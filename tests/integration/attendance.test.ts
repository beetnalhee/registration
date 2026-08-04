import pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetSchema } from './support/schema.js';

/**
 * 리셉션 출석 체크 통합 테스트 — 실제 PostgreSQL 이 필요하다.
 * 실행 방법은 tests/integration/concurrency.test.ts 주석 참고.
 */
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

const ADMIN_EMAIL = 'admin@example.com';

describe.skipIf(!TEST_DATABASE_URL)('출석 체크', () => {
  let pool: pg.Pool;
  let services: {
    submitApplication: typeof import('../../server/services/applicationService.js').submitApplication;
    attendance: typeof import('../../server/services/admin/attendanceService.js');
    mutations: typeof import('../../server/services/admin/participantMutationService.js');
    overview: typeof import('../../server/services/admin/overviewService.js');
    queries: typeof import('../../server/services/admin/participantQueryService.js');
  };

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DATABASE_URL;
    process.env.SUPABASE_URL = 'http://localhost:54321';
    process.env.SUPABASE_ANON_KEY = 'test-anon-key';
    process.env.NODE_ENV = 'test';
    delete process.env.GMAIL_USER;
    delete process.env.GMAIL_APP_PASSWORD;

    pg.types.setTypeParser(1082, (value) => value);
    pool = new pg.Pool({ connectionString: TEST_DATABASE_URL, max: 10 });

    await resetSchema(pool);

    services = {
      submitApplication: (await import('../../server/services/applicationService.js'))
        .submitApplication,
      attendance: await import('../../server/services/admin/attendanceService.js'),
      mutations: await import('../../server/services/admin/participantMutationService.js'),
      overview: await import('../../server/services/admin/overviewService.js'),
      queries: await import('../../server/services/admin/participantQueryService.js'),
    };
  }, 60_000);

  afterAll(async () => {
    const { closePool } = await import('../../server/db/pool.js');
    await closePool();
    await pool?.end();
  });

  beforeEach(async () => {
    // audit_logs.participant_id 는 on delete set null 이라 참가자를 지워도 남는다.
    // 테스트 간 격리를 위해 함께 비운다.
    await pool.query('delete from audit_logs');
    await pool.query('delete from participants');
    await pool.query('update round_capacity set filled_count = 0, capacity = 20');
    await pool.query('update group_tally set active_count = 0, seq_counter = 0');
    await pool.query(
      `update event_settings set is_open = true, event_date = date '2026-08-15'`,
    );
  });

  const apply = (index: number, overrides: { roundNo?: number } = {}) =>
    services.submitApplication({
      name: `참가자${index}`,
      nickname: `닉${index}`,
      birthdate: '2001-05-14',
      gender: 'F',
      phone: `010${String(30_000_000 + index).padStart(8, '0')}`,
      email: `guest${index}@example.com`,
      roundNo: overrides.roundNo ?? 1,
    });

  const idOf = async (index: number): Promise<string> => {
    const { rows } = await pool.query<{ id: string }>(
      'select id from participants where email = $1',
      [`guest${index}@example.com`],
    );
    return rows[0]?.id as string;
  };

  it('출석 처리하면 시각이 기록된다', async () => {
    await apply(1);
    const id = await idOf(1);

    const result = await services.attendance.checkInParticipant({
      adminEmail: ADMIN_EMAIL,
      participantId: id,
    });

    expect(result.checkedInAt).not.toBeNull();
  });

  it('중복으로 눌러도 첫 도착 시각이 유지된다', async () => {
    await apply(1);
    const id = await idOf(1);

    const first = await services.attendance.checkInParticipant({
      adminEmail: ADMIN_EMAIL,
      participantId: id,
    });
    const second = await services.attendance.checkInParticipant({
      adminEmail: ADMIN_EMAIL,
      participantId: id,
    });

    expect(second.checkedInAt).toBe(first.checkedInAt);
    // ISO 8601 문자열로 정규화되어 나온다 (Date 객체가 아니다)
    expect(first.checkedInAt).toMatch(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/);
  });

  it('되돌리면 출석 기록이 사라진다', async () => {
    await apply(1);
    const id = await idOf(1);

    await services.attendance.checkInParticipant({ adminEmail: ADMIN_EMAIL, participantId: id });
    const undone = await services.attendance.undoCheckInParticipant({
      adminEmail: ADMIN_EMAIL,
      participantId: id,
    });

    expect(undone.checkedInAt).toBeNull();
  });

  it('출석하지 않은 사람을 되돌리려 하면 거절한다', async () => {
    await apply(1);

    await expect(
      services.attendance.undoCheckInParticipant({
        adminEmail: ADMIN_EMAIL,
        participantId: await idOf(1),
      }),
    ).rejects.toThrow(/출석 처리되지 않은/);
  });

  it('대기자는 출석 처리할 수 없다', async () => {
    await pool.query('update round_capacity set capacity = 1');
    await apply(1);
    await apply(2);
    await apply(3);
    const waiting = await apply(4);
    expect(waiting.status).toBe('waitlisted');

    await expect(
      services.attendance.checkInParticipant({
        adminEmail: ADMIN_EMAIL,
        participantId: await idOf(4),
      }),
    ).rejects.toThrow(/대기자/);
  });

  it('취소된 사람은 출석 처리할 수 없다', async () => {
    await apply(1);
    const id = await idOf(1);
    await services.mutations.cancelParticipant({ adminEmail: ADMIN_EMAIL, participantId: id });

    await expect(
      services.attendance.checkInParticipant({ adminEmail: ADMIN_EMAIL, participantId: id }),
    ).rejects.toThrow(/취소된/);
  });

  it('출석한 사람을 취소하면 출석 기록도 함께 지워진다', async () => {
    await apply(1);
    const id = await idOf(1);
    await services.attendance.checkInParticipant({ adminEmail: ADMIN_EMAIL, participantId: id });

    await services.mutations.cancelParticipant({ adminEmail: ADMIN_EMAIL, participantId: id });

    const { rows } = await pool.query<{ checked_in_at: string | null }>(
      'select checked_in_at from participants where id = $1',
      [id],
    );
    // 참석하지 않는 사람이 출석으로 남으면 노쇼 집계가 틀어진다.
    expect(rows[0]?.checked_in_at).toBeNull();
  });

  it('회차를 옮겨도 출석 기록은 유지된다 (이미 현장에 있는 사람이다)', async () => {
    await apply(1);
    const id = await idOf(1);
    await services.attendance.checkInParticipant({ adminEmail: ADMIN_EMAIL, participantId: id });

    const moved = await services.mutations.reassignParticipant({
      adminEmail: ADMIN_EMAIL,
      participantId: id,
      roundNo: 3,
    });

    expect(moved.roundNo).toBe(3);
    expect(moved.checkedInAt).not.toBeNull();
  });

  it('현황판이 회차별 출석 수를 집계한다', async () => {
    await apply(1, { roundNo: 1 });
    await apply(2, { roundNo: 1 });
    await apply(3, { roundNo: 2 });

    await services.attendance.checkInParticipant({
      adminEmail: ADMIN_EMAIL,
      participantId: await idOf(1),
    });

    const overview = await services.overview.getAdminOverview(pool);
    const first = overview.rounds.find((round) => round.roundNo === 1);

    expect(first?.attendance).toEqual({ checkedIn: 1, assigned: 2 });
  });

  it('미도착자만 필터링할 수 있다', async () => {
    await apply(1);
    await apply(2);
    await services.attendance.checkInParticipant({
      adminEmail: ADMIN_EMAIL,
      participantId: await idOf(1),
    });

    const pending = await services.queries.listParticipants(pool, {
      status: 'assigned',
      checkedIn: false,
      page: 1,
      pageSize: 50,
    });
    const arrived = await services.queries.listParticipants(pool, {
      status: 'assigned',
      checkedIn: true,
      page: 1,
      pageSize: 50,
    });

    expect(pending.items.map((item) => item.nickname)).toEqual(['닉2']);
    expect(arrived.items.map((item) => item.nickname)).toEqual(['닉1']);
  });

  it('CSV 에 출석 여부가 포함된다', async () => {
    await apply(1);
    await services.attendance.checkInParticipant({
      adminEmail: ADMIN_EMAIL,
      participantId: await idOf(1),
    });

    const csv = await services.queries.buildParticipantsCsv(pool);

    expect(csv).toContain('출석');
    expect(csv.split('\r\n')[1]).toContain('"O"');
  });

  it('출석 처리가 감사 로그에 남는다', async () => {
    await apply(1);
    const id = await idOf(1);
    await services.attendance.checkInParticipant({ adminEmail: ADMIN_EMAIL, participantId: id });
    await services.attendance.undoCheckInParticipant({ adminEmail: ADMIN_EMAIL, participantId: id });

    const { rows } = await pool.query<{ action: string }>(
      'select action from audit_logs order by created_at',
    );

    expect(rows.map((row) => row.action)).toEqual(['check_in', 'undo_check_in']);
  });
});

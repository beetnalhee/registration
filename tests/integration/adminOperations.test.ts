import pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetSchema } from './support/schema.js';

/**
 * 관리자 조작 통합 테스트 — 실제 PostgreSQL 이 필요하다.
 * 실행 방법은 tests/integration/concurrency.test.ts 주석 참고.
 */
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

const ADMIN_EMAIL = 'admin@example.com';

describe.skipIf(!TEST_DATABASE_URL)('관리자 조작', () => {
  let pool: pg.Pool;
  let services: {
    submitApplication: typeof import('../../server/services/applicationService.js').submitApplication;
    lookupAssignment: typeof import('../../server/services/lookupService.js').lookupAssignment;
    mutations: typeof import('../../server/services/admin/participantMutationService.js');
    overview: typeof import('../../server/services/admin/overviewService.js');
    queries: typeof import('../../server/services/admin/participantQueryService.js');
    availability: typeof import('../../server/services/availabilityService.js');
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
      lookupAssignment: (await import('../../server/services/lookupService.js')).lookupAssignment,
      mutations: await import('../../server/services/admin/participantMutationService.js'),
      overview: await import('../../server/services/admin/overviewService.js'),
      queries: await import('../../server/services/admin/participantQueryService.js'),
      availability: await import('../../server/services/availabilityService.js'),
    };
  }, 60_000);

  afterAll(async () => {
    const { closePool } = await import('../../server/db/pool.js');
    await closePool();
    await pool?.end();
  });

  beforeEach(async () => {
    await pool.query('delete from participants');
    await pool.query('update round_slots set active_count = 0, seq_counter = 0, capacity = 10');
    await pool.query(
      `update event_settings set is_open = true, near_full_threshold = 0.8, event_date = date '2026-08-15'`,
    );
  });

  const apply = (
    overrides: Partial<{
      index: number;
      gender: 'M' | 'F';
      birthdate: string;
      roundNo: number;
    }> = {},
  ) => {
    const index = overrides.index ?? 1;
    return services.submitApplication({
      name: `참가자${index}`,
      // 만 22세 = SUMMER 고정. 경계 연령(24~27)을 쓰면 기본 그룹이 차도
      // 반대 그룹으로 넘어가 정원 테스트가 모호해진다.
      birthdate: overrides.birthdate ?? '2004-05-14',
      gender: overrides.gender ?? 'F',
      phone: `010${String(20_000_000 + index).padStart(8, '0')}`,
      email: `member${index}@example.com`,
      roundNo: overrides.roundNo ?? 1,
    });
  };

  const idOf = async (index: number): Promise<string> => {
    const { rows } = await pool.query<{ id: string }>(
      'select id from participants where email = $1',
      [`member${index}@example.com`],
    );
    return rows[0]?.id as string;
  };

  it('만나이로 그룹이 결정된다 (2004년생 → SUMMER, 1995년생 → NIGHT)', async () => {
    const young = await apply({ index: 1, birthdate: '2004-05-14' });
    const older = await apply({ index: 2, birthdate: '1995-05-14' });

    expect(young.groupCode).toBe('SUMMER');
    expect(older.groupCode).toBe('NIGHT');
  });

  it('참가번호는 그룹-회차-성별-순번 형식으로 발급된다', async () => {
    const first = await apply({ index: 1, gender: 'F' });
    const second = await apply({ index: 2, gender: 'F' });

    expect(first.participantCode).toBe('SUMMER-1-F-001');
    expect(second.participantCode).toBe('SUMMER-1-F-002');
  });

  it('회차를 변경하면 참가번호가 재발급되고 좌석이 이동한다', async () => {
    const before = await apply({ index: 1 });
    expect(before.roundNo).toBe(1);

    const updated = await services.mutations.reassignParticipant({
      adminEmail: ADMIN_EMAIL,
      participantId: await idOf(1),
      roundNo: 3,
    });

    expect(updated.roundNo).toBe(3);
    expect(updated.participantCode).toBe('SUMMER-3-F-001');

    const { rows } = await pool.query<{ round_no: number; active_count: number }>(
      `select r.round_no, s.active_count
         from round_slots s join rounds r on r.id = s.round_id
        where s.gender = 'F' and s.group_code = 'SUMMER' order by r.round_no`,
    );
    expect(rows.map((row) => row.active_count)).toEqual([0, 0, 1]);
  });

  it('그룹을 변경하면 새 그룹 기준으로 참가번호가 바뀐다', async () => {
    await apply({ index: 1 });

    const updated = await services.mutations.reassignParticipant({
      adminEmail: ADMIN_EMAIL,
      participantId: await idOf(1),
      groupCode: 'NIGHT',
    });

    expect(updated.groupCode).toBe('NIGHT');
    expect(updated.participantCode).toBe('NIGHT-1-F-001');
    expect(updated.isGroupOverridden).toBe(true);
  });

  it('정원이 찬 회차로는 변경할 수 없다', async () => {
    await pool.query(
      `update round_slots set capacity = 1
        where round_id = (select id from rounds where round_no = 2)`,
    );

    await apply({ index: 1, roundNo: 1 });
    await apply({ index: 2, roundNo: 2 });

    await expect(
      services.mutations.reassignParticipant({
        adminEmail: ADMIN_EMAIL,
        participantId: await idOf(1),
        roundNo: 2,
      }),
    ).rejects.toThrow(/마감/);
  });

  it('정원이 차면 신청이 거절된다 (대기자로 만들지 않는다)', async () => {
    await pool.query('update round_slots set capacity = 1');

    await apply({ index: 1, roundNo: 1 });

    // 2·3회차와 다른 그룹에 자리가 남아 있어도 넘기지 않는다.
    await expect(apply({ index: 2, roundNo: 1 })).rejects.toThrow(/마감/);

    const { rows } = await pool.query<{ count: string }>('select count(*) from participants');
    expect(Number(rows[0]?.count)).toBe(1);
  });

  it('취소로 자리가 열리면 다음 사람이 신청할 수 있다', async () => {
    await pool.query('update round_slots set capacity = 1');

    await apply({ index: 1, roundNo: 1 });
    await expect(apply({ index: 2, roundNo: 1 })).rejects.toThrow(/마감/);

    await services.mutations.cancelParticipant({
      adminEmail: ADMIN_EMAIL,
      participantId: await idOf(1),
    });

    const second = await apply({ index: 2, roundNo: 1 });
    // 취소된 번호는 재사용되지 않는다.
    expect(second.participantCode).toBe('SUMMER-1-F-002');
  });

  it('취소된 참가번호는 재사용되지 않는다', async () => {
    const first = await apply({ index: 1 });
    expect(first.participantCode).toBe('SUMMER-1-F-001');

    await services.mutations.cancelParticipant({
      adminEmail: ADMIN_EMAIL,
      participantId: await idOf(1),
    });

    const second = await apply({ index: 2 });
    expect(second.participantCode).toBe('SUMMER-1-F-002');
  });

  it('취소 후 같은 사람이 다시 신청할 수 있다', async () => {
    await apply({ index: 1 });
    await services.mutations.cancelParticipant({
      adminEmail: ADMIN_EMAIL,
      participantId: await idOf(1),
    });

    // 이메일·연락처 유니크 인덱스는 취소 건을 제외하므로 재신청이 가능하다.
    await expect(apply({ index: 1 })).resolves.toMatchObject({ roundNo: 1 });
  });

  it('조회는 이메일 + 전화 뒤 4자리로 본인을 찾고 실명을 보여준다', async () => {
    await apply({ index: 7, birthdate: '2004-05-14' });

    const result = await services.lookupAssignment({
      email: 'member7@example.com',
      phoneLast4: String(20_000_007).slice(-4),
    });

    expect(result.participantCode).toBe('SUMMER-1-F-001');
    expect(result.name).toBe('참가자7');
  });

  it('조회 키가 틀리면 아무 정보도 주지 않는다', async () => {
    await apply({ index: 8, birthdate: '2001-05-14' });

    await expect(
      services.lookupAssignment({ email: 'member8@example.com', phoneLast4: '0000' }),
    ).rejects.toThrow(/찾을 수 없|없어요/);
  });

  it('참가자용 회차 상태에는 인원수가 담기지 않는다', async () => {
    await apply({ index: 1 });

    const statuses = await services.availability.getRoundAvailabilities(pool, { gender: 'F', birthdate: '2004-05-14' });
    const serialized = JSON.stringify(statuses);

    expect(Object.keys(statuses[0] ?? {})).toEqual(['roundNo', 'availability']);
    expect(serialized).not.toMatch(/filled|capacity|remaining|count|bridge/i);
  });

  it('마감 임박 기준을 바꾸면 참가자에게 보이는 상태가 바뀐다', async () => {
    await pool.query('update round_slots set capacity = 10');
    for (let index = 1; index <= 5; index += 1) {
      await apply({ index, roundNo: 1 });
    }

    const before = await services.availability.getRoundAvailabilities(pool, { gender: 'F', birthdate: '2004-05-14' });
    expect(before[0]?.availability).toBe('open');

    await pool.query('update event_settings set near_full_threshold = 0.5');

    const after = await services.availability.getRoundAvailabilities(pool, { gender: 'F', birthdate: '2004-05-14' });
    expect(after[0]?.availability).toBe('near_full');
  });

  it('접수를 중단하면 모든 회차가 마감으로 표시되고 신청이 거절된다', async () => {
    await pool.query('update event_settings set is_open = false');

    const statuses = await services.availability.getRoundAvailabilities(pool, { gender: 'F', birthdate: '2004-05-14' });
    expect(statuses.every((item) => item.availability === 'closed')).toBe(true);

    await expect(apply({ index: 1 })).rejects.toThrow(/받고 있지 않/);
  });

  it('참가 가능 연령을 벗어나면 내부 규칙을 노출하지 않고 거절한다', async () => {
    await expect(apply({ index: 1, birthdate: '2015-01-01' })).rejects.toThrow(/만 18세/);
    await expect(apply({ index: 2, birthdate: '1970-01-01' })).rejects.toThrow(/만 35세/);

    await apply({ index: 3, birthdate: '2015-01-01' }).catch((error: Error) => {
      expect(error.message.toLowerCase()).not.toContain('bridge');
    });
  });

  it('관리자 현황판은 실제 인원수와 그룹 구성을 보여준다', async () => {
    await apply({ index: 1, gender: 'F', birthdate: '2004-05-14' });
    await apply({ index: 2, gender: 'M', birthdate: '1995-05-14' });

    const overview = await services.overview.getAdminOverview(pool);
    const first = overview.rounds[0];

    expect(overview.totalAssigned).toBe(2);
    expect(first?.female.filled).toBe(1);
    expect(first?.male.filled).toBe(1);
    // 그룹별 10명 × 2그룹 = 성별당 20명
    expect(first?.male.capacity).toBe(20);
    expect(first?.groups.find((group) => group.groupCode === 'SUMMER')?.female.filled).toBe(1);
    expect(first?.groups.find((group) => group.groupCode === 'SUMMER')?.female.capacity).toBe(10);
    expect(first?.groups.find((group) => group.groupCode === 'NIGHT')?.male.filled).toBe(1);
  });

  it('CSV 에는 헤더와 참가자 정보가 담긴다', async () => {
    await apply({ index: 1 });

    const csv = await services.queries.buildParticipantsCsv(pool);

    expect(csv).toContain('참가번호');
    expect(csv).toContain('SUMMER-1-F-001');
    expect(csv).toContain('member1@example.com');
    // 엑셀 한글 깨짐 방지용 BOM
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it('관리자 변경은 감사 로그에 남는다', async () => {
    await apply({ index: 1 });
    await services.mutations.reassignParticipant({
      adminEmail: ADMIN_EMAIL,
      participantId: await idOf(1),
      roundNo: 2,
      reason: '본인 요청',
    });

    const { rows } = await pool.query<{ action: string; admin_email: string; after_state: unknown }>(
      'select action, admin_email, after_state from audit_logs order by created_at desc limit 1',
    );

    expect(rows[0]?.action).toBe('reassign');
    expect(rows[0]?.admin_email).toBe(ADMIN_EMAIL);
    expect(JSON.stringify(rows[0]?.after_state)).toContain('본인 요청');
  });
});

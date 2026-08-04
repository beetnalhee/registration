import pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetSchema } from './support/schema.js';

/**
 * 본인 취소 통합 테스트 — 실제 PostgreSQL 이 필요하다.
 * 실행 방법은 tests/integration/concurrency.test.ts 주석 참고.
 */
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

describe.skipIf(!TEST_DATABASE_URL)('본인 취소', () => {
  let pool: pg.Pool;
  let services: {
    submitApplication: typeof import('../../server/services/applicationService.js').submitApplication;
    selfCancel: typeof import('../../server/services/selfCancelService.js');
    lookup: typeof import('../../server/services/lookupService.js');
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
      selfCancel: await import('../../server/services/selfCancelService.js'),
      lookup: await import('../../server/services/lookupService.js'),
    };
  }, 60_000);

  afterAll(async () => {
    const { closePool } = await import('../../server/db/pool.js');
    await closePool();
    await pool?.end();
  });

  beforeEach(async () => {
    await pool.query('delete from audit_logs');
    await pool.query('delete from participants');
    await pool.query('update round_capacity set filled_count = 0, capacity = 20');
    await pool.query('update group_tally set active_count = 0, seq_counter = 0');
    await pool.query(
      `update event_settings set is_open = true, event_date = date '2026-08-15'`,
    );
  });

  const emailOf = (index: number) => `guest${index}@example.com`;
  const last4Of = (index: number) => String(40_000_000 + index).slice(-4);

  const apply = (index: number, roundNo = 1) =>
    services.submitApplication({
      name: `참가자${index}`,
      nickname: `닉${index}`,
      birthdate: '2001-05-14',
      gender: 'F',
      phone: `010${String(40_000_000 + index).padStart(8, '0')}`,
      email: emailOf(index),
      roundNo,
    });

  const credentials = (index: number) => ({
    email: emailOf(index),
    phoneLast4: last4Of(index),
  });

  const filledCount = async (roundNo: number): Promise<number> => {
    const { rows } = await pool.query<{ filled_count: number }>(
      `select rc.filled_count
         from round_capacity rc join rounds r on r.id = rc.round_id
        where r.round_no = $1 and rc.gender = 'F'`,
      [roundNo],
    );
    return rows[0]?.filled_count ?? -1;
  };

  it('이메일 + 전화 뒤 4자리로 본인 신청을 취소한다', async () => {
    await apply(1);

    const result = await services.selfCancel.cancelOwnApplication(credentials(1));

    expect(result).toEqual({ nickname: '닉1' });

    const { rows } = await pool.query<{ status: string }>(
      'select status from participants where email = $1',
      [emailOf(1)],
    );
    expect(rows[0]?.status).toBe('cancelled');
  });

  it('취소하면 좌석이 즉시 반납된다', async () => {
    await apply(1);
    expect(await filledCount(1)).toBe(1);

    await services.selfCancel.cancelOwnApplication(credentials(1));

    expect(await filledCount(1)).toBe(0);
  });

  it('응답에 내부 운영 정보가 담기지 않는다', async () => {
    await apply(1);

    const result = await services.selfCancel.cancelOwnApplication(credentials(1));

    // 관리자용 DTO 를 그대로 돌려주면 나이·기본그룹·Bridge Zone 이 새어나간다.
    expect(Object.keys(result)).toEqual(['nickname']);
    expect(JSON.stringify(result).toLowerCase()).not.toContain('bridge');
  });

  it('전화 뒤 4자리가 틀리면 취소되지 않는다', async () => {
    await apply(1);

    await expect(
      services.selfCancel.cancelOwnApplication({ email: emailOf(1), phoneLast4: '0000' }),
    ).rejects.toThrow(/찾을 수 없|없어요/);

    const { rows } = await pool.query<{ status: string }>(
      'select status from participants where email = $1',
      [emailOf(1)],
    );
    expect(rows[0]?.status).toBe('assigned');
  });

  it('이메일이 틀리면 취소되지 않는다', async () => {
    await apply(1);

    await expect(
      services.selfCancel.cancelOwnApplication({
        email: 'someone-else@example.com',
        phoneLast4: last4Of(1),
      }),
    ).rejects.toThrow(/찾을 수 없|없어요/);
  });

  it('접수가 마감되면 직접 취소할 수 없고 운영진 문의로 안내한다', async () => {
    await apply(1);
    await pool.query('update event_settings set is_open = false');

    await expect(services.selfCancel.cancelOwnApplication(credentials(1))).rejects.toThrow(
      /운영진에게 문의/,
    );
  });

  it('이미 취소된 신청은 다시 취소할 수 없다', async () => {
    await apply(1);
    await services.selfCancel.cancelOwnApplication(credentials(1));

    // 취소된 건은 조회 키로 찾히지 않으므로 '내역 없음' 으로 응답한다.
    await expect(services.selfCancel.cancelOwnApplication(credentials(1))).rejects.toThrow(
      /찾을 수 없|없어요/,
    );
  });

  it('취소 후 같은 사람이 다시 신청할 수 있다', async () => {
    await apply(1);
    await services.selfCancel.cancelOwnApplication(credentials(1));

    const again = await apply(1);
    expect(again.status).toBe('assigned');
    // 취소된 번호는 재사용되지 않는다.
    expect(again.participantCode).toBe('SUMMER-1-F-002');
  });

  it('대기자도 스스로 취소할 수 있다', async () => {
    await pool.query('update round_capacity set capacity = 1');
    await apply(1);
    const waiting = await apply(2);
    expect(waiting.status).toBe('waitlisted');

    await services.selfCancel.cancelOwnApplication(credentials(2));

    const { rows } = await pool.query<{ status: string }>(
      'select status from participants where email = $1',
      [emailOf(2)],
    );
    expect(rows[0]?.status).toBe('cancelled');
    // 대기자는 좌석을 점유하지 않았으므로 정원은 그대로다.
    expect(await filledCount(1)).toBe(1);
  });

  it('감사 로그에 본인 취소임이 남는다', async () => {
    await apply(1);
    await services.selfCancel.cancelOwnApplication(credentials(1));

    const { rows } = await pool.query<{ action: string; admin_email: string }>(
      'select action, admin_email from audit_logs order by created_at desc limit 1',
    );

    expect(rows[0]?.action).toBe('cancel');
    // 관리자 취소와 구분되어야 한다.
    expect(rows[0]?.admin_email).toBe(services.selfCancel.SELF_SERVICE_ACTOR);
  });

  it('조회도 같은 자격증명으로 동작한다', async () => {
    await apply(1);

    const result = await services.lookup.lookupAssignment(credentials(1));

    expect(result.participantCode).toBe('SUMMER-1-F-001');
    expect(result.maskedName).toBe('참○○○');
  });
});

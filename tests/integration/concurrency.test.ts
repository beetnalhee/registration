import pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetSchema } from './support/schema.js';

/**
 * 동시 신청 통합 테스트 — 실제 PostgreSQL 이 필요하다.
 *
 * TEST_DATABASE_URL 이 없으면 전체를 건너뛴다.
 * ⚠️ 이 테스트는 participants 표를 비우므로 절대 운영 DB 를 가리키게 하지 말 것.
 *    그래서 DATABASE_URL 이 아닌 별도 변수를 요구한다.
 *
 * 실행:
 *   docker run --rm -d -p 55432:5432 -e POSTGRES_PASSWORD=postgres --name midsummer-test postgres:16
 *   TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:55432/postgres npm test
 */
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

describe.skipIf(!TEST_DATABASE_URL)('동시 신청 처리', () => {
  let pool: pg.Pool;
  let submitApplication: typeof import('../../server/services/applicationService.js').submitApplication;

  beforeAll(async () => {
    // 서버 모듈이 loadEnv() 로 검증하는 값들을 테스트용으로 채운다.
    process.env.DATABASE_URL = TEST_DATABASE_URL;
    process.env.SUPABASE_URL = 'http://localhost:54321';
    process.env.SUPABASE_ANON_KEY = 'test-anon-key';
    process.env.NODE_ENV = 'test';
    delete process.env.GMAIL_USER;
    delete process.env.GMAIL_APP_PASSWORD;

    pg.types.setTypeParser(1082, (value) => value);
    pool = new pg.Pool({ connectionString: TEST_DATABASE_URL, max: 20 });

    // 매 실행마다 깨끗한 스키마에서 시작한다(모든 마이그레이션 적용).
    await resetSchema(pool);

    ({ submitApplication } = await import('../../server/services/applicationService.js'));
  }, 60_000);

  afterAll(async () => {
    const { closePool } = await import('../../server/db/pool.js');
    await closePool();
    await pool?.end();
  });

  beforeEach(async () => {
    await pool.query('delete from audit_logs');
    await pool.query('delete from participants');
    await pool.query('update round_capacity set filled_count = 0');
    await pool.query('update group_tally set active_count = 0, seq_counter = 0');
    await pool.query('update round_capacity set capacity = 20');
    await pool.query('update event_settings set is_open = true');
  });

  const applicant = (index: number, gender: 'M' | 'F', roundNo = 1, age = 22) => {
    const birthYear = new Date().getFullYear() - age;
    return {
      name: `참가자${index}`,
      nickname: `닉${index}`,
      birthdate: `${birthYear}-01-01`,
      gender,
      phone: `010${String(10_000_000 + index).padStart(8, '0')}`,
      email: `applicant${index}@example.com`,
      roundNo,
    };
  };

  const filledCount = async (roundNo: number, gender: 'M' | 'F'): Promise<number> => {
    const { rows } = await pool.query<{ filled_count: number }>(
      `select rc.filled_count
         from round_capacity rc join rounds r on r.id = rc.round_id
        where r.round_no = $1 and rc.gender = $2`,
      [roundNo, gender],
    );
    return rows[0]?.filled_count ?? -1;
  };

  it('40명이 동시에 같은 회차를 신청하면 정확히 20명만 배정된다', async () => {
    const results = await Promise.all(
      Array.from({ length: 40 }, (_, index) => submitApplication(applicant(index, 'M', 1))),
    );

    const assigned = results.filter((result) => result.status === 'assigned');
    const waitlisted = results.filter((result) => result.status === 'waitlisted');

    expect(assigned).toHaveLength(20);
    expect(waitlisted).toHaveLength(20);
    expect(await filledCount(1, 'M')).toBe(20);

    // ★ 선착순이므로 초과분이 다른 회차로 넘어가지 않는다.
    expect(await filledCount(2, 'M')).toBe(0);
    expect(await filledCount(3, 'M')).toBe(0);

    // 배정된 사람의 참가번호는 중복 없이 발급된다.
    const codes = assigned.map((result) => result.participantCode);
    expect(new Set(codes).size).toBe(20);

    // 대기자는 자신이 기다리는 회차를 안다.
    expect(waitlisted.every((result) => result.waitingForRoundNo === 1)).toBe(true);
  }, 60_000);

  it('서로 다른 회차를 동시에 신청하면 회차별로 독립적으로 채워진다', async () => {
    await pool.query('update round_capacity set capacity = 3');

    const results = await Promise.all([
      ...Array.from({ length: 5 }, (_, index) => submitApplication(applicant(index, 'F', 1))),
      ...Array.from({ length: 5 }, (_, index) => submitApplication(applicant(100 + index, 'F', 2))),
      ...Array.from({ length: 5 }, (_, index) => submitApplication(applicant(200 + index, 'F', 3))),
    ]);

    expect(results.filter((result) => result.status === 'assigned')).toHaveLength(9);
    expect(results.filter((result) => result.status === 'waitlisted')).toHaveLength(6);

    for (const roundNo of [1, 2, 3]) {
      expect(await filledCount(roundNo, 'F')).toBe(3);
    }
  }, 60_000);

  it('남녀 정원은 독립적이다', async () => {
    await pool.query('update round_capacity set capacity = 3');

    const results = await Promise.all([
      ...Array.from({ length: 6 }, (_, index) => submitApplication(applicant(index, 'M', 1))),
      ...Array.from({ length: 6 }, (_, index) => submitApplication(applicant(100 + index, 'F', 1))),
    ]);

    expect(results.filter((result) => result.status === 'assigned')).toHaveLength(6);
    expect(await filledCount(1, 'M')).toBe(3);
    expect(await filledCount(1, 'F')).toBe(3);
  }, 60_000);

  it('같은 이메일로 두 번 신청하면 한 건만 접수된다', async () => {
    const duplicate = { ...applicant(500, 'M', 1), email: 'dup@example.com' };

    const settled = await Promise.allSettled([
      submitApplication(duplicate),
      submitApplication({ ...duplicate, phone: '01099998888' }),
    ]);

    expect(settled.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(settled.filter((result) => result.status === 'rejected')).toHaveLength(1);

    const { rows } = await pool.query<{ count: string }>('select count(*) from participants');
    expect(Number(rows[0]?.count)).toBe(1);
  }, 60_000);

  it('취소하면 좌석이 반납되어 다음 사람이 들어갈 수 있다', async () => {
    await pool.query('update round_capacity set capacity = 1');

    const first = await submitApplication(applicant(600, 'M', 1));
    expect(first.status).toBe('assigned');

    const { rows } = await pool.query<{ id: string }>(
      `select id from participants where email = $1`,
      [applicant(600, 'M', 1).email],
    );
    const participantId = rows[0]?.id as string;

    const { cancelParticipant } = await import(
      '../../server/services/admin/participantMutationService.js'
    );
    await cancelParticipant({ adminEmail: 'test@example.com', participantId });

    expect(await filledCount(1, 'M')).toBe(0);

    const second = await submitApplication(applicant(601, 'M', 1));
    expect(second.status).toBe('assigned');
    expect(await filledCount(1, 'M')).toBe(1);
  }, 60_000);
});

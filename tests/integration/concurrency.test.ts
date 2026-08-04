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

/** (회차, 그룹, 성별) 기본 정원 */
const CAPACITY = 10;

describe.skipIf(!TEST_DATABASE_URL)('동시 신청 처리', () => {
  let pool: pg.Pool;
  let submitApplication: typeof import('../../server/services/applicationService.js').submitApplication;

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DATABASE_URL;
    process.env.SUPABASE_URL = 'http://localhost:54321';
    process.env.SUPABASE_ANON_KEY = 'test-anon-key';
    process.env.NODE_ENV = 'test';
    delete process.env.GMAIL_USER;
    delete process.env.GMAIL_APP_PASSWORD;

    pg.types.setTypeParser(1082, (value) => value);
    pool = new pg.Pool({ connectionString: TEST_DATABASE_URL, max: 20 });

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
    await pool.query(
      `update round_slots set active_count = 0, seq_counter = 0, capacity = ${CAPACITY}`,
    );
    await pool.query(
      `update event_settings set is_open = true, event_date = date '2026-08-15'`,
    );
  });

  /**
   * @param age 22 → SUMMER, 30 → NIGHT, 25 → 경계(SUMMER 기본, NIGHT 가능)
   */
  const applicant = (index: number, gender: 'M' | 'F', roundNo = 1, age = 22) => ({
    name: `참가자${index}`,
    nickname: `닉${index}`,
    birthdate: `${2026 - age}-01-01`,
    gender,
    phone: `010${String(10_000_000 + index).padStart(8, '0')}`,
    email: `applicant${index}@example.com`,
    roundNo,
  });

  const filledCount = async (
    roundNo: number,
    groupCode: 'SUMMER' | 'NIGHT',
    gender: 'M' | 'F',
  ): Promise<number> => {
    const { rows } = await pool.query<{ active_count: number }>(
      `select s.active_count
         from round_slots s join rounds r on r.id = s.round_id
        where r.round_no = $1 and s.group_code = $2 and s.gender = $3`,
      [roundNo, groupCode, gender],
    );
    return rows[0]?.active_count ?? -1;
  };

  it('20명이 동시에 같은 그룹·성별·회차를 신청하면 정확히 10명만 배정된다', async () => {
    const settled = await Promise.allSettled(
      Array.from({ length: 20 }, (_, index) =>
        submitApplication(applicant(index, 'F', 1, 22)),
      ),
    );

    const assigned = settled.filter((result) => result.status === 'fulfilled');
    const rejected = settled.filter((result) => result.status === 'rejected');

    expect(assigned).toHaveLength(CAPACITY);
    expect(rejected).toHaveLength(CAPACITY);
    expect(await filledCount(1, 'SUMMER', 'F')).toBe(CAPACITY);

    // ★ 선착순·대기자 없음이므로 초과분이 다른 회차나 그룹으로 넘어가지 않는다.
    expect(await filledCount(2, 'SUMMER', 'F')).toBe(0);
    expect(await filledCount(1, 'NIGHT', 'F')).toBe(0);

    // 참가번호는 중복 없이 발급된다.
    const codes = assigned.map(
      (result) => (result as PromiseFulfilledResult<{ participantCode: string }>).value.participantCode,
    );
    expect(new Set(codes).size).toBe(CAPACITY);
  }, 60_000);

  it('그룹·성별이 다르면 서로 잠식하지 않는다', async () => {
    const settled = await Promise.allSettled([
      ...Array.from({ length: 5 }, (_, i) => submitApplication(applicant(i, 'F', 1, 22))),
      ...Array.from({ length: 5 }, (_, i) => submitApplication(applicant(100 + i, 'M', 1, 22))),
      ...Array.from({ length: 5 }, (_, i) => submitApplication(applicant(200 + i, 'F', 1, 30))),
      ...Array.from({ length: 5 }, (_, i) => submitApplication(applicant(300 + i, 'M', 1, 30))),
    ]);

    expect(settled.filter((result) => result.status === 'fulfilled')).toHaveLength(20);
    expect(await filledCount(1, 'SUMMER', 'F')).toBe(5);
    expect(await filledCount(1, 'SUMMER', 'M')).toBe(5);
    expect(await filledCount(1, 'NIGHT', 'F')).toBe(5);
    expect(await filledCount(1, 'NIGHT', 'M')).toBe(5);
  }, 60_000);

  it('경계 연령은 기본 그룹이 차면 반대 그룹으로 들어간다', async () => {
    // 22세 여성 10명이 SUMMER 를 채운 뒤 25세(경계) 여성 5명이 동시에 신청한다.
    await Promise.all(
      Array.from({ length: CAPACITY }, (_, i) => submitApplication(applicant(i, 'F', 1, 22))),
    );

    const settled = await Promise.allSettled(
      Array.from({ length: 5 }, (_, i) => submitApplication(applicant(500 + i, 'F', 1, 25))),
    );

    expect(settled.filter((result) => result.status === 'fulfilled')).toHaveLength(5);
    expect(await filledCount(1, 'SUMMER', 'F')).toBe(CAPACITY);
    expect(await filledCount(1, 'NIGHT', 'F')).toBe(5);
  }, 60_000);

  it('회차별로 독립적으로 채워진다', async () => {
    await pool.query('update round_slots set capacity = 3');

    const settled = await Promise.allSettled([
      ...Array.from({ length: 5 }, (_, i) => submitApplication(applicant(i, 'F', 1, 22))),
      ...Array.from({ length: 5 }, (_, i) => submitApplication(applicant(100 + i, 'F', 2, 22))),
      ...Array.from({ length: 5 }, (_, i) => submitApplication(applicant(200 + i, 'F', 3, 22))),
    ]);

    expect(settled.filter((result) => result.status === 'fulfilled')).toHaveLength(9);

    for (const roundNo of [1, 2, 3]) {
      expect(await filledCount(roundNo, 'SUMMER', 'F')).toBe(3);
    }
  }, 60_000);

  it('같은 이메일로 두 번 신청하면 한 건만 접수된다', async () => {
    const duplicate = { ...applicant(500, 'M', 1, 22), email: 'dup@example.com' };

    const settled = await Promise.allSettled([
      submitApplication(duplicate),
      submitApplication({ ...duplicate, phone: '01099998888' }),
    ]);

    expect(settled.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(settled.filter((result) => result.status === 'rejected')).toHaveLength(1);

    const { rows } = await pool.query<{ count: string }>('select count(*) from participants');
    expect(Number(rows[0]?.count)).toBe(1);
  }, 60_000);

  it('취소하면 자리가 반납되어 다음 사람이 들어갈 수 있다', async () => {
    await pool.query('update round_slots set capacity = 1');

    await submitApplication(applicant(600, 'M', 1, 22));

    // 자리가 없으면 거절된다 (대기자로 만들지 않는다).
    await expect(submitApplication(applicant(601, 'M', 1, 22))).rejects.toThrow(/마감/);

    const { rows } = await pool.query<{ id: string }>(
      `select id from participants where email = $1`,
      [applicant(600, 'M', 1, 22).email],
    );

    const { cancelParticipant } = await import(
      '../../server/services/admin/participantMutationService.js'
    );
    await cancelParticipant({
      adminEmail: 'test@example.com',
      participantId: rows[0]?.id as string,
    });

    expect(await filledCount(1, 'SUMMER', 'M')).toBe(0);

    // 자리가 열린 뒤에는 다시 신청할 수 있다.
    await expect(submitApplication(applicant(602, 'M', 1, 22))).resolves.toMatchObject({
      roundNo: 1,
    });
    expect(await filledCount(1, 'SUMMER', 'M')).toBe(1);
  }, 60_000);
});

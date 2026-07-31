import pg from 'pg';
import { DB_POOL_CONFIG } from '../config/policy';
import { loadEnv } from '../config/env';

const { Pool } = pg;

/** 리포지토리가 풀/트랜잭션 클라이언트를 구분하지 않도록 최소 인터페이스만 요구한다. */
export interface Queryable {
  query<R extends pg.QueryResultRow = pg.QueryResultRow>(
    queryText: string,
    values?: unknown[],
  ): Promise<pg.QueryResult<R>>;
}

let pool: pg.Pool | null = null;

/**
 * 서버리스 환경에서는 인스턴스가 재사용되므로 풀을 모듈 스코프에 캐시한다.
 * date/timestamp 는 문자열로 받아 타임존 변환 사고를 원천 차단한다.
 */
export const getPool = (): pg.Pool => {
  if (pool) {
    return pool;
  }

  const env = loadEnv();

  // DATE(1082) 를 Date 객체로 바꾸지 않고 'YYYY-MM-DD' 문자열로 그대로 받는다.
  pg.types.setTypeParser(1082, (value) => value);

  // SSL 여부는 코드가 아니라 연결 문자열이 결정한다.
  // 운영(Supabase)에서는 DATABASE_URL 에 ?sslmode=require 를 붙이고,
  // 로컬/테스트용 PostgreSQL 은 붙이지 않으면 평문으로 연결된다.
  pool = new Pool({
    connectionString: env.DATABASE_URL,
    max: DB_POOL_CONFIG.max,
    idleTimeoutMillis: DB_POOL_CONFIG.idleTimeoutMillis,
    connectionTimeoutMillis: DB_POOL_CONFIG.connectionTimeoutMillis,
    statement_timeout: DB_POOL_CONFIG.statementTimeoutMillis,
  });

  pool.on('error', (error) => {
    console.error('[db] 유휴 커넥션 오류', error);
  });

  return pool;
};

/**
 * 트랜잭션 실행. 콜백이 던지면 롤백한다.
 *
 * 배정처럼 정합성이 중요한 작업은 반드시 이 함수를 통해 실행하고,
 * 콜백 안에서 lockAssignment() 를 먼저 호출해 직렬화한다.
 */
export const withTransaction = async <T>(
  handler: (client: pg.PoolClient) => Promise<T>,
): Promise<T> => {
  const client = await getPool().connect();

  try {
    await client.query('BEGIN');
    const result = await handler(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('[db] 롤백 실패', rollbackError);
    }
    throw error;
  } finally {
    client.release();
  }
};

export const closePool = async (): Promise<void> => {
  if (pool) {
    await pool.end();
    pool = null;
  }
};

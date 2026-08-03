import { DEFAULT_BALANCE_POLICY } from '../domain/assignment.js';
import type { BalancePolicy } from '../domain/types.js';

/**
 * 배정 트랜잭션을 직렬화하는 advisory lock 키.
 *
 * 모든 배정(신청·대기자 승격·회차 변경)이 같은 키를 잡으므로
 * 동시에 두 건의 배정이 진행되는 일이 없다.
 * pg_advisory_xact_lock 은 트랜잭션 종료 시 자동 해제되고
 * transaction pooler(PgBouncer) 환경에서도 안전하다.
 */
export const ASSIGNMENT_LOCK_KEY = 918_273_645;

/** 그룹 성비 보정 가중치. 운영 중 조정하려면 이 값만 바꾸면 된다. */
export const BALANCE_POLICY: BalancePolicy = DEFAULT_BALANCE_POLICY;

/** 참가자 API 요청 제한 (분당) */
export const RATE_LIMITS = {
  application: { windowMs: 60_000, max: 5 },
  lookup: { windowMs: 60_000, max: 10 },
  adminLogin: { windowMs: 60_000, max: 10 },
} as const;

/** DB 커넥션 풀 크기. Vercel 서버리스는 인스턴스가 많아지므로 작게 잡는다. */
export const DB_POOL_CONFIG = {
  max: 4,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 10_000,
  statementTimeoutMillis: 8_000,
} as const;

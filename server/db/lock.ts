import { ASSIGNMENT_LOCK_KEY } from '../config/policy';
import type { Queryable } from './pool';

/**
 * 배정 임계 구역에 진입한다. 반드시 트랜잭션 안에서 호출해야 한다.
 *
 * 이 락을 잡은 트랜잭션이 커밋/롤백될 때까지 다른 배정 트랜잭션은 대기한다.
 * 따라서 "정원 확인 → 카운터 증가" 사이에 다른 신청이 끼어들 수 없고,
 * 20명을 초과해 배정되는 상황이 발생하지 않는다.
 *
 * 만약 애플리케이션에 버그가 있어도 round_capacity 의
 * CHECK (filled_count <= capacity) 제약이 커밋을 거부한다(이중 안전장치).
 */
export const lockAssignment = async (client: Queryable): Promise<void> => {
  await client.query('select pg_advisory_xact_lock($1)', [ASSIGNMENT_LOCK_KEY]);
};

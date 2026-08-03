import type { Gender, GroupCode } from '../../shared/types.js';
import type { Queryable } from '../db/pool.js';
import type { GroupTallyState, RoundCapacityState } from '../domain/types.js';
import { conflict } from '../errors.js';

interface CapacityRow {
  round_no: number;
  gender: Gender;
  capacity: number;
  filled_count: number;
}

interface TallyRow {
  round_no: number;
  group_code: GroupCode;
  gender: Gender;
  active_count: number;
}

/** (회차, 성별) 하드 정원 현황. 활성 회차만 반환한다. */
export const findCapacityStates = async (client: Queryable): Promise<RoundCapacityState[]> => {
  const { rows } = await client.query<CapacityRow>(
    `select r.round_no, rc.gender, rc.capacity, rc.filled_count
       from round_capacity rc
       join rounds r on r.id = rc.round_id
      where r.is_active = true
      order by r.round_no, rc.gender`,
  );

  return rows.map((row) => ({
    roundNo: row.round_no,
    gender: row.gender,
    capacity: row.capacity,
    filled: row.filled_count,
  }));
};

/** (회차, 그룹, 성별) 카운트. 그룹 내 성비 보정 판단에 쓰인다. */
export const findGroupTallyStates = async (client: Queryable): Promise<GroupTallyState[]> => {
  const { rows } = await client.query<TallyRow>(
    `select r.round_no, gt.group_code, gt.gender, gt.active_count
       from group_tally gt
       join rounds r on r.id = gt.round_id
      where r.is_active = true
      order by r.round_no, gt.group_code, gt.gender`,
  );

  return rows.map((row) => ({
    roundNo: row.round_no,
    groupCode: row.group_code,
    gender: row.gender,
    activeCount: row.active_count,
  }));
};

/**
 * 좌석 1개를 확정 점유한다. 반드시 lockAssignment() 이후 같은 트랜잭션에서 호출한다.
 *
 * `filled_count < capacity` 조건을 UPDATE 문 자체에 넣었으므로
 * 만약 락이 없었더라도 정원을 넘겨 갱신되는 일은 없다(0행 반환).
 */
export const reserveSeat = async (
  client: Queryable,
  params: { roundId: string; gender: Gender },
): Promise<void> => {
  const { rowCount } = await client.query(
    `update round_capacity
        set filled_count = filled_count + 1
      where round_id = $1
        and gender = $2
        and filled_count < capacity`,
    [params.roundId, params.gender],
  );

  if (rowCount === 0) {
    throw conflict('ROUND_FULL', '방금 해당 회차가 마감되었어요. 다시 시도해 주세요.');
  }
};

/** 좌석 1개를 반납한다(취소·회차 변경). */
export const releaseSeat = async (
  client: Queryable,
  params: { roundId: string; gender: Gender },
): Promise<void> => {
  await client.query(
    `update round_capacity
        set filled_count = filled_count - 1
      where round_id = $1
        and gender = $2
        and filled_count > 0`,
    [params.roundId, params.gender],
  );
};

/**
 * 그룹 카운터를 올리고 발급할 참가번호 순번을 받는다.
 * seq_counter 는 취소되어도 감소하지 않으므로 번호가 재사용되지 않는다.
 */
export const claimSequence = async (
  client: Queryable,
  params: { roundId: string; groupCode: GroupCode; gender: Gender },
): Promise<number> => {
  const { rows } = await client.query<{ seq_counter: number }>(
    `update group_tally
        set active_count = active_count + 1,
            seq_counter  = seq_counter + 1
      where round_id = $1 and group_code = $2 and gender = $3
      returning seq_counter`,
    [params.roundId, params.groupCode, params.gender],
  );

  const row = rows[0];
  if (!row) {
    throw conflict('SLOT_NOT_FOUND', '좌석 정보를 찾을 수 없어요. 관리자에게 문의해 주세요.');
  }

  return row.seq_counter;
};

/** 그룹 카운터에서 1명을 뺀다. seq_counter 는 건드리지 않는다. */
export const releaseGroupCount = async (
  client: Queryable,
  params: { roundId: string; groupCode: GroupCode; gender: Gender },
): Promise<void> => {
  await client.query(
    `update group_tally
        set active_count = active_count - 1
      where round_id = $1 and group_code = $2 and gender = $3
        and active_count > 0`,
    [params.roundId, params.groupCode, params.gender],
  );
};

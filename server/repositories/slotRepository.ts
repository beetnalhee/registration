import type { Gender, GroupCode } from '../../shared/types.js';
import type { Queryable } from '../db/pool.js';
import type { SlotState } from '../domain/types.js';
import { conflict } from '../errors.js';

interface SlotRow {
  round_no: number;
  group_code: GroupCode;
  gender: Gender;
  capacity: number;
  active_count: number;
}

/** (회차, 그룹, 성별) 정원 현황. 활성 회차만 반환한다. */
export const findSlotStates = async (client: Queryable): Promise<SlotState[]> => {
  const { rows } = await client.query<SlotRow>(
    `select r.round_no, s.group_code, s.gender, s.capacity, s.active_count
       from round_slots s
       join rounds r on r.id = s.round_id
      where r.is_active = true
      order by r.round_no, s.group_code, s.gender`,
  );

  return rows.map((row) => ({
    roundNo: row.round_no,
    groupCode: row.group_code,
    gender: row.gender,
    capacity: row.capacity,
    filled: row.active_count,
  }));
};

/**
 * 자리 하나를 확정 점유하고 발급할 참가번호 순번을 받는다.
 * 반드시 lockAssignment() 이후 같은 트랜잭션에서 호출한다.
 *
 * `active_count < capacity` 조건을 UPDATE 문 자체에 넣었으므로
 * 만약 락이 없었더라도 정원을 넘겨 갱신되는 일은 없다(0행 반환).
 *
 * seq_counter 는 취소되어도 감소하지 않으므로 참가번호가 재사용되지 않는다.
 */
export const reserveSlot = async (
  client: Queryable,
  params: { roundId: string; groupCode: GroupCode; gender: Gender },
): Promise<number> => {
  const { rows } = await client.query<{ seq_counter: number }>(
    `update round_slots
        set active_count = active_count + 1,
            seq_counter  = seq_counter + 1
      where round_id = $1
        and group_code = $2
        and gender = $3
        and active_count < capacity
      returning seq_counter`,
    [params.roundId, params.groupCode, params.gender],
  );

  const row = rows[0];
  if (!row) {
    throw conflict(
      'ROUND_FULL',
      '방금 이 회차가 마감되었어요. 다른 회차를 선택해 주세요.',
    );
  }

  return row.seq_counter;
};

/** 자리 하나를 반납한다(취소·회차 변경). seq_counter 는 건드리지 않는다. */
export const releaseSlot = async (
  client: Queryable,
  params: { roundId: string; groupCode: GroupCode; gender: Gender },
): Promise<void> => {
  await client.query(
    `update round_slots
        set active_count = active_count - 1
      where round_id = $1 and group_code = $2 and gender = $3
        and active_count > 0`,
    [params.roundId, params.groupCode, params.gender],
  );
};

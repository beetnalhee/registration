import type { Gender, GroupCode, ParticipantStatus } from '../../shared/types.js';
import type { Queryable } from '../db/pool.js';

export interface ParticipantRecord {
  id: string;
  name: string;
  nickname: string;
  /** 'YYYY-MM-DD' */
  birthdate: string;
  gender: Gender;
  /** 숫자만 */
  phone: string;
  phoneLast4: string;
  email: string;

  // 내부 운영 정보 — 참가자 응답에 포함 금지
  ageAtEvent: number;
  defaultGroupCode: GroupCode;
  isBridgeZone: boolean;

  preferences: number[];

  status: ParticipantStatus;
  assignedRoundId: string | null;
  assignedRoundNo: number | null;
  assignedGroupCode: GroupCode | null;
  sequenceNo: number | null;
  participantCode: string | null;
  waitlistedAt: string | null;
  cancelledAt: string | null;
  /** 리셉션에서 출석 확인한 시각. null 이면 아직 도착하지 않음. */
  checkedInAt: string | null;
  createdAt: string;
}

interface ParticipantRow {
  id: string;
  name: string;
  nickname: string;
  birthdate: string;
  gender: Gender;
  phone_digits: string;
  phone_last4: string;
  email: string;
  age_at_event: number;
  default_group_code: GroupCode;
  is_bridge_zone: boolean;
  pref_1: number;
  pref_2: number;
  pref_3: number;
  status: ParticipantStatus;
  assigned_round_id: string | null;
  assigned_round_no: number | null;
  assigned_group_code: GroupCode | null;
  sequence_no: number | null;
  participant_code: string | null;
  waitlisted_at: string | null;
  cancelled_at: string | null;
  checked_in_at: string | null;
  created_at: string;
}

const SELECT_PARTICIPANT = `
  select p.id, p.name, p.nickname,
         to_char(p.birthdate, 'YYYY-MM-DD') as birthdate,
         p.gender, p.phone_digits, p.phone_last4, p.email,
         p.age_at_event, p.default_group_code, p.is_bridge_zone,
         p.pref_1, p.pref_2, p.pref_3,
         p.status, p.assigned_round_id, r.round_no as assigned_round_no,
         p.assigned_group_code, p.sequence_no, p.participant_code,
         p.waitlisted_at, p.cancelled_at, p.checked_in_at, p.created_at
    from participants p
    left join rounds r on r.id = p.assigned_round_id`;

const toRecord = (row: ParticipantRow): ParticipantRecord => ({
  id: row.id,
  name: row.name,
  nickname: row.nickname,
  birthdate: row.birthdate,
  gender: row.gender,
  phone: row.phone_digits,
  phoneLast4: row.phone_last4,
  email: row.email,
  ageAtEvent: row.age_at_event,
  defaultGroupCode: row.default_group_code,
  isBridgeZone: row.is_bridge_zone,
  preferences: [row.pref_1, row.pref_2, row.pref_3],
  status: row.status,
  assignedRoundId: row.assigned_round_id,
  assignedRoundNo: row.assigned_round_no,
  assignedGroupCode: row.assigned_group_code,
  sequenceNo: row.sequence_no,
  participantCode: row.participant_code,
  waitlistedAt: row.waitlisted_at,
  cancelledAt: row.cancelled_at,
  checkedInAt: row.checked_in_at,
  createdAt: row.created_at,
});

export interface InsertParticipantParams {
  name: string;
  nickname: string;
  birthdate: string;
  gender: Gender;
  phone: string;
  email: string;
  ageAtEvent: number;
  defaultGroupCode: GroupCode;
  isBridgeZone: boolean;
  preferences: number[];
  assignment:
    | {
        status: 'assigned';
        roundId: string;
        groupCode: GroupCode;
        sequenceNo: number;
        participantCode: string;
      }
    | { status: 'waitlisted' };
}

export const insertParticipant = async (
  client: Queryable,
  params: InsertParticipantParams,
): Promise<ParticipantRecord> => {
  const assigned = params.assignment.status === 'assigned' ? params.assignment : null;

  const { rows } = await client.query<{ id: string }>(
    `insert into participants
       (name, nickname, birthdate, gender, phone, email,
        age_at_event, default_group_code, is_bridge_zone,
        pref_1, pref_2, pref_3,
        status, assigned_round_id, assigned_group_code, sequence_no, participant_code,
        waitlisted_at)
     values ($1, $2, $3, $4, $5, $6,
             $7, $8, $9,
             $10, $11, $12,
             $13::participant_status, $14, $15, $16, $17,
             -- 대기자만 대기 시각을 기록한다(승격 순서의 기준이 된다).
             case when $13::participant_status = 'waitlisted' then now() else null end)
     returning id`,
    [
      params.name,
      params.nickname,
      params.birthdate,
      params.gender,
      params.phone,
      params.email,
      params.ageAtEvent,
      params.defaultGroupCode,
      params.isBridgeZone,
      params.preferences[0],
      params.preferences[1],
      params.preferences[2],
      params.assignment.status,
      assigned?.roundId ?? null,
      assigned?.groupCode ?? null,
      assigned?.sequenceNo ?? null,
      assigned?.participantCode ?? null,
    ],
  );

  const inserted = rows[0];
  if (!inserted) {
    throw new Error('참가자 저장에 실패했습니다.');
  }

  const record = await findParticipantById(client, inserted.id);
  if (!record) {
    throw new Error('저장한 참가자를 다시 읽어오지 못했습니다.');
  }
  return record;
};

export const findParticipantById = async (
  client: Queryable,
  id: string,
): Promise<ParticipantRecord | null> => {
  const { rows } = await client.query<ParticipantRow>(`${SELECT_PARTICIPANT} where p.id = $1`, [id]);
  const row = rows[0];
  return row ? toRecord(row) : null;
};

/** 조회 페이지 키: 생년월일 + 전화번호 뒤 4자리 (취소 건은 제외) */
export const findParticipantByLookupKey = async (
  client: Queryable,
  params: { birthdate: string; phoneLast4: string },
): Promise<ParticipantRecord | null> => {
  const { rows } = await client.query<ParticipantRow>(
    `${SELECT_PARTICIPANT}
      where p.birthdate = $1
        and p.phone_last4 = $2
        and p.status <> 'cancelled'
      limit 1`,
    [params.birthdate, params.phoneLast4],
  );

  const row = rows[0];
  return row ? toRecord(row) : null;
};

/** 대기 순번 (1부터). 대기자가 아니면 null. */
export const findWaitlistPosition = async (
  client: Queryable,
  participantId: string,
): Promise<number | null> => {
  const { rows } = await client.query<{ position: string }>(
    `select count(*) + 1 as position
       from participants earlier
      where earlier.status = 'waitlisted'
        and earlier.waitlisted_at < (
          select waitlisted_at from participants where id = $1 and status = 'waitlisted'
        )`,
    [participantId],
  );

  const row = rows[0];
  if (!row) {
    return null;
  }

  const position = Number(row.position);
  return Number.isFinite(position) ? position : null;
};

export interface AssignmentPatch {
  roundId: string;
  groupCode: GroupCode;
  sequenceNo: number;
  participantCode: string;
}

export const applyAssignment = async (
  client: Queryable,
  participantId: string,
  patch: AssignmentPatch,
): Promise<void> => {
  await client.query(
    `update participants
        set status = 'assigned',
            assigned_round_id = $2,
            assigned_group_code = $3,
            sequence_no = $4,
            participant_code = $5,
            waitlisted_at = null,
            cancelled_at = null
      where id = $1`,
    [participantId, patch.roundId, patch.groupCode, patch.sequenceNo, patch.participantCode],
  );
};

export const markCancelled = async (client: Queryable, participantId: string): Promise<void> => {
  // 출석 기록도 지운다. 참석하지 않는 사람이 출석으로 남으면
  // 노쇼 집계와 회차별 출석 수가 틀어진다.
  await client.query(
    `update participants
        set status = 'cancelled', cancelled_at = now(), checked_in_at = null
      where id = $1`,
    [participantId],
  );
};

/**
 * 출석 확인. 이미 출석한 사람을 다시 눌러도 처음 시각을 유지한다
 * (현장에서 중복 클릭이 잦고, 첫 도착 시각이 기록으로서 의미 있다).
 * 배정 상태가 아니면 아무 행도 갱신하지 않고 false 를 돌려준다.
 */
export const markCheckedIn = async (
  client: Queryable,
  participantId: string,
): Promise<boolean> => {
  const { rowCount } = await client.query(
    `update participants
        set checked_in_at = coalesce(checked_in_at, now())
      where id = $1 and status = 'assigned'`,
    [participantId],
  );

  return rowCount === 1;
};

/** 출석 취소(잘못 눌렀을 때). */
export const clearCheckedIn = async (client: Queryable, participantId: string): Promise<void> => {
  await client.query(`update participants set checked_in_at = null where id = $1`, [participantId]);
};

export interface AttendanceCountRow {
  roundNo: number;
  assigned: number;
  checkedIn: number;
}

/** 회차별 출석 현황. 배정 인원과 도착 인원을 함께 센다. */
export const countAttendanceByRound = async (
  client: Queryable,
): Promise<AttendanceCountRow[]> => {
  const { rows } = await client.query<{
    round_no: number;
    assigned: string;
    checked_in: string;
  }>(
    `select r.round_no,
            count(*) as assigned,
            count(p.checked_in_at) as checked_in
       from participants p
       join rounds r on r.id = p.assigned_round_id
      where p.status = 'assigned'
      group by r.round_no`,
  );

  return rows.map((row) => ({
    roundNo: row.round_no,
    assigned: Number(row.assigned),
    checkedIn: Number(row.checked_in),
  }));
};

export const listWaitlisted = async (client: Queryable): Promise<ParticipantRecord[]> => {
  const { rows } = await client.query<ParticipantRow>(
    `${SELECT_PARTICIPANT} where p.status = 'waitlisted' order by p.waitlisted_at`,
  );
  return rows.map(toRecord);
};

export interface ParticipantSearchParams {
  q?: string;
  status?: ParticipantStatus;
  roundNo?: number;
  groupCode?: GroupCode;
  gender?: Gender;
  /** true = 출석한 사람만, false = 아직 도착하지 않은 사람만 */
  checkedIn?: boolean;
  page: number;
  pageSize: number;
}

export interface ParticipantSearchResult {
  items: ParticipantRecord[];
  total: number;
}

export const searchParticipants = async (
  client: Queryable,
  params: ParticipantSearchParams,
): Promise<ParticipantSearchResult> => {
  const conditions: string[] = [];
  const values: unknown[] = [];

  const push = (clause: (index: number) => string, value: unknown) => {
    values.push(value);
    conditions.push(clause(values.length));
  };

  if (params.q) {
    push(
      (i) =>
        `(p.name ilike '%' || $${i} || '%'
          or p.nickname ilike '%' || $${i} || '%'
          or p.email ilike '%' || $${i} || '%'
          or p.phone_digits like '%' || $${i} || '%'
          or p.participant_code ilike '%' || $${i} || '%')`,
      params.q,
    );
  }
  if (params.status) push((i) => `p.status = $${i}`, params.status);
  if (params.roundNo !== undefined) push((i) => `r.round_no = $${i}`, params.roundNo);
  if (params.groupCode) push((i) => `p.assigned_group_code = $${i}`, params.groupCode);
  if (params.gender) push((i) => `p.gender = $${i}`, params.gender);

  // 값이 없는 컬럼 비교라 파라미터를 쓰지 않는다.
  if (params.checkedIn === true) conditions.push('p.checked_in_at is not null');
  if (params.checkedIn === false) conditions.push('p.checked_in_at is null');

  const where = conditions.length > 0 ? `where ${conditions.join(' and ')}` : '';

  const countResult = await client.query<{ total: string }>(
    `select count(*) as total
       from participants p
       left join rounds r on r.id = p.assigned_round_id
       ${where}`,
    values,
  );

  const offset = (params.page - 1) * params.pageSize;
  const listResult = await client.query<ParticipantRow>(
    `${SELECT_PARTICIPANT}
     ${where}
     order by p.created_at desc
     limit $${values.length + 1} offset $${values.length + 2}`,
    [...values, params.pageSize, offset],
  );

  return {
    items: listResult.rows.map(toRecord),
    total: Number(countResult.rows[0]?.total ?? 0),
  };
};

export const countByStatus = async (
  client: Queryable,
): Promise<Record<ParticipantStatus, number>> => {
  const { rows } = await client.query<{ status: ParticipantStatus; count: string }>(
    `select status, count(*) as count from participants group by status`,
  );

  const tally: Record<ParticipantStatus, number> = { assigned: 0, waitlisted: 0, cancelled: 0 };
  for (const row of rows) {
    tally[row.status] = Number(row.count);
  }
  return tally;
};

export interface GroupBreakdownRow {
  roundNo: number;
  groupCode: GroupCode;
  gender: Gender;
  count: number;
}

/** 관리자 현황판용 그룹별 실인원. group_tally 와 별개로 참가자 표에서 직접 센다. */
export const countAssignedByGroup = async (
  client: Queryable,
): Promise<GroupBreakdownRow[]> => {
  const { rows } = await client.query<{
    round_no: number;
    group_code: GroupCode;
    gender: Gender;
    count: string;
  }>(
    `select r.round_no, p.assigned_group_code as group_code, p.gender, count(*) as count
       from participants p
       join rounds r on r.id = p.assigned_round_id
      where p.status = 'assigned'
      group by r.round_no, p.assigned_group_code, p.gender`,
  );

  return rows.map((row) => ({
    roundNo: row.round_no,
    groupCode: row.group_code,
    gender: row.gender,
    count: Number(row.count),
  }));
};

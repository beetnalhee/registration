import { formatTimeRange } from '../../shared/format';
import type { Queryable } from '../db/pool';

export interface RoundRecord {
  id: string;
  roundNo: number;
  /** 'HH:mm' */
  startsAt: string;
  endsAt: string;
  timeLabel: string;
  isActive: boolean;
}

interface RoundRow {
  id: string;
  round_no: number;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
}

const toRecord = (row: RoundRow): RoundRecord => ({
  id: row.id,
  roundNo: row.round_no,
  startsAt: row.starts_at,
  endsAt: row.ends_at,
  timeLabel: formatTimeRange(row.starts_at, row.ends_at),
  isActive: row.is_active,
});

/** time 타입은 타임존 영향을 피하기 위해 항상 'HH:MI' 문자열로 받는다. */
const SELECT_ROUNDS = `
  select id,
         round_no,
         to_char(starts_at, 'HH24:MI') as starts_at,
         to_char(ends_at, 'HH24:MI')   as ends_at,
         is_active
    from rounds`;

export const findActiveRounds = async (client: Queryable): Promise<RoundRecord[]> => {
  const { rows } = await client.query<RoundRow>(
    `${SELECT_ROUNDS} where is_active = true order by round_no`,
  );
  return rows.map(toRecord);
};

export const findAllRounds = async (client: Queryable): Promise<RoundRecord[]> => {
  const { rows } = await client.query<RoundRow>(`${SELECT_ROUNDS} order by round_no`);
  return rows.map(toRecord);
};

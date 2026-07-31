import type { GroupCode } from '../../shared/types';
import type { Queryable } from '../db/pool';
import type { AgePolicy, GroupRule } from '../domain/types';
import { internal } from '../errors';

export interface EventSettings extends AgePolicy {
  eventName: string;
  /** 'YYYY-MM-DD' — 만나이 계산 기준일 */
  eventDate: string;
  isOpen: boolean;
  nearFullThreshold: number;
}

interface SettingsRow {
  event_name: string;
  event_date: string;
  is_open: boolean;
  near_full_threshold: string;
  min_age: number;
  max_age: number;
  bridge_min_age: number;
  bridge_max_age: number;
}

interface GroupRow {
  code: GroupCode;
  display_name: string;
  min_age: number;
  max_age: number;
  sort_order: number;
}

export const findEventSettings = async (client: Queryable): Promise<EventSettings> => {
  const { rows } = await client.query<SettingsRow>(
    `select event_name,
            to_char(event_date, 'YYYY-MM-DD') as event_date,
            is_open,
            near_full_threshold::text as near_full_threshold,
            min_age, max_age, bridge_min_age, bridge_max_age
       from event_settings
      where id = true`,
  );

  const row = rows[0];
  if (!row) {
    throw internal('행사 설정이 초기화되지 않았습니다. 002_seed.sql 을 실행해 주세요.');
  }

  return {
    eventName: row.event_name,
    eventDate: row.event_date,
    isOpen: row.is_open,
    nearFullThreshold: Number(row.near_full_threshold),
    minAge: row.min_age,
    maxAge: row.max_age,
    bridgeMinAge: row.bridge_min_age,
    bridgeMaxAge: row.bridge_max_age,
  };
};

export interface EventSettingsPatch {
  eventName?: string;
  eventDate?: string;
  isOpen?: boolean;
  nearFullThreshold?: number;
}

export const updateEventSettings = async (
  client: Queryable,
  patch: EventSettingsPatch,
): Promise<void> => {
  const assignments: string[] = [];
  const values: unknown[] = [];

  const push = (column: string, value: unknown) => {
    values.push(value);
    assignments.push(`${column} = $${values.length}`);
  };

  if (patch.eventName !== undefined) push('event_name', patch.eventName);
  if (patch.eventDate !== undefined) push('event_date', patch.eventDate);
  if (patch.isOpen !== undefined) push('is_open', patch.isOpen);
  if (patch.nearFullThreshold !== undefined) push('near_full_threshold', patch.nearFullThreshold);

  if (assignments.length === 0) {
    return;
  }

  await client.query(
    `update event_settings set ${assignments.join(', ')} where id = true`,
    values,
  );
};

export const findGroups = async (client: Queryable): Promise<GroupRule[]> => {
  const { rows } = await client.query<GroupRow>(
    `select code, display_name, min_age, max_age, sort_order
       from groups
      order by sort_order`,
  );

  if (rows.length === 0) {
    throw internal('그룹 설정이 초기화되지 않았습니다. 002_seed.sql 을 실행해 주세요.');
  }

  return rows.map((row) => ({
    code: row.code,
    minAge: row.min_age,
    maxAge: row.max_age,
    sortOrder: row.sort_order,
  }));
};

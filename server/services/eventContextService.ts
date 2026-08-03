import type { Queryable } from '../db/pool.js';
import { BALANCE_POLICY } from '../config/policy.js';
import type { AssignmentContext, GroupRule } from '../domain/types.js';
import { findGroups, findEventSettings, type EventSettings } from '../repositories/settingsRepository.js';
import { findActiveRounds, type RoundRecord } from '../repositories/roundRepository.js';
import { findCapacityStates, findGroupTallyStates } from '../repositories/slotRepository.js';
import { badRequest } from '../errors.js';

export interface EventContext {
  settings: EventSettings;
  groups: GroupRule[];
  rounds: RoundRecord[];
}

/** 신청 처리 전에 필요한 설정을 한 번에 읽는다. 락 밖에서 호출한다. */
export const loadEventContext = async (client: Queryable): Promise<EventContext> => {
  const [settings, groups, rounds] = await Promise.all([
    findEventSettings(client),
    findGroups(client),
    findActiveRounds(client),
  ]);

  return { settings, groups, rounds };
};

/** 트랜잭션 안에서 최신 정원·카운터를 읽어 배정 컨텍스트를 만든다. */
export const loadAssignmentContext = async (
  client: Queryable,
  context: EventContext,
): Promise<AssignmentContext> => {
  const [capacities, tallies] = await Promise.all([
    findCapacityStates(client),
    findGroupTallyStates(client),
  ]);

  return {
    groups: context.groups,
    agePolicy: context.settings,
    balancePolicy: BALANCE_POLICY,
    capacities,
    tallies,
  };
};

export const findRoundByNo = (rounds: RoundRecord[], roundNo: number): RoundRecord | undefined =>
  rounds.find((round) => round.roundNo === roundNo);

/** 희망 회차가 실제로 존재하는 활성 회차인지 검증한다. */
export const assertPreferencesExist = (rounds: RoundRecord[], preferences: number[]): void => {
  const available = new Set(rounds.map((round) => round.roundNo));
  const unknown = preferences.filter((roundNo) => !available.has(roundNo));

  if (unknown.length > 0) {
    throw badRequest('선택할 수 없는 회차가 포함되어 있어요. 화면을 새로 고침한 뒤 다시 시도해 주세요.', {
      preferences: '회차 정보가 변경되었어요.',
    });
  }
};

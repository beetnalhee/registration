import { resolveCounterpartGroup, resolveDefaultGroup, isBridgeZone } from './group';
import type {
  AssignmentContext,
  AssignmentDecision,
  AssignmentRequest,
  BalancePolicy,
  Gender,
  GroupCode,
  GroupTallyState,
  RoundCapacityState,
} from './types';

/**
 * 기본값 해설
 *   balanceWeight=1, defaultGroupBonus=2 이면
 *   "반대 그룹의 성비 결손이 기본 그룹보다 3명 이상 클 때만" 그룹을 옮긴다.
 *   즉 평소에는 기본 연령 그룹을 유지하고, 한쪽 성비가 무너질 때만 개입한다.
 */
export const DEFAULT_BALANCE_POLICY: BalancePolicy = {
  balanceWeight: 1,
  defaultGroupBonus: 2,
};

const oppositeGender = (gender: Gender): Gender => (gender === 'M' ? 'F' : 'M');

const findCapacity = (
  capacities: RoundCapacityState[],
  roundNo: number,
  gender: Gender,
): RoundCapacityState | undefined =>
  capacities.find((item) => item.roundNo === roundNo && item.gender === gender);

const countIn = (
  tallies: GroupTallyState[],
  roundNo: number,
  groupCode: GroupCode,
  gender: Gender,
): number =>
  tallies.find(
    (item) =>
      item.roundNo === roundNo && item.groupCode === groupCode && item.gender === gender,
  )?.activeCount ?? 0;

export const hasRoomInRound = (
  capacities: RoundCapacityState[],
  roundNo: number,
  gender: Gender,
): boolean => {
  const capacity = findCapacity(capacities, roundNo, gender);
  return capacity !== undefined && capacity.filled < capacity.capacity;
};

/**
 * 그룹 내 성비 결손. 양수면 "내 성별이 부족하다 = 내가 들어가면 매칭이 좋아진다".
 *
 * 3분 데이트는 같은 그룹끼리 짝을 짓기 때문에
 * 회차 안에서 그룹별 남녀 수가 비슷해야 짝이 남지 않는다.
 */
export const genderDeficit = (
  tallies: GroupTallyState[],
  roundNo: number,
  groupCode: GroupCode,
  gender: Gender,
): number =>
  countIn(tallies, roundNo, groupCode, oppositeGender(gender)) -
  countIn(tallies, roundNo, groupCode, gender);

export const scoreGroup = (params: {
  tallies: GroupTallyState[];
  roundNo: number;
  groupCode: GroupCode;
  gender: Gender;
  isDefaultGroup: boolean;
  balancePolicy: BalancePolicy;
}): number => {
  const { tallies, roundNo, groupCode, gender, isDefaultGroup, balancePolicy } = params;

  const deficitScore =
    genderDeficit(tallies, roundNo, groupCode, gender) * balancePolicy.balanceWeight;
  const defaultBonus = isDefaultGroup ? balancePolicy.defaultGroupBonus : 0;

  return deficitScore + defaultBonus;
};

/**
 * 배정될 그룹을 고른다.
 *
 * - 일반 참가자 : 기본 연령 그룹으로 확정
 * - Bridge Zone: 기본 그룹과 반대 그룹을 점수로 비교해 성비가 더 좋아지는 쪽으로
 *
 * ⚠️ Bridge Zone 규칙은 내부 운영 규칙이다. 이 판단 결과(어느 그룹으로 갔는지)는
 *    참가자에게 그룹명으로만 보이고, 왜 그렇게 됐는지는 노출하지 않는다.
 */
export const chooseGroup = (params: {
  roundNo: number;
  gender: Gender;
  defaultGroup: GroupCode;
  eligibleForBothGroups: boolean;
  context: Pick<AssignmentContext, 'groups' | 'tallies' | 'balancePolicy'>;
}): GroupCode => {
  const { roundNo, gender, defaultGroup, eligibleForBothGroups, context } = params;

  if (!eligibleForBothGroups) {
    return defaultGroup;
  }

  const counterpart = resolveCounterpartGroup(defaultGroup, context.groups);
  if (counterpart === null) {
    return defaultGroup;
  }

  const candidates: GroupCode[] = [defaultGroup, counterpart];

  const scored = candidates.map((groupCode) => ({
    groupCode,
    score: scoreGroup({
      tallies: context.tallies,
      roundNo,
      groupCode,
      gender,
      isDefaultGroup: groupCode === defaultGroup,
      balancePolicy: context.balancePolicy,
    }),
  }));

  // 점수가 같으면 기본 그룹을 유지한다(candidates 의 첫 원소가 기본 그룹).
  const best = scored.reduce((winner, candidate) =>
    candidate.score > winner.score ? candidate : winner,
  );

  return best.groupCode;
};

export class IneligibleAgeError extends Error {
  constructor(age: number) {
    super(`배정할 수 있는 그룹이 없는 나이입니다: ${age}`);
    this.name = 'IneligibleAgeError';
  }
}

/**
 * 배정 결정. 순수 함수이므로 DB·시간·난수에 의존하지 않는다.
 *
 * 알고리즘
 *   1) 나이로 기본 그룹을 정한다
 *   2) 희망 회차를 1순위부터 확인한다 — 회차 선택이 그룹 선택보다 우선한다
 *      (하드 정원은 (회차, 성별) 단위이므로 그룹은 회차 가용성에 영향을 주지 않는다)
 *   3) 자리가 있는 첫 회차에서 그룹을 고른다
 *   4) 세 회차 모두 마감이면 대기자
 *
 * 이 함수는 상태를 바꾸지 않는다. 실제 카운터 증가와 정원 재확인은
 * 호출자(AssignmentService)가 트랜잭션 안에서 수행한다.
 */
export const decideAssignment = (
  request: AssignmentRequest,
  context: AssignmentContext,
): AssignmentDecision => {
  const defaultGroup = resolveDefaultGroup(request.age, context.groups);
  if (defaultGroup === null) {
    throw new IneligibleAgeError(request.age);
  }

  const eligibleForBothGroups = isBridgeZone(request.age, context.agePolicy);

  for (const [index, roundNo] of request.preferences.entries()) {
    if (!hasRoomInRound(context.capacities, roundNo, request.gender)) {
      continue;
    }

    const groupCode = chooseGroup({
      roundNo,
      gender: request.gender,
      defaultGroup,
      eligibleForBothGroups,
      context,
    });

    return {
      outcome: 'assigned',
      roundNo,
      groupCode,
      movedFromDefaultGroup: groupCode !== defaultGroup,
      matchedPreferenceRank: index + 1,
    };
  }

  return { outcome: 'waitlisted', reason: 'all_rounds_full' };
};

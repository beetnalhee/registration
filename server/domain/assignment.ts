import { resolveCounterpartGroup, resolveDefaultGroup, isBridgeZone } from './group.js';
import type {
  AgePolicy,
  AssignmentContext,
  AssignmentDecision,
  AssignmentRequest,
  BalancePolicy,
  Gender,
  GroupCode,
  GroupRule,
  SlotState,
} from './types.js';

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

export const findSlot = (
  slots: SlotState[],
  roundNo: number,
  groupCode: GroupCode,
  gender: Gender,
): SlotState | undefined =>
  slots.find(
    (slot) => slot.roundNo === roundNo && slot.groupCode === groupCode && slot.gender === gender,
  );

export const hasRoom = (
  slots: SlotState[],
  roundNo: number,
  groupCode: GroupCode,
  gender: Gender,
): boolean => {
  const slot = findSlot(slots, roundNo, groupCode, gender);
  return slot !== undefined && slot.filled < slot.capacity;
};

const filledIn = (
  slots: SlotState[],
  roundNo: number,
  groupCode: GroupCode,
  gender: Gender,
): number => findSlot(slots, roundNo, groupCode, gender)?.filled ?? 0;

/**
 * 그룹 내 성비 결손. 양수면 "내 성별이 부족하다 = 내가 들어가면 매칭이 좋아진다".
 *
 * 3분 데이트는 같은 그룹끼리 짝을 짓기 때문에
 * 회차 안에서 그룹별 남녀 수가 비슷해야 짝이 남지 않는다.
 */
export const genderDeficit = (
  slots: SlotState[],
  roundNo: number,
  groupCode: GroupCode,
  gender: Gender,
): number =>
  filledIn(slots, roundNo, groupCode, oppositeGender(gender)) -
  filledIn(slots, roundNo, groupCode, gender);

export const scoreGroup = (params: {
  slots: SlotState[];
  roundNo: number;
  groupCode: GroupCode;
  gender: Gender;
  isDefaultGroup: boolean;
  balancePolicy: BalancePolicy;
}): number => {
  const { slots, roundNo, groupCode, gender, isDefaultGroup, balancePolicy } = params;

  return (
    genderDeficit(slots, roundNo, groupCode, gender) * balancePolicy.balanceWeight +
    (isDefaultGroup ? balancePolicy.defaultGroupBonus : 0)
  );
};

/**
 * 나이로 결정되는 후보 그룹 목록.
 *
 * 일반 참가자는 기본 그룹 하나뿐이고, Bridge Zone(경계 연령)은 두 그룹 모두 가능하다.
 * ⚠️ Bridge Zone 은 내부 운영 규칙이다. 참가자에게 노출하지 않는다.
 */
export const resolveCandidateGroups = (
  age: number,
  groups: GroupRule[],
  agePolicy: AgePolicy,
): GroupCode[] => {
  const defaultGroup = resolveDefaultGroup(age, groups);
  if (defaultGroup === null) {
    return [];
  }

  if (!isBridgeZone(age, agePolicy)) {
    return [defaultGroup];
  }

  const counterpart = resolveCounterpartGroup(defaultGroup, groups);
  return counterpart === null ? [defaultGroup] : [defaultGroup, counterpart];
};

/**
 * 자리가 있는 후보 그룹 중 성비가 가장 좋아지는 곳을 고른다.
 *
 * 정원이 그룹 단위로 끊기므로 Bridge Zone 은 성비 보정 수단이면서
 * 실제로 자리를 확보하는 수단이 된다. 기본 그룹이 마감이어도
 * 반대 그룹에 자리가 있으면 참가할 수 있다.
 */
export const chooseGroup = (params: {
  roundNo: number;
  gender: Gender;
  defaultGroup: GroupCode;
  candidates: GroupCode[];
  slots: SlotState[];
  balancePolicy: BalancePolicy;
}): GroupCode | null => {
  const { roundNo, gender, defaultGroup, candidates, slots, balancePolicy } = params;

  const withRoom = candidates.filter((groupCode) =>
    hasRoom(slots, roundNo, groupCode, gender),
  );

  if (withRoom.length === 0) {
    return null;
  }

  const scored = withRoom.map((groupCode) => ({
    groupCode,
    score: scoreGroup({
      slots,
      roundNo,
      groupCode,
      gender,
      isDefaultGroup: groupCode === defaultGroup,
      balancePolicy,
    }),
  }));

  // 점수가 같으면 후보 목록의 앞쪽(기본 그룹)을 유지한다.
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
 * 알고리즘 (선착순, 대기자 없음)
 *   1) 나이로 후보 그룹을 정한다 (일반 1개 / Bridge Zone 2개)
 *   2) 고른 회차에서 자리가 있는 후보 그룹을 찾는다
 *   3) 여러 곳에 자리가 있으면 성비가 더 좋아지는 쪽으로 배정한다
 *   4) 어디에도 자리가 없으면 거절한다 — 대기자로 만들지 않는다
 *
 * 이 함수는 상태를 바꾸지 않는다. 실제 카운터 증가와 정원 재확인은
 * 호출자(AssignmentService)가 트랜잭션 안에서 수행한다.
 */
export const decideAssignment = (
  request: AssignmentRequest,
  context: AssignmentContext,
): AssignmentDecision => {
  const candidates = resolveCandidateGroups(request.age, context.groups, context.agePolicy);

  if (candidates.length === 0) {
    throw new IneligibleAgeError(request.age);
  }

  const defaultGroup = candidates[0] as GroupCode;

  const groupCode = chooseGroup({
    roundNo: request.roundNo,
    gender: request.gender,
    defaultGroup,
    candidates,
    slots: context.slots,
    balancePolicy: context.balancePolicy,
  });

  if (groupCode === null) {
    return { outcome: 'rejected', reason: 'round_full' };
  }

  return {
    outcome: 'assigned',
    roundNo: request.roundNo,
    groupCode,
    movedFromDefaultGroup: groupCode !== defaultGroup,
  };
};

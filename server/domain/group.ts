import type { AgePolicy, GroupCode, GroupRule } from './types';

/**
 * 나이에 해당하는 기본 그룹을 찾는다.
 * 어떤 그룹에도 속하지 않으면 null (= 참가 불가 연령).
 */
export const resolveDefaultGroup = (age: number, groups: GroupRule[]): GroupCode | null => {
  const matched = [...groups]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .find((group) => age >= group.minAge && age <= group.maxAge);

  return matched?.code ?? null;
};

/**
 * Bridge Zone 여부.
 *
 * ⚠️ 내부 운영 규칙이다. 이 값은 참가자 응답에 포함되어서는 안 되고,
 *    참가자에게 "당신은 경계 연령입니다" 같은 안내도 하지 않는다.
 */
export const isBridgeZone = (age: number, policy: AgePolicy): boolean =>
  age >= policy.bridgeMinAge && age <= policy.bridgeMaxAge;

/** 기본 그룹의 반대 그룹. 그룹이 2개가 아니면 null. */
export const resolveCounterpartGroup = (
  defaultGroup: GroupCode,
  groups: GroupRule[],
): GroupCode | null => {
  const others = groups.filter((group) => group.code !== defaultGroup);
  return others.length === 1 ? (others[0] as GroupRule).code : null;
};

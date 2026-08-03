import type { Gender, GroupCode, RoundAvailability } from '../../shared/types.js';

/** 그룹의 기본 연령 구간. DB(groups 표)에서 읽어온다. */
export interface GroupRule {
  code: GroupCode;
  minAge: number;
  maxAge: number;
  sortOrder: number;
}

/**
 * 연령 정책. DB(event_settings)에서 읽어온다.
 * bridge* 값은 내부 운영 규칙이므로 어떤 응답에도 포함되어서는 안 된다.
 */
export interface AgePolicy {
  minAge: number;
  maxAge: number;
  bridgeMinAge: number;
  bridgeMaxAge: number;
}

/** 하드 정원 상태: (회차, 성별) 단위 */
export interface RoundCapacityState {
  roundNo: number;
  gender: Gender;
  capacity: number;
  filled: number;
}

/** 소프트 균형 상태: (회차, 그룹, 성별) 단위 */
export interface GroupTallyState {
  roundNo: number;
  groupCode: GroupCode;
  gender: Gender;
  activeCount: number;
}

/** 그룹 선택 시 '기본 그룹 유지'와 '성비 보정' 사이의 가중치 */
export interface BalancePolicy {
  /** 그룹 내 성비 결손 1명당 점수 */
  balanceWeight: number;
  /** 기본 그룹에 주는 가산점. 이 값보다 결손 차이가 커야 그룹을 옮긴다. */
  defaultGroupBonus: number;
}

export interface AssignmentRequest {
  gender: Gender;
  age: number;
  /** 1순위 → 3순위 순서로 정렬된 회차 번호 */
  preferences: number[];
}

export interface AssignmentContext {
  groups: GroupRule[];
  agePolicy: AgePolicy;
  balancePolicy: BalancePolicy;
  capacities: RoundCapacityState[];
  tallies: GroupTallyState[];
}

export type AssignmentDecision =
  | {
      outcome: 'assigned';
      roundNo: number;
      groupCode: GroupCode;
      /** 기본 그룹이 아닌 곳으로 옮겨졌는지 (내부 기록용) */
      movedFromDefaultGroup: boolean;
      /** 몇 순위 희망이 반영되었는지 (1-based) */
      matchedPreferenceRank: number;
    }
  | {
      outcome: 'waitlisted';
      reason: 'all_rounds_full';
    };

export interface AvailabilityInput {
  capacity: number;
  filled: number;
  nearFullThreshold: number;
}

export type { Gender, GroupCode, RoundAvailability };

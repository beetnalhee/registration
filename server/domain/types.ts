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

/**
 * 정원 슬롯: (회차, 그룹, 성별) 단위. 기본 10명.
 *
 * 3분 데이트는 같은 그룹끼리 짝을 짓기 때문에 정원을 그룹 단위로 끊는다.
 * 이 값이 하드 제약이라 (회차, 성별) 합계 20명은 자동으로 따라온다.
 */
export interface SlotState {
  roundNo: number;
  groupCode: GroupCode;
  gender: Gender;
  capacity: number;
  /** 현재 유효 인원. 취소 시 감소한다. */
  filled: number;
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
  /** 참가자가 고른 회차. 선착순이므로 대체 순위가 없다. */
  roundNo: number;
}

export interface AssignmentContext {
  groups: GroupRule[];
  agePolicy: AgePolicy;
  balancePolicy: BalancePolicy;
  slots: SlotState[];
}

/**
 * 배정 결과.
 *
 * 대기자가 없으므로 자리가 없으면 거절이다.
 * 참가자는 다른 회차를 고르거나, 누군가 취소해 자리가 열리면 다시 시도한다.
 */
export type AssignmentDecision =
  | {
      outcome: 'assigned';
      roundNo: number;
      groupCode: GroupCode;
      /** 기본 그룹이 아닌 곳으로 옮겨졌는지 (내부 기록용) */
      movedFromDefaultGroup: boolean;
    }
  | {
      outcome: 'rejected';
      reason: 'round_full';
    };

export type { Gender, GroupCode, RoundAvailability };

import type { AvailabilityInput, RoundAvailability } from './types';

/**
 * 회차 상태를 계산한다.
 *
 * 참가자에게는 이 세 값 중 하나만 내려간다.
 * 실제 인원수·잔여석·성비는 어떤 경로로도 참가자 응답에 포함하지 않는다.
 */
export const resolveAvailability = ({
  capacity,
  filled,
  nearFullThreshold,
}: AvailabilityInput): RoundAvailability => {
  if (capacity <= 0 || filled >= capacity) {
    return 'closed';
  }

  if (filled / capacity >= nearFullThreshold) {
    return 'near_full';
  }

  return 'open';
};

/**
 * 여러 정원(예: 남/여)의 상태를 하나로 합친다.
 * 성별을 아직 선택하지 않은 화면에서 쓰이며, 어느 성별이 찼는지는 드러내지 않는다.
 */
export const combineAvailability = (statuses: RoundAvailability[]): RoundAvailability => {
  if (statuses.length === 0) {
    return 'closed';
  }
  if (statuses.every((status) => status === 'closed')) {
    return 'closed';
  }
  if (statuses.some((status) => status !== 'open')) {
    return 'near_full';
  }
  return 'open';
};

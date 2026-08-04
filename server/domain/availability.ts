import type { RoundAvailability, SlotState } from './types.js';

/**
 * 회차 상태를 계산한다.
 *
 * 참가자에게는 이 세 값 중 하나만 내려간다.
 * 실제 인원수·잔여석·성비는 어떤 경로로도 참가자 응답에 포함하지 않는다.
 *
 * @param slots 이 참가자가 들어갈 수 있는 슬롯들.
 *   · 일반 참가자      → 자기 그룹·성별 슬롯 1개
 *   · Bridge Zone      → 두 그룹의 자기 성별 슬롯 2개
 *   · 성별/나이 미입력 → 그 회차의 모든 슬롯 (랜딩 화면의 개괄 표시)
 *
 * 모든 슬롯이 꽉 찼을 때만 '마감'이다. Bridge Zone 참가자는 기본 그룹이
 * 마감이어도 반대 그룹에 자리가 있으면 참가할 수 있으므로, 슬롯 하나가
 * 찼다고 마감으로 표시하면 거짓이 된다.
 */
export const availabilityForSlots = (
  slots: SlotState[],
  nearFullThreshold: number,
): RoundAvailability => {
  if (slots.length === 0) {
    return 'closed';
  }

  if (slots.every((slot) => slot.filled >= slot.capacity)) {
    return 'closed';
  }

  const capacity = slots.reduce((sum, slot) => sum + slot.capacity, 0);
  const filled = slots.reduce((sum, slot) => sum + slot.filled, 0);

  if (capacity <= 0) {
    return 'closed';
  }

  return filled / capacity >= nearFullThreshold ? 'near_full' : 'open';
};

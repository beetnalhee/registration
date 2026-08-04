import { describe, expect, it } from 'vitest';
import { availabilityForSlots } from '../../server/domain/availability.js';
import type { Gender, GroupCode, SlotState } from '../../server/domain/types.js';

const threshold = 0.8;

const slot = (
  groupCode: GroupCode,
  gender: Gender,
  filled: number,
  capacity = 10,
): SlotState => ({ roundNo: 1, groupCode, gender, capacity, filled });

describe('availabilityForSlots — 슬롯 하나 (일반 참가자)', () => {
  it('여유가 있으면 신청 가능', () => {
    expect(availabilityForSlots([slot('SUMMER', 'F', 0)], threshold)).toBe('open');
    expect(availabilityForSlots([slot('SUMMER', 'F', 7)], threshold)).toBe('open');
  });

  it('기준 비율에 도달하면 마감 임박', () => {
    // 정원 10명의 80% = 8명
    expect(availabilityForSlots([slot('SUMMER', 'F', 8)], threshold)).toBe('near_full');
    expect(availabilityForSlots([slot('SUMMER', 'F', 9)], threshold)).toBe('near_full');
  });

  it('정원이 차면 마감', () => {
    expect(availabilityForSlots([slot('SUMMER', 'F', 10)], threshold)).toBe('closed');
  });

  it('기준 비율을 바꾸면 임박 시점이 달라진다', () => {
    expect(availabilityForSlots([slot('SUMMER', 'F', 5)], 0.5)).toBe('near_full');
    expect(availabilityForSlots([slot('SUMMER', 'F', 5)], 0.9)).toBe('open');
  });
});

describe('availabilityForSlots — 슬롯 둘 (Bridge Zone)', () => {
  it('한쪽이 차도 다른 쪽에 자리가 있으면 마감이 아니다', () => {
    // ★ 두 그룹 중 하나라도 자리가 있으면 참가할 수 있으므로 마감이라고 하면 거짓이 된다.
    const result = availabilityForSlots(
      [slot('SUMMER', 'F', 10), slot('NIGHT', 'F', 0)],
      threshold,
    );

    expect(result).toBe('open');
  });

  it('두 슬롯을 합쳐 기준 비율을 넘으면 마감 임박', () => {
    // 합계 18/20 = 90%
    const result = availabilityForSlots(
      [slot('SUMMER', 'F', 10), slot('NIGHT', 'F', 8)],
      threshold,
    );

    expect(result).toBe('near_full');
  });

  it('두 슬롯 모두 차야 마감이다', () => {
    const result = availabilityForSlots(
      [slot('SUMMER', 'F', 10), slot('NIGHT', 'F', 10)],
      threshold,
    );

    expect(result).toBe('closed');
  });
});

describe('availabilityForSlots — 회차 전체 (랜딩 화면)', () => {
  it('네 슬롯을 합쳐 개괄 상태를 보여준다', () => {
    const all = [
      slot('SUMMER', 'M', 10),
      slot('SUMMER', 'F', 10),
      slot('NIGHT', 'M', 5),
      slot('NIGHT', 'F', 5),
    ];

    // 30/40 = 75% → 아직 임박 아님
    expect(availabilityForSlots(all, threshold)).toBe('open');
  });

  it('모든 슬롯이 차면 마감', () => {
    const all = (['SUMMER', 'NIGHT'] as GroupCode[]).flatMap((group) =>
      (['M', 'F'] as Gender[]).map((gender) => slot(group, gender, 10)),
    );

    expect(availabilityForSlots(all, threshold)).toBe('closed');
  });
});

describe('availabilityForSlots — 경계', () => {
  it('슬롯이 없으면 마감으로 간주한다', () => {
    expect(availabilityForSlots([], threshold)).toBe('closed');
  });

  it('정원이 0인 슬롯은 마감이다', () => {
    expect(availabilityForSlots([slot('SUMMER', 'F', 0, 0)], threshold)).toBe('closed');
  });
});

import { describe, expect, it } from 'vitest';
import { combineAvailability, resolveAvailability } from '../../server/domain/availability.js';

const threshold = 0.8;

describe('resolveAvailability', () => {
  it('여유가 있으면 신청 가능', () => {
    expect(resolveAvailability({ capacity: 20, filled: 0, nearFullThreshold: threshold })).toBe('open');
    expect(resolveAvailability({ capacity: 20, filled: 15, nearFullThreshold: threshold })).toBe('open');
  });

  it('기준 비율에 도달하면 마감 임박', () => {
    expect(resolveAvailability({ capacity: 20, filled: 16, nearFullThreshold: threshold })).toBe(
      'near_full',
    );
    expect(resolveAvailability({ capacity: 20, filled: 19, nearFullThreshold: threshold })).toBe(
      'near_full',
    );
  });

  it('정원이 차면 마감', () => {
    expect(resolveAvailability({ capacity: 20, filled: 20, nearFullThreshold: threshold })).toBe(
      'closed',
    );
  });

  it('정원이 0이면 마감', () => {
    expect(resolveAvailability({ capacity: 0, filled: 0, nearFullThreshold: threshold })).toBe(
      'closed',
    );
  });

  it('기준 비율을 바꾸면 임박 시점이 달라진다', () => {
    expect(resolveAvailability({ capacity: 20, filled: 10, nearFullThreshold: 0.5 })).toBe(
      'near_full',
    );
    expect(resolveAvailability({ capacity: 20, filled: 10, nearFullThreshold: 0.9 })).toBe('open');
  });
});

describe('combineAvailability', () => {
  it('모두 마감이면 마감', () => {
    expect(combineAvailability(['closed', 'closed'])).toBe('closed');
  });

  it('한쪽만 마감이면 마감 임박으로 보여준다 (어느 성별인지 드러내지 않는다)', () => {
    expect(combineAvailability(['closed', 'open'])).toBe('near_full');
  });

  it('모두 여유가 있으면 신청 가능', () => {
    expect(combineAvailability(['open', 'open'])).toBe('open');
  });

  it('빈 배열은 마감으로 간주한다', () => {
    expect(combineAvailability([])).toBe('closed');
  });
});

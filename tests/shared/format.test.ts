import { describe, expect, it } from 'vitest';
import {
  formatPhone,
  formatPhoneInput,
  formatRoundLabel,
  formatTimeRange,
} from '../../shared/format.js';

describe('formatTimeRange', () => {
  it('시작~종료 형식으로 만든다', () => {
    expect(formatTimeRange('09:50', '10:10')).toBe('09:50 ~ 10:10');
  });
});

describe('formatRoundLabel', () => {
  it('회차 라벨을 만든다', () => {
    expect(formatRoundLabel(2)).toBe('2회차');
  });
});

describe('formatPhoneInput', () => {
  it('입력하는 대로 하이픈을 붙인다', () => {
    expect(formatPhoneInput('010')).toBe('010');
    expect(formatPhoneInput('0101')).toBe('010-1');
    expect(formatPhoneInput('0101234')).toBe('010-1234');
    expect(formatPhoneInput('01012345')).toBe('010-1234-5');
    expect(formatPhoneInput('01012345678')).toBe('010-1234-5678');
  });

  it('이미 하이픈이 있어도 중복되지 않는다', () => {
    expect(formatPhoneInput('010-1234-5678')).toBe('010-1234-5678');
  });

  it('숫자가 아닌 문자는 버린다', () => {
    expect(formatPhoneInput('010abc1234가')).toBe('010-1234');
  });

  it('11자리를 넘으면 잘라낸다', () => {
    expect(formatPhoneInput('010123456789999')).toBe('010-1234-5678');
  });

  it('빈 입력을 지울 수 있다 (지우기가 막히면 안 된다)', () => {
    expect(formatPhoneInput('')).toBe('');
    expect(formatPhoneInput('-')).toBe('');
  });
});

describe('formatPhone', () => {
  it('11자리 번호를 3-4-4 로 나눈다', () => {
    expect(formatPhone('01012345678')).toBe('010-1234-5678');
  });

  it('10자리 번호를 3-3-4 로 나눈다', () => {
    expect(formatPhone('0101234567')).toBe('010-123-4567');
  });

  it('길이가 다르면 그대로 반환한다', () => {
    expect(formatPhone('12345')).toBe('12345');
  });
});

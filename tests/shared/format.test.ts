import { describe, expect, it } from 'vitest';
import { formatPhone, formatRoundLabel, formatTimeRange, maskName } from '../../shared/format';

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

describe('maskName', () => {
  it('첫 글자만 남기고 가린다', () => {
    expect(maskName('김희주')).toBe('김○○');
    expect(maskName('김민')).toBe('김○');
  });

  it('한 글자 이름은 그대로 둔다', () => {
    expect(maskName('이')).toBe('이');
  });

  it('앞뒤 공백을 제거한 뒤 가린다', () => {
    expect(maskName('  김희주  ')).toBe('김○○');
  });

  it('빈 문자열도 안전하게 처리한다', () => {
    expect(maskName('   ')).toBe('');
  });

  it('가린 결과에 원래 이름이 남지 않는다', () => {
    expect(maskName('남궁민수')).toBe('남○○○');
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

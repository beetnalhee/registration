import { describe, expect, it } from 'vitest';
import { calculateAge, resolveAgeEligibility } from '../../server/domain/age.js';

describe('calculateAge (만나이)', () => {
  it('생일이 지났으면 나이가 올라간다', () => {
    expect(calculateAge('2000-03-01', '2026-08-15')).toBe(26);
  });

  it('생일이 아직 안 지났으면 나이가 올라가지 않는다', () => {
    expect(calculateAge('2000-12-01', '2026-08-15')).toBe(25);
  });

  it('생일 당일이면 나이가 올라간다', () => {
    expect(calculateAge('2000-08-15', '2026-08-15')).toBe(26);
  });

  it('생일 하루 전이면 아직 올라가지 않는다', () => {
    expect(calculateAge('2000-08-16', '2026-08-15')).toBe(25);
  });

  it('2월 29일생도 평년 기준일에서 정확히 계산된다', () => {
    expect(calculateAge('2004-02-29', '2026-02-28')).toBe(21);
    expect(calculateAge('2004-02-29', '2026-03-01')).toBe(22);
  });

  it('행사일이 생년월일보다 앞서면 0을 반환한다', () => {
    expect(calculateAge('2030-01-01', '2026-08-15')).toBe(0);
  });
});

describe('resolveAgeEligibility', () => {
  const policy = { minAge: 18, maxAge: 35, bridgeMinAge: 24, bridgeMaxAge: 27 };

  it('범위 안이면 통과한다', () => {
    expect(resolveAgeEligibility(18, policy).eligible).toBe(true);
    expect(resolveAgeEligibility(35, policy).eligible).toBe(true);
  });

  it('너무 어리면 거절한다', () => {
    const result = resolveAgeEligibility(17, policy);
    expect(result.eligible).toBe(false);
    if (!result.eligible) expect(result.reason).toContain('18');
  });

  it('너무 많으면 거절한다', () => {
    const result = resolveAgeEligibility(36, policy);
    expect(result.eligible).toBe(false);
    if (!result.eligible) expect(result.reason).toContain('35');
  });

  it('거절 메시지에 Bridge Zone 같은 내부 용어를 노출하지 않는다', () => {
    const result = resolveAgeEligibility(40, policy);
    if (!result.eligible) {
      expect(result.reason.toLowerCase()).not.toContain('bridge');
      expect(result.reason).not.toContain('24');
      expect(result.reason).not.toContain('27');
    }
  });
});

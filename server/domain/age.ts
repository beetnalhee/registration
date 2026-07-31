import type { AgePolicy } from './types';

interface DateParts {
  year: number;
  month: number;
  day: number;
}

/** 'YYYY-MM-DD' 를 파싱한다. 타임존 영향을 받지 않도록 문자열을 직접 분해한다. */
const parseIsoDate = (iso: string): DateParts => {
  const [year, month, day] = iso.split('-').map(Number);
  if (year === undefined || month === undefined || day === undefined) {
    throw new Error(`날짜 형식이 올바르지 않습니다: ${iso}`);
  }
  return { year, month, day };
};

/**
 * 만나이를 계산한다.
 *
 * Date 객체를 쓰지 않고 (연, 월, 일) 튜플 비교로 계산하므로
 * 서버 타임존이나 일광절약시간에 영향을 받지 않는다.
 *
 * @param birthdate  'YYYY-MM-DD'
 * @param referenceDate 기준일 'YYYY-MM-DD' (행사 당일)
 */
export const calculateAge = (birthdate: string, referenceDate: string): number => {
  const birth = parseIsoDate(birthdate);
  const reference = parseIsoDate(referenceDate);

  let age = reference.year - birth.year;

  const birthdayPassed =
    reference.month > birth.month ||
    (reference.month === birth.month && reference.day >= birth.day);

  if (!birthdayPassed) {
    age -= 1;
  }

  return Math.max(age, 0);
};

export type AgeEligibility =
  | { eligible: true }
  | { eligible: false; reason: string };

/**
 * 참가 가능 연령인지 확인한다.
 *
 * 거절 메시지에는 참가 가능 연령 범위만 담는다.
 * Bridge Zone 등 내부 운영 규칙은 절대 문구에 포함하지 않는다.
 */
export const resolveAgeEligibility = (age: number, policy: AgePolicy): AgeEligibility => {
  if (age < policy.minAge) {
    return {
      eligible: false,
      reason: `이번 행사는 만 ${policy.minAge}세부터 참여하실 수 있어요.`,
    };
  }

  if (age > policy.maxAge) {
    return {
      eligible: false,
      reason: `이번 행사는 만 ${policy.maxAge}세까지 참여하실 수 있어요.`,
    };
  }

  return { eligible: true };
};

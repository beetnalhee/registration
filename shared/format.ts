/** '09:50' + '10:10' → '09:50 ~ 10:10' */
export const formatTimeRange = (startsAt: string, endsAt: string): string =>
  `${startsAt} ~ ${endsAt}`;

/** 1 → '1회차' */
export const formatRoundLabel = (roundNo: number): string => `${roundNo}회차`;

/**
 * 이름 마스킹. 조회 화면에서 본인 확인용으로만 쓴다.
 * '김희주' → '김○○', '김민' → '김○', '이' → '이'
 */
export const maskName = (name: string): string => {
  const trimmed = name.trim();
  if (trimmed.length <= 1) {
    return trimmed;
  }
  return `${trimmed[0]}${'○'.repeat(trimmed.length - 1)}`;
};

/** '01012345678' → '010-1234-5678' */
export const formatPhone = (digits: string): string => {
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return digits;
};

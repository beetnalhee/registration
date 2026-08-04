/** '09:50' + '10:10' → '09:50 ~ 10:10' */
export const formatTimeRange = (startsAt: string, endsAt: string): string =>
  `${startsAt} ~ ${endsAt}`;

/** 1 → '1회차' */
export const formatRoundLabel = (roundNo: number): string => `${roundNo}회차`;

/**
 * 입력 중인 전화번호에 하이픈을 붙여준다.
 *
 * 서버는 숫자만 남겨 저장하므로 하이픈은 어차피 선택 사항이다.
 * 그래도 자동으로 넣어주면 사용자가 "하이픈을 써야 하나" 고민할 일이 없어진다.
 */
export const formatPhoneInput = (raw: string): string => {
  const digits = raw.replace(/\D/g, '').slice(0, 11);

  if (digits.length <= 3) {
    return digits;
  }
  if (digits.length <= 7) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  }
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
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

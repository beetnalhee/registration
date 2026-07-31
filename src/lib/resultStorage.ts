import type { AssignmentResultDto } from '@shared/types';

const STORAGE_KEY = 'midsummer:assignment-result';

/**
 * 신청 결과를 완료 화면으로 넘기는 통로.
 *
 * URL 쿼리에 담으면 참가번호가 브라우저 기록·공유 링크에 남으므로
 * 세션 저장소에만 두고 탭을 닫으면 사라지게 한다.
 */
export const saveAssignmentResult = (result: AssignmentResultDto): void => {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(result));
  } catch (error) {
    console.warn('결과를 임시 저장하지 못했습니다.', error);
  }
};

export const readAssignmentResult = (): AssignmentResultDto | null => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AssignmentResultDto) : null;
  } catch {
    return null;
  }
};

export const clearAssignmentResult = (): void => {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* 저장소를 못 써도 화면 동작에는 영향이 없다 */
  }
};

import type { AdminSessionDto } from '@shared/types';

const STORAGE_KEY = 'midsummer:admin-session';

/**
 * 관리자 세션은 sessionStorage 에만 둔다.
 * 탭을 닫으면 사라지므로 공용 PC 에서 세션이 남는 사고를 줄인다.
 */
export const saveAdminSession = (session: AdminSessionDto): void => {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
};

export const readAdminSession = (): AdminSessionDto | null => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const session = JSON.parse(raw) as AdminSessionDto;

    // expiresAt 은 초 단위(Supabase 규약)
    if (session.expiresAt > 0 && session.expiresAt * 1000 <= Date.now()) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return session;
  } catch {
    return null;
  }
};

export const clearAdminSession = (): void => {
  sessionStorage.removeItem(STORAGE_KEY);
};

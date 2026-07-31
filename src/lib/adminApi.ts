import type {
  AdminOverviewDto,
  AdminParticipantDetailDto,
  AdminParticipantDto,
  AdminParticipantListDto,
  AdminSessionDto,
  AdminSettingsDto,
  GroupCode,
} from '@shared/types';
import { request, requestBlob } from './api';
import { clearAdminSession, readAdminSession } from './adminSession';

/** 세션이 없으면 즉시 실패시킨다 — 토큰 없이 관리자 API 를 부르는 실수를 막는다. */
const token = (): string => {
  const session = readAdminSession();
  if (!session) {
    throw new Error('세션이 만료되었어요. 다시 로그인해 주세요.');
  }
  return session.accessToken;
};

export const login = (credentials: { email: string; password: string }): Promise<AdminSessionDto> =>
  request<AdminSessionDto>('/admin/login', { method: 'POST', body: credentials });

export const logout = (): void => clearAdminSession();

export const fetchOverview = (signal?: AbortSignal): Promise<AdminOverviewDto> =>
  request<AdminOverviewDto>('/admin/overview', {
    accessToken: token(),
    ...(signal ? { signal } : {}),
  });

export interface ParticipantFilters {
  q?: string;
  status?: string;
  roundNo?: number;
  groupCode?: GroupCode;
  gender?: string;
  page?: number;
  pageSize?: number;
}

const toQueryString = (filters: ParticipantFilters): string => {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '' && value !== null) {
      params.set(key, String(value));
    }
  }

  const query = params.toString();
  return query ? `?${query}` : '';
};

export const fetchParticipants = (
  filters: ParticipantFilters,
  signal?: AbortSignal,
): Promise<AdminParticipantListDto> =>
  request<AdminParticipantListDto>(`/admin/participants${toQueryString(filters)}`, {
    accessToken: token(),
    ...(signal ? { signal } : {}),
  });

export const fetchParticipantDetail = (
  id: string,
  signal?: AbortSignal,
): Promise<AdminParticipantDetailDto> =>
  request<AdminParticipantDetailDto>(`/admin/participants/${id}`, {
    accessToken: token(),
    ...(signal ? { signal } : {}),
  });

export const reassignParticipant = (
  id: string,
  patch: { roundNo?: number; groupCode?: GroupCode; reason?: string },
): Promise<AdminParticipantDto> =>
  request<AdminParticipantDto>(`/admin/participants/${id}/assignment`, {
    method: 'PATCH',
    body: patch,
    accessToken: token(),
  });

export const cancelParticipant = (id: string, notify = true): Promise<AdminParticipantDto> =>
  request<AdminParticipantDto>(`/admin/participants/${id}/cancel`, {
    method: 'POST',
    body: { notify },
    accessToken: token(),
  });

export const promoteParticipant = (
  id: string,
  target: { roundNo?: number; groupCode?: GroupCode } = {},
): Promise<AdminParticipantDto> =>
  request<AdminParticipantDto>(`/admin/participants/${id}/promote`, {
    method: 'POST',
    body: target,
    accessToken: token(),
  });

export const resendEmail = (id: string): Promise<{ sent: boolean }> =>
  request<{ sent: boolean }>(`/admin/participants/${id}/resend-email`, {
    method: 'POST',
    body: {},
    accessToken: token(),
  });

export const updateSettings = (patch: {
  eventName?: string;
  eventDate?: string;
  isOpen?: boolean;
  nearFullThreshold?: number;
}): Promise<AdminSettingsDto> =>
  request<AdminSettingsDto>('/admin/settings', {
    method: 'PATCH',
    body: patch,
    accessToken: token(),
  });

/** 참가자 CSV 다운로드. 개인정보가 담기므로 파일을 열어본 뒤 관리에 주의한다. */
export const downloadParticipantsCsv = async (): Promise<void> => {
  const blob = await requestBlob('/admin/participants.csv', token());
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'participants.csv';
  anchor.click();

  URL.revokeObjectURL(url);
};

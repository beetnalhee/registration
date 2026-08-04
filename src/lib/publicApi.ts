import type { ApplicationInput, LookupInput, SelfCancelInput } from '@shared/schemas';
import type {
  AssignmentResultDto,
  EventInfoDto,
  Gender,
  LookupResultDto,
  RoundAvailabilityDto,
  SelfCancelResultDto,
} from '@shared/types';
import { request } from './api';

export const fetchEventInfo = (signal?: AbortSignal): Promise<EventInfoDto> =>
  request<EventInfoDto>('/event', signal ? { signal } : {});

export interface AvailabilityRequest {
  gender?: Gender;
  /** 'YYYY-MM-DD'. 정원이 그룹 단위라 나이를 알아야 정확한 상태가 나온다. */
  birthdate?: string;
}

/**
 * 회차 상태를 가져온다.
 *
 * 정원이 (회차, 그룹, 성별) 단위이므로 정확한 상태를 알려면 성별과 생년월일이
 * 모두 필요하다. 그룹 판정은 서버가 하고, 응답에는 상태 문자열만 담기므로
 * 참가자에게 그룹이나 인원수가 노출되지 않는다.
 *
 * 생년월일이 URL 에 남지 않도록 POST 를 쓴다.
 */
export const fetchRoundAvailability = (
  query: AvailabilityRequest = {},
  signal?: AbortSignal,
): Promise<RoundAvailabilityDto[]> =>
  request<RoundAvailabilityDto[]>('/rounds/availability', {
    method: 'POST',
    body: query,
    ...(signal ? { signal } : {}),
  });

export const submitApplication = (input: ApplicationInput): Promise<AssignmentResultDto> =>
  request<AssignmentResultDto>('/applications', { method: 'POST', body: input });

export const lookupAssignment = (input: LookupInput): Promise<LookupResultDto> =>
  request<LookupResultDto>('/lookup', { method: 'POST', body: input });

/** 본인 취소. 조회와 같은 자격증명을 쓰고, 되돌릴 수 없다. */
export const cancelOwnApplication = (input: SelfCancelInput): Promise<SelfCancelResultDto> =>
  request<SelfCancelResultDto>('/participants/cancel', { method: 'POST', body: input });

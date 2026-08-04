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

/**
 * 회차 상태를 가져온다.
 * 성별을 알면 함께 보내 정확한 상태를 받는다(성별별로 정원이 분리되어 있다).
 * 응답에는 인원수가 포함되지 않으므로 성별을 보내도 노출되는 정보는 없다.
 */
export const fetchRoundAvailability = (
  gender?: Gender,
  signal?: AbortSignal,
): Promise<RoundAvailabilityDto[]> => {
  const query = gender ? `?gender=${gender}` : '';
  return request<RoundAvailabilityDto[]>(`/rounds/availability${query}`, signal ? { signal } : {});
};

export const submitApplication = (input: ApplicationInput): Promise<AssignmentResultDto> =>
  request<AssignmentResultDto>('/applications', { method: 'POST', body: input });

export const lookupAssignment = (input: LookupInput): Promise<LookupResultDto> =>
  request<LookupResultDto>('/lookup', { method: 'POST', body: input });

/** 본인 취소. 조회와 같은 자격증명을 쓰고, 되돌릴 수 없다. */
export const cancelOwnApplication = (input: SelfCancelInput): Promise<SelfCancelResultDto> =>
  request<SelfCancelResultDto>('/participants/cancel', { method: 'POST', body: input });

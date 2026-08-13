import type {
  AdminParticipantDto,
  AssignmentResultDto,
  LookupResultDto,
} from '../../shared/types.js';
import type { ParticipantRecord } from '../repositories/participantRepository.js';

/**
 * 참가자에게 내려보낼 형태로 변환한다.
 *
 * ★ 여기서 내부 운영 정보(is_bridge_zone, default_group_code, 나이, 정원)를
 *   의도적으로 떨어뜨린다. 참가자용 응답은 반드시 이 함수를 거쳐야 한다.
 */
export const toAssignmentResultDto = (
  participant: ParticipantRecord,
  extra: { timeLabel: string },
): AssignmentResultDto => {
  if (
    participant.status !== 'assigned' ||
    participant.assignedGroupCode === null ||
    participant.assignedRoundNo === null ||
    participant.participantCode === null
  ) {
    throw new Error('배정이 확정되지 않은 신청은 결과로 변환할 수 없습니다.');
  }

  return {
    name: participant.name,
    groupCode: participant.assignedGroupCode,
    roundNo: participant.assignedRoundNo,
    timeLabel: extra.timeLabel,
    participantCode: participant.participantCode,
  };
};

export const toLookupResultDto = (
  participant: ParticipantRecord,
  extra: { timeLabel: string },
): LookupResultDto => toAssignmentResultDto(participant, extra);

/** 관리자용 — 내부 운영 정보를 포함한다. 관리자 인증을 통과한 요청에만 사용한다. */
export const toAdminParticipantDto = (
  participant: ParticipantRecord,
  timeLabel: string | null,
): AdminParticipantDto => ({
  id: participant.id,
  name: participant.name,
  birthdate: participant.birthdate,
  age: participant.ageAtEvent,
  gender: participant.gender,
  phone: participant.phone,
  email: participant.email,
  preferredRoundNo: participant.preferredRoundNo,
  status: participant.status,
  groupCode: participant.assignedGroupCode,
  roundNo: participant.assignedRoundNo,
  timeLabel,
  participantCode: participant.participantCode,
  checkedInAt: participant.checkedInAt,
  defaultGroupCode: participant.defaultGroupCode,
  isBridgeZone: participant.isBridgeZone,
  isGroupOverridden:
    participant.assignedGroupCode !== null &&
    participant.assignedGroupCode !== participant.defaultGroupCode,
  createdAt: participant.createdAt,
});

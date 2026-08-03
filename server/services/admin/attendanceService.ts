import type { AdminParticipantDto } from '../../../shared/types.js';
import { getPool } from '../../db/pool.js';
import { badRequest, notFound } from '../../errors.js';
import { recordAudit } from '../../repositories/auditLogRepository.js';
import {
  clearCheckedIn,
  findParticipantById,
  markCheckedIn,
} from '../../repositories/participantRepository.js';
import { findAllRounds } from '../../repositories/roundRepository.js';
import { toAdminParticipantDto } from '../dto.js';

export interface AttendanceParams {
  adminEmail: string;
  participantId: string;
}

/**
 * 출석 처리는 배정 트랜잭션(advisory lock)을 쓰지 않는다.
 *
 * 정원·순번 같은 공유 자원을 건드리지 않고 자기 행의 컬럼 하나만 바꾸기 때문에
 * 동시에 여러 리셉션 담당자가 눌러도 서로 간섭하지 않는다.
 * 배정 락을 잡으면 오히려 접수·승격 처리를 불필요하게 막게 된다.
 */
const loadDto = async (participantId: string): Promise<AdminParticipantDto> => {
  const pool = getPool();

  const participant = await findParticipantById(pool, participantId);
  if (!participant) {
    throw notFound('참가자를 찾을 수 없습니다.');
  }

  const rounds = await findAllRounds(pool);
  const timeLabel =
    rounds.find((round) => round.roundNo === participant.assignedRoundNo)?.timeLabel ?? null;

  return toAdminParticipantDto(participant, timeLabel);
};

/** 출석 확인. 이미 출석한 사람을 다시 눌러도 첫 도착 시각이 유지된다. */
export const checkInParticipant = async (
  params: AttendanceParams,
): Promise<AdminParticipantDto> => {
  const pool = getPool();

  const participant = await findParticipantById(pool, params.participantId);
  if (!participant) {
    throw notFound('참가자를 찾을 수 없습니다.');
  }

  if (participant.status !== 'assigned') {
    throw badRequest(
      participant.status === 'waitlisted'
        ? '대기자입니다. 자리가 있으면 먼저 승격해 주세요.'
        : '취소된 신청입니다. 출석 처리할 수 없습니다.',
    );
  }

  const alreadyCheckedIn = participant.checkedInAt !== null;
  const updated = await markCheckedIn(pool, params.participantId);

  if (!updated) {
    throw badRequest('출석 처리에 실패했습니다. 화면을 새로 고침한 뒤 다시 시도해 주세요.');
  }

  // 중복 클릭은 기록을 남기지 않는다(로그가 의미 없이 불어난다).
  if (!alreadyCheckedIn) {
    await recordAudit(pool, {
      adminEmail: params.adminEmail,
      action: 'check_in',
      participantId: params.participantId,
      afterState: { participantCode: participant.participantCode },
    });
  }

  return loadDto(params.participantId);
};

/** 출석 취소 — 현장에서 잘못 눌렀을 때 되돌린다. */
export const undoCheckInParticipant = async (
  params: AttendanceParams,
): Promise<AdminParticipantDto> => {
  const pool = getPool();

  const participant = await findParticipantById(pool, params.participantId);
  if (!participant) {
    throw notFound('참가자를 찾을 수 없습니다.');
  }

  if (participant.checkedInAt === null) {
    throw badRequest('아직 출석 처리되지 않은 참가자입니다.');
  }

  await clearCheckedIn(pool, params.participantId);

  await recordAudit(pool, {
    adminEmail: params.adminEmail,
    action: 'undo_check_in',
    participantId: params.participantId,
    beforeState: { checkedInAt: participant.checkedInAt },
  });

  return loadDto(params.participantId);
};

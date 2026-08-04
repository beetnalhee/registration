import type { AdminParticipantDto, GroupCode } from '../../../shared/types.js';
import { getPool, withTransaction, type Queryable } from '../../db/pool.js';
import { lockAssignment } from '../../db/lock.js';
import { formatParticipantCode } from '../../domain/participantCode.js';
import { getMailer } from '../../email/nodemailerMailer.js';
import { notifyParticipant } from '../../email/notificationService.js';
import { badRequest, conflict, notFound } from '../../errors.js';
import { recordAudit } from '../../repositories/auditLogRepository.js';
import {
  applyAssignment,
  findParticipantById,
  markCancelled,
  type ParticipantRecord,
} from '../../repositories/participantRepository.js';
import { releaseSlot, reserveSlot } from '../../repositories/slotRepository.js';
import type { RoundRecord } from '../../repositories/roundRepository.js';
import { toAdminParticipantDto } from '../dto.js';
import { findRoundByNo, loadEventContext } from '../eventContextService.js';

interface MutationContext {
  adminEmail: string;
  participantId: string;
}

const loadParticipant = async (
  client: Queryable,
  participantId: string,
): Promise<ParticipantRecord> => {
  const participant = await findParticipantById(client, participantId);
  if (!participant) {
    throw notFound('참가자를 찾을 수 없습니다.');
  }
  return participant;
};

/** 감사 로그에 남길 스냅샷 (비밀 값은 담지 않는다) */
const snapshot = (participant: ParticipantRecord) => ({
  status: participant.status,
  roundNo: participant.assignedRoundNo,
  groupCode: participant.assignedGroupCode,
  participantCode: participant.participantCode,
});

/** 자리를 점유하고 참가번호를 발급한 뒤 참가자 행을 갱신한다. */
const occupySlot = async (
  client: Queryable,
  participant: ParticipantRecord,
  target: { round: RoundRecord; groupCode: GroupCode },
): Promise<string> => {
  const sequenceNo = await reserveSlot(client, {
    roundId: target.round.id,
    groupCode: target.groupCode,
    gender: participant.gender,
  });

  const participantCode = formatParticipantCode({
    groupCode: target.groupCode,
    roundNo: target.round.roundNo,
    gender: participant.gender,
    sequenceNo,
  });

  await applyAssignment(client, participant.id, {
    roundId: target.round.id,
    groupCode: target.groupCode,
    sequenceNo,
    participantCode,
  });

  return participantCode;
};

/** 기존 자리를 반납한다. */
const vacateSlot = async (client: Queryable, participant: ParticipantRecord): Promise<void> => {
  if (participant.assignedRoundId === null || participant.assignedGroupCode === null) {
    return;
  }

  await releaseSlot(client, {
    roundId: participant.assignedRoundId,
    groupCode: participant.assignedGroupCode,
    gender: participant.gender,
  });
};

export interface ReassignParams extends MutationContext {
  roundNo?: number;
  groupCode?: GroupCode;
  reason?: string;
}

/**
 * 배정된 참가자의 회차/그룹을 변경한다.
 *
 * 참가번호는 새 (그룹, 회차, 성별) 기준으로 재발급된다.
 * 정원이 가득 찬 곳으로는 옮길 수 없다 — 관리자라도 그룹별 10명 제한은 지킨다.
 */
export const reassignParticipant = async (
  params: ReassignParams,
): Promise<AdminParticipantDto> => {
  const pool = getPool();
  const context = await loadEventContext(pool);

  const updated = await withTransaction(async (client) => {
    await lockAssignment(client);

    const participant = await loadParticipant(client, params.participantId);

    if (participant.status !== 'assigned') {
      throw badRequest('취소된 신청은 변경할 수 없습니다.');
    }

    const targetRoundNo = params.roundNo ?? participant.assignedRoundNo;
    const targetGroupCode = params.groupCode ?? participant.assignedGroupCode;

    if (targetRoundNo === null || targetGroupCode === null) {
      throw badRequest('변경할 회차 또는 그룹을 지정해 주세요.');
    }

    const unchanged =
      targetRoundNo === participant.assignedRoundNo &&
      targetGroupCode === participant.assignedGroupCode;

    if (unchanged) {
      return participant;
    }

    const round = findRoundByNo(context.rounds, targetRoundNo);
    if (!round) {
      throw notFound(`${targetRoundNo}회차를 찾을 수 없습니다.`);
    }

    const before = snapshot(participant);

    // 반납을 먼저 한다. 같은 회차에서 그룹만 옮기는 경우에도
    // 원래 자리를 비워야 정원 계산이 맞는다.
    await vacateSlot(client, participant);
    const participantCode = await occupySlot(client, participant, {
      round,
      groupCode: targetGroupCode,
    });

    await recordAudit(client, {
      adminEmail: params.adminEmail,
      action: 'reassign',
      participantId: participant.id,
      beforeState: before,
      afterState: {
        status: 'assigned',
        roundNo: round.roundNo,
        groupCode: targetGroupCode,
        participantCode,
        reason: params.reason ?? null,
      },
    });

    return loadParticipant(client, params.participantId);
  });

  const round = findRoundByNo(context.rounds, updated.assignedRoundNo ?? -1);
  return toAdminParticipantDto(updated, round?.timeLabel ?? null);
};

export interface CancelParams extends MutationContext {
  notify?: boolean;
}

/** 참가 취소. 자리를 반납해 다음 사람이 신청할 수 있게 한다. */
export const cancelParticipant = async (params: CancelParams): Promise<AdminParticipantDto> => {
  const pool = getPool();
  const context = await loadEventContext(pool);

  const cancelled = await withTransaction(async (client) => {
    await lockAssignment(client);

    const participant = await loadParticipant(client, params.participantId);

    if (participant.status === 'cancelled') {
      throw conflict('ALREADY_CANCELLED', '이미 취소된 신청입니다.');
    }

    const before = snapshot(participant);

    await vacateSlot(client, participant);
    await markCancelled(client, participant.id);

    await recordAudit(client, {
      adminEmail: params.adminEmail,
      action: 'cancel',
      participantId: participant.id,
      beforeState: before,
      afterState: { status: 'cancelled' },
    });

    return loadParticipant(client, params.participantId);
  });

  if (params.notify !== false) {
    await notifyParticipant(pool, getMailer(), {
      participant: cancelled,
      kind: 'cancellation',
      eventName: context.settings.eventName,
    });
  }

  return toAdminParticipantDto(cancelled, null);
};

/** 현재 상태에 맞는 안내 메일을 다시 보낸다. */
export const resendParticipantEmail = async (
  params: MutationContext,
): Promise<{ sent: boolean }> => {
  const pool = getPool();
  const context = await loadEventContext(pool);

  const participant = await loadParticipant(pool, params.participantId);
  const round = findRoundByNo(context.rounds, participant.assignedRoundNo ?? -1);

  const kind = participant.status === 'assigned' ? 'assignment' : 'cancellation';

  const sent = await notifyParticipant(pool, getMailer(), {
    participant,
    kind,
    eventName: context.settings.eventName,
    timeLabel: round?.timeLabel ?? null,
  });

  await recordAudit(pool, {
    adminEmail: params.adminEmail,
    action: 'resend_email',
    participantId: participant.id,
    afterState: { kind, sent },
  });

  return { sent };
};

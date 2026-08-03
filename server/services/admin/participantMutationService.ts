import type { GroupCode } from '../../../shared/types.js';
import { getPool, withTransaction } from '../../db/pool.js';
import { lockAssignment } from '../../db/lock.js';
import { chooseGroup } from '../../domain/assignment.js';
import { isBridgeZone } from '../../domain/group.js';
import { formatParticipantCode } from '../../domain/participantCode.js';
import { getMailer } from '../../email/nodemailerMailer.js';
import { notifyParticipant } from '../../email/notificationService.js';
import { badRequest, conflict, notFound } from '../../errors.js';
import { recordAudit } from '../../repositories/auditLogRepository.js';
import {
  applyAssignment,
  findParticipantById,
  findWaitlistPosition,
  markCancelled,
  type ParticipantRecord,
} from '../../repositories/participantRepository.js';
import {
  claimSequence,
  releaseGroupCount,
  releaseSeat,
  reserveSeat,
} from '../../repositories/slotRepository.js';
import type { RoundRecord } from '../../repositories/roundRepository.js';
import { toAdminParticipantDto } from '../dto.js';
import { findRoundByNo, loadAssignmentContext, loadEventContext } from '../eventContextService.js';
import type { AdminParticipantDto } from '../../../shared/types.js';
import type { Queryable } from '../../db/pool.js';

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

/** 좌석을 점유하고 참가번호를 발급한 뒤 참가자 행을 갱신한다. */
const occupySeat = async (
  client: Queryable,
  participant: ParticipantRecord,
  target: { round: RoundRecord; groupCode: GroupCode },
): Promise<string> => {
  await reserveSeat(client, { roundId: target.round.id, gender: participant.gender });

  const sequenceNo = await claimSequence(client, {
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

/** 기존 좌석을 반납한다. */
const vacateSeat = async (client: Queryable, participant: ParticipantRecord): Promise<void> => {
  if (participant.assignedRoundId === null || participant.assignedGroupCode === null) {
    return;
  }

  await releaseSeat(client, {
    roundId: participant.assignedRoundId,
    gender: participant.gender,
  });
  await releaseGroupCount(client, {
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
 * 정원이 가득 찬 회차로는 옮길 수 없다 — 관리자라도 20명 제한은 지킨다.
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
      throw badRequest(
        participant.status === 'waitlisted'
          ? '대기자는 "대기자 승격" 기능으로 배정해 주세요.'
          : '취소된 신청은 변경할 수 없습니다.',
      );
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

    await vacateSeat(client, participant);
    const participantCode = await occupySeat(client, participant, { round, groupCode: targetGroupCode });

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

/** 참가 취소. 좌석을 반납해 다음 사람이 쓸 수 있게 한다. */
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

    if (participant.status === 'assigned') {
      await vacateSeat(client, participant);
    }

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

export interface PromoteParams extends MutationContext {
  roundNo?: number;
  groupCode?: GroupCode;
}

/**
 * 대기자를 승격시킨다.
 *
 * 회차를 지정하지 않으면 본인의 희망 순위대로 빈자리를 찾고,
 * 그룹을 지정하지 않으면 신청 때와 같은 규칙(기본 그룹 우선 + 성비 보정)으로 정한다.
 */
export const promoteParticipant = async (params: PromoteParams): Promise<AdminParticipantDto> => {
  const pool = getPool();
  const context = await loadEventContext(pool);

  const promoted = await withTransaction(async (client) => {
    await lockAssignment(client);

    const participant = await loadParticipant(client, params.participantId);

    if (participant.status !== 'waitlisted') {
      throw badRequest('대기자만 승격할 수 있습니다.');
    }

    const assignmentContext = await loadAssignmentContext(client, context);

    const candidateRoundNos =
      params.roundNo !== undefined
        ? [params.roundNo]
        : [
            ...participant.preferences,
            ...context.rounds
              .map((round) => round.roundNo)
              .filter((roundNo) => !participant.preferences.includes(roundNo)),
          ];

    const targetRound = candidateRoundNos
      .map((roundNo) => findRoundByNo(context.rounds, roundNo))
      .find((round) => {
        if (!round) {
          return false;
        }
        const capacity = assignmentContext.capacities.find(
          (item) => item.roundNo === round.roundNo && item.gender === participant.gender,
        );
        return capacity !== undefined && capacity.filled < capacity.capacity;
      });

    if (!targetRound) {
      throw conflict(
        'NO_SEAT_AVAILABLE',
        params.roundNo === undefined
          ? '빈자리가 있는 회차가 없습니다.'
          : `${params.roundNo}회차에 빈자리가 없습니다.`,
      );
    }

    const groupCode =
      params.groupCode ??
      chooseGroup({
        roundNo: targetRound.roundNo,
        gender: participant.gender,
        defaultGroup: participant.defaultGroupCode,
        eligibleForBothGroups: isBridgeZone(participant.ageAtEvent, context.settings),
        context: assignmentContext,
      });

    const before = snapshot(participant);
    const participantCode = await occupySeat(client, participant, { round: targetRound, groupCode });

    await recordAudit(client, {
      adminEmail: params.adminEmail,
      action: 'promote',
      participantId: participant.id,
      beforeState: before,
      afterState: {
        status: 'assigned',
        roundNo: targetRound.roundNo,
        groupCode,
        participantCode,
      },
    });

    return loadParticipant(client, params.participantId);
  });

  const round = findRoundByNo(context.rounds, promoted.assignedRoundNo ?? -1);

  await notifyParticipant(pool, getMailer(), {
    participant: promoted,
    kind: 'promotion',
    eventName: context.settings.eventName,
    timeLabel: round?.timeLabel ?? null,
  });

  return toAdminParticipantDto(promoted, round?.timeLabel ?? null);
};

/** 현재 상태에 맞는 안내 메일을 다시 보낸다. */
export const resendParticipantEmail = async (params: MutationContext): Promise<{ sent: boolean }> => {
  const pool = getPool();
  const context = await loadEventContext(pool);

  const participant = await loadParticipant(pool, params.participantId);
  const round = findRoundByNo(context.rounds, participant.assignedRoundNo ?? -1);

  const kind =
    participant.status === 'assigned'
      ? 'assignment'
      : participant.status === 'waitlisted'
        ? 'waitlist'
        : 'cancellation';

  const sent = await notifyParticipant(pool, getMailer(), {
    participant,
    kind,
    eventName: context.settings.eventName,
    timeLabel: round?.timeLabel ?? null,
    waitlistPosition:
      participant.status === 'waitlisted'
        ? await findWaitlistPosition(pool, participant.id)
        : null,
  });

  await recordAudit(pool, {
    adminEmail: params.adminEmail,
    action: 'resend_email',
    participantId: participant.id,
    afterState: { kind, sent },
  });

  return { sent };
};

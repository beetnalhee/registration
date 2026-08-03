import type { ApplicationInput } from '../../shared/schemas.js';
import type { AssignmentResultDto } from '../../shared/types.js';
import { getPool, withTransaction } from '../db/pool.js';
import { lockAssignment } from '../db/lock.js';
import { calculateAge, resolveAgeEligibility } from '../domain/age.js';
import { decideAssignment } from '../domain/assignment.js';
import { resolveDefaultGroup, isBridgeZone } from '../domain/group.js';
import { formatParticipantCode } from '../domain/participantCode.js';
import { getMailer } from '../email/nodemailerMailer.js';
import { notifyParticipant } from '../email/notificationService.js';
import { PG_ERROR_CODES, asPgError, badRequest, conflict } from '../errors.js';
import {
  findWaitlistPosition,
  insertParticipant,
  type ParticipantRecord,
} from '../repositories/participantRepository.js';
import { claimSequence, reserveSeat } from '../repositories/slotRepository.js';
import { toAssignmentResultDto } from './dto.js';
import {
  assertPreferencesExist,
  findRoundByNo,
  loadAssignmentContext,
  loadEventContext,
} from './eventContextService.js';

/** 중복 신청은 DB 제약으로 잡고, 어떤 값이 겹쳤는지에 맞는 안내로 바꿔준다. */
const translateDuplicate = (error: unknown): never => {
  const pgError = asPgError(error);

  if (pgError?.code === PG_ERROR_CODES.uniqueViolation) {
    if (pgError.constraint === 'participants_active_email_uniq') {
      throw conflict(
        'DUPLICATE_EMAIL',
        '이미 이 이메일로 신청이 접수되어 있어요. 조회 페이지에서 확인해 주세요.',
      );
    }
    throw conflict(
      'DUPLICATE_PHONE',
      '이미 이 연락처로 신청이 접수되어 있어요. 조회 페이지에서 확인해 주세요.',
    );
  }

  // round_capacity 의 CHECK 제약이 걸렸다면 정원을 넘기려 한 것이다(정상적으로는 도달하지 않음).
  if (pgError?.code === PG_ERROR_CODES.checkViolation) {
    throw conflict('ROUND_FULL', '방금 자리가 마감되었어요. 다시 시도해 주세요.');
  }

  throw error;
};

interface AssignmentOutcome {
  participant: ParticipantRecord;
  timeLabel: string | null;
  waitlistPosition: number | null;
}

/**
 * 신청을 접수하고 배정한다.
 *
 * 흐름
 *   1) 락 밖에서 설정을 읽고 연령·회차 유효성을 검증한다 (락 점유 시간을 최소화)
 *   2) 트랜잭션 + advisory lock 안에서 정원을 다시 읽고 배정을 확정한다
 *   3) 커밋된 뒤에 이메일을 발송한다 (메일 지연이 락을 붙잡지 않도록)
 */
export const submitApplication = async (input: ApplicationInput): Promise<AssignmentResultDto> => {
  const pool = getPool();
  const context = await loadEventContext(pool);

  if (!context.settings.isOpen) {
    throw conflict('EVENT_CLOSED', '지금은 신청을 받고 있지 않아요.');
  }

  const age = calculateAge(input.birthdate, context.settings.eventDate);

  const eligibility = resolveAgeEligibility(age, context.settings);
  if (!eligibility.eligible) {
    throw badRequest(eligibility.reason, { birthdate: eligibility.reason });
  }

  const defaultGroupCode = resolveDefaultGroup(age, context.groups);
  if (defaultGroupCode === null) {
    throw badRequest('참가 가능한 연령이 아니에요. 생년월일을 다시 확인해 주세요.', {
      birthdate: '참가 가능한 연령이 아니에요.',
    });
  }

  assertPreferencesExist(context.rounds, input.preferences);

  const outcome = await withTransaction<AssignmentOutcome>(async (client) => {
    // ★ 여기서부터 커밋까지 다른 배정 트랜잭션은 진입할 수 없다.
    await lockAssignment(client);

    const assignmentContext = await loadAssignmentContext(client, context);
    const decision = decideAssignment(
      { gender: input.gender, age, preferences: input.preferences },
      assignmentContext,
    );

    const common = {
      name: input.name,
      nickname: input.nickname,
      birthdate: input.birthdate,
      gender: input.gender,
      phone: input.phone,
      email: input.email,
      ageAtEvent: age,
      defaultGroupCode,
      isBridgeZone: isBridgeZone(age, context.settings),
      preferences: input.preferences,
    };

    if (decision.outcome === 'waitlisted') {
      const participant = await insertParticipant(client, {
        ...common,
        assignment: { status: 'waitlisted' },
      }).catch(translateDuplicate);

      return {
        participant,
        timeLabel: null,
        waitlistPosition: await findWaitlistPosition(client, participant.id),
      };
    }

    const round = findRoundByNo(context.rounds, decision.roundNo);
    if (!round) {
      throw conflict('ROUND_NOT_FOUND', '회차 정보가 변경되었어요. 다시 시도해 주세요.');
    }

    await reserveSeat(client, { roundId: round.id, gender: input.gender });

    const sequenceNo = await claimSequence(client, {
      roundId: round.id,
      groupCode: decision.groupCode,
      gender: input.gender,
    });

    const participantCode = formatParticipantCode({
      groupCode: decision.groupCode,
      roundNo: round.roundNo,
      gender: input.gender,
      sequenceNo,
    });

    const participant = await insertParticipant(client, {
      ...common,
      assignment: {
        status: 'assigned',
        roundId: round.id,
        groupCode: decision.groupCode,
        sequenceNo,
        participantCode,
      },
    }).catch(translateDuplicate);

    return { participant, timeLabel: round.timeLabel, waitlistPosition: null };
  });

  // 커밋 후 발송. 실패해도 신청은 유효하며 email_logs 에 남아 재발송할 수 있다.
  await notifyParticipant(pool, getMailer(), {
    participant: outcome.participant,
    kind: outcome.participant.status === 'assigned' ? 'assignment' : 'waitlist',
    eventName: context.settings.eventName,
    timeLabel: outcome.timeLabel,
    waitlistPosition: outcome.waitlistPosition,
  });

  return toAssignmentResultDto(outcome.participant, {
    timeLabel: outcome.timeLabel,
    waitlistPosition: outcome.waitlistPosition,
  });
};

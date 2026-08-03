import { loadEnv } from '../config/env.js';
import type { Queryable } from '../db/pool.js';
import type { ParticipantRecord } from '../repositories/participantRepository.js';
import { recordEmailAttempt, type EmailKind } from '../repositories/emailLogRepository.js';
import type { Mailer, MailMessage } from './mailer.js';
import {
  buildAssignmentMail,
  buildCancellationMail,
  buildPromotionMail,
  buildWaitlistMail,
} from './templates.js';

export interface NotifyParams {
  participant: ParticipantRecord;
  kind: EmailKind;
  eventName: string;
  /** 배정 메일에 필요 */
  timeLabel?: string | null;
  /** 대기 메일에 필요 */
  waitlistPosition?: number | null;
}

const buildMessage = (params: NotifyParams, lookupUrl: string): MailMessage | null => {
  const { participant, kind, eventName } = params;

  if (kind === 'cancellation') {
    return buildCancellationMail(participant.email, {
      eventName,
      nickname: participant.nickname,
    });
  }

  if (kind === 'waitlist') {
    return buildWaitlistMail(participant.email, {
      eventName,
      nickname: participant.nickname,
      waitlistPosition: params.waitlistPosition ?? null,
      lookupUrl,
    });
  }

  // assignment / promotion — 배정 정보가 모두 있어야 발송할 수 있다.
  if (
    participant.assignedGroupCode === null ||
    participant.assignedRoundNo === null ||
    participant.participantCode === null ||
    !params.timeLabel
  ) {
    return null;
  }

  const data = {
    eventName,
    nickname: participant.nickname,
    groupCode: participant.assignedGroupCode,
    roundNo: participant.assignedRoundNo,
    timeLabel: params.timeLabel,
    participantCode: participant.participantCode,
    lookupUrl,
  };

  return kind === 'promotion'
    ? buildPromotionMail(participant.email, data)
    : buildAssignmentMail(participant.email, data);
};

/**
 * 이메일을 보내고 결과를 email_logs 에 남긴다.
 *
 * ★ 절대 예외를 던지지 않는다.
 *   Gmail 장애로 메일이 안 나가더라도 신청 자체는 성공해야 하고,
 *   실패는 로그에 남아 관리자가 재발송할 수 있다.
 *   또한 배정 트랜잭션이 커밋된 뒤에 호출해야 한다(메일 발송이 락을 붙잡지 않도록).
 */
export const notifyParticipant = async (
  client: Queryable,
  mailer: Mailer,
  params: NotifyParams,
): Promise<boolean> => {
  const lookupUrl = `${loadEnv().PUBLIC_BASE_URL}/lookup`;
  const message = buildMessage(params, lookupUrl);

  if (!message) {
    console.warn(
      `[mail] 발송 정보가 부족해 건너뜁니다. participant=${params.participant.id} kind=${params.kind}`,
    );
    return false;
  }

  try {
    await mailer.send(message);
    await recordEmailAttempt(client, {
      participantId: params.participant.id,
      kind: params.kind,
      toAddress: params.participant.email,
      status: 'sent',
    });
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[mail] 발송 실패 participant=${params.participant.id}`, error);

    try {
      await recordEmailAttempt(client, {
        participantId: params.participant.id,
        kind: params.kind,
        toAddress: params.participant.email,
        status: 'failed',
        errorMessage,
      });
    } catch (logError) {
      console.error('[mail] 발송 실패 기록마저 실패', logError);
    }

    return false;
  }
};

import type { LookupInput } from '../../shared/schemas';
import type { LookupResultDto } from '../../shared/types';
import { getPool } from '../db/pool';
import { notFound } from '../errors';
import {
  findParticipantByLookupKey,
  findWaitlistPosition,
} from '../repositories/participantRepository';
import { findActiveRounds } from '../repositories/roundRepository';
import { toLookupResultDto } from './dto';

/**
 * 본인 조회. 키는 생년월일 + 전화번호 뒤 4자리.
 *
 * 두 값 모두 참가자가 정확히 기억하는 값이고 표기가 하나뿐이라
 * 닉네임보다 재현성이 높다. (participants_lookup_key_uniq 인덱스로
 * 이 조합이 항상 한 명만 가리키도록 DB 에서 보장한다)
 *
 * 무작위 대조를 막기 위해 라우터에서 IP 기준 요청 제한을 걸고,
 * 응답에서 이름은 마스킹한다.
 */
export const lookupAssignment = async (input: LookupInput): Promise<LookupResultDto> => {
  const pool = getPool();

  const participant = await findParticipantByLookupKey(pool, {
    birthdate: input.birthdate,
    phoneLast4: input.phoneLast4,
  });

  if (!participant) {
    throw notFound('일치하는 신청 내역이 없어요. 생년월일과 전화번호 뒤 4자리를 다시 확인해 주세요.');
  }

  const rounds = await findActiveRounds(pool);
  const round = rounds.find((item) => item.roundNo === participant.assignedRoundNo);

  const waitlistPosition =
    participant.status === 'waitlisted' ? await findWaitlistPosition(pool, participant.id) : null;

  return toLookupResultDto(participant, {
    timeLabel: round?.timeLabel ?? null,
    waitlistPosition,
  });
};

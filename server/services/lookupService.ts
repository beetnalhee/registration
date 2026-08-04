import type { LookupInput } from '../../shared/schemas.js';
import type { LookupResultDto } from '../../shared/types.js';
import { getPool } from '../db/pool.js';
import { internal, notFound } from '../errors.js';
import { findParticipantByLookupKey } from '../repositories/participantRepository.js';
import { findActiveRounds } from '../repositories/roundRepository.js';
import { toLookupResultDto } from './dto.js';

/**
 * 본인 조회. 키는 이메일 + 전화번호 뒤 4자리.
 *
 * 이 조합은 본인 취소의 자격증명도 되므로 지인이 알기 쉬운 값(생년월일)은 쓰지 않는다.
 * 이메일은 활성 신청 중 유일하므로 조합이 항상 한 명만 가리킨다.
 *
 * 무작위 대조를 막기 위해 라우터에서 IP 기준 요청 제한을 건다.
 */
export const lookupAssignment = async (input: LookupInput): Promise<LookupResultDto> => {
  const pool = getPool();

  const participant = await findParticipantByLookupKey(pool, input);

  if (!participant) {
    throw notFound('일치하는 신청 내역이 없어요. 이메일과 전화번호 뒤 4자리를 다시 확인해 주세요.');
  }

  const rounds = await findActiveRounds(pool);
  const round = rounds.find((item) => item.roundNo === participant.assignedRoundNo);

  if (!round) {
    // 배정된 회차가 비활성화된 경우. 참가자가 스스로 해결할 수 없으므로 운영진 문의로 유도한다.
    throw internal('회차 정보를 불러오지 못했어요. 운영진에게 문의해 주세요.');
  }

  return toLookupResultDto(participant, { timeLabel: round.timeLabel });
};

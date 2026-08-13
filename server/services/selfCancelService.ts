import type { SelfCancelInput } from '../../shared/schemas.js';
import type { SelfCancelResultDto } from '../../shared/types.js';
import { getPool } from '../db/pool.js';
import { conflict, notFound } from '../errors.js';
import { findParticipantByLookupKey } from '../repositories/participantRepository.js';
import { findEventSettings } from '../repositories/settingsRepository.js';
import { cancelParticipant } from './admin/participantMutationService.js';

/**
 * 감사 로그에 남길 행위자. 실제 관리자 이메일과 구분되어야 한다.
 * 로그를 볼 때 "누가 취소했는지"가 바로 드러난다.
 */
export const SELF_SERVICE_ACTOR = 'self-service(본인 취소)';

/**
 * 참가자가 스스로 신청을 취소한다.
 *
 * 자격증명은 조회와 동일한 (이메일 + 전화번호 뒤 4자리)다.
 * 남의 이메일과 번호 뒷자리를 아는 사람은 그 사람 신청을 취소할 수 있으므로,
 * 라우터에서 요청 제한을 걸고 화면에서 되돌릴 수 없음을 명확히 경고한다.
 *
 * 접수 중일 때만 허용한다. 접수를 닫은 뒤에는 자리 재배치를 사람이
 * 판단해야 하므로 운영진 문의로 유도한다.
 *
 * 좌석 반납·출석 기록 정리·취소 메일 발송은 관리자 취소와 완전히 같은 경로를
 * 재사용한다. 취소 로직이 두 벌로 갈라지면 한쪽만 고쳐지는 사고가 난다.
 */
export const cancelOwnApplication = async (
  input: SelfCancelInput,
): Promise<SelfCancelResultDto> => {
  const pool = getPool();

  const settings = await findEventSettings(pool);
  if (!settings.isOpen) {
    throw conflict(
      'EVENT_CLOSED',
      '접수가 마감되어 직접 취소할 수 없어요. 운영진에게 문의해 주세요.',
    );
  }

  const participant = await findParticipantByLookupKey(pool, input);
  if (!participant) {
    throw notFound('일치하는 신청 내역이 없어요. 이메일과 전화번호 뒤 4자리를 다시 확인해 주세요.');
  }

  // ★ 반환값(AdminParticipantDto)에는 나이·기본그룹·Bridge Zone 같은 내부 정보가
  //   들어 있으므로 참가자에게 그대로 돌려주지 않는다. 이름만 추려서 응답한다.
  await cancelParticipant({
    adminEmail: SELF_SERVICE_ACTOR,
    participantId: participant.id,
  });

  return { name: participant.name };
};

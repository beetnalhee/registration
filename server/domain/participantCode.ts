import { SEQUENCE_PAD_LENGTH } from '../../shared/constants.js';
import type { Gender, GroupCode } from './types.js';

export interface ParticipantCodeParts {
  groupCode: GroupCode;
  roundNo: number;
  gender: Gender;
  sequenceNo: number;
}

/**
 * 참가번호를 만든다: `{그룹}-{회차}-{성별}-{순번}`
 *
 * 예) SUMMER-2-F-013
 *
 * 그룹 코드는 연령대를 추측할 수 없는 중립적 이름이어야 한다.
 * 참가번호는 명찰·좌석표에 노출되므로 여기에 연령 정보가 들어가면
 * Bridge Zone 비노출 원칙이 깨진다.
 */
export const formatParticipantCode = ({
  groupCode,
  roundNo,
  gender,
  sequenceNo,
}: ParticipantCodeParts): string => {
  if (!Number.isInteger(roundNo) || roundNo <= 0) {
    throw new Error(`회차 번호가 올바르지 않습니다: ${roundNo}`);
  }
  if (!Number.isInteger(sequenceNo) || sequenceNo <= 0) {
    throw new Error(`순번이 올바르지 않습니다: ${sequenceNo}`);
  }

  const sequence = String(sequenceNo).padStart(SEQUENCE_PAD_LENGTH, '0');
  return `${groupCode}-${roundNo}-${gender}-${sequence}`;
};

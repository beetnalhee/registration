import { describe, expect, it } from 'vitest';
import { formatParticipantCode } from '../../server/domain/participantCode';

describe('formatParticipantCode', () => {
  it('그룹-회차-성별-순번 형식으로 만든다', () => {
    expect(
      formatParticipantCode({ groupCode: 'SUMMER', roundNo: 2, gender: 'F', sequenceNo: 13 }),
    ).toBe('SUMMER-2-F-013');
  });

  it('순번을 3자리로 채운다', () => {
    expect(
      formatParticipantCode({ groupCode: 'NIGHT', roundNo: 1, gender: 'M', sequenceNo: 1 }),
    ).toBe('NIGHT-1-M-001');
  });

  it('3자리를 넘으면 자르지 않는다', () => {
    expect(
      formatParticipantCode({ groupCode: 'NIGHT', roundNo: 3, gender: 'M', sequenceNo: 1234 }),
    ).toBe('NIGHT-3-M-1234');
  });

  it('참가번호에 연령 정보가 들어가지 않는다', () => {
    const code = formatParticipantCode({
      groupCode: 'SUMMER',
      roundNo: 2,
      gender: 'F',
      sequenceNo: 7,
    });

    expect(code).not.toMatch(/YB|OB/);
  });

  it('잘못된 회차·순번은 예외를 던진다', () => {
    expect(() =>
      formatParticipantCode({ groupCode: 'SUMMER', roundNo: 0, gender: 'F', sequenceNo: 1 }),
    ).toThrow();
    expect(() =>
      formatParticipantCode({ groupCode: 'SUMMER', roundNo: 1, gender: 'F', sequenceNo: 0 }),
    ).toThrow();
  });
});

import { describe, expect, it } from 'vitest';
import { ARRIVAL_LEAD_MINUTES, VENUE } from '../../shared/constants.js';
import { buildAssignmentMail } from '../../server/email/templates.js';

/**
 * 안내 메일이 "언제 어디로 가야 하는지"를 빠뜨리지 않는지 검증한다.
 *
 * 장소와 도착 시각은 참가자가 메일에서 얻지 못하면 행사 당일에
 * 운영진 문의로 되돌아오는 정보다. 문구를 다듬다 지워지는 일이 없도록 못을 박는다.
 */

const data = {
  eventName: '사랑은 돌아오는 거야',
  nickname: '희주',
  groupCode: 'SUMMER',
  roundNo: 2,
  timeLabel: '22:05 ~ 22:25',
  participantCode: 'SUMMER-2-F-013',
};

describe('buildAssignmentMail', () => {
  it('HTML 본문에 모이는 장소가 들어간다', () => {
    const mail = buildAssignmentMail('heeju@example.com', data);

    // 작은따옴표는 escapeHtml 로 이스케이프되므로 그 앞뒤 조각으로 확인한다.
    expect(mail.html).toContain('본관 5층');
    expect(mail.html).toContain('세미나실');
  });

  it('HTML 본문에 회차 시작 전 도착 안내가 들어간다', () => {
    const mail = buildAssignmentMail('heeju@example.com', data);

    expect(mail.html).toContain(`${ARRIVAL_LEAD_MINUTES}분 전까지`);
  });

  it('텍스트 본문에도 장소와 도착 안내가 들어간다', () => {
    const mail = buildAssignmentMail('heeju@example.com', data);

    expect(mail.text).toContain(VENUE);
    expect(mail.text).toContain(`${ARRIVAL_LEAD_MINUTES}분 전까지`);
  });

  it('조회 페이지로 보내는 버튼·링크는 넣지 않는다', () => {
    const mail = buildAssignmentMail('heeju@example.com', data);

    // 메일에 필요한 것은 당일 리셉션에서 보여줄 정보뿐이다.
    expect(mail.html).not.toContain('내 배정 다시 보기');
    expect(mail.html).not.toContain('/lookup');
    expect(mail.text).not.toContain('내 배정 다시 보기');
    expect(mail.text).not.toContain('/lookup');
  });

  it('기존 배정 정보(회차·시간·참가번호)는 그대로 유지한다', () => {
    const mail = buildAssignmentMail('heeju@example.com', data);

    expect(mail.text).toContain('2회차');
    expect(mail.text).toContain('22:05 ~ 22:25');
    expect(mail.text).toContain('SUMMER-2-F-013');
    expect(mail.subject).toContain('SUMMER-2-F-013');
  });
});

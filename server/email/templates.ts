import type { MailMessage } from './mailer.js';

export interface AssignmentMailData {
  eventName: string;
  nickname: string;
  groupCode: string;
  roundNo: number;
  timeLabel: string;
  participantCode: string;
  lookupUrl: string;
}

export interface WaitlistMailData {
  eventName: string;
  nickname: string;
  waitlistPosition: number | null;
  lookupUrl: string;
}

export interface CancellationMailData {
  eventName: string;
  nickname: string;
}

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/**
 * 이메일 레이아웃.
 * 메일 클라이언트는 외부 CSS·flex 를 신뢰할 수 없으므로 table + inline style 로 짠다.
 */
const layout = (params: { title: string; preheader: string; body: string }): string => `
<!doctype html>
<html lang="ko">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width" /></head>
<body style="margin:0;padding:0;background-color:#070B1C;">
  <div style="display:none;font-size:1px;color:#070B1C;">${escapeHtml(params.preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="background-color:#070B1C;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="max-width:520px;background:linear-gradient(180deg,#0B1026 0%,#1B2A5B 100%);
                    border-radius:20px;border:1px solid rgba(255,217,142,0.25);overflow:hidden;">
        <tr><td style="padding:36px 32px 8px;text-align:center;">
          <div style="font-size:28px;line-height:1;">🌙</div>
          <!-- 메일 클라이언트는 웹폰트를 신뢰할 수 없으므로 기기 기본 산세리프로 둔다 -->
          <h1 style="margin:16px 0 0;font-family:-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;font-size:22px;
                     font-weight:700;color:#FFEFC7;letter-spacing:-0.01em;">${escapeHtml(params.title)}</h1>
        </td></tr>
        <tr><td style="padding:8px 32px 36px;font-family:-apple-system,'Apple SD Gothic Neo',
                       'Malgun Gothic',sans-serif;font-size:15px;line-height:1.7;color:#D7DEF5;">
          ${params.body}
        </td></tr>
      </table>
      <p style="max-width:520px;margin:20px auto 0;font-family:-apple-system,sans-serif;
                font-size:12px;line-height:1.6;color:#6C7BA8;text-align:center;">
        이 메일은 신청 확인용으로 자동 발송되었습니다.<br />
        문의사항은 행사 운영진에게 전해주세요.
      </p>
    </td></tr>
  </table>
</body>
</html>`;

const infoRow = (label: string, value: string, emphasis = false): string => `
  <tr>
    <td style="padding:10px 0;width:76px;font-size:13px;color:#8FA0D0;vertical-align:top;">
      ${escapeHtml(label)}
    </td>
    <td style="padding:10px 0;font-size:${emphasis ? '18px' : '15px'};font-weight:${emphasis ? '700' : '500'};
               color:${emphasis ? '#FFD98E' : '#F2F5FF'};letter-spacing:${emphasis ? '0.02em' : 'normal'};">
      ${escapeHtml(value)}
    </td>
  </tr>`;

const button = (url: string, label: string): string => `
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px auto 0;">
    <tr><td style="border-radius:999px;background:linear-gradient(135deg,#FFD98E 0%,#FFB3C1 100%);">
      <a href="${escapeHtml(url)}"
         style="display:inline-block;padding:13px 30px;font-size:14px;font-weight:700;
                color:#0B1026;text-decoration:none;border-radius:999px;">${escapeHtml(label)}</a>
    </td></tr>
  </table>`;

export const buildAssignmentMail = (to: string, data: AssignmentMailData): MailMessage => {
  const body = `
    <p style="margin:0 0 20px;">
      <strong style="color:#FFEFC7;">${escapeHtml(data.nickname)}</strong>님, 신청이 완료되었어요.<br />
      아래 정보를 행사 당일에 그대로 보여주시면 됩니다.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
           style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,217,142,0.18);
                  border-radius:14px;padding:8px 18px;">
      ${infoRow('그룹', data.groupCode)}
      ${infoRow('회차', `${data.roundNo}회차`)}
      ${infoRow('시간', data.timeLabel)}
      ${infoRow('참가번호', data.participantCode, true)}
    </table>
    <p style="margin:24px 0 0;font-size:13px;color:#8FA0D0;">
      시간 맞춰 입장해주세요, 늦으면 입장이 제한될 수 있어요.<br />
    </p>
    ${button(data.lookupUrl, '내 배정 다시 보기')}`;

  const text = [
    `${data.nickname}님, 신청이 완료되었어요.`,
    '',
    `그룹: ${data.groupCode}`,
    `회차: ${data.roundNo}회차`,
    `시간: ${data.timeLabel}`,
    `참가번호: ${data.participantCode}`,
    '',
    `내 배정 다시 보기: ${data.lookupUrl}`,
  ].join('\n');

  return {
    to,
    subject: `[${data.eventName}] 신청 완료 · ${data.participantCode}`,
    html: layout({
      title: '신청이 완료되었습니다',
      preheader: `${data.roundNo}회차 ${data.timeLabel} · ${data.participantCode}`,
      body,
    }),
    text,
  };
};

export const buildWaitlistMail = (to: string, data: WaitlistMailData): MailMessage => {
  const positionLine =
    data.waitlistPosition === null
      ? '대기 명단에 등록되었습니다.'
      : `현재 대기 <strong style="color:#FFD98E;">${data.waitlistPosition}번</strong>이세요.`;

  const body = `
    <p style="margin:0 0 20px;">
      <strong style="color:#FFEFC7;">${escapeHtml(data.nickname)}</strong>님, 신청해 주셔서 고맙습니다.<br />
      선택하신 회차가 마감되어 대기자로 등록되었어요.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
           style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,179,193,0.2);
                  border-radius:14px;padding:16px 18px;">
      <tr><td style="font-size:15px;color:#F2F5FF;">${positionLine}</td></tr>
    </table>
    <p style="margin:20px 0 0;font-size:14px;">
      자리가 생기면 순서대로 안내드리고, 배정되면 다시 메일을 보내드립니다.
    </p>
    ${button(data.lookupUrl, '내 상태 확인하기')}`;

  const text = [
    `${data.nickname}님, 선택하신 회차가 마감되어 대기자로 등록되었습니다.`,
    data.waitlistPosition === null ? '' : `현재 대기 ${data.waitlistPosition}번입니다.`,
    '자리가 생기면 순서대로 안내드립니다.',
    '',
    `내 상태 확인하기: ${data.lookupUrl}`,
  ]
    .filter(Boolean)
    .join('\n');

  return {
    to,
    subject: `[${data.eventName}] 대기자로 등록되었습니다`,
    html: layout({ title: '대기자로 등록되었습니다', preheader: '자리가 생기면 안내드립니다', body }),
    text,
  };
};

export const buildPromotionMail = (to: string, data: AssignmentMailData): MailMessage => {
  const body = `
    <p style="margin:0 0 20px;">
      <strong style="color:#FFEFC7;">${escapeHtml(data.nickname)}</strong>님, 자리가 생겼어요!<br />
      대기자에서 정식 참가자로 배정되었습니다.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
           style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,217,142,0.18);
                  border-radius:14px;padding:8px 18px;">
      ${infoRow('그룹', data.groupCode)}
      ${infoRow('회차', `${data.roundNo}회차`)}
      ${infoRow('시간', data.timeLabel)}
      ${infoRow('참가번호', data.participantCode, true)}
    </table>
    ${button(data.lookupUrl, '내 배정 확인하기')}`;

  const text = [
    `${data.nickname}님, 대기자에서 참가자로 배정되었습니다.`,
    '',
    `그룹: ${data.groupCode}`,
    `회차: ${data.roundNo}회차`,
    `시간: ${data.timeLabel}`,
    `참가번호: ${data.participantCode}`,
    '',
    `내 배정 확인하기: ${data.lookupUrl}`,
  ].join('\n');

  return {
    to,
    subject: `[${data.eventName}] 자리가 생겼어요 · ${data.participantCode}`,
    html: layout({
      title: '자리가 생겼어요',
      preheader: `${data.roundNo}회차 ${data.timeLabel} · ${data.participantCode}`,
      body,
    }),
    text,
  };
};

export const buildCancellationMail = (to: string, data: CancellationMailData): MailMessage => {
  const body = `
    <p style="margin:0;">
      <strong style="color:#FFEFC7;">${escapeHtml(data.nickname)}</strong>님의 신청이 취소되었습니다.<br />
      다시 신청하고 싶으시면 신청 페이지에서 새로 접수해 주세요.
    </p>`;

  return {
    to,
    subject: `[${data.eventName}] 신청이 취소되었습니다`,
    html: layout({ title: '신청이 취소되었습니다', preheader: '신청 취소 안내', body }),
    text: `${data.nickname}님의 신청이 취소되었습니다.`,
  };
};

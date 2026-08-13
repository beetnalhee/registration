/**
 * 프론트엔드와 서버가 함께 쓰는 상수.
 * 참가자에게 노출되는 값만 여기에 둔다.
 * 정원 수치, Bridge Zone 연령, 성비 가중치 등 운영 규칙은
 * server/config 와 DB(event_settings) 에만 존재한다.
 */

export const GENDERS = ['M', 'F'] as const;

export const GROUP_CODES = ['SUMMER', 'NIGHT'] as const;

/** 대기자 제도가 없으므로 배정 또는 취소 두 가지뿐이다. */
export const PARTICIPANT_STATUSES = ['assigned', 'cancelled'] as const;

/** 참가자 화면에 노출되는 회차 상태. 실제 인원수는 절대 내려보내지 않는다. */
export const ROUND_AVAILABILITIES = ['open', 'near_full', 'closed'] as const;

export const GENDER_LABELS: Record<(typeof GENDERS)[number], string> = {
  M: '남성',
  F: '여성',
};

export const ROUND_AVAILABILITY_LABELS: Record<(typeof ROUND_AVAILABILITIES)[number], string> = {
  open: '신청 가능',
  near_full: '마감 임박',
  closed: '마감',
};

export const ROUND_AVAILABILITY_ICONS: Record<(typeof ROUND_AVAILABILITIES)[number], string> = {
  open: '✅',
  near_full: '🔥',
  closed: '❌',
};

export const PARTICIPANT_STATUS_LABELS: Record<(typeof PARTICIPANT_STATUSES)[number], string> = {
  assigned: '배정 완료',
  cancelled: '취소',
};

/**
 * 회차는 1개만 고른다(선착순).
 * 고른 회차가 마감이면 신청할 수 없다. 대기자 제도는 없고,
 * 누군가 취소해 자리가 열리면 그 시점에 신청하는 사람이 가져간다.
 */

/** 참가번호 자리수: SUMMER-2-F-013 의 '013' 부분 */
export const SEQUENCE_PAD_LENGTH = 3;

/**
 * 모이는 장소. 배정이 확정된 뒤에만 안내한다(결과 카드·안내 메일).
 * 신청 전 화면에는 노출하지 않는다.
 */
export const VENUE = "본관 5층 '국' 세미나실";

/** 활동 설명이 있어 회차 시작보다 먼저 도착해야 하는 시간(분). */
export const ARRIVAL_LEAD_MINUTES = 10;

export const ARRIVAL_NOTICE =
  `활동 설명이 있으니 본인 회차 시작 ${ARRIVAL_LEAD_MINUTES}분 전까지 도착해 주세요.`;

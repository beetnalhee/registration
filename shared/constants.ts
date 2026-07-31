/**
 * 프론트엔드와 서버가 함께 쓰는 상수.
 * 참가자에게 노출되는 값만 여기에 둔다.
 * 정원 수치, Bridge Zone 연령, 성비 가중치 등 운영 규칙은
 * server/config 와 DB(event_settings) 에만 존재한다.
 */

export const GENDERS = ['M', 'F'] as const;

export const GROUP_CODES = ['SUMMER', 'NIGHT'] as const;

export const PARTICIPANT_STATUSES = ['assigned', 'waitlisted', 'cancelled'] as const;

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
  waitlisted: '대기',
  cancelled: '취소',
};

/** 희망 회차는 3순위까지 받는다. */
export const PREFERENCE_COUNT = 3;

/** 참가번호 자리수: SUMMER-2-F-013 의 '013' 부분 */
export const SEQUENCE_PAD_LENGTH = 3;

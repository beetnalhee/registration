import type {
  GENDERS,
  GROUP_CODES,
  PARTICIPANT_STATUSES,
  ROUND_AVAILABILITIES,
} from './constants.js';

export type Gender = (typeof GENDERS)[number];
export type GroupCode = (typeof GROUP_CODES)[number];
export type ParticipantStatus = (typeof PARTICIPANT_STATUSES)[number];
export type RoundAvailability = (typeof ROUND_AVAILABILITIES)[number];

// ─── 공용 응답 봉투 ─────────────────────────────────────────────────────────

export interface ApiSuccess<T> {
  success: true;
  data: T;
  error: null;
}

export interface ApiFailure {
  success: false;
  data: null;
  error: { code: string; message: string; fields?: Record<string, string> };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

// ─── 참가자용 (공개) ───────────────────────────────────────────────────────

export interface RoundInfo {
  roundNo: number;
  /** 'HH:mm' */
  startsAt: string;
  /** 'HH:mm' */
  endsAt: string;
  /** '09:50 ~ 10:10' */
  timeLabel: string;
}

export interface EventInfoDto {
  eventName: string;
  eventDate: string;
  isOpen: boolean;
  rounds: RoundInfo[];
}

/** 참가자에게 내려가는 회차 상태. 인원수·성비·잔여석은 포함하지 않는다. */
export interface RoundAvailabilityDto {
  roundNo: number;
  availability: RoundAvailability;
}

/**
 * 배정 결과. 대기자 제도가 없으므로 신청이 성공하면 항상 자리가 확정된다.
 * 자리가 없으면 신청 자체가 거절되므로 null 인 필드가 없다.
 */
export interface AssignmentResultDto {
  /** 실명. 신청한 본인에게만 내려간다. */
  name: string;
  groupCode: GroupCode;
  roundNo: number;
  timeLabel: string;
  participantCode: string;
}

export interface SelfCancelResultDto {
  name: string;
}

/**
 * 조회 결과. 이메일 + 전화번호 뒤 4자리를 맞춘 본인에게만 내려간다.
 * 배정 직후 결과와 같은 내용이므로 형태도 같다.
 */
export type LookupResultDto = AssignmentResultDto;

// ─── 관리자용 ──────────────────────────────────────────────────────────────

export interface AdminSessionDto {
  email: string;
  displayName: string | null;
  accessToken: string;
  expiresAt: number;
}

export interface GenderCountDto {
  filled: number;
  capacity: number;
}

/** 그룹별 정원 현황. 하드 정원이 (회차, 그룹, 성별) 단위이므로 그룹마다 정원이 있다. */
export interface SlotCountDto {
  groupCode: GroupCode;
  male: GenderCountDto;
  female: GenderCountDto;
}

/** 회차별 출석 현황. 배정 인원 대비 몇 명이 도착했는지. */
export interface AttendanceDto {
  checkedIn: number;
  assigned: number;
}

export interface RoundOverviewDto {
  roundNo: number;
  timeLabel: string;
  male: GenderCountDto;
  female: GenderCountDto;
  availability: RoundAvailability;
  groups: SlotCountDto[];
  attendance: AttendanceDto;
}

export interface AdminOverviewDto {
  eventName: string;
  eventDate: string;
  isOpen: boolean;
  nearFullThreshold: number;
  totalAssigned: number;
  totalCancelled: number;
  rounds: RoundOverviewDto[];
}

export interface AdminParticipantDto {
  id: string;
  name: string;
  birthdate: string;
  age: number;
  gender: Gender;
  phone: string;
  email: string;
  /** 참가자가 고른 회차 (선착순이므로 하나뿐) */
  preferredRoundNo: number;
  status: ParticipantStatus;
  groupCode: GroupCode | null;
  roundNo: number | null;
  timeLabel: string | null;
  participantCode: string | null;
  /** 출석 확인 시각. null 이면 아직 도착하지 않음. */
  checkedInAt: string | null;
  /** 내부 운영 정보 — 관리자에게만 노출 */
  defaultGroupCode: GroupCode;
  isBridgeZone: boolean;
  isGroupOverridden: boolean;
  createdAt: string;
}

export interface AdminParticipantListDto {
  items: AdminParticipantDto[];
  total: number;
  page: number;
  pageSize: number;
}

export interface EmailLogDto {
  id: string;
  kind: string;
  toAddress: string;
  status: 'sent' | 'failed';
  errorMessage: string | null;
  createdAt: string;
}

export interface AdminParticipantDetailDto {
  participant: AdminParticipantDto;
  emailLogs: EmailLogDto[];
}

export interface AdminSettingsDto {
  eventName: string;
  eventDate: string;
  isOpen: boolean;
  nearFullThreshold: number;
}

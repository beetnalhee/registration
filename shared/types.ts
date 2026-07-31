import type {
  GENDERS,
  GROUP_CODES,
  PARTICIPANT_STATUSES,
  ROUND_AVAILABILITIES,
} from './constants';

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

export interface AssignmentResultDto {
  status: Extract<ParticipantStatus, 'assigned' | 'waitlisted'>;
  nickname: string;
  /** 대기자는 null */
  groupCode: GroupCode | null;
  roundNo: number | null;
  timeLabel: string | null;
  participantCode: string | null;
  /** 대기 순번 (대기자만) */
  waitlistPosition: number | null;
}

export interface LookupResultDto extends AssignmentResultDto {
  /** '김○○' 형태로 마스킹된 이름 */
  maskedName: string;
}

// ─── 관리자용 ──────────────────────────────────────────────────────────────

export interface AdminSessionDto {
  email: string;
  displayName: string | null;
  accessToken: string;
  expiresAt: number;
}

export interface SlotCountDto {
  groupCode: GroupCode;
  male: number;
  female: number;
}

export interface GenderCountDto {
  filled: number;
  capacity: number;
}

export interface RoundOverviewDto {
  roundNo: number;
  timeLabel: string;
  male: GenderCountDto;
  female: GenderCountDto;
  availability: RoundAvailability;
  groups: SlotCountDto[];
}

export interface AdminOverviewDto {
  eventName: string;
  eventDate: string;
  isOpen: boolean;
  nearFullThreshold: number;
  totalAssigned: number;
  totalWaitlisted: number;
  totalCancelled: number;
  rounds: RoundOverviewDto[];
}

export interface AdminParticipantDto {
  id: string;
  name: string;
  nickname: string;
  birthdate: string;
  age: number;
  gender: Gender;
  phone: string;
  email: string;
  preferences: number[];
  status: ParticipantStatus;
  groupCode: GroupCode | null;
  roundNo: number | null;
  timeLabel: string | null;
  participantCode: string | null;
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

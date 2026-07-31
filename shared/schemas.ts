import { z } from 'zod';
import { GENDERS, GROUP_CODES, PREFERENCE_COUNT } from './constants';

/** 하이픈·공백·괄호를 제거하고 숫자만 남긴다. */
export const normalizePhone = (raw: string): string => raw.replace(/\D/g, '');

const KOREAN_MOBILE = /^01[016789]\d{7,8}$/;

const trimmedString = (min: number, max: number, label: string) =>
  z
    .string({ required_error: `${label}을(를) 입력해 주세요.` })
    .transform((value) => value.trim())
    .refine((value) => value.length >= min, { message: `${label}을(를) 입력해 주세요.` })
    .refine((value) => value.length <= max, {
      message: `${label}은(는) ${max}자 이내로 입력해 주세요.`,
    });

export const birthdateSchema = z
  .string({ required_error: '생년월일을 입력해 주세요.' })
  .regex(/^\d{4}-\d{2}-\d{2}$/, '생년월일을 YYYY-MM-DD 형식으로 입력해 주세요.')
  .refine((value) => {
    // 2월 30일 같은 값을 Date 가 자동 보정해 버리므로 왕복 비교로 검증한다.
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, '존재하지 않는 날짜입니다. 다시 확인해 주세요.');

export const phoneSchema = z
  .string({ required_error: '연락처를 입력해 주세요.' })
  .transform(normalizePhone)
  .refine((value) => KOREAN_MOBILE.test(value), '휴대폰 번호를 정확히 입력해 주세요. (예: 010-1234-5678)');

export const genderSchema = z.enum(GENDERS, {
  required_error: '성별을 선택해 주세요.',
  invalid_type_error: '성별을 선택해 주세요.',
});

export const groupCodeSchema = z.enum(GROUP_CODES);

export const preferencesSchema = z
  .array(z.number({ invalid_type_error: '희망 회차를 선택해 주세요.' }).int().positive())
  .length(PREFERENCE_COUNT, `희망 회차를 ${PREFERENCE_COUNT}순위까지 모두 선택해 주세요.`)
  .refine((values) => new Set(values).size === values.length, {
    message: '희망 회차는 서로 다르게 선택해 주세요.',
  });

/** 신청 폼 — 참가자 입력의 유일한 진입점 */
export const applicationSchema = z.object({
  name: trimmedString(1, 40, '이름'),
  nickname: trimmedString(1, 20, '닉네임'),
  birthdate: birthdateSchema,
  gender: genderSchema,
  phone: phoneSchema,
  email: z
    .string({ required_error: '이메일을 입력해 주세요.' })
    .transform((value) => value.trim().toLowerCase())
    .refine((value) => z.string().email().safeParse(value).success, '이메일 형식을 확인해 주세요.')
    .refine((value) => value.length <= 254, '이메일이 너무 깁니다.'),
  preferences: preferencesSchema,
});

export type ApplicationInput = z.infer<typeof applicationSchema>;

/** 본인 조회 — 생년월일 + 전화번호 뒤 4자리 */
export const lookupSchema = z.object({
  birthdate: birthdateSchema,
  phoneLast4: z
    .string({ required_error: '전화번호 뒤 4자리를 입력해 주세요.' })
    .transform(normalizePhone)
    .refine((value) => /^\d{4}$/.test(value), '전화번호 뒤 4자리를 숫자로 입력해 주세요.'),
});

export type LookupInput = z.infer<typeof lookupSchema>;

/** 회차 상태 조회 — 성별만 받는다(성별에 따라 정원이 분리되어 있으므로). */
export const roundAvailabilityQuerySchema = z.object({
  gender: genderSchema.optional(),
});

export const adminLoginSchema = z.object({
  email: z.string().trim().toLowerCase().email('이메일 형식을 확인해 주세요.'),
  password: z.string().min(8, '비밀번호는 8자 이상입니다.'),
});

export const adminParticipantQuerySchema = z.object({
  q: z.string().trim().max(60).optional(),
  status: z.enum(['assigned', 'waitlisted', 'cancelled']).optional(),
  roundNo: z.coerce.number().int().positive().optional(),
  groupCode: groupCodeSchema.optional(),
  gender: genderSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

/** 회차/그룹 변경 — 최소 하나는 있어야 한다. */
export const adminReassignSchema = z
  .object({
    roundNo: z.number().int().positive().optional(),
    groupCode: groupCodeSchema.optional(),
    reason: z.string().trim().max(200).optional(),
  })
  .refine((value) => value.roundNo !== undefined || value.groupCode !== undefined, {
    message: '변경할 회차 또는 그룹을 지정해 주세요.',
  });

export const adminPromoteSchema = z.object({
  roundNo: z.number().int().positive().optional(),
  groupCode: groupCodeSchema.optional(),
});

export const adminSettingsSchema = z
  .object({
    eventName: z.string().trim().min(1).max(60).optional(),
    eventDate: birthdateSchema.optional(),
    isOpen: z.boolean().optional(),
    nearFullThreshold: z.number().gt(0).lte(1).optional(),
  })
  .refine((value) => Object.values(value).some((v) => v !== undefined), {
    message: '변경할 항목이 없습니다.',
  });

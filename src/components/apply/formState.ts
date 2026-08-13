import { applicationSchema } from '@shared/schemas';
import type { Gender } from '@shared/types';

export interface ApplyFormState {
  name: string;
  birthdate: string;
  gender: Gender | null;
  phone: string;
  email: string;
  /** 선착순이므로 회차는 하나만 고른다. 아직 고르지 않았으면 null. */
  roundNo: number | null;
}

export const EMPTY_FORM: ApplyFormState = {
  name: '',
  birthdate: '',
  gender: null,
  phone: '',
  email: '',
  roundNo: null,
};

/** 불변 업데이트 — 기존 상태를 바꾸지 않고 새 객체를 만든다. */
export const updateForm = <K extends keyof ApplyFormState>(
  form: ApplyFormState,
  key: K,
  value: ApplyFormState[K],
): ApplyFormState => ({ ...form, [key]: value });

/**
 * 회차 상태 계산에 필요한 값. 정원이 (회차, 그룹, 성별) 단위이고 그룹은
 * 나이로 정해지므로, 이 둘만 있으면 그 사람 기준의 정확한 회차 상태가 나온다.
 * 그래서 신청서에서 가장 먼저 받는다.
 */
const identitySchema = applicationSchema.pick({
  birthdate: true,
  gender: true,
});

/** 배정 결과를 전달하는 데 필요한 값. 회차를 고른 뒤에 받는다. */
const contactSchema = applicationSchema.pick({
  name: true,
  phone: true,
  email: true,
});

/** 신원 단계에서 입력받는 필드. 제출 오류를 어느 단계로 되돌릴지 판단할 때도 쓴다. */
export const IDENTITY_FIELDS = ['birthdate', 'gender'] as const;

export type FieldErrors = Partial<Record<keyof ApplyFormState, string>>;

const toFieldErrors = (issues: { path: (string | number)[]; message: string }[]): FieldErrors => {
  const errors: FieldErrors = {};

  for (const issue of issues) {
    const key = issue.path[0];
    if (typeof key === 'string' && !(key in errors)) {
      errors[key as keyof ApplyFormState] = issue.message;
    }
  }

  return errors;
};

/** 1단계 검증 — 생년월일·성별. 서버와 같은 zod 스키마를 쓰므로 규칙이 어긋날 일이 없다. */
export const validateIdentity = (form: ApplyFormState): FieldErrors => {
  const result = identitySchema.safeParse(form);
  return result.success ? {} : toFieldErrors(result.error.issues);
};

/** 3단계 검증 — 이름·연락처·이메일. */
export const validateContact = (form: ApplyFormState): FieldErrors => {
  const result = contactSchema.safeParse(form);
  return result.success ? {} : toFieldErrors(result.error.issues);
};

/** 2단계 검증 — 회차를 하나 골랐는지 확인한다. */
export const validateRoundSelection = (form: ApplyFormState): FieldErrors =>
  form.roundNo === null ? { roundNo: '회차를 선택해 주세요.' } : {};

/** 서버로 보낼 형태로 정규화한다. */
export const toApplicationPayload = (form: ApplyFormState) => applicationSchema.parse(form);

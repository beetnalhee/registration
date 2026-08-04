import { applicationSchema } from '@shared/schemas';
import type { Gender } from '@shared/types';

export interface ApplyFormState {
  name: string;
  nickname: string;
  birthdate: string;
  gender: Gender | null;
  phone: string;
  email: string;
  /** 선착순이므로 회차는 하나만 고른다. 아직 고르지 않았으면 null. */
  roundNo: number | null;
}

export const EMPTY_FORM: ApplyFormState = {
  name: '',
  nickname: '',
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

const basicInfoSchema = applicationSchema.pick({
  name: true,
  nickname: true,
  birthdate: true,
  gender: true,
  phone: true,
  email: true,
});

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

/** 1단계 검증. 서버와 같은 zod 스키마를 쓰므로 규칙이 어긋날 일이 없다. */
export const validateBasicInfo = (form: ApplyFormState): FieldErrors => {
  const result = basicInfoSchema.safeParse(form);
  return result.success ? {} : toFieldErrors(result.error.issues);
};

/** 2단계 검증 — 회차를 하나 골랐는지 확인한다. */
export const validateRoundSelection = (form: ApplyFormState): FieldErrors =>
  form.roundNo === null ? { roundNo: '회차를 선택해 주세요.' } : {};

/** 서버로 보낼 형태로 정규화한다. */
export const toApplicationPayload = (form: ApplyFormState) => applicationSchema.parse(form);

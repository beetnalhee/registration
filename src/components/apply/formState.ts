import { applicationSchema } from '@shared/schemas';
import type { Gender } from '@shared/types';

export interface ApplyFormState {
  name: string;
  nickname: string;
  birthdate: string;
  gender: Gender | null;
  phone: string;
  email: string;
  /** 1순위 → 3순위 순서로 담긴 회차 번호 */
  preferences: number[];
}

export const EMPTY_FORM: ApplyFormState = {
  name: '',
  nickname: '',
  birthdate: '',
  gender: null,
  phone: '',
  email: '',
  preferences: [],
};

/** 불변 업데이트 — 기존 상태를 바꾸지 않고 새 객체를 만든다. */
export const updateForm = <K extends keyof ApplyFormState>(
  form: ApplyFormState,
  key: K,
  value: ApplyFormState[K],
): ApplyFormState => ({ ...form, [key]: value });

/**
 * 순위 토글.
 * 이미 선택된 회차를 다시 누르면 목록에서 빼고, 아니면 뒤에 붙인다.
 * 배열을 직접 수정하지 않고 새 배열을 반환한다.
 */
export const togglePreference = (preferences: number[], roundNo: number): number[] =>
  preferences.includes(roundNo)
    ? preferences.filter((value) => value !== roundNo)
    : [...preferences, roundNo];

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

/** 2단계 검증 — 모든 회차를 순서대로 골랐는지 확인한다. */
export const validatePreferences = (form: ApplyFormState, roundCount: number): FieldErrors => {
  if (form.preferences.length < roundCount) {
    return { preferences: `희망 순위를 ${roundCount}개 모두 선택해 주세요.` };
  }
  return {};
};

/** 서버로 보낼 형태로 정규화한다. */
export const toApplicationPayload = (form: ApplyFormState) => applicationSchema.parse(form);

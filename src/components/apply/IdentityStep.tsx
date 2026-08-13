import { GENDER_LABELS, GENDERS } from '@shared/constants';
import type { Gender } from '@shared/types';
import { BirthdateField } from '../ui/BirthdateField';
import { ChoiceGroup } from '../ui/Field';
import type { ApplyFormState, FieldErrors } from './formState';

interface IdentityStepProps {
  form: ApplyFormState;
  errors: FieldErrors;
  onChange: <K extends keyof ApplyFormState>(key: K, value: ApplyFormState[K]) => void;
}

const GENDER_OPTIONS = GENDERS.map((value) => ({
  value,
  label: GENDER_LABELS[value],
}));

/**
 * 1단계 — 생년월일·성별.
 *
 * 이 둘만 있으면 그 사람 기준의 정확한 회차 상태를 계산할 수 있어서 가장 먼저 받는다.
 * 이름·연락처를 다 적은 뒤에야 마감을 알게 되는 헛걸음을 막기 위한 순서다.
 *
 * 생년월일은 그룹 판정에 쓰이지만, 화면에서는 그 사실을 설명하지 않는다.
 * 참가자는 자신이 어떤 기준으로 그룹이 나뉘는지 알 필요가 없다.
 */
export const IdentityStep = ({ form, errors, onChange }: IdentityStepProps) => (
  <div className="space-y-5">
    <BirthdateField
      label="생년월일"
      value={form.birthdate}
      onChange={(value) => onChange('birthdate', value)}
      {...(errors.birthdate ? { error: errors.birthdate } : {})}
    />

    <ChoiceGroup<Gender>
      label="성별"
      name="gender"
      options={GENDER_OPTIONS}
      value={form.gender}
      onChange={(value) => onChange('gender', value)}
      {...(errors.gender ? { error: errors.gender } : {})}
    />
  </div>
);

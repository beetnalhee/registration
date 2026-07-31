import { GENDER_LABELS, GENDERS } from '@shared/constants';
import type { Gender } from '@shared/types';
import { ChoiceGroup, TextField } from '../ui/Field';
import type { ApplyFormState, FieldErrors } from './formState';

interface BasicInfoStepProps {
  form: ApplyFormState;
  errors: FieldErrors;
  onChange: <K extends keyof ApplyFormState>(key: K, value: ApplyFormState[K]) => void;
}

const GENDER_OPTIONS = GENDERS.map((value) => ({
  value,
  label: GENDER_LABELS[value],
  emoji: value === 'M' ? '🌊' : '🌸',
}));

/**
 * 1단계 — 기본 정보.
 *
 * 생년월일은 그룹 판정에 쓰이지만, 화면에서는 그 사실을 설명하지 않는다.
 * 참가자는 자신이 어떤 기준으로 그룹이 나뉘는지 알 필요가 없다.
 */
export const BasicInfoStep = ({ form, errors, onChange }: BasicInfoStepProps) => (
  <div className="space-y-5">
    <div className="grid grid-cols-2 gap-3">
      <TextField
        label="이름"
        name="name"
        autoComplete="name"
        placeholder="김희주"
        value={form.name}
        onChange={(event) => onChange('name', event.target.value)}
        {...(errors.name ? { error: errors.name } : {})}
      />
      <TextField
        label="닉네임"
        name="nickname"
        placeholder="현장에서 불릴 이름"
        value={form.nickname}
        onChange={(event) => onChange('nickname', event.target.value)}
        {...(errors.nickname ? { error: errors.nickname } : {})}
      />
    </div>

    <TextField
      label="생년월일"
      name="birthdate"
      type="date"
      value={form.birthdate}
      onChange={(event) => onChange('birthdate', event.target.value)}
      {...(errors.birthdate ? { error: errors.birthdate } : { hint: '참가 안내에 사용됩니다.' })}
    />

    <ChoiceGroup<Gender>
      label="성별"
      name="gender"
      options={GENDER_OPTIONS}
      value={form.gender}
      onChange={(value) => onChange('gender', value)}
      {...(errors.gender ? { error: errors.gender } : {})}
    />

    <TextField
      label="연락처"
      name="phone"
      type="tel"
      inputMode="numeric"
      autoComplete="tel"
      placeholder="010-1234-5678"
      value={form.phone}
      onChange={(event) => onChange('phone', event.target.value)}
      {...(errors.phone ? { error: errors.phone } : {})}
    />

    <TextField
      label="이메일"
      name="email"
      type="email"
      inputMode="email"
      autoComplete="email"
      placeholder="you@example.com"
      value={form.email}
      onChange={(event) => onChange('email', event.target.value)}
      {...(errors.email ? { error: errors.email } : { hint: '배정 결과를 이 주소로 보내드려요.' })}
    />
  </div>
);

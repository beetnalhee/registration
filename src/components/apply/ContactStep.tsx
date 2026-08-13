import { formatPhoneInput } from '@shared/format';
import { TextField } from '../ui/Field';
import type { ApplyFormState, FieldErrors } from './formState';

interface ContactStepProps {
  form: ApplyFormState;
  errors: FieldErrors;
  onChange: <K extends keyof ApplyFormState>(key: K, value: ApplyFormState[K]) => void;
}

/**
 * 3단계 — 연락처.
 *
 * 회차를 고른 뒤에 받는다. 자리가 있는지 먼저 확인하고 나서 개인정보를 적게 하면
 * 마감된 회차 때문에 헛수고하는 범위가 1단계의 두 필드로 줄어든다.
 */
export const ContactStep = ({ form, errors, onChange }: ContactStepProps) => (
  <div className="space-y-5">
    <TextField
      label="이름"
      name="name"
      autoComplete="name"
      placeholder="이름"
      value={form.name}
      onChange={(event) => onChange('name', event.target.value)}
      {...(errors.name ? { error: errors.name } : { hint: '리셉션에서 확인하는 이름이에요.' })}
    />

    {/* 하이픈은 입력하는 대로 자동으로 붙는다. 서버는 숫자만 남겨 저장한다. */}
    <TextField
      label="연락처"
      name="phone"
      type="tel"
      inputMode="numeric"
      autoComplete="tel"
      placeholder="010-1234-5678"
      value={form.phone}
      onChange={(event) => onChange('phone', formatPhoneInput(event.target.value))}
      {...(errors.phone ? { error: errors.phone } : { hint: '숫자만 입력해주세요.' })}
    />

    <TextField
      label="이메일"
      name="email"
      type="email"
      inputMode="email"
      autoComplete="email"
      placeholder="love@gmail.com"
      value={form.email}
      onChange={(event) => onChange('email', event.target.value)}
      {...(errors.email ? { error: errors.email } : { hint: '배정 결과를 이 주소로 보내드려요.' })}
    />
  </div>
);

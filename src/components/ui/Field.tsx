import type { InputHTMLAttributes, ReactNode } from 'react';

interface FieldShellProps {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}

export const FieldShell = ({ label, htmlFor, error, hint, children }: FieldShellProps) => (
  <div>
    <label className="label-text" htmlFor={htmlFor}>
      {label}
    </label>
    {children}
    {error ? (
      <p className="mt-1.5 text-[13px] text-peach-soft" role="alert">
        {error}
      </p>
    ) : hint ? (
      <p className="mt-1.5 text-[13px] text-slate-400">{hint}</p>
    ) : null}
  </div>
);

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export const TextField = ({ label, error, hint, id, className = '', ...rest }: TextFieldProps) => {
  const fieldId = id ?? `field-${rest.name ?? label}`;

  return (
    <FieldShell label={label} htmlFor={fieldId} {...(error ? { error } : {})} {...(hint ? { hint } : {})}>
      <input
        id={fieldId}
        aria-invalid={error ? true : undefined}
        className={`input-base ${error ? 'input-error' : ''} ${className}`}
        {...rest}
      />
    </FieldShell>
  );
};

export interface ChoiceOption<T extends string> {
  value: T;
  label: string;
}

interface ChoiceGroupProps<T extends string> {
  label: string;
  options: ChoiceOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  error?: string;
  name: string;
}

/** 성별처럼 선택지가 적을 때 쓰는 카드형 라디오 그룹 */
export const ChoiceGroup = <T extends string>({
  label,
  options,
  value,
  onChange,
  error,
  name,
}: ChoiceGroupProps<T>) => (
  <fieldset>
    <legend className="label-text">{label}</legend>
    <div className="grid grid-cols-2 gap-3">
      {options.map((option) => {
        const selected = value === option.value;

        return (
          <label
            key={option.value}
            className={[
              'flex cursor-pointer items-center justify-center gap-2 rounded-2xl border px-4 py-3.5',
              'text-[15px] transition-all duration-200',
              selected
                ? 'border-moonlight/70 bg-moonlight/15 text-moonlight-soft shadow-glow'
                : 'border-white/12 bg-midnight-700/60 text-slate-300 hover:border-white/25',
            ].join(' ')}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={selected}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            <span className={selected ? 'font-semibold' : ''}>{option.label}</span>
          </label>
        );
      })}
    </div>
    {error && (
      <p className="mt-1.5 text-[13px] text-peach-soft" role="alert">
        {error}
      </p>
    )}
  </fieldset>
);

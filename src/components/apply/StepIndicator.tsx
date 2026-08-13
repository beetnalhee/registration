const STEP_LABELS = ['기본 정보', '회차 선택', '연락처', '확인'] as const;

export const TOTAL_STEPS = STEP_LABELS.length;

export const StepIndicator = ({ current }: { current: number }) => (
  <ol className="mb-7 flex items-center gap-2" aria-label="신청 단계">
    {STEP_LABELS.map((label, index) => {
      const step = index + 1;
      const done = step < current;
      const active = step === current;

      return (
        <li key={label} className="flex flex-1 flex-col gap-2">
          <div
            className={[
              'h-1 rounded-full transition-colors duration-300',
              done || active ? 'bg-moon-gradient' : 'bg-white/10',
            ].join(' ')}
          />
          <span
            className={[
              'text-[12px] transition-colors duration-300',
              active ? 'font-semibold text-moonlight-soft' : done ? 'text-slate-400' : 'text-slate-600',
            ].join(' ')}
            aria-current={active ? 'step' : undefined}
          >
            {label}
          </span>
        </li>
      );
    })}
  </ol>
);

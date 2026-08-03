import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'ghost' | 'subtle' | 'danger';

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    'bg-moon-gradient text-midnight-900 font-bold shadow-glow hover:brightness-105 active:brightness-95',
  ghost:
    'border border-moonlight/40 text-moonlight-soft hover:border-moonlight/70 hover:bg-moonlight/10',
  subtle: 'border border-white/12 bg-white/[0.06] text-slate-200 hover:bg-white/[0.1]',
  danger: 'border border-peach-deep/50 bg-peach-deep/15 text-peach-soft hover:bg-peach-deep/25',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
  fullWidth?: boolean;
  children: ReactNode;
}

export const Button = ({
  variant = 'primary',
  loading = false,
  fullWidth = false,
  disabled,
  className = '',
  children,
  ...rest
}: ButtonProps) => (
  <button
    type="button"
    disabled={disabled || loading}
    className={[
      // whitespace-nowrap: 좁은 폭에서 '취소' 가 한 글자씩 세로로 쪼개지는 것을 막는다
      'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full px-6 py-3.5 text-[15px]',
      'transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-45',
      VARIANT_CLASSES[variant],
      // fullWidth 와 shrink-0 을 함께 주면 flex 안에서 줄어들지 못해 화면 밖으로 넘친다.
      // 폭을 채우는 버튼은 줄어들 수 있어야 하고, 그렇지 않은 버튼만 고정한다.
      fullWidth ? 'w-full min-w-0' : 'shrink-0',
      className,
    ]
      .filter(Boolean)
      .join(' ')}
    {...rest}
  >
    {loading && (
      <span
        aria-hidden
        className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
      />
    )}
    {children}
  </button>
);

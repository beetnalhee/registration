import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { NightSky } from './NightSky';

interface PageShellProps {
  children: ReactNode;
  /** 상단 뒤로가기/브랜드 영역을 숨긴다 (랜딩 페이지용) */
  bare?: boolean;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
}

const MAX_WIDTHS = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
  xl: 'max-w-6xl',
} as const;

export const PageShell = ({ children, bare = false, maxWidth = 'sm' }: PageShellProps) => (
  <div className="relative min-h-dvh">
    <NightSky />

    <div className={`mx-auto w-full px-5 pt-6 safe-bottom ${MAX_WIDTHS[maxWidth]}`}>
      {!bare && (
        <header className="mb-6 flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-2 text-[13px] tracking-wide text-slate-400 transition-colors hover:text-moonlight-soft"
          >
            <span aria-hidden>🌙</span>
            한여름 밤의 꿈
          </Link>
          <Link
            to="/lookup"
            className="text-[13px] text-slate-400 transition-colors hover:text-moonlight-soft"
          >
            내 배정 확인
          </Link>
        </header>
      )}

      {children}
    </div>
  </div>
);

export const SectionTitle = ({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) => (
  <div className="mb-6 animate-fade-up">
    {eyebrow && (
      <p className="mb-2 text-[12.5px] font-medium uppercase tracking-[0.18em] text-moonlight/70">
        {eyebrow}
      </p>
    )}
    <h1 className="font-display text-[26px] font-bold leading-tight tracking-tight text-slate-50">
      {title}
    </h1>
    {description && <p className="mt-2.5 text-[14.5px] leading-relaxed text-slate-400">{description}</p>}
  </div>
);

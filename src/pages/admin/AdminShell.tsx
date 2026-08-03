import type { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { NightSky } from '../../components/ui/NightSky';
import { logout } from '../../lib/adminApi';

const NAV_ITEMS = [
  { to: '/admin', label: '현황판' },
  { to: '/admin/reception', label: '출석 체크' },
  { to: '/admin/participants', label: '참가자 관리' },
] as const;

export const AdminShell = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/admin/login', { replace: true });
  };

  return (
    <div className="relative min-h-dvh">
      <NightSky />

      <div className="mx-auto w-full max-w-6xl px-5 pt-6 safe-bottom">
        <header className="mb-7 flex flex-wrap items-center justify-between gap-3">
          <nav className="flex items-center gap-1.5">
            {NAV_ITEMS.map((item) => {
              const active = location.pathname === item.to;

              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={[
                    'rounded-full px-4 py-2 text-[13.5px] transition-colors',
                    active
                      ? 'bg-moonlight/15 font-semibold text-moonlight-soft'
                      : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-200',
                  ].join(' ')}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={handleLogout}
            className="text-[13px] text-slate-500 transition-colors hover:text-peach-soft"
          >
            로그아웃
          </button>
        </header>

        {children}
      </div>
    </div>
  );
};

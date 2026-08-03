import { Link, useNavigate } from 'react-router-dom';
import { AvailabilityBadge } from '../components/ui/AvailabilityBadge';
import { Button } from '../components/ui/Button';
import { ErrorBanner, LoadingBlock } from '../components/ui/Feedback';
import { PageShell } from '../components/ui/PageShell';
import { useAsync } from '../hooks/useAsync';
import { fetchEventInfo, fetchRoundAvailability } from '../lib/publicApi';

const HighlightRow = ({ icon, children }: { icon: string; children: string }) => (
  <li className="flex items-center gap-2.5 text-[14px] text-slate-300">
    <span aria-hidden className="text-moonlight/80">
      {icon}
    </span>
    {children}
  </li>
);

export const LandingPage = () => {
  const navigate = useNavigate();

  const event = useAsync((signal) => fetchEventInfo(signal));
  const availability = useAsync((signal) => fetchRoundAvailability(undefined, signal));

  const availabilityOf = (roundNo: number) =>
    availability.data?.find((item) => item.roundNo === roundNo)?.availability ?? 'closed';

  const allClosed =
    availability.data !== null && availability.data.every((item) => item.availability === 'closed');

  return (
    <PageShell bare maxWidth="sm">
      <section className="pt-10 text-center">
        {/* 한글은 자간을 넓게 벌리면 흐트러져 보이므로 영문보다 좁게 잡는다 */}
        <p className="animate-fade-up text-[13px] font-medium tracking-[0.14em] text-moonlight/70">
          로테이션 소개팅
        </p>

        <h1 className="mt-5 animate-fade-up stagger-1 font-display text-[42px] font-black leading-[1.2] tracking-[-0.03em]">
          <span className="text-moon">사랑은 돌아오는 거야</span>
        </h1>

        <p className="mx-auto mt-5 max-w-[19rem] animate-fade-up stagger-2 text-[15px] leading-relaxed text-slate-300">
          짧은 3분, 그런데 이상하게 오래 남는 대화.
          <br />
          오늘 밤, 당신의 이야기가 시작됩니다.
        </p>

        <div className="mt-9 animate-fade-up stagger-3">
          <Button fullWidth onClick={() => navigate('/apply')} disabled={allClosed}>
            {allClosed ? '모든 회차가 마감되었어요' : '신청하기'}
          </Button>
          <Link
            to="/lookup"
            className="mt-4 inline-block text-[13.5px] text-slate-400 underline-offset-4 transition-colors hover:text-moonlight-soft hover:underline"
          >
            이미 신청했어요 · 내 배정 확인하기
          </Link>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="mb-4 flex items-center gap-2 text-[13px] font-medium tracking-[0.1em] text-slate-400">
          <span aria-hidden>✨</span> 회차 안내
        </h2>

        {event.error ? (
          <ErrorBanner message={event.error} />
        ) : event.loading || availability.loading ? (
          <LoadingBlock />
        ) : (
          <ul className="space-y-3">
            {event.data?.rounds.map((round, index) => (
              <li
                key={round.roundNo}
                className={`glass animate-fade-up stagger-${Math.min(index + 1, 4)} flex items-center justify-between px-5 py-4`}
              >
                <div>
                  <p className="text-[15px] font-semibold text-slate-100">{round.roundNo}회차</p>
                  <p className="mt-1 text-[13.5px] tabular-nums text-slate-400">{round.timeLabel}</p>
                </div>
                <AvailabilityBadge availability={availabilityOf(round.roundNo)} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="glass mt-8 px-5 py-5">
        <h2 className="mb-3.5 text-[14px] font-semibold text-slate-100">이렇게 진행돼요</h2>
        <ul className="space-y-2.5">
          <HighlightRow icon="📝">신청서를 작성하고 희망 회차를 3순위까지 고릅니다</HighlightRow>
          <HighlightRow icon="⚡">신청하는 순간 자리가 자동으로 배정됩니다</HighlightRow>
          <HighlightRow icon="💌">배정 결과는 화면과 이메일로 바로 알려드려요</HighlightRow>
        </ul>
      </section>

      {/* 관리자 로그인 링크는 노출하지 않는다. /admin/login 주소로 직접 접근한다. */}
      <div className="pb-10" />
    </PageShell>
  );
};

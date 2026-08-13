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
  // 성별·생년월일 없이 부르면 회차 전체를 합친 개괄 상태가 온다.
  const availability = useAsync((signal) => fetchRoundAvailability({}, signal));

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
        <h2 className="mb-2 flex items-center gap-2 text-[13px] font-medium tracking-[0.1em] text-slate-400">
          <span aria-hidden>✨</span> 회차 안내
        </h2>

        {/* 이 배지는 회차 전체를 합친 개괄이다. 정확한 상태는 생년월일·성별을 받아야
            나오므로, 여기 표시만 보고 확정으로 받아들이지 않도록 미리 알린다. */}
        <p className="mb-4 text-[13px] leading-relaxed text-slate-500">
          전체 접수 현황이에요. 신청 화면에서 지금 등록 가능한 회차를 확인해보세요.
        </p>

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
                  {/* 회차 선택 화면과 같은 기준으로 시작 시각만 보여준다.
                      전체 시간대는 배정이 확정된 뒤(결과 카드·이메일)에 안내한다. */}
                  <p className="mt-1 text-[13.5px] tabular-nums text-slate-400">{round.startsAt}</p>
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
          <HighlightRow icon="📝">신청서를 작성하고 참여할 회차를 하나 고릅니다</HighlightRow>
          <HighlightRow icon="⚡">선착순으로 자리가 즉시 배정됩니다</HighlightRow>
          <HighlightRow icon="💌">배정 결과는 화면과 이메일로 바로 알려드려요</HighlightRow>
        </ul>
      </section>

      {/* 관리자 로그인 링크는 노출하지 않는다. /admin/login 주소로 직접 접근한다. */}
      <div className="pb-10" />
    </PageShell>
  );
};

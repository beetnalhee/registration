import { useEffect } from 'react';
import { RoundOverviewCard } from '../../components/admin/RoundOverviewCard';
import { SettingsPanel } from '../../components/admin/SettingsPanel';
import { Button } from '../../components/ui/Button';
import { ErrorBanner, LoadingBlock } from '../../components/ui/Feedback';
import { useAsync } from '../../hooks/useAsync';
import { downloadParticipantsCsv, fetchOverview } from '../../lib/adminApi';
import { AdminShell } from './AdminShell';

/** 현황판 자동 갱신 주기 */
const REFRESH_INTERVAL_MS = 15_000;

const StatCard = ({ label, value, tone }: { label: string; value: number; tone: string }) => (
  <div className="glass px-4 py-4 text-center">
    <p className="text-[12px] text-slate-400">{label}</p>
    <p className={`mt-1.5 text-[26px] font-bold tabular-nums ${tone}`}>{value}</p>
  </div>
);

export const AdminDashboardPage = () => {
  const overview = useAsync((signal) => fetchOverview(signal));

  // 접수 중에는 여러 명이 동시에 신청하므로 주기적으로 다시 읽는다.
  useEffect(() => {
    const timer = setInterval(overview.reload, REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [overview.reload]);

  return (
    <AdminShell>
      {overview.error && <ErrorBanner message={overview.error} />}

      {overview.loading && !overview.data ? (
        <LoadingBlock />
      ) : overview.data ? (
        <div className="space-y-6 pb-12">
          <section className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-[24px] font-bold tracking-[-0.015em] text-slate-50">
                {overview.data.eventName}
              </h1>
              <p className="mt-1 text-[13px] text-slate-400">
                {overview.data.eventDate} ·{' '}
                {overview.data.isOpen ? (
                  <span className="text-glow-soft">접수 중</span>
                ) : (
                  <span className="text-peach-soft">접수 중단</span>
                )}
                <span className="ml-2 text-slate-600">{REFRESH_INTERVAL_MS / 1000}초마다 자동 갱신</span>
              </p>
            </div>

            <div className="flex gap-2">
              <Button variant="subtle" className="px-5 py-2.5 text-[13.5px]" onClick={overview.reload}>
                새로 고침
              </Button>
              <Button
                variant="ghost"
                className="px-5 py-2.5 text-[13.5px]"
                onClick={() => void downloadParticipantsCsv()}
              >
                CSV 다운로드
              </Button>
            </div>
          </section>

          <section className="grid grid-cols-2 gap-3">
            <StatCard label="배정 완료" value={overview.data.totalAssigned} tone="text-moonlight" />
            <StatCard label="취소" value={overview.data.totalCancelled} tone="text-slate-500" />
          </section>

          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {overview.data.rounds.map((round) => (
              <RoundOverviewCard key={round.roundNo} round={round} />
            ))}
          </section>

          <SettingsPanel overview={overview.data} onUpdated={overview.reload} />
        </div>
      ) : null}
    </AdminShell>
  );
};

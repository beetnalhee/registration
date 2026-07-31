import { useState } from 'react';
import type { AdminOverviewDto } from '@shared/types';
import { Button } from '../ui/Button';
import { toErrorMessage } from '../../hooks/useAsync';
import { updateSettings } from '../../lib/adminApi';

interface SettingsPanelProps {
  overview: AdminOverviewDto;
  onUpdated: () => void;
}

/**
 * 행사 설정.
 * '마감 임박' 기준을 관리자가 바꿀 수 있어야 한다는 요구사항을 여기서 충족한다.
 */
export const SettingsPanel = ({ overview, onUpdated }: SettingsPanelProps) => {
  const [threshold, setThreshold] = useState(Math.round(overview.nearFullThreshold * 100));
  const [eventDate, setEventDate] = useState(overview.eventDate);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const save = async (patch: Parameters<typeof updateSettings>[0], successMessage: string) => {
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      await updateSettings(patch);
      setMessage(successMessage);
      onUpdated();
    } catch (caught) {
      setError(toErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="glass px-5 py-5">
      <h2 className="mb-4 text-[14px] font-semibold text-slate-100">행사 설정</h2>

      <div className="space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[14px] font-medium text-slate-200">신청 접수</p>
            <p className="mt-0.5 text-[12.5px] text-slate-500">
              끄면 모든 회차가 마감으로 표시되고 신청이 차단됩니다.
            </p>
          </div>
          <Button
            variant={overview.isOpen ? 'danger' : 'ghost'}
            disabled={saving}
            className="shrink-0 px-5 py-2.5 text-[13.5px]"
            onClick={() =>
              void save(
                { isOpen: !overview.isOpen },
                overview.isOpen ? '접수를 중단했습니다.' : '접수를 다시 열었습니다.',
              )
            }
          >
            {overview.isOpen ? '접수 중단' : '접수 시작'}
          </Button>
        </div>

        <div className="border-t border-white/[0.07] pt-5">
          <label className="label-text" htmlFor="threshold">
            마감 임박 표시 기준 · {threshold}%
          </label>
          <p className="mb-3 text-[12.5px] text-slate-500">
            정원의 이 비율 이상 차면 참가자 화면에 🔥 마감 임박으로 표시됩니다.
          </p>
          <div className="flex items-center gap-4">
            <input
              id="threshold"
              type="range"
              min={10}
              max={100}
              step={5}
              value={threshold}
              onChange={(event) => setThreshold(Number(event.target.value))}
              className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-white/10 accent-moonlight"
            />
            <Button
              variant="subtle"
              disabled={saving || threshold === Math.round(overview.nearFullThreshold * 100)}
              className="shrink-0 px-5 py-2.5 text-[13.5px]"
              onClick={() =>
                void save({ nearFullThreshold: threshold / 100 }, '마감 임박 기준을 변경했습니다.')
              }
            >
              저장
            </Button>
          </div>
        </div>

        <div className="border-t border-white/[0.07] pt-5">
          <label className="label-text" htmlFor="eventDate">
            행사 당일 (만나이 계산 기준일)
          </label>
          <p className="mb-3 text-[12.5px] text-slate-500">
            이 값이 틀리면 그룹 배정이 어긋납니다. 접수 시작 전에 반드시 확인하세요.
          </p>
          <div className="flex items-center gap-3">
            <input
              id="eventDate"
              type="date"
              value={eventDate}
              onChange={(event) => setEventDate(event.target.value)}
              className="input-base flex-1"
            />
            <Button
              variant="subtle"
              disabled={saving || eventDate === overview.eventDate}
              className="shrink-0 px-5 py-2.5 text-[13.5px]"
              onClick={() => void save({ eventDate }, '행사 기준일을 변경했습니다.')}
            >
              저장
            </Button>
          </div>
        </div>
      </div>

      {message && <p className="mt-4 text-[13px] text-glow-soft">{message}</p>}
      {error && (
        <p className="mt-4 text-[13px] text-peach-soft" role="alert">
          {error}
        </p>
      )}
    </section>
  );
};

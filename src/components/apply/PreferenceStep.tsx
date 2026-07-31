import type { RoundAvailabilityDto, RoundInfo } from '@shared/types';
import { AvailabilityBadge } from '../ui/AvailabilityBadge';
import type { FieldErrors } from './formState';

interface PreferenceStepProps {
  rounds: RoundInfo[];
  availability: RoundAvailabilityDto[];
  preferences: number[];
  errors: FieldErrors;
  onToggle: (roundNo: number) => void;
  onReset: () => void;
}

const RANK_LABELS = ['1순위', '2순위', '3순위'] as const;

/**
 * 2단계 — 희망 회차 순위 선택.
 *
 * 회차 카드에는 '신청 가능 / 마감 임박 / 마감' 상태만 표시한다.
 * 남녀 인원수·잔여석·신청 인원은 서버가 내려주지 않으므로 표시할 수도 없다.
 */
export const PreferenceStep = ({
  rounds,
  availability,
  preferences,
  errors,
  onToggle,
  onReset,
}: PreferenceStepProps) => {
  const rankOf = (roundNo: number): number => preferences.indexOf(roundNo);

  const availabilityOf = (roundNo: number) =>
    availability.find((item) => item.roundNo === roundNo)?.availability ?? 'closed';

  const everyRoundClosed =
    availability.length > 0 && availability.every((item) => item.availability === 'closed');

  return (
    <div>
      <p className="mb-4 text-[14px] leading-relaxed text-slate-400">
        원하는 순서대로 회차를 눌러주세요. 누른 순서가 그대로 희망 순위가 됩니다.
      </p>

      <ul className="space-y-3">
        {rounds.map((round) => {
          const rank = rankOf(round.roundNo);
          const selected = rank >= 0;
          const closed = availabilityOf(round.roundNo) === 'closed';

          return (
            <li key={round.roundNo}>
              <button
                type="button"
                onClick={() => onToggle(round.roundNo)}
                aria-pressed={selected}
                className={[
                  'flex w-full items-center gap-4 rounded-3xl border px-5 py-4 text-left',
                  'transition-all duration-200',
                  selected
                    ? 'border-moonlight/60 bg-moonlight/12 shadow-glow'
                    : 'border-white/10 bg-white/[0.05] hover:border-white/25',
                  closed && !selected ? 'opacity-60' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <span
                  aria-hidden
                  className={[
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[12px] font-bold',
                    selected
                      ? 'bg-moon-gradient text-midnight-900'
                      : 'border border-white/15 text-slate-500',
                  ].join(' ')}
                >
                  {selected ? RANK_LABELS[rank] : round.roundNo}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold text-slate-100">
                    {round.roundNo}회차
                  </span>
                  <span className="mt-0.5 block text-[13.5px] tabular-nums text-slate-400">
                    {round.timeLabel}
                  </span>
                </span>

                <AvailabilityBadge availability={availabilityOf(round.roundNo)} />
              </button>
            </li>
          );
        })}
      </ul>

      {preferences.length > 0 && (
        <button
          type="button"
          onClick={onReset}
          className="mt-4 text-[13px] text-slate-400 underline-offset-4 transition-colors hover:text-moonlight-soft hover:underline"
        >
          순위 다시 정하기
        </button>
      )}

      {errors.preferences && (
        <p className="mt-4 text-[13px] text-peach-soft" role="alert">
          {errors.preferences}
        </p>
      )}

      {everyRoundClosed ? (
        <p className="mt-5 rounded-2xl border border-peach/30 bg-peach/10 px-4 py-3.5 text-[13.5px] leading-relaxed text-peach-soft">
          지금은 모든 회차가 마감되었어요. 신청하시면 대기 명단에 올라가고, 자리가 생기면 순서대로
          안내드립니다.
        </p>
      ) : (
        <p className="mt-5 text-[13px] leading-relaxed text-slate-500">
          마감된 회차도 순위에 담을 수 있어요. 앞순위가 마감이면 다음 순위로 자동 배정됩니다.
        </p>
      )}
    </div>
  );
};

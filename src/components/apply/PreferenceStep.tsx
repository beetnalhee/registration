import type { RoundAvailabilityDto, RoundInfo } from '@shared/types';
import { AvailabilityBadge } from '../ui/AvailabilityBadge';
import type { FieldErrors } from './formState';

interface PreferenceStepProps {
  rounds: RoundInfo[];
  availability: RoundAvailabilityDto[];
  selected: number | null;
  errors: FieldErrors;
  onSelect: (roundNo: number) => void;
}

/**
 * 2단계 — 회차 선택 (선착순, 1개만).
 *
 * 마감된 회차도 고를 수 있게 둔다. 선택을 막으면 전 회차 마감 시
 * 아무도 신청할 수 없어 대기자가 생기지 않고, 대기자가 없으면
 * 취소로 열린 자리를 채울 사람이 없어진다.
 * 대신 마감 회차를 고르면 대기자가 된다는 사실을 분명히 알린다.
 *
 * 회차 카드에는 '신청 가능 / 마감 임박 / 마감' 상태만 표시한다.
 * 남녀 인원수·잔여석은 서버가 내려주지 않으므로 표시할 수도 없다.
 */
export const PreferenceStep = ({
  rounds,
  availability,
  selected,
  errors,
  onSelect,
}: PreferenceStepProps) => {
  const availabilityOf = (roundNo: number) =>
    availability.find((item) => item.roundNo === roundNo)?.availability ?? 'closed';

  const selectedIsClosed = selected !== null && availabilityOf(selected) === 'closed';

  return (
    <div>
      <p className="mb-4 text-[14px] leading-relaxed text-slate-400">
        참여할 회차를 하나 골라주세요. 선착순으로 자리가 배정됩니다.
      </p>

      <ul className="space-y-3">
        {rounds.map((round) => {
          const chosen = selected === round.roundNo;
          const closed = availabilityOf(round.roundNo) === 'closed';

          return (
            <li key={round.roundNo}>
              <button
                type="button"
                onClick={() => onSelect(round.roundNo)}
                aria-pressed={chosen}
                className={[
                  'flex w-full items-center gap-4 rounded-3xl border px-5 py-4 text-left',
                  'transition-all duration-200',
                  chosen
                    ? 'border-moonlight/60 bg-moonlight/12 shadow-glow'
                    : 'border-white/10 bg-white/[0.05] hover:border-white/25',
                  closed && !chosen ? 'opacity-60' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <span
                  aria-hidden
                  className={[
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-bold',
                    chosen
                      ? 'bg-moon-gradient text-midnight-900'
                      : 'border border-white/15 text-slate-500',
                  ].join(' ')}
                >
                  {chosen ? '✓' : round.roundNo}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold text-slate-100">
                    {round.roundNo}회차
                  </span>
                  <span className="mt-0.5 block text-[13.5px] tabular-nums text-slate-400">
                    {round.startsAt}
                  </span>
                </span>

                <AvailabilityBadge availability={availabilityOf(round.roundNo)} />
              </button>
            </li>
          );
        })}
      </ul>

      {errors.roundNo && (
        <p className="mt-4 text-[13px] text-peach-soft" role="alert">
          {errors.roundNo}
        </p>
      )}

      {selectedIsClosed ? (
        <p className="mt-5 rounded-2xl border border-peach/30 bg-peach/10 px-4 py-3.5 text-[13.5px] leading-relaxed text-peach-soft">
          이 회차는 이미 마감되어 <strong className="font-semibold">대기자로 등록</strong>됩니다.
          자리가 생기면 순서대로 안내드릴게요.
        </p>
      ) : (
        <p className="mt-5 text-[13px] leading-relaxed text-slate-500">
          마감된 회차를 고르면 대기자로 등록되고, 자리가 생기면 순서대로 안내드려요.
        </p>
      )}
    </div>
  );
};

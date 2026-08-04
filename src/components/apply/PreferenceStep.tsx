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
 * 마감된 회차는 선택할 수 없다. 대기자 제도가 없으므로 고를 수 있게 두면
 * 신청 버튼을 눌렀을 때 거절되는 헛걸음만 만든다.
 *
 * 회차 카드에는 '신청 가능 / 마감 임박 / 마감' 상태만 표시한다.
 * 정원은 (회차, 그룹, 성별) 단위지만 그룹이 무엇인지는 알려주지 않고,
 * 인원수·잔여석도 서버가 내려주지 않으므로 표시할 수 없다.
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

  const allClosed =
    rounds.length > 0 && rounds.every((round) => availabilityOf(round.roundNo) === 'closed');

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
                disabled={closed}
                aria-pressed={chosen}
                className={[
                  'flex w-full items-center gap-4 rounded-3xl border px-5 py-4 text-left',
                  'transition-all duration-200',
                  closed
                    ? 'cursor-not-allowed border-white/[0.06] bg-white/[0.02] opacity-50'
                    : chosen
                      ? 'border-moonlight/60 bg-moonlight/12 shadow-glow'
                      : 'border-white/10 bg-white/[0.05] hover:border-white/25',
                ].join(' ')}
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

      {allClosed && (
        <p className="mt-5 rounded-2xl border border-peach/30 bg-peach/10 px-4 py-3.5 text-[13.5px] leading-relaxed text-peach-soft">
          모든 회차가 마감되었어요. 취소가 생기면 자리가 다시 열리니 조금 뒤에 확인해 주세요.
        </p>
      )}
    </div>
  );
};

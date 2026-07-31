import type { RoundOverviewDto } from '@shared/types';
import { AvailabilityBadge } from '../ui/AvailabilityBadge';

const ratio = (filled: number, capacity: number): number =>
  capacity > 0 ? Math.min(filled / capacity, 1) : 0;

const GenderBar = ({
  label,
  filled,
  capacity,
  tone,
}: {
  label: string;
  filled: number;
  capacity: number;
  tone: 'male' | 'female';
}) => (
  <div>
    <div className="mb-1.5 flex items-baseline justify-between">
      <span className="text-[12.5px] text-slate-400">{label}</span>
      <span className="text-[13.5px] font-semibold tabular-nums text-slate-100">
        {filled}
        <span className="text-slate-500"> / {capacity}</span>
      </span>
    </div>
    <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
      <div
        className={`h-full rounded-full transition-[width] duration-500 ${
          tone === 'male' ? 'bg-glow-deep' : 'bg-peach-deep'
        }`}
        style={{ width: `${ratio(filled, capacity) * 100}%` }}
      />
    </div>
  </div>
);

/**
 * 관리자 현황판의 회차 카드.
 * 관리자에게는 실제 인원수와 성비를 그대로 보여준다(참가자 화면과 다른 점).
 */
export const RoundOverviewCard = ({ round }: { round: RoundOverviewDto }) => (
  <article className="glass px-5 py-5">
    <header className="mb-4 flex items-center justify-between gap-3">
      <div>
        <h3 className="text-[15.5px] font-bold text-slate-50">{round.roundNo}회차</h3>
        <p className="mt-0.5 text-[13px] tabular-nums text-slate-400">{round.timeLabel}</p>
      </div>
      <AvailabilityBadge availability={round.availability} />
    </header>

    <div className="space-y-3.5">
      <GenderBar label="남성" filled={round.male.filled} capacity={round.male.capacity} tone="male" />
      <GenderBar
        label="여성"
        filled={round.female.filled}
        capacity={round.female.capacity}
        tone="female"
      />
    </div>

    <div className="mt-4 border-t border-white/[0.07] pt-3.5">
      <p className="mb-2 text-[11.5px] uppercase tracking-[0.14em] text-slate-500">그룹 구성</p>
      <ul className="space-y-1.5">
        {round.groups.map((group) => {
          const gap = Math.abs(group.male - group.female);

          return (
            <li key={group.groupCode} className="flex items-center justify-between text-[13px]">
              <span className="font-medium text-slate-300">{group.groupCode}</span>
              <span className="tabular-nums text-slate-400">
                남 {group.male} · 여 {group.female}
                {gap >= 3 && (
                  <span className="ml-2 text-peach-soft" title="그룹 내 성비 차이가 큽니다">
                    ±{gap}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  </article>
);

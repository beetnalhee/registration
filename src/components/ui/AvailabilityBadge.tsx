import { ROUND_AVAILABILITY_ICONS, ROUND_AVAILABILITY_LABELS } from '@shared/constants';
import type { RoundAvailability } from '@shared/types';

const STYLES: Record<RoundAvailability, string> = {
  open: 'border-glow/40 bg-glow/10 text-glow-soft',
  near_full: 'border-peach/50 bg-peach/12 text-peach-soft',
  closed: 'border-white/12 bg-white/[0.04] text-slate-500',
};

/**
 * 회차 상태 배지.
 * 참가자에게 보여줄 수 있는 정보는 이 세 상태뿐이다.
 * 인원수·잔여석은 서버가 내려주지도 않으므로 여기서 표시할 수 없다.
 */
export const AvailabilityBadge = ({ availability }: { availability: RoundAvailability }) => (
  <span
    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12.5px] font-medium ${STYLES[availability]}`}
  >
    <span aria-hidden>{ROUND_AVAILABILITY_ICONS[availability]}</span>
    {ROUND_AVAILABILITY_LABELS[availability]}
  </span>
);

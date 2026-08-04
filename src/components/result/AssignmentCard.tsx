import type { AssignmentResultDto } from '@shared/types';

const InfoRow = ({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) => (
  <div className="flex items-center justify-between gap-4 border-b border-white/[0.07] py-3.5 last:border-0">
    <span className="text-[13px] text-slate-400">{label}</span>
    <span
      className={
        emphasis
          ? 'font-mono text-[19px] font-bold tracking-[0.06em] text-moonlight'
          : 'text-[15.5px] font-semibold text-slate-50'
      }
    >
      {value}
    </span>
  </div>
);

/**
 * 배정 결과 카드. 신청 완료 화면과 조회 화면이 함께 쓴다.
 *
 * 대기자 제도가 없으므로 이 카드는 언제나 확정된 자리를 보여준다.
 * 참가자에게 보여주는 값은 서버가 내려준 것뿐이고, 그룹이 왜 그렇게
 * 정해졌는지(연령 구간·성비 보정)는 표시하지 않는다.
 */
export const AssignmentCard = ({ result }: { result: AssignmentResultDto }) => (
  <div className="glass animate-fade-up overflow-hidden">
    <div className="border-b border-white/[0.07] bg-moonlight/[0.06] px-6 py-6 text-center">
      <div aria-hidden className="text-[34px] animate-float">
        🌙
      </div>
      <h2 className="mt-3 font-display text-[22px] font-extrabold tracking-[-0.02em] text-moonlight-soft">
        신청이 완료되었습니다
      </h2>
      <p className="mt-2 text-[13.5px] text-slate-400">{result.nickname}님, 여름밤에서 만나요</p>
    </div>

    <div className="px-6 py-2">
      <InfoRow label="그룹" value={result.groupCode} />
      <InfoRow label="회차" value={`${result.roundNo}회차`} />
      <InfoRow label="시간" value={result.timeLabel} />
      <InfoRow label="참가번호" value={result.participantCode} emphasis />
    </div>

    <p className="border-t border-white/[0.07] px-6 py-4 text-center text-[12.5px] leading-relaxed text-slate-500">
      시간 맞춰 입장해 주세요.
      <br />
      참가번호로 자리를 안내드립니다.
    </p>
  </div>
);

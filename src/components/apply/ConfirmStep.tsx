import { GENDER_LABELS } from '@shared/constants';
import { formatPhone, formatRoundLabel } from '@shared/format';
import { normalizePhone } from '@shared/schemas';
import type { RoundInfo } from '@shared/types';
import type { ApplyFormState } from './formState';

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-start justify-between gap-4 border-b border-white/[0.07] py-3 last:border-0">
    <span className="shrink-0 text-[13px] text-slate-400">{label}</span>
    <span className="text-right text-[14.5px] font-medium text-slate-100">{value}</span>
  </div>
);

/**
 * 3단계 — 확인.
 * 배정 결과는 여기서 예측해서 보여주지 않는다. 배정은 서버만 수행한다.
 */
export const ConfirmStep = ({
  form,
  rounds,
}: {
  form: ApplyFormState;
  rounds: RoundInfo[];
}) => {
  const timeLabelOf = (roundNo: number) =>
    rounds.find((round) => round.roundNo === roundNo)?.timeLabel ?? '';

  return (
    <div>
      <div className="glass px-5 py-2">
        <Row label="이름" value={form.name} />
        <Row label="닉네임" value={form.nickname} />
        <Row label="생년월일" value={form.birthdate} />
        <Row label="성별" value={form.gender ? GENDER_LABELS[form.gender] : '-'} />
        <Row label="연락처" value={formatPhone(normalizePhone(form.phone))} />
        <Row label="이메일" value={form.email} />
      </div>

      <h2 className="mb-3 mt-6 text-[13px] font-medium uppercase tracking-[0.16em] text-slate-400">
        희망 회차
      </h2>
      <ol className="glass space-y-0 px-5 py-2">
        {form.preferences.map((roundNo, index) => (
          <Row
            key={roundNo}
            label={`${index + 1}순위`}
            value={`${formatRoundLabel(roundNo)} · ${timeLabelOf(roundNo)}`}
          />
        ))}
      </ol>

      <p className="mt-6 text-[13px] leading-relaxed text-slate-500">
        신청을 누르면 자리가 바로 배정되고, 결과를 화면과 이메일로 안내드려요.
        <br />
        배정 후에는 직접 변경할 수 없으니 정보를 한 번 더 확인해 주세요.
      </p>
    </div>
  );
};

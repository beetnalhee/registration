import { useState } from 'react';
import { PARTICIPANT_STATUS_LABELS } from '@shared/constants';
import { lookupSchema } from '@shared/schemas';
import type { LookupResultDto } from '@shared/types';
import { AssignmentCard } from '../components/result/AssignmentCard';
import { Button } from '../components/ui/Button';
import { ErrorBanner } from '../components/ui/Feedback';
import { TextField } from '../components/ui/Field';
import { PageShell, SectionTitle } from '../components/ui/PageShell';
import { toErrorMessage } from '../hooks/useAsync';
import { ApiError } from '../lib/api';
import { lookupAssignment } from '../lib/publicApi';

interface LookupFormState {
  birthdate: string;
  phoneLast4: string;
}

const EMPTY: LookupFormState = { birthdate: '', phoneLast4: '' };

/**
 * 본인 조회.
 *
 * 키를 (생년월일 + 전화 뒤 4자리)로 잡은 이유:
 *  - 닉네임은 중복될 수 있고 본인이 정확히 재입력하지 못하는 경우가 많다
 *  - 이 두 값은 표기가 하나뿐이고 참가자가 절대 잊지 않는다
 * 서버는 요청 수를 제한하고 이름을 마스킹해서 돌려준다.
 */
export const LookupPage = () => {
  const [form, setForm] = useState<LookupFormState>(EMPTY);
  const [fieldErrors, setFieldErrors] = useState<Partial<LookupFormState>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LookupResultDto | null>(null);

  const handleSubmit = async () => {
    setError(null);

    const parsed = lookupSchema.safeParse(form);

    if (!parsed.success) {
      const next: Partial<LookupFormState> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if ((key === 'birthdate' || key === 'phoneLast4') && !(key in next)) {
          next[key] = issue.message;
        }
      }
      setFieldErrors(next);
      return;
    }

    setFieldErrors({});
    setLoading(true);

    try {
      setResult(await lookupAssignment(parsed.data));
    } catch (caught) {
      setResult(null);
      setError(caught instanceof ApiError ? caught.message : toErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    return (
      <PageShell>
        <div className="mb-5 flex items-center justify-between gap-3">
          <p className="text-[14px] text-slate-300">
            <strong className="font-semibold text-slate-100">{result.maskedName}</strong>님의 신청
            내역
          </p>
          <span className="rounded-full border border-white/12 bg-white/[0.05] px-3 py-1 text-[12px] text-slate-300">
            {PARTICIPANT_STATUS_LABELS[result.status]}
          </span>
        </div>

        <AssignmentCard result={result} />

        <div className="mt-6 pb-10">
          <Button
            variant="subtle"
            fullWidth
            onClick={() => {
              setResult(null);
              setForm(EMPTY);
            }}
          >
            다시 조회하기
          </Button>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      {/* 제목만으로 충분해 eyebrow 를 두지 않는다 ('배정 조회' 같은 말은 제목과 중복된다) */}
      <SectionTitle
        title="내 배정 확인하기"
        description="신청할 때 입력한 생년월일과 전화번호 뒤 4자리를 넣어주세요."
      />

      {error && <ErrorBanner message={error} />}

      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit();
        }}
      >
        <TextField
          label="생년월일"
          name="birthdate"
          type="date"
          value={form.birthdate}
          onChange={(event) => setForm((previous) => ({ ...previous, birthdate: event.target.value }))}
          {...(fieldErrors.birthdate ? { error: fieldErrors.birthdate } : {})}
        />

        <TextField
          label="전화번호 뒤 4자리"
          name="phoneLast4"
          inputMode="numeric"
          maxLength={4}
          placeholder="8241"
          value={form.phoneLast4}
          onChange={(event) =>
            setForm((previous) => ({
              ...previous,
              phoneLast4: event.target.value.replace(/\D/g, '').slice(0, 4),
            }))
          }
          {...(fieldErrors.phoneLast4 ? { error: fieldErrors.phoneLast4 } : {})}
        />

        <Button type="submit" fullWidth loading={loading}>
          조회하기
        </Button>
      </form>
    </PageShell>
  );
};

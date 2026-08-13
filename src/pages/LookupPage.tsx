import { useState } from 'react';
import { lookupSchema } from '@shared/schemas';
import type { LookupResultDto } from '@shared/types';
import { AssignmentCard } from '../components/result/AssignmentCard';
import { Button } from '../components/ui/Button';
import { ErrorBanner } from '../components/ui/Feedback';
import { TextField } from '../components/ui/Field';
import { PageShell, SectionTitle } from '../components/ui/PageShell';
import { toErrorMessage } from '../hooks/useAsync';
import { ApiError } from '../lib/api';
import { cancelOwnApplication, lookupAssignment } from '../lib/publicApi';

interface LookupFormState {
  email: string;
  phoneLast4: string;
}

const EMPTY: LookupFormState = { email: '', phoneLast4: '' };

/**
 * 본인 조회 및 취소.
 *
 * 키를 (이메일 + 전화 뒤 4자리)로 잡은 이유:
 * 이 화면에서 취소까지 할 수 있으므로 자격증명이 지인에게 쉽게 알려지는 값이면 안 된다.
 * 생년월일은 그 조건을 만족하지 못한다.
 *
 * 취소는 되돌릴 수 없으므로 두 단계 확인을 거치게 한다.
 */
export const LookupPage = () => {
  const [form, setForm] = useState<LookupFormState>(EMPTY);
  const [fieldErrors, setFieldErrors] = useState<Partial<LookupFormState>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LookupResultDto | null>(null);

  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelledName, setCancelledName] = useState<string | null>(null);

  const reset = () => {
    setResult(null);
    setForm(EMPTY);
    setConfirmingCancel(false);
    setError(null);
  };

  const handleSubmit = async () => {
    setError(null);

    const parsed = lookupSchema.safeParse(form);

    if (!parsed.success) {
      const next: Partial<LookupFormState> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if ((key === 'email' || key === 'phoneLast4') && !(key in next)) {
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

  const handleCancel = async () => {
    const parsed = lookupSchema.safeParse(form);
    if (!parsed.success) {
      return;
    }

    setCancelling(true);
    setError(null);

    try {
      const { name } = await cancelOwnApplication(parsed.data);
      setCancelledName(name);
      setResult(null);
      setConfirmingCancel(false);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : toErrorMessage(caught));
    } finally {
      setCancelling(false);
    }
  };

  // ── 취소 완료 화면 ────────────────────────────────────────────────
  if (cancelledName !== null) {
    return (
      <PageShell>
        <div className="glass animate-fade-up px-6 py-8 text-center">
          <div aria-hidden className="text-[32px]">
            🌙
          </div>
          <h1 className="mt-3 text-[20px] font-extrabold tracking-[-0.02em] text-slate-50">
            신청이 취소되었습니다
          </h1>
          <p className="mt-3 text-[14.5px] leading-relaxed text-slate-400">
            {cancelledName}님의 자리가 반납되었어요.
            <br />
            다시 참여하고 싶으시면 새로 신청해 주세요.
          </p>
        </div>

        <div className="mt-6 space-y-3 pb-10">
          <Button fullWidth onClick={() => (window.location.href = '/apply')}>
            새로 신청하기
          </Button>
          <Button variant="subtle" fullWidth onClick={() => (window.location.href = '/')}>
            처음으로
          </Button>
        </div>
      </PageShell>
    );
  }

  // ── 조회 결과 화면 ────────────────────────────────────────────────
  if (result) {
    return (
      <PageShell>
        <p className="mb-5 text-[14px] text-slate-300">
          <strong className="font-semibold text-slate-100">{result.name}</strong>님의 신청 내역
        </p>

        {error && <ErrorBanner message={error} />}

        <AssignmentCard result={result} />

        {confirmingCancel ? (
          <div className="glass-soft mt-6 border-peach-deep/40 bg-peach-deep/10 px-5 py-5">
            <h2 className="text-[15px] font-bold text-peach-soft">정말 취소하시겠어요?</h2>
            <p className="mt-2.5 text-[13.5px] leading-relaxed text-slate-300">
              취소하면 자리가 <strong className="font-semibold">즉시 다른 분에게 열립니다.</strong>
              <br />
              되돌릴 수 없고, 다시 참여하려면 새로 신청해야 해요. 그때 자리가 남아 있지 않으면
              참여하실 수 없습니다.
            </p>

            <div className="mt-5 flex gap-2">
              <Button
                variant="subtle"
                fullWidth
                disabled={cancelling}
                className="py-3 text-[14px]"
                onClick={() => setConfirmingCancel(false)}
              >
                그대로 둘게요
              </Button>
              <Button
                variant="danger"
                fullWidth
                loading={cancelling}
                className="py-3 text-[14px]"
                onClick={() => void handleCancel()}
              >
                취소하겠습니다
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-6 space-y-3 pb-10">
            <Button variant="subtle" fullWidth onClick={reset}>
              다시 조회하기
            </Button>
            <button
              type="button"
              onClick={() => setConfirmingCancel(true)}
              className="w-full py-2 text-[13px] text-slate-500 underline-offset-4 transition-colors hover:text-peach-soft hover:underline"
            >
              신청 취소하기
            </button>
          </div>
        )}
      </PageShell>
    );
  }

  // ── 조회 입력 화면 ────────────────────────────────────────────────
  return (
    <PageShell>
      <SectionTitle
        title="내 배정 확인하기"
        description="신청할 때 입력한 이메일과 전화번호 뒤 4자리를 넣어주세요."
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
          label="이메일"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="love@gmail.com"
          value={form.email}
          onChange={(event) => setForm((previous) => ({ ...previous, email: event.target.value }))}
          {...(fieldErrors.email ? { error: fieldErrors.email } : {})}
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

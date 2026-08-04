import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BasicInfoStep } from '../components/apply/BasicInfoStep';
import { ConfirmStep } from '../components/apply/ConfirmStep';
import { PreferenceStep } from '../components/apply/PreferenceStep';
import { StepIndicator, TOTAL_STEPS } from '../components/apply/StepIndicator';
import {
  EMPTY_FORM,
  toApplicationPayload,
  updateForm,
  validateBasicInfo,
  validateRoundSelection,
  type ApplyFormState,
  type FieldErrors,
} from '../components/apply/formState';
import { Button } from '../components/ui/Button';
import { ErrorBanner, LoadingBlock } from '../components/ui/Feedback';
import { PageShell, SectionTitle } from '../components/ui/PageShell';
import { useAsync, toErrorMessage } from '../hooks/useAsync';
import { ApiError } from '../lib/api';
import { fetchEventInfo, fetchRoundAvailability, submitApplication } from '../lib/publicApi';
import { saveAssignmentResult } from '../lib/resultStorage';

const STEP_TITLES = ['어떤 분이신가요?', '언제 만날까요?', '이대로 신청할까요?'] as const;

export const ApplyPage = () => {
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [form, setForm] = useState<ApplyFormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const event = useAsync((signal) => fetchEventInfo(signal));

  // 정원이 (회차, 그룹, 성별) 단위라 성별과 생년월일이 모두 있어야
  // 정확한 상태가 나온다. 그룹 판정은 서버가 한다.
  const availability = useAsync(
    (signal) =>
      fetchRoundAvailability(
        {
          ...(form.gender ? { gender: form.gender } : {}),
          ...(form.birthdate ? { birthdate: form.birthdate } : {}),
        },
        signal,
      ),
    [form.gender, form.birthdate],
  );

  const handleChange = <K extends keyof ApplyFormState>(key: K, value: ApplyFormState[K]) => {
    setForm((previous) => updateForm(previous, key, value));
    setErrors((previous) => ({ ...previous, [key]: undefined }));
  };

  const rounds = event.data?.rounds ?? [];

  const goNext = () => {
    if (step === 1) {
      const found = validateBasicInfo(form);
      setErrors(found);
      if (Object.keys(found).length > 0) {
        return;
      }
    }

    if (step === 2) {
      const found = validateRoundSelection(form);
      setErrors(found);
      if (Object.keys(found).length > 0) {
        return;
      }
    }

    setStep((current) => Math.min(current + 1, TOTAL_STEPS));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goBack = () => {
    if (step === 1) {
      navigate('/');
      return;
    }
    setStep((current) => current - 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError(null);

    try {
      const result = await submitApplication(toApplicationPayload(form));

      // 새로 고침으로 중복 제출되지 않도록 결과는 세션에만 담고 이동한다.
      saveAssignmentResult(result);
      navigate('/apply/complete', { replace: true });
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fields).length > 0) {
        setErrors(error.fields as FieldErrors);
        setStep(1);
      } else if (error instanceof ApiError && error.code === 'ROUND_FULL') {
        // 폼을 채우는 동안 마감된 경우. 최신 상태로 갱신하고 다시 고르게 한다.
        setForm((previous) => ({ ...previous, roundNo: null }));
        availability.reload();
        setStep(2);
      }
      setSubmitError(toErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  if (event.loading) {
    return (
      <PageShell>
        <LoadingBlock />
      </PageShell>
    );
  }

  if (event.error) {
    return (
      <PageShell>
        <ErrorBanner message={event.error} />
        <Button variant="subtle" fullWidth onClick={event.reload}>
          다시 시도
        </Button>
      </PageShell>
    );
  }

  if (event.data && !event.data.isOpen) {
    return (
      <PageShell>
        <SectionTitle
          title="지금은 신청을 받고 있지 않아요"
          description="접수가 열리면 다시 안내드릴게요."
        />
        <Button variant="subtle" fullWidth onClick={() => navigate('/')}>
          처음으로
        </Button>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <StepIndicator current={step} />
      <SectionTitle eyebrow={`STEP ${step} / ${TOTAL_STEPS}`} title={STEP_TITLES[step - 1] ?? ''} />

      {submitError && <ErrorBanner message={submitError} />}

      <div className="animate-fade-up">
        {step === 1 && <BasicInfoStep form={form} errors={errors} onChange={handleChange} />}

        {step === 2 &&
          (availability.loading ? (
            <LoadingBlock label="회차 상태를 확인하고 있어요" />
          ) : (
            <PreferenceStep
              rounds={rounds}
              availability={availability.data ?? []}
              selected={form.roundNo}
              errors={errors}
              onSelect={(roundNo) => handleChange('roundNo', roundNo)}
            />
          ))}

        {step === 3 && <ConfirmStep form={form} rounds={rounds} />}
      </div>

      <div className="mt-8 flex gap-3 pb-10">
        <Button variant="subtle" onClick={goBack} disabled={submitting} className="px-6">
          {step === 1 ? '취소' : '이전'}
        </Button>

        {step < TOTAL_STEPS ? (
          <Button fullWidth onClick={goNext}>
            다음
          </Button>
        ) : (
          <Button fullWidth loading={submitting} onClick={handleSubmit}>
            {submitting ? '배정하는 중...' : '신청하기'}
          </Button>
        )}
      </div>
    </PageShell>
  );
};

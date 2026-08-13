import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ConfirmStep } from '../components/apply/ConfirmStep';
import { ContactStep } from '../components/apply/ContactStep';
import { IdentityStep } from '../components/apply/IdentityStep';
import { PreferenceStep } from '../components/apply/PreferenceStep';
import { StepIndicator, TOTAL_STEPS } from '../components/apply/StepIndicator';
import {
  EMPTY_FORM,
  IDENTITY_FIELDS,
  toApplicationPayload,
  updateForm,
  validateContact,
  validateIdentity,
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

const STEP_TITLES = [
  '어떤 분이신가요?',
  '언제 만날까요?',
  '어디로 안내드릴까요?',
  '이대로 신청할까요?',
] as const;

/**
 * 1단계에서 생년월일·성별만 먼저 받는 이유를 참가자 언어로 설명한다.
 * 나이로 그룹이 나뉜다는 내부 규칙은 드러내지 않는다.
 */
const STEP_DESCRIPTIONS: readonly (string | undefined)[] = [
  '지금 등록 가능한 회차를 확인해보세요.',
  undefined,
  '배정 결과를 보내드릴 곳이 필요해요.',
  undefined,
];

/** 제출 오류를 어느 단계로 되돌릴지 정한다. */
const stepForErrorFields = (fields: FieldErrors): number =>
  IDENTITY_FIELDS.some((field) => fields[field] !== undefined) ? 1 : 3;

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
    const validate =
      step === 1 ? validateIdentity : step === 2 ? validateRoundSelection : step === 3 ? validateContact : null;

    if (validate) {
      const found = validate(form);
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
        const fields = error.fields as FieldErrors;
        setErrors(fields);
        // 문제가 된 값을 입력한 단계로 되돌린다. 연락처 오류인데 1단계로 보내면
        // 참가자는 멀쩡한 생년월일 화면에서 무엇이 틀렸는지 알 수 없다.
        setStep(stepForErrorFields(fields));
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
      <SectionTitle
        eyebrow={`STEP ${step} / ${TOTAL_STEPS}`}
        title={STEP_TITLES[step - 1] ?? ''}
        {...(STEP_DESCRIPTIONS[step - 1] ? { description: STEP_DESCRIPTIONS[step - 1] as string } : {})}
      />

      {submitError && <ErrorBanner message={submitError} />}

      <div className="animate-fade-up">
        {step === 1 && <IdentityStep form={form} errors={errors} onChange={handleChange} />}

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

        {step === 3 && <ContactStep form={form} errors={errors} onChange={handleChange} />}

        {step === 4 && <ConfirmStep form={form} rounds={rounds} />}
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

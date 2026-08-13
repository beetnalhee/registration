import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AssignmentResultDto } from '@shared/types';
import { AssignmentCard } from '../components/result/AssignmentCard';
import { Button } from '../components/ui/Button';
import { PageShell } from '../components/ui/PageShell';
import { readAssignmentResult } from '../lib/resultStorage';

export const CompletePage = () => {
  const navigate = useNavigate();
  const [result, setResult] = useState<AssignmentResultDto | null>(null);

  useEffect(() => {
    const stored = readAssignmentResult();

    // 결과 없이 직접 접근한 경우(주소 입력·새 탭)에는 조회 화면으로 보낸다.
    if (!stored) {
      navigate('/lookup', { replace: true });
      return;
    }

    setResult(stored);
  }, [navigate]);

  if (!result) {
    return <PageShell bare>{null}</PageShell>;
  }

  return (
    <PageShell bare>
      <div className="pt-10">
        <p className="mb-6 text-center text-[13px] font-medium tracking-[0.14em] text-moonlight/70">
          오늘 밤의 초대장
        </p>

        <AssignmentCard result={result} />

        <div className="mt-7 space-y-3 pb-10">
          <p className="text-center text-[13px] leading-relaxed text-slate-500">
            같은 내용을 이메일로도 보내드렸어요.
            <br />
            메일이 보이지 않으면 스팸함을 확인해 주세요.
          </p>
          <Button variant="subtle" fullWidth onClick={() => navigate('/')}>
            처음으로
          </Button>
        </div>
      </div>
    </PageShell>
  );
};

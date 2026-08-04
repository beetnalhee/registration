import { useState } from 'react';
import { GENDER_LABELS, GROUP_CODES, PARTICIPANT_STATUS_LABELS } from '@shared/constants';
import { formatPhone } from '@shared/format';
import type { AdminParticipantDto, GroupCode, RoundInfo } from '@shared/types';
import { Button } from '../ui/Button';
import { useAsync, toErrorMessage } from '../../hooks/useAsync';
import {
  cancelParticipant,
  fetchParticipantDetail,
  reassignParticipant,
  resendEmail,
} from '../../lib/adminApi';
import { LoadingBlock } from '../ui/Feedback';

interface ParticipantDetailPanelProps {
  participantId: string;
  rounds: RoundInfo[];
  onClose: () => void;
  onChanged: () => void;
}

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-start justify-between gap-4 border-b border-white/[0.07] py-2.5 last:border-0">
    <span className="shrink-0 text-[12.5px] text-slate-400">{label}</span>
    <span className="text-right text-[13.5px] text-slate-100">{value}</span>
  </div>
);

const emailKindLabel = (kind: string): string =>
  ({ assignment: '배정 안내', cancellation: '취소 안내' })[kind] ?? kind;

export const ParticipantDetailPanel = ({
  participantId,
  rounds,
  onClose,
  onChanged,
}: ParticipantDetailPanelProps) => {
  const detail = useAsync((signal) => fetchParticipantDetail(participantId, signal), [participantId]);

  const [targetRound, setTargetRound] = useState<number | ''>('');
  const [targetGroup, setTargetGroup] = useState<GroupCode | ''>('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<unknown>, successMessage: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      await action();
      setNotice(successMessage);
      detail.reload();
      onChanged();
    } catch (caught) {
      setError(toErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const participant: AdminParticipantDto | null = detail.data?.participant ?? null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-midnight-900/70 backdrop-blur-sm sm:items-center">
      <div className="glass max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-b-none rounded-t-3xl px-5 py-5 sm:rounded-3xl">
        <header className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[17px] font-bold text-slate-50">
              {participant ? `${participant.name} (${participant.nickname})` : '참가자'}
            </h2>
            {participant && (
              <p className="mt-1 flex flex-wrap items-center gap-2 text-[12.5px] text-slate-400">
                <span>{PARTICIPANT_STATUS_LABELS[participant.status]}</span>
                {participant.participantCode && (
                  <span className="font-mono text-moonlight">{participant.participantCode}</span>
                )}
                {participant.isGroupOverridden && (
                  <span
                    className="rounded-full border border-glow/40 bg-glow/10 px-2 py-0.5 text-[11px] text-glow-soft"
                    title={`기본 그룹은 ${participant.defaultGroupCode} 이지만 성비 조정으로 이동되었습니다.`}
                  >
                    그룹 조정됨
                  </span>
                )}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="shrink-0 rounded-full border border-white/12 px-3 py-1.5 text-[13px] text-slate-400 hover:text-slate-100"
          >
            닫기
          </button>
        </header>

        {detail.loading && !participant ? (
          <LoadingBlock />
        ) : participant ? (
          <>
            <div className="glass-soft px-4 py-1.5">
              <Row label="상태" value={PARTICIPANT_STATUS_LABELS[participant.status]} />
              <Row
                label="배정"
                value={
                  participant.roundNo !== null
                    ? `${participant.groupCode} · ${participant.roundNo}회차 · ${participant.timeLabel ?? ''}`
                    : '미배정'
                }
              />
              <Row
                label="출석"
                value={
                  participant.checkedInAt
                    ? `출석 (${new Date(participant.checkedInAt).toLocaleString('ko-KR')})`
                    : '미도착'
                }
              />
              <Row label="성별" value={GENDER_LABELS[participant.gender]} />
              <Row label="생년월일" value={`${participant.birthdate} (만 ${participant.age}세)`} />
              <Row label="연락처" value={formatPhone(participant.phone)} />
              <Row label="이메일" value={participant.email} />
              <Row label="선택한 회차" value={`${participant.preferredRoundNo}회차`} />
              <Row label="기본 그룹" value={participant.defaultGroupCode} />
            </div>

            {/* ── 관리 작업 ─────────────────────────────────────────── */}
            <div className="mt-5 space-y-4">
              <div>
                <p className="label-text">회차 · 그룹 변경</p>
                <div className="flex gap-2">
                  <select
                    value={targetRound}
                    onChange={(event) =>
                      setTargetRound(event.target.value === '' ? '' : Number(event.target.value))
                    }
                    className="input-base flex-1 py-2.5 text-[14px]"
                    aria-label="변경할 회차"
                  >
                    <option value="">회차 유지</option>
                    {rounds.map((round) => (
                      <option key={round.roundNo} value={round.roundNo}>
                        {round.roundNo}회차 ({round.timeLabel})
                      </option>
                    ))}
                  </select>

                  <select
                    value={targetGroup}
                    onChange={(event) => setTargetGroup(event.target.value as GroupCode | '')}
                    className="input-base flex-1 py-2.5 text-[14px]"
                    aria-label="변경할 그룹"
                  >
                    <option value="">그룹 유지</option>
                    {GROUP_CODES.map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mt-2.5 flex gap-2">
                  <Button
                    variant="ghost"
                    fullWidth
                    loading={busy}
                    disabled={targetRound === '' && targetGroup === ''}
                    className="py-2.5 text-[13.5px]"
                    onClick={() =>
                      void run(
                        () =>
                          reassignParticipant(participant.id, {
                            ...(targetRound !== '' ? { roundNo: targetRound } : {}),
                            ...(targetGroup !== '' ? { groupCode: targetGroup } : {}),
                          }),
                        '배정을 변경했습니다. 참가번호가 재발급되었습니다.',
                      )
                    }
                  >
                    배정 변경
                  </Button>
                </div>
              </div>

              <div className="flex gap-2 border-t border-white/[0.07] pt-4">
                <Button
                  variant="subtle"
                  fullWidth
                  loading={busy}
                  className="py-2.5 text-[13.5px]"
                  onClick={() =>
                    void run(async () => {
                      const { sent } = await resendEmail(participant.id);
                      if (!sent) {
                        throw new Error('메일 발송에 실패했습니다. 발송 기록을 확인해 주세요.');
                      }
                    }, '안내 메일을 다시 발송했습니다.')
                  }
                >
                  이메일 재발송
                </Button>

                {participant.status !== 'cancelled' && (
                  <Button
                    variant="danger"
                    fullWidth
                    loading={busy}
                    className="py-2.5 text-[13.5px]"
                    onClick={() => {
                      if (!window.confirm(`${participant.name}님의 신청을 취소할까요?`)) {
                        return;
                      }
                      void run(
                        () => cancelParticipant(participant.id),
                        '신청을 취소했습니다. 좌석이 반납되었습니다.',
                      );
                    }}
                  >
                    참가 취소
                  </Button>
                )}
              </div>
            </div>

            {notice && <p className="mt-4 text-[13px] text-glow-soft">{notice}</p>}
            {error && (
              <p className="mt-4 text-[13px] text-peach-soft" role="alert">
                {error}
              </p>
            )}

            {/* ── 이메일 발송 기록 ──────────────────────────────────── */}
            <div className="mt-6">
              <p className="mb-2 text-[11.5px] uppercase tracking-[0.14em] text-slate-500">
                이메일 발송 기록
              </p>
              {detail.data && detail.data.emailLogs.length > 0 ? (
                <ul className="space-y-1.5">
                  {detail.data.emailLogs.map((log) => (
                    <li key={log.id} className="text-[12.5px] text-slate-400">
                      <div className="flex items-center justify-between gap-3">
                        <span>{emailKindLabel(log.kind)}</span>
                        <span className="flex items-center gap-2">
                          <span
                            className={log.status === 'sent' ? 'text-glow-soft' : 'text-peach-soft'}
                          >
                            {log.status === 'sent' ? '성공' : '실패'}
                          </span>
                          <span className="tabular-nums text-slate-600">
                            {new Date(log.createdAt).toLocaleString('ko-KR')}
                          </span>
                        </span>
                      </div>
                      {/* 실패 원인을 보여줘야 관리자가 재발송으로 해결될 문제인지 판단할 수 있다 */}
                      {log.errorMessage && (
                        <p className="mt-0.5 text-[11.5px] leading-relaxed text-peach-soft/70">
                          {log.errorMessage}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[12.5px] text-slate-600">발송 기록이 없습니다.</p>
              )}
            </div>
          </>
        ) : (
          <p className="text-[14px] text-peach-soft">{detail.error}</p>
        )}
      </div>
    </div>
  );
};

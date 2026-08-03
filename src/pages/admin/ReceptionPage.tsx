import { useEffect, useMemo, useRef, useState } from 'react';
import { GENDER_LABELS } from '@shared/constants';
import type { AdminParticipantDto } from '@shared/types';
import { Button } from '../../components/ui/Button';
import { EmptyState, ErrorBanner, LoadingBlock } from '../../components/ui/Feedback';
import { useAsync, toErrorMessage } from '../../hooks/useAsync';
import {
  checkInParticipant,
  fetchOverview,
  fetchParticipants,
  undoCheckInParticipant,
} from '../../lib/adminApi';
import { AdminShell } from './AdminShell';

/**
 * 리셉션 출석 체크 전용 화면.
 *
 * 현장에서 줄이 밀리지 않게 검색 → 한 번 누르기까지의 동선을 최대한 짧게 만든다.
 * 참가자 관리 화면과 분리한 이유도 그것이다(그쪽은 정보가 많아 느리다).
 */

/** 입력이 멈춘 뒤 검색하도록 지연시킨다. 한 글자마다 요청하면 현장 네트워크가 버겁다. */
const SEARCH_DEBOUNCE_MS = 300;
const PAGE_SIZE = 40;

type ArrivalFilter = 'all' | 'pending' | 'arrived';

const ARRIVAL_LABELS: Record<ArrivalFilter, string> = {
  all: '전체',
  pending: '미도착',
  arrived: '출석 완료',
};

const useDebounced = <T,>(value: T, delayMs: number): T => {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return settled;
};

const AttendanceRow = ({
  participant,
  busy,
  onCheckIn,
  onUndo,
}: {
  participant: AdminParticipantDto;
  busy: boolean;
  onCheckIn: () => void;
  onUndo: () => void;
}) => {
  const arrived = participant.checkedInAt !== null;

  return (
    <li
      className={[
        'flex items-center gap-3 rounded-2xl border px-4 py-3.5 transition-colors',
        arrived ? 'border-glow/35 bg-glow/[0.08]' : 'border-white/10 bg-white/[0.05]',
      ].join(' ')}
    >
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2">
          <span className="truncate text-[16px] font-bold text-slate-50">
            {participant.nickname}
          </span>
          <span className="truncate text-[13px] text-slate-500">{participant.name}</span>
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[13px] text-slate-400">
          <span className="font-mono text-moonlight">{participant.participantCode ?? '-'}</span>
          <span aria-hidden>·</span>
          <span>
            {participant.roundNo}회차 {participant.timeLabel}
          </span>
          <span aria-hidden>·</span>
          <span>{GENDER_LABELS[participant.gender]}</span>
        </p>
        {arrived && (
          <p className="mt-1 text-[12px] text-glow-soft">
            출석 {new Date(participant.checkedInAt as string).toLocaleTimeString('ko-KR')}
          </p>
        )}
      </div>

      {arrived ? (
        <Button
          variant="subtle"
          loading={busy}
          className="shrink-0 px-4 py-2.5 text-[13px]"
          onClick={onUndo}
        >
          되돌리기
        </Button>
      ) : (
        <Button
          loading={busy}
          className="shrink-0 px-7 py-3 text-[15px] font-bold"
          onClick={onCheckIn}
        >
          출석
        </Button>
      )}
    </li>
  );
};

export const ReceptionPage = () => {
  const [keyword, setKeyword] = useState('');
  const [roundNo, setRoundNo] = useState<number | null>(null);
  const [arrival, setArrival] = useState<ArrivalFilter>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const debouncedKeyword = useDebounced(keyword.trim(), SEARCH_DEBOUNCE_MS);

  const overview = useAsync((signal) => fetchOverview(signal));

  const list = useAsync(
    (signal) =>
      fetchParticipants(
        {
          status: 'assigned',
          pageSize: PAGE_SIZE,
          ...(debouncedKeyword ? { q: debouncedKeyword } : {}),
          ...(roundNo !== null ? { roundNo } : {}),
          ...(arrival === 'pending' ? { checkedIn: false } : {}),
          ...(arrival === 'arrived' ? { checkedIn: true } : {}),
        },
        signal,
      ),
    [debouncedKeyword, roundNo, arrival],
  );

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  const rounds = useMemo(() => overview.data?.rounds ?? [], [overview.data]);

  const run = async (id: string, action: () => Promise<unknown>) => {
    setBusyId(id);
    setActionError(null);

    try {
      await action();
      list.reload();
      overview.reload();
    } catch (error) {
      setActionError(toErrorMessage(error));
    } finally {
      setBusyId(null);
    }
  };

  const totals = rounds.reduce(
    (sum, round) => ({
      checkedIn: sum.checkedIn + round.attendance.checkedIn,
      assigned: sum.assigned + round.attendance.assigned,
    }),
    { checkedIn: 0, assigned: 0 },
  );

  return (
    <AdminShell>
      <div className="pb-12">
        <header className="mb-5">
          <h1 className="font-display text-[24px] font-bold text-slate-50">리셉션 · 출석 체크</h1>
          <p className="mt-1 text-[13px] text-slate-400">
            닉네임 · 참가번호 · 이름 · 연락처 아무거나 입력하세요
          </p>
        </header>

        {/* ── 회차별 출석 카운터 ─────────────────────────────────── */}
        <section className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="glass px-4 py-3.5 text-center">
            <p className="text-[12px] text-slate-400">전체</p>
            <p className="mt-1 text-[22px] font-bold tabular-nums text-slate-100">
              {totals.checkedIn}
              <span className="text-[15px] text-slate-500"> / {totals.assigned}</span>
            </p>
          </div>
          {rounds.map((round) => (
            <div key={round.roundNo} className="glass px-4 py-3.5 text-center">
              <p className="text-[12px] text-slate-400">{round.roundNo}회차</p>
              <p className="mt-1 text-[22px] font-bold tabular-nums text-moonlight">
                {round.attendance.checkedIn}
                <span className="text-[15px] text-slate-500"> / {round.attendance.assigned}</span>
              </p>
            </div>
          ))}
        </section>

        {/* ── 검색 · 필터 ────────────────────────────────────────── */}
        <section className="glass mb-5 px-4 py-4">
          <input
            ref={searchRef}
            type="search"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="닉네임, 참가번호, 이름, 연락처"
            autoComplete="off"
            className="input-base text-[17px]"
            aria-label="참가자 검색"
          />

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setRoundNo(null)}
              className={[
                'rounded-full px-4 py-2 text-[13px] transition-colors',
                roundNo === null
                  ? 'bg-moonlight/15 font-semibold text-moonlight-soft'
                  : 'border border-white/12 text-slate-400 hover:text-slate-200',
              ].join(' ')}
            >
              전체 회차
            </button>
            {rounds.map((round) => (
              <button
                key={round.roundNo}
                type="button"
                onClick={() => setRoundNo(round.roundNo)}
                className={[
                  'rounded-full px-4 py-2 text-[13px] transition-colors',
                  roundNo === round.roundNo
                    ? 'bg-moonlight/15 font-semibold text-moonlight-soft'
                    : 'border border-white/12 text-slate-400 hover:text-slate-200',
                ].join(' ')}
              >
                {round.roundNo}회차
              </button>
            ))}
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            {(['all', 'pending', 'arrived'] as ArrivalFilter[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setArrival(option)}
                className={[
                  'rounded-full px-4 py-2 text-[13px] transition-colors',
                  arrival === option
                    ? 'bg-glow/15 font-semibold text-glow-soft'
                    : 'border border-white/12 text-slate-400 hover:text-slate-200',
                ].join(' ')}
              >
                {ARRIVAL_LABELS[option]}
              </button>
            ))}
          </div>
        </section>

        {actionError && <ErrorBanner message={actionError} />}
        {list.error && <ErrorBanner message={list.error} />}

        {list.loading && !list.data ? (
          <LoadingBlock label="명단을 불러오고 있어요" />
        ) : list.data && list.data.items.length > 0 ? (
          <>
            <ul className="space-y-2">
              {list.data.items.map((participant) => (
                <AttendanceRow
                  key={participant.id}
                  participant={participant}
                  busy={busyId === participant.id}
                  onCheckIn={() => void run(participant.id, () => checkInParticipant(participant.id))}
                  onUndo={() => void run(participant.id, () => undoCheckInParticipant(participant.id))}
                />
              ))}
            </ul>

            {list.data.total > list.data.items.length && (
              <p className="mt-4 text-center text-[13px] text-slate-500">
                {list.data.total}명 중 {list.data.items.length}명 표시 중 — 검색어를 좁혀주세요
              </p>
            )}
          </>
        ) : (
          <EmptyState
            message={
              debouncedKeyword
                ? `'${debouncedKeyword}' 와 일치하는 배정 참가자가 없습니다.`
                : '조건에 맞는 참가자가 없습니다.'
            }
          />
        )}
      </div>
    </AdminShell>
  );
};

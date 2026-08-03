import { useState } from 'react';
import {
  GENDERS,
  GENDER_LABELS,
  GROUP_CODES,
  PARTICIPANT_STATUSES,
  PARTICIPANT_STATUS_LABELS,
} from '@shared/constants';
import type { AdminParticipantDto } from '@shared/types';
import { ParticipantDetailPanel } from '../../components/admin/ParticipantDetailPanel';
import { Button } from '../../components/ui/Button';
import { EmptyState, ErrorBanner, LoadingBlock } from '../../components/ui/Feedback';
import { useAsync } from '../../hooks/useAsync';
import { downloadParticipantsCsv, fetchParticipants } from '../../lib/adminApi';
import { fetchEventInfo } from '../../lib/publicApi';
import { AdminShell } from './AdminShell';

const PAGE_SIZE = 30;

interface Filters {
  q: string;
  status: string;
  roundNo: string;
  groupCode: string;
  gender: string;
}

const EMPTY_FILTERS: Filters = { q: '', status: '', roundNo: '', groupCode: '', gender: '' };

const STATUS_TONE: Record<string, string> = {
  assigned: 'text-moonlight',
  waitlisted: 'text-peach-soft',
  cancelled: 'text-slate-500',
};

const ParticipantRow = ({
  participant,
  onSelect,
}: {
  participant: AdminParticipantDto;
  onSelect: () => void;
}) => (
  <li>
    <button
      type="button"
      onClick={onSelect}
      className="glass-soft flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.08]"
    >
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-[14.5px] font-semibold text-slate-100">
            {participant.name}
          </span>
          <span className="truncate text-[13px] text-slate-500">{participant.nickname}</span>
        </span>
        <span className="mt-1 block text-[12.5px] text-slate-400">
          {GENDER_LABELS[participant.gender]} · 만 {participant.age}세
          {participant.roundNo !== null && ` · ${participant.groupCode} ${participant.roundNo}회차`}
        </span>
      </span>

      <span className="shrink-0 text-right">
        <span className={`block text-[12.5px] ${STATUS_TONE[participant.status] ?? ''}`}>
          {PARTICIPANT_STATUS_LABELS[participant.status]}
        </span>
        {participant.participantCode && (
          <span className="mt-0.5 block font-mono text-[12px] text-slate-500">
            {participant.participantCode}
          </span>
        )}
      </span>
    </button>
  </li>
);

export const AdminParticipantsPage = () => {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<Filters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const event = useAsync((signal) => fetchEventInfo(signal));

  const list = useAsync(
    (signal) =>
      fetchParticipants(
        {
          page,
          pageSize: PAGE_SIZE,
          ...(applied.q ? { q: applied.q } : {}),
          ...(applied.status ? { status: applied.status } : {}),
          ...(applied.roundNo ? { roundNo: Number(applied.roundNo) } : {}),
          ...(applied.groupCode ? { groupCode: applied.groupCode as (typeof GROUP_CODES)[number] } : {}),
          ...(applied.gender ? { gender: applied.gender } : {}),
        },
        signal,
      ),
    [applied, page],
  );

  const search = () => {
    setPage(1);
    setApplied(filters);
  };

  const totalPages = list.data ? Math.max(1, Math.ceil(list.data.total / PAGE_SIZE)) : 1;

  return (
    <AdminShell>
      <div className="pb-12">
        <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[24px] font-bold tracking-[-0.015em] text-slate-50">참가자 관리</h1>
            <p className="mt-1 text-[13px] text-slate-400">
              총 {list.data?.total ?? 0}명 · 이름 · 닉네임 · 이메일 · 연락처 · 참가번호로 검색
            </p>
          </div>
          <Button
            variant="ghost"
            className="px-5 py-2.5 text-[13.5px]"
            onClick={() => void downloadParticipantsCsv()}
          >
            CSV 다운로드
          </Button>
        </header>

        <section className="glass mb-5 px-4 py-4">
          <form
            className="space-y-3"
            onSubmit={(submitEvent) => {
              submitEvent.preventDefault();
              search();
            }}
          >
            <input
              type="search"
              value={filters.q}
              onChange={(changeEvent) =>
                setFilters((previous) => ({ ...previous, q: changeEvent.target.value }))
              }
              placeholder="이름, 닉네임, 이메일, 연락처, 참가번호"
              className="input-base py-2.5 text-[14px]"
              aria-label="참가자 검색"
            />

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <select
                value={filters.status}
                onChange={(changeEvent) =>
                  setFilters((previous) => ({ ...previous, status: changeEvent.target.value }))
                }
                className="input-base py-2.5 text-[13.5px]"
                aria-label="상태 필터"
              >
                <option value="">전체 상태</option>
                {PARTICIPANT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {PARTICIPANT_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>

              <select
                value={filters.roundNo}
                onChange={(changeEvent) =>
                  setFilters((previous) => ({ ...previous, roundNo: changeEvent.target.value }))
                }
                className="input-base py-2.5 text-[13.5px]"
                aria-label="회차 필터"
              >
                <option value="">전체 회차</option>
                {event.data?.rounds.map((round) => (
                  <option key={round.roundNo} value={round.roundNo}>
                    {round.roundNo}회차
                  </option>
                ))}
              </select>

              <select
                value={filters.groupCode}
                onChange={(changeEvent) =>
                  setFilters((previous) => ({ ...previous, groupCode: changeEvent.target.value }))
                }
                className="input-base py-2.5 text-[13.5px]"
                aria-label="그룹 필터"
              >
                <option value="">전체 그룹</option>
                {GROUP_CODES.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>

              <select
                value={filters.gender}
                onChange={(changeEvent) =>
                  setFilters((previous) => ({ ...previous, gender: changeEvent.target.value }))
                }
                className="input-base py-2.5 text-[13.5px]"
                aria-label="성별 필터"
              >
                <option value="">전체 성별</option>
                {GENDERS.map((gender) => (
                  <option key={gender} value={gender}>
                    {GENDER_LABELS[gender]}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2">
              <Button type="submit" fullWidth className="py-2.5 text-[13.5px]">
                검색
              </Button>
              <Button
                variant="subtle"
                className="shrink-0 px-5 py-2.5 text-[13.5px]"
                onClick={() => {
                  setFilters(EMPTY_FILTERS);
                  setApplied(EMPTY_FILTERS);
                  setPage(1);
                }}
              >
                초기화
              </Button>
            </div>
          </form>
        </section>

        {list.error && <ErrorBanner message={list.error} />}

        {list.loading && !list.data ? (
          <LoadingBlock />
        ) : list.data && list.data.items.length > 0 ? (
          <>
            <ul className="space-y-2">
              {list.data.items.map((participant) => (
                <ParticipantRow
                  key={participant.id}
                  participant={participant}
                  onSelect={() => setSelectedId(participant.id)}
                />
              ))}
            </ul>

            {totalPages > 1 && (
              <div className="mt-5 flex items-center justify-center gap-3">
                <Button
                  variant="subtle"
                  disabled={page <= 1}
                  className="px-4 py-2 text-[13px]"
                  onClick={() => setPage((current) => current - 1)}
                >
                  이전
                </Button>
                <span className="text-[13px] tabular-nums text-slate-400">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="subtle"
                  disabled={page >= totalPages}
                  className="px-4 py-2 text-[13px]"
                  onClick={() => setPage((current) => current + 1)}
                >
                  다음
                </Button>
              </div>
            )}
          </>
        ) : (
          <EmptyState message="조건에 맞는 참가자가 없습니다." />
        )}
      </div>

      {selectedId && (
        <ParticipantDetailPanel
          participantId={selectedId}
          rounds={event.data?.rounds ?? []}
          onClose={() => setSelectedId(null)}
          onChanged={list.reload}
        />
      )}
    </AdminShell>
  );
};

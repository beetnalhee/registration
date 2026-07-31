import { z } from 'zod';
import { formatPhone } from '../../../shared/format';
import type { adminParticipantQuerySchema } from '../../../shared/schemas';
import {
  GENDER_LABELS,
  PARTICIPANT_STATUS_LABELS,
} from '../../../shared/constants';
import type {
  AdminParticipantDetailDto,
  AdminParticipantListDto,
} from '../../../shared/types';
import type { Queryable } from '../../db/pool';
import { notFound } from '../../errors';
import { findEmailLogs } from '../../repositories/emailLogRepository';
import {
  findParticipantById,
  searchParticipants,
  type ParticipantRecord,
} from '../../repositories/participantRepository';
import { findAllRounds, type RoundRecord } from '../../repositories/roundRepository';
import { toAdminParticipantDto } from '../dto';

export type ParticipantQuery = z.infer<typeof adminParticipantQuerySchema>;

const timeLabelOf = (rounds: RoundRecord[], participant: ParticipantRecord): string | null =>
  rounds.find((round) => round.roundNo === participant.assignedRoundNo)?.timeLabel ?? null;

export const listParticipants = async (
  client: Queryable,
  query: ParticipantQuery,
): Promise<AdminParticipantListDto> => {
  const [result, rounds] = await Promise.all([
    searchParticipants(client, query),
    findAllRounds(client),
  ]);

  return {
    items: result.items.map((participant) =>
      toAdminParticipantDto(participant, timeLabelOf(rounds, participant)),
    ),
    total: result.total,
    page: query.page,
    pageSize: query.pageSize,
  };
};

export const getParticipantDetail = async (
  client: Queryable,
  participantId: string,
): Promise<AdminParticipantDetailDto> => {
  const participant = await findParticipantById(client, participantId);
  if (!participant) {
    throw notFound('참가자를 찾을 수 없습니다.');
  }

  const [rounds, emailLogs] = await Promise.all([
    findAllRounds(client),
    findEmailLogs(client, participantId),
  ]);

  return {
    participant: toAdminParticipantDto(participant, timeLabelOf(rounds, participant)),
    emailLogs,
  };
};

const CSV_HEADERS = [
  '참가번호',
  '상태',
  '그룹',
  '회차',
  '시간',
  '이름',
  '닉네임',
  '성별',
  '생년월일',
  '만나이',
  '연락처',
  '이메일',
  '희망1',
  '희망2',
  '희망3',
  '기본그룹',
  '그룹이동',
  '신청시각',
] as const;

/** CSV 수식 주입(=, +, -, @ 로 시작하는 값) 방지 */
const escapeCsvCell = (value: string | number | null): string => {
  const raw = value === null ? '' : String(value);
  const guarded = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${guarded.replace(/"/g, '""')}"`;
};

/**
 * 엑셀에서 한글이 깨지지 않도록 UTF-8 BOM 을 앞에 붙인다.
 * 참가자 개인정보가 포함되므로 관리자 인증을 통과한 요청에만 제공한다.
 */
export const buildParticipantsCsv = async (client: Queryable): Promise<string> => {
  const [result, rounds] = await Promise.all([
    searchParticipants(client, { page: 1, pageSize: 10_000 }),
    findAllRounds(client),
  ]);

  const lines = [CSV_HEADERS.map(escapeCsvCell).join(',')];

  for (const participant of result.items) {
    lines.push(
      [
        participant.participantCode,
        PARTICIPANT_STATUS_LABELS[participant.status],
        participant.assignedGroupCode,
        participant.assignedRoundNo,
        timeLabelOf(rounds, participant),
        participant.name,
        participant.nickname,
        GENDER_LABELS[participant.gender],
        participant.birthdate,
        participant.ageAtEvent,
        formatPhone(participant.phone),
        participant.email,
        participant.preferences[0] ?? null,
        participant.preferences[1] ?? null,
        participant.preferences[2] ?? null,
        participant.defaultGroupCode,
        participant.assignedGroupCode !== null &&
        participant.assignedGroupCode !== participant.defaultGroupCode
          ? 'Y'
          : '',
        participant.createdAt,
      ]
        .map(escapeCsvCell)
        .join(','),
    );
  }

  return `﻿${lines.join('\r\n')}\r\n`;
};

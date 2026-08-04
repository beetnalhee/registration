import type { EmailLogDto } from '../../shared/types.js';
import type { Queryable } from '../db/pool.js';

/** 대기자·승격 제도가 없어져 배정 안내와 취소 안내만 남았다. */
export type EmailKind = 'assignment' | 'cancellation';

export interface RecordEmailParams {
  participantId: string;
  kind: EmailKind;
  toAddress: string;
  status: 'sent' | 'failed';
  errorMessage?: string;
}

export const recordEmailAttempt = async (
  client: Queryable,
  params: RecordEmailParams,
): Promise<void> => {
  await client.query(
    `insert into email_logs (participant_id, kind, to_address, status, error_message)
     values ($1, $2, $3, $4, $5)`,
    [
      params.participantId,
      params.kind,
      params.toAddress,
      params.status,
      params.errorMessage ?? null,
    ],
  );
};

export const findEmailLogs = async (
  client: Queryable,
  participantId: string,
): Promise<EmailLogDto[]> => {
  const { rows } = await client.query<{
    id: string;
    kind: string;
    to_address: string;
    status: 'sent' | 'failed';
    error_message: string | null;
    created_at: string;
  }>(
    `select id, kind, to_address, status, error_message, created_at
       from email_logs
      where participant_id = $1
      order by created_at desc
      limit 20`,
    [participantId],
  );

  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    toAddress: row.to_address,
    status: row.status,
    errorMessage: row.error_message,
    createdAt: row.created_at,
  }));
};

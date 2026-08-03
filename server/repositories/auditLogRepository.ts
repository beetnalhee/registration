import type { Queryable } from '../db/pool.js';

export type AuditAction =
  | 'reassign'
  | 'cancel'
  | 'promote'
  | 'resend_email'
  | 'update_settings'
  | 'check_in'
  | 'undo_check_in';

export interface AuditEntry {
  adminEmail: string;
  action: AuditAction;
  participantId?: string | null;
  beforeState?: unknown;
  afterState?: unknown;
}

/**
 * 관리자 변경 이력을 누적한다.
 * 참가자 행을 덮어쓰더라도 변경 전 상태가 여기에 남으므로 되돌릴 근거가 남는다.
 */
export const recordAudit = async (client: Queryable, entry: AuditEntry): Promise<void> => {
  await client.query(
    `insert into audit_logs (admin_email, action, participant_id, before_state, after_state)
     values ($1, $2, $3, $4, $5)`,
    [
      entry.adminEmail,
      entry.action,
      entry.participantId ?? null,
      entry.beforeState === undefined ? null : JSON.stringify(entry.beforeState),
      entry.afterState === undefined ? null : JSON.stringify(entry.afterState),
    ],
  );
};

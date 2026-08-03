import type { Queryable } from '../db/pool.js';

export interface AdminRecord {
  userId: string;
  email: string;
  displayName: string | null;
}

/**
 * Supabase Auth 로 인증된 사용자가 관리자 화이트리스트에 있는지 확인한다.
 * 인증(Supabase)과 인가(이 표)를 분리해 두면 계정만 있어도 권한은 얻지 못한다.
 */
export const findAdminByUserId = async (
  client: Queryable,
  userId: string,
): Promise<AdminRecord | null> => {
  const { rows } = await client.query<{
    user_id: string;
    email: string;
    display_name: string | null;
  }>(`select user_id, email, display_name from admins where user_id = $1`, [userId]);

  const row = rows[0];
  return row ? { userId: row.user_id, email: row.email, displayName: row.display_name } : null;
};

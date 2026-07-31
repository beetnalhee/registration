import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AdminSessionDto } from '../../shared/types';
import { loadEnv } from '../config/env';
import { getPool } from '../db/pool';
import { forbidden, unauthorized } from '../errors';
import { findAdminByUserId, type AdminRecord } from '../repositories/adminRepository';

let client: SupabaseClient | null = null;

/**
 * 인증은 Supabase Auth 에 위임한다.
 * 비밀번호 해싱·토큰 서명을 직접 구현하지 않으므로 암호학적 실수 여지가 없다.
 */
const getSupabase = (): SupabaseClient => {
  if (client) {
    return client;
  }

  const env = loadEnv();
  client = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return client;
};

/** 로그인. 계정이 있어도 admins 표에 없으면 권한을 주지 않는다(인증과 인가의 분리). */
export const loginAdmin = async (credentials: {
  email: string;
  password: string;
}): Promise<AdminSessionDto> => {
  const { data, error } = await getSupabase().auth.signInWithPassword(credentials);

  if (error || !data.session || !data.user) {
    // 계정 존재 여부를 구분해 알려주지 않는다(사용자 열거 방지).
    throw unauthorized('이메일 또는 비밀번호를 확인해 주세요.');
  }

  const admin = await findAdminByUserId(getPool(), data.user.id);
  if (!admin) {
    throw forbidden('관리자로 등록된 계정이 아닙니다.');
  }

  return {
    email: admin.email,
    displayName: admin.displayName,
    accessToken: data.session.access_token,
    expiresAt: data.session.expires_at ?? 0,
  };
};

/** Bearer 토큰을 검증하고 관리자 레코드를 돌려준다. */
export const authenticateAdmin = async (accessToken: string): Promise<AdminRecord> => {
  const { data, error } = await getSupabase().auth.getUser(accessToken);

  if (error || !data.user) {
    throw unauthorized('세션이 만료되었어요. 다시 로그인해 주세요.');
  }

  const admin = await findAdminByUserId(getPool(), data.user.id);
  if (!admin) {
    throw forbidden('관리자로 등록된 계정이 아닙니다.');
  }

  return admin;
};

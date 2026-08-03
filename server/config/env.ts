import { z } from 'zod';

/**
 * 환경 변수는 서버 시작 시 한 번만 검증한다.
 * 빠져 있으면 즉시 알아차릴 수 있도록 명확한 메시지와 함께 실패시킨다.
 */
const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL 이 필요합니다. (Supabase transaction pooler 주소)'),

  SUPABASE_URL: z.string().url('SUPABASE_URL 이 올바른 URL 이어야 합니다.'),
  SUPABASE_ANON_KEY: z.string().min(1, 'SUPABASE_ANON_KEY 가 필요합니다.'),

  // 이메일 설정이 없으면 발송을 건너뛰고 로그만 남긴다(로컬 개발용).
  GMAIL_USER: z.string().email().optional(),
  GMAIL_APP_PASSWORD: z.string().min(1).optional(),
  MAIL_FROM_NAME: z.string().default('사랑은 돌아오는 거야'),

  PUBLIC_BASE_URL: z.string().url().default('http://localhost:5173'),
  PORT: z.coerce.number().int().positive().default(3001),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export const loadEnv = (source: NodeJS.ProcessEnv = process.env): Env => {
  if (cached) {
    return cached;
  }

  const parsed = envSchema.safeParse(source);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`환경 변수 설정이 올바르지 않습니다.\n${details}\n(.env.example 을 참고하세요)`);
  }

  cached = parsed.data;
  return cached;
};

export const isEmailConfigured = (env: Env): boolean =>
  Boolean(env.GMAIL_USER && env.GMAIL_APP_PASSWORD);

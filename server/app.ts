import express, { type Express } from 'express';
import { asyncHandler } from './http/asyncHandler.js';
import { errorHandler, notFoundHandler } from './http/middleware/errorHandler.js';
import { securityHeaders } from './http/middleware/securityHeaders.js';
import { fail, ok } from './http/respond.js';
import { asPgError } from './errors.js';
import { isEmailConfigured, loadEnv } from './config/env.js';
import { adminRoutes } from './routes/adminRoutes.js';
import { publicRoutes } from './routes/publicRoutes.js';
import { getPool } from './db/pool.js';

export const createApp = (): Express => {
  const app = express();

  app.disable('x-powered-by');
  // Vercel 은 프록시 뒤에서 동작하므로 요청 제한이 실제 클라이언트 IP 를 보게 한다.
  app.set('trust proxy', 1);

  app.use(express.json({ limit: '32kb' }));
  app.use(securityHeaders);

  /**
   * 상태 확인용. 앱이 살아있는지와 DB 연결이 되는지를 구분해서 알려준다.
   *
   * DB 문제일 때 일반 500 대신 503 + pg 에러 코드를 돌려주는 이유:
   * 배포 직후 "왜 안 되는지" 를 로그 접근 없이 즉시 구분하기 위함이다.
   *   ENOTFOUND → DATABASE_URL 의 호스트가 잘못됨(값에 따옴표·공백이 섞인 경우 포함)
   *   28P01     → 비밀번호 인증 실패
   *   ETIMEDOUT → 네트워크에서 막힘
   * 호스트·사용자·비밀번호는 담지 않으므로 노출되는 비밀은 없다.
   */
  app.get(
    '/api/health',
    asyncHandler(async (_req, res) => {
      try {
        await getPool().query('select 1');
      } catch (error) {
        const code = asPgError(error)?.code ?? 'UNKNOWN';
        console.error('[api] health: 데이터베이스 연결 실패', error);

        fail(res, {
          status: 503,
          code: 'DATABASE_UNAVAILABLE',
          message: `데이터베이스에 연결할 수 없습니다. (${code})`,
        });
        return;
      }

      // 이메일 설정 여부도 알려준다. 설정이 없으면 배정은 되지만 메일이 나가지 않으므로
      // 접수 시작 전에 반드시 확인해야 하는 값이다. (비밀 값은 담지 않는다)
      ok(res, {
        status: 'ok',
        email: isEmailConfigured(loadEnv()) ? 'configured' : 'not_configured',
      });
    }),
  );

  app.use('/api/admin', adminRoutes);
  app.use('/api', publicRoutes);

  app.use('/api', notFoundHandler);
  app.use(errorHandler);

  return app;
};

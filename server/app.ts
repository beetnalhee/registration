import express, { type Express } from 'express';
import { asyncHandler } from './http/asyncHandler';
import { errorHandler, notFoundHandler } from './http/middleware/errorHandler';
import { securityHeaders } from './http/middleware/securityHeaders';
import { ok } from './http/respond';
import { adminRoutes } from './routes/adminRoutes';
import { publicRoutes } from './routes/publicRoutes';
import { getPool } from './db/pool';

export const createApp = (): Express => {
  const app = express();

  app.disable('x-powered-by');
  // Vercel 은 프록시 뒤에서 동작하므로 요청 제한이 실제 클라이언트 IP 를 보게 한다.
  app.set('trust proxy', 1);

  app.use(express.json({ limit: '32kb' }));
  app.use(securityHeaders);

  app.get(
    '/api/health',
    asyncHandler(async (_req, res) => {
      await getPool().query('select 1');
      ok(res, { status: 'ok' });
    }),
  );

  app.use('/api/admin', adminRoutes);
  app.use('/api', publicRoutes);

  app.use('/api', notFoundHandler);
  app.use(errorHandler);

  return app;
};

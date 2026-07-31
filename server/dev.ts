/**
 * 로컬 개발용 API 서버.
 * Vite dev server(5173)가 /api 요청을 이 포트로 프록시한다.
 * Vercel 배포 시에는 api/index.ts 가 진입점이므로 이 파일은 사용되지 않는다.
 */
import 'dotenv/config';
import { createApp } from './app';
import { loadEnv } from './config/env';
import { closePool } from './db/pool';

const env = loadEnv();
const app = createApp();

const server = app.listen(env.PORT, () => {
  console.info(`[api] http://localhost:${env.PORT} 에서 대기 중`);
});

const shutdown = (signal: string) => {
  console.info(`[api] ${signal} 수신 — 종료합니다`);
  server.close(() => {
    void closePool().finally(() => process.exit(0));
  });
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

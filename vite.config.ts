import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const resolvePath = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));

const API_DEV_PORT = process.env.PORT ?? '3001';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolvePath('./src'),
      '@shared': resolvePath('./shared'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: `http://localhost:${API_DEV_PORT}`,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // 통합 테스트가 스키마를 다시 만들기 때문에 파일을 병렬로 돌리면 서로를 망친다.
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      include: ['server/domain/**/*.ts', 'shared/**/*.ts'],
      // 타입 선언만 있는 파일은 실행 코드가 없어 커버리지 의미가 없다.
      exclude: ['**/types.ts'],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});

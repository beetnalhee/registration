import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type pg from 'pg';

const MIGRATIONS_DIR = fileURLToPath(new URL('../../../supabase/migrations/', import.meta.url));

/**
 * 테스트용 스키마를 처음부터 다시 만든다.
 *
 * 마이그레이션 파일 목록을 하드코딩하지 않고 디렉터리를 읽어 파일명 순서대로 전부 적용한다.
 * 새 마이그레이션을 추가했을 때 일부 테스트 파일만 예전 스키마로 돌아가는 사고를 막는다.
 * (실제로 003 을 추가했을 때 그런 사고가 났다)
 */
export const resetSchema = async (pool: pg.Pool): Promise<void> => {
  await pool.query('drop schema public cascade; create schema public;');

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    throw new Error(`마이그레이션 파일을 찾을 수 없습니다: ${MIGRATIONS_DIR}`);
  }

  for (const file of files) {
    await pool.query(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'));
  }
};

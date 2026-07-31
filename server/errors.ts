/**
 * 도메인/애플리케이션 오류.
 *
 * message 는 그대로 참가자 화면에 표시되므로
 * 내부 운영 규칙(Bridge Zone, 정원 수치, 성비)이 새어나가지 않는 문구만 쓴다.
 * 상세한 원인은 cause 에 담아 서버 로그로만 남긴다.
 */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields?: Record<string, string>;

  constructor(params: {
    status: number;
    code: string;
    message: string;
    fields?: Record<string, string>;
    cause?: unknown;
  }) {
    super(params.message);
    this.name = 'AppError';
    this.status = params.status;
    this.code = params.code;
    if (params.fields) {
      this.fields = params.fields;
    }
    if (params.cause !== undefined) {
      this.cause = params.cause;
    }
  }
}

export const badRequest = (message: string, fields?: Record<string, string>): AppError =>
  new AppError({ status: 400, code: 'BAD_REQUEST', message, ...(fields ? { fields } : {}) });

export const unauthorized = (message = '로그인이 필요합니다.'): AppError =>
  new AppError({ status: 401, code: 'UNAUTHORIZED', message });

export const forbidden = (message = '접근 권한이 없습니다.'): AppError =>
  new AppError({ status: 403, code: 'FORBIDDEN', message });

export const notFound = (message = '요청한 정보를 찾을 수 없습니다.'): AppError =>
  new AppError({ status: 404, code: 'NOT_FOUND', message });

export const conflict = (code: string, message: string): AppError =>
  new AppError({ status: 409, code, message });

export const internal = (message = '일시적인 오류가 발생했어요. 잠시 후 다시 시도해 주세요.', cause?: unknown): AppError =>
  new AppError({ status: 500, code: 'INTERNAL_ERROR', message, cause });

/** PostgreSQL 오류 코드 */
export const PG_ERROR_CODES = {
  uniqueViolation: '23505',
  checkViolation: '23514',
  serializationFailure: '40001',
} as const;

interface PgErrorLike {
  code?: string;
  constraint?: string;
}

export const asPgError = (error: unknown): PgErrorLike | null =>
  typeof error === 'object' && error !== null && 'code' in error ? (error as PgErrorLike) : null;

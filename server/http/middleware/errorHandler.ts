import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../../errors.js';
import { fail } from '../respond.js';

/** zod 검증 실패를 필드별 메시지로 변환한다. */
const toFieldErrors = (error: ZodError): Record<string, string> => {
  const fields: Record<string, string> = {};

  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join('.') : '_';
    if (!(key in fields)) {
      fields[key] = issue.message;
    }
  }

  return fields;
};

export const notFoundHandler: RequestHandler = (_req, res) => {
  fail(res, { status: 404, code: 'NOT_FOUND', message: '요청한 경로를 찾을 수 없습니다.' });
};

/**
 * 마지막 방어선.
 *
 * 예상하지 못한 오류의 상세 내용은 서버 로그에만 남기고
 * 클라이언트에는 일반적인 문구만 보낸다(스택·SQL·내부 규칙 유출 방지).
 */
export const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof ZodError) {
    const fields = toFieldErrors(error);
    fail(res, {
      status: 400,
      code: 'VALIDATION_ERROR',
      message: Object.values(fields)[0] ?? '입력값을 확인해 주세요.',
      fields,
    });
    return;
  }

  if (error instanceof AppError) {
    if (error.status >= 500) {
      console.error(`[api] ${req.method} ${req.originalUrl}`, error);
    }
    fail(res, {
      status: error.status,
      code: error.code,
      message: error.message,
      ...(error.fields ? { fields: error.fields } : {}),
    });
    return;
  }

  console.error(`[api] 처리되지 않은 오류 ${req.method} ${req.originalUrl}`, error);
  fail(res, {
    status: 500,
    code: 'INTERNAL_ERROR',
    message: '일시적인 오류가 발생했어요. 잠시 후 다시 시도해 주세요.',
  });
};

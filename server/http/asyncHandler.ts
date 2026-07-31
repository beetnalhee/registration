import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Express 4 는 async 핸들러의 rejection 을 잡지 못한다.
 * 모든 비동기 핸들러를 이 함수로 감싸 에러 핸들러까지 전달되도록 한다.
 */
export const asyncHandler =
  (handler: (req: Request, res: Response, next: NextFunction) => Promise<void>): RequestHandler =>
  (req, res, next) => {
    handler(req, res, next).catch(next);
  };

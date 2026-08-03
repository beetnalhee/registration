import type { Request, RequestHandler, Response } from 'express';
import { unauthorized } from '../../errors.js';
import type { AdminRecord } from '../../repositories/adminRepository.js';
import { authenticateAdmin } from '../../services/authService.js';

const ADMIN_LOCALS_KEY = 'admin';

const extractBearerToken = (req: Request): string | null => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return null;
  }
  const token = header.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
};

/**
 * 관리자 인증 미들웨어.
 * 모든 /api/admin/* 경로(로그인 제외)는 이 미들웨어를 통과해야 한다.
 */
export const requireAdmin: RequestHandler = (req, res, next) => {
  const token = extractBearerToken(req);

  if (!token) {
    next(unauthorized());
    return;
  }

  authenticateAdmin(token)
    .then((admin) => {
      res.locals[ADMIN_LOCALS_KEY] = admin;
      next();
    })
    .catch(next);
};

/** requireAdmin 을 통과한 요청에서만 호출한다. */
export const getAdmin = (res: Response): AdminRecord => {
  const admin = res.locals[ADMIN_LOCALS_KEY] as AdminRecord | undefined;
  if (!admin) {
    throw unauthorized();
  }
  return admin;
};

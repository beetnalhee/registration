import rateLimit, { type RateLimitRequestHandler } from 'express-rate-limit';
import { RATE_LIMITS } from '../../config/policy.js';
import { fail } from '../respond.js';

const build = (config: { windowMs: number; max: number }, message: string): RateLimitRequestHandler =>
  rateLimit({
    windowMs: config.windowMs,
    limit: config.max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, res) => {
      fail(res, { status: 429, code: 'TOO_MANY_REQUESTS', message });
    },
  });

export const applicationLimiter = build(
  RATE_LIMITS.application,
  '신청 요청이 너무 많아요. 잠시 후 다시 시도해 주세요.',
);

/**
 * 조회는 (생년월일 + 전화 뒤 4자리) 조합을 무작위로 대조하는 시도를 막기 위해
 * 특히 촘촘하게 제한한다.
 */
export const lookupLimiter = build(
  RATE_LIMITS.lookup,
  '조회 요청이 너무 많아요. 잠시 후 다시 시도해 주세요.',
);

/**
 * 본인 취소는 파괴적인 동작이므로 조회보다 더 촘촘하게 제한한다.
 * 자격증명(이메일 + 전화 뒤 4자리)을 무작위로 대조하며 남의 신청을
 * 취소하려는 시도를 늦춘다.
 */
export const selfCancelLimiter = build(
  RATE_LIMITS.selfCancel,
  '요청이 너무 많아요. 잠시 후 다시 시도해 주세요.',
);

export const adminLoginLimiter = build(
  RATE_LIMITS.adminLogin,
  '로그인 시도가 너무 많아요. 잠시 후 다시 시도해 주세요.',
);

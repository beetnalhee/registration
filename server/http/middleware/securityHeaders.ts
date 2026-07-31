import type { RequestHandler } from 'express';

/**
 * API 응답에 최소한의 보안 헤더를 붙인다.
 * 정적 페이지의 CSP 는 Vercel 이 처리하므로 여기서는 API 응답에 필요한 것만 둔다.
 */
export const securityHeaders: RequestHandler = (_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  // 참가자 배정 결과는 개인정보이므로 중간 캐시에 남지 않게 한다.
  res.setHeader('Cache-Control', 'no-store');
  next();
};

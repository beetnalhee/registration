import { Router } from 'express';
import { applicationSchema, lookupSchema, roundAvailabilityQuerySchema } from '../../shared/schemas';
import { getPool } from '../db/pool';
import { asyncHandler } from '../http/asyncHandler';
import { applicationLimiter, lookupLimiter } from '../http/middleware/rateLimiters';
import { ok } from '../http/respond';
import { submitApplication } from '../services/applicationService';
import { getEventInfo, getRoundAvailabilities } from '../services/availabilityService';
import { lookupAssignment } from '../services/lookupService';

/**
 * 참가자용 공개 API.
 *
 * ★ 이 라우터의 어떤 응답에도 인원수·잔여석·성비·Bridge Zone 정보가 없다.
 *   회차 상태는 '신청 가능 / 마감 임박 / 마감' 문자열로만 내려간다.
 */
export const publicRoutes = Router();

publicRoutes.get(
  '/event',
  asyncHandler(async (_req, res) => {
    ok(res, await getEventInfo(getPool()));
  }),
);

publicRoutes.get(
  '/rounds/availability',
  asyncHandler(async (req, res) => {
    const query = roundAvailabilityQuerySchema.parse(req.query);
    ok(res, await getRoundAvailabilities(getPool(), query.gender));
  }),
);

publicRoutes.post(
  '/applications',
  applicationLimiter,
  asyncHandler(async (req, res) => {
    const input = applicationSchema.parse(req.body);
    ok(res, await submitApplication(input), 201);
  }),
);

publicRoutes.post(
  '/lookup',
  lookupLimiter,
  asyncHandler(async (req, res) => {
    const input = lookupSchema.parse(req.body);
    ok(res, await lookupAssignment(input));
  }),
);

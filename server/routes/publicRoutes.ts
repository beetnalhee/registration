import { Router } from 'express';
import {
  applicationSchema,
  lookupSchema,
  roundAvailabilityQuerySchema,
  selfCancelSchema,
} from '../../shared/schemas.js';
import { getPool } from '../db/pool.js';
import { asyncHandler } from '../http/asyncHandler.js';
import {
  applicationLimiter,
  lookupLimiter,
  selfCancelLimiter,
} from '../http/middleware/rateLimiters.js';
import { ok } from '../http/respond.js';
import { submitApplication } from '../services/applicationService.js';
import { getEventInfo, getRoundAvailabilities } from '../services/availabilityService.js';
import { lookupAssignment } from '../services/lookupService.js';
import { cancelOwnApplication } from '../services/selfCancelService.js';

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

/**
 * 본인 취소. 조회와 같은 자격증명을 요구하고 접수 중일 때만 동작한다.
 * 파괴적인 동작이므로 조회보다 촘촘한 요청 제한을 적용한다.
 */
publicRoutes.post(
  '/participants/cancel',
  selfCancelLimiter,
  asyncHandler(async (req, res) => {
    const input = selfCancelSchema.parse(req.body);
    ok(res, await cancelOwnApplication(input));
  }),
);

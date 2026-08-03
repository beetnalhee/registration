import { Router } from 'express';
import { z } from 'zod';
import {
  adminLoginSchema,
  adminParticipantQuerySchema,
  adminPromoteSchema,
  adminReassignSchema,
  adminSettingsSchema,
} from '../../shared/schemas.js';
import { getPool } from '../db/pool.js';
import { asyncHandler } from '../http/asyncHandler.js';
import { adminLoginLimiter } from '../http/middleware/rateLimiters.js';
import { getAdmin, requireAdmin } from '../http/middleware/requireAdmin.js';
import { ok } from '../http/respond.js';
import { loginAdmin } from '../services/authService.js';
import { getAdminOverview } from '../services/admin/overviewService.js';
import {
  buildParticipantsCsv,
  getParticipantDetail,
  listParticipants,
} from '../services/admin/participantQueryService.js';
import {
  cancelParticipant,
  promoteParticipant,
  reassignParticipant,
  resendParticipantEmail,
} from '../services/admin/participantMutationService.js';
import { updateSettings } from '../services/admin/settingsAdminService.js';
import {
  checkInParticipant,
  undoCheckInParticipant,
} from '../services/admin/attendanceService.js';

const participantIdSchema = z.object({ id: z.string().uuid('참가자 ID 형식이 올바르지 않습니다.') });

export const adminRoutes = Router();

// ── 로그인 (인증 불필요) ───────────────────────────────────────────────────
adminRoutes.post(
  '/login',
  adminLoginLimiter,
  asyncHandler(async (req, res) => {
    const credentials = adminLoginSchema.parse(req.body);
    ok(res, await loginAdmin(credentials));
  }),
);

// ── 이하 전부 관리자 인증 필요 ─────────────────────────────────────────────
adminRoutes.use(requireAdmin);

adminRoutes.get(
  '/me',
  asyncHandler(async (_req, res) => {
    const admin = getAdmin(res);
    ok(res, { email: admin.email, displayName: admin.displayName });
  }),
);

adminRoutes.get(
  '/overview',
  asyncHandler(async (_req, res) => {
    ok(res, await getAdminOverview(getPool()));
  }),
);

adminRoutes.get(
  '/participants',
  asyncHandler(async (req, res) => {
    const query = adminParticipantQuerySchema.parse(req.query);
    ok(res, await listParticipants(getPool(), query));
  }),
);

adminRoutes.get(
  '/participants/:id',
  asyncHandler(async (req, res) => {
    const { id } = participantIdSchema.parse(req.params);
    ok(res, await getParticipantDetail(getPool(), id));
  }),
);

adminRoutes.patch(
  '/participants/:id/assignment',
  asyncHandler(async (req, res) => {
    const { id } = participantIdSchema.parse(req.params);
    const patch = adminReassignSchema.parse(req.body);

    ok(
      res,
      await reassignParticipant({
        adminEmail: getAdmin(res).email,
        participantId: id,
        ...patch,
      }),
    );
  }),
);

adminRoutes.post(
  '/participants/:id/cancel',
  asyncHandler(async (req, res) => {
    const { id } = participantIdSchema.parse(req.params);
    const body = z.object({ notify: z.boolean().optional() }).parse(req.body ?? {});

    ok(
      res,
      await cancelParticipant({
        adminEmail: getAdmin(res).email,
        participantId: id,
        ...body,
      }),
    );
  }),
);

adminRoutes.post(
  '/participants/:id/promote',
  asyncHandler(async (req, res) => {
    const { id } = participantIdSchema.parse(req.params);
    const body = adminPromoteSchema.parse(req.body ?? {});

    ok(
      res,
      await promoteParticipant({
        adminEmail: getAdmin(res).email,
        participantId: id,
        ...body,
      }),
    );
  }),
);

adminRoutes.post(
  '/participants/:id/resend-email',
  asyncHandler(async (req, res) => {
    const { id } = participantIdSchema.parse(req.params);

    ok(
      res,
      await resendParticipantEmail({
        adminEmail: getAdmin(res).email,
        participantId: id,
      }),
    );
  }),
);

// ── 리셉션 출석 체크 ───────────────────────────────────────────────────────
adminRoutes.post(
  '/participants/:id/check-in',
  asyncHandler(async (req, res) => {
    const { id } = participantIdSchema.parse(req.params);

    ok(res, await checkInParticipant({ adminEmail: getAdmin(res).email, participantId: id }));
  }),
);

adminRoutes.post(
  '/participants/:id/undo-check-in',
  asyncHandler(async (req, res) => {
    const { id } = participantIdSchema.parse(req.params);

    ok(res, await undoCheckInParticipant({ adminEmail: getAdmin(res).email, participantId: id }));
  }),
);

adminRoutes.get(
  '/participants.csv',
  asyncHandler(async (_req, res) => {
    const csv = await buildParticipantsCsv(getPool());

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="participants.csv"');
    res.status(200).send(csv);
  }),
);

adminRoutes.patch(
  '/settings',
  asyncHandler(async (req, res) => {
    const patch = adminSettingsSchema.parse(req.body);

    ok(res, await updateSettings({ adminEmail: getAdmin(res).email, patch }));
  }),
);

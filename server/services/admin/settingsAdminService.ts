import type { z } from 'zod';
import type { adminSettingsSchema } from '../../../shared/schemas.js';
import type { AdminSettingsDto } from '../../../shared/types.js';
import { withTransaction } from '../../db/pool.js';
import { recordAudit } from '../../repositories/auditLogRepository.js';
import { findEventSettings, updateEventSettings } from '../../repositories/settingsRepository.js';

export type SettingsPatch = z.infer<typeof adminSettingsSchema>;

/**
 * 행사 설정 변경 (행사명, 기준일, 접수 여부, 마감 임박 기준).
 * 마감 임박 기준(near_full_threshold)은 관리자가 언제든 조정할 수 있어야 한다는
 * 요구사항을 여기서 충족한다.
 */
export const updateSettings = async (params: {
  adminEmail: string;
  patch: SettingsPatch;
}): Promise<AdminSettingsDto> => {
  return withTransaction(async (client) => {
    const before = await findEventSettings(client);

    await updateEventSettings(client, params.patch);

    const after = await findEventSettings(client);

    await recordAudit(client, {
      adminEmail: params.adminEmail,
      action: 'update_settings',
      beforeState: {
        eventName: before.eventName,
        eventDate: before.eventDate,
        isOpen: before.isOpen,
        nearFullThreshold: before.nearFullThreshold,
      },
      afterState: {
        eventName: after.eventName,
        eventDate: after.eventDate,
        isOpen: after.isOpen,
        nearFullThreshold: after.nearFullThreshold,
      },
    });

    return {
      eventName: after.eventName,
      eventDate: after.eventDate,
      isOpen: after.isOpen,
      nearFullThreshold: after.nearFullThreshold,
    };
  });
};

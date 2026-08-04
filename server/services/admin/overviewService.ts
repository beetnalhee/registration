import { GROUP_CODES } from '../../../shared/constants.js';
import type {
  AdminOverviewDto,
  GenderCountDto,
  Gender,
  SlotCountDto,
} from '../../../shared/types.js';
import type { Queryable } from '../../db/pool.js';
import { availabilityForSlots } from '../../domain/availability.js';
import type { SlotState } from '../../domain/types.js';
import { countAttendanceByRound, countByStatus } from '../../repositories/participantRepository.js';
import { findActiveRounds } from '../../repositories/roundRepository.js';
import { findEventSettings } from '../../repositories/settingsRepository.js';
import { findSlotStates } from '../../repositories/slotRepository.js';

const sumFor = (slots: SlotState[], gender: Gender): GenderCountDto =>
  slots
    .filter((slot) => slot.gender === gender)
    .reduce(
      (total, slot) => ({
        filled: total.filled + slot.filled,
        capacity: total.capacity + slot.capacity,
      }),
      { filled: 0, capacity: 0 },
    );

/**
 * 관리자 현황판.
 *
 * 참가자 응답과 달리 실제 인원수와 성비를 그대로 담는다.
 * 이 응답은 requireAdmin 미들웨어를 통과한 요청에만 반환된다.
 */
export const getAdminOverview = async (client: Queryable): Promise<AdminOverviewDto> => {
  const [settings, rounds, slots, statusTally, attendance] = await Promise.all([
    findEventSettings(client),
    findActiveRounds(client),
    findSlotStates(client),
    countByStatus(client),
    countAttendanceByRound(client),
  ]);

  return {
    eventName: settings.eventName,
    eventDate: settings.eventDate,
    isOpen: settings.isOpen,
    nearFullThreshold: settings.nearFullThreshold,
    totalAssigned: statusTally.assigned,
    totalCancelled: statusTally.cancelled,
    rounds: rounds.map((round) => {
      const roundSlots = slots.filter((slot) => slot.roundNo === round.roundNo);

      // 그룹별 정원이 하드 제약이므로 남/여 합계는 자동으로 그룹 정원의 합이 된다.
      const male = sumFor(roundSlots, 'M');
      const female = sumFor(roundSlots, 'F');

      const groups: SlotCountDto[] = GROUP_CODES.map((groupCode) => {
        const forGroup = roundSlots.filter((slot) => slot.groupCode === groupCode);

        return {
          groupCode,
          male: sumFor(forGroup, 'M'),
          female: sumFor(forGroup, 'F'),
        };
      });

      const counted = attendance.find((item) => item.roundNo === round.roundNo);

      return {
        roundNo: round.roundNo,
        timeLabel: round.timeLabel,
        male,
        female,
        availability: availabilityForSlots(roundSlots, settings.nearFullThreshold),
        groups,
        attendance: {
          checkedIn: counted?.checkedIn ?? 0,
          assigned: counted?.assigned ?? 0,
        },
      };
    }),
  };
};

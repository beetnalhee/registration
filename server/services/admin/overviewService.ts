import { GROUP_CODES } from '../../../shared/constants.js';
import type { AdminOverviewDto, GenderCountDto, SlotCountDto } from '../../../shared/types.js';
import type { Queryable } from '../../db/pool.js';
import { combineAvailability, resolveAvailability } from '../../domain/availability.js';
import { countAssignedByGroup, countByStatus } from '../../repositories/participantRepository.js';
import { findActiveRounds } from '../../repositories/roundRepository.js';
import { findEventSettings } from '../../repositories/settingsRepository.js';
import { findCapacityStates } from '../../repositories/slotRepository.js';
import type { RoundCapacityState } from '../../domain/types.js';
import type { Gender } from '../../../shared/types.js';

const EMPTY_COUNT: GenderCountDto = { filled: 0, capacity: 0 };

const toGenderCount = (
  capacities: RoundCapacityState[],
  roundNo: number,
  gender: Gender,
): GenderCountDto => {
  const found = capacities.find(
    (capacity) => capacity.roundNo === roundNo && capacity.gender === gender,
  );
  return found ? { filled: found.filled, capacity: found.capacity } : EMPTY_COUNT;
};

/**
 * 관리자 현황판.
 * 참가자 응답과 달리 실제 인원수와 성비를 그대로 담는다.
 * 이 응답은 requireAdmin 미들웨어를 통과한 요청에만 반환된다.
 */
export const getAdminOverview = async (client: Queryable): Promise<AdminOverviewDto> => {
  const [settings, rounds, capacities, groupCounts, statusTally] = await Promise.all([
    findEventSettings(client),
    findActiveRounds(client),
    findCapacityStates(client),
    countAssignedByGroup(client),
    countByStatus(client),
  ]);

  const countOf = (roundNo: number, groupCode: string, gender: Gender): number =>
    groupCounts.find(
      (row) => row.roundNo === roundNo && row.groupCode === groupCode && row.gender === gender,
    )?.count ?? 0;

  return {
    eventName: settings.eventName,
    eventDate: settings.eventDate,
    isOpen: settings.isOpen,
    nearFullThreshold: settings.nearFullThreshold,
    totalAssigned: statusTally.assigned,
    totalWaitlisted: statusTally.waitlisted,
    totalCancelled: statusTally.cancelled,
    rounds: rounds.map((round) => {
      const male = toGenderCount(capacities, round.roundNo, 'M');
      const female = toGenderCount(capacities, round.roundNo, 'F');

      const availability = combineAvailability(
        [male, female].map((count) =>
          resolveAvailability({
            capacity: count.capacity,
            filled: count.filled,
            nearFullThreshold: settings.nearFullThreshold,
          }),
        ),
      );

      const groups: SlotCountDto[] = GROUP_CODES.map((groupCode) => ({
        groupCode,
        male: countOf(round.roundNo, groupCode, 'M'),
        female: countOf(round.roundNo, groupCode, 'F'),
      }));

      return { roundNo: round.roundNo, timeLabel: round.timeLabel, male, female, availability, groups };
    }),
  };
};

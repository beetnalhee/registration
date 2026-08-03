import type { EventInfoDto, Gender, RoundAvailabilityDto } from '../../shared/types.js';
import type { Queryable } from '../db/pool.js';
import { combineAvailability, resolveAvailability } from '../domain/availability.js';
import { findCapacityStates } from '../repositories/slotRepository.js';
import { findEventSettings } from '../repositories/settingsRepository.js';
import { findActiveRounds } from '../repositories/roundRepository.js';

/** 참가자 화면에 필요한 행사 기본 정보. 인원수는 포함하지 않는다. */
export const getEventInfo = async (client: Queryable): Promise<EventInfoDto> => {
  const [settings, rounds] = await Promise.all([
    findEventSettings(client),
    findActiveRounds(client),
  ]);

  return {
    eventName: settings.eventName,
    eventDate: settings.eventDate,
    isOpen: settings.isOpen,
    rounds: rounds.map((round) => ({
      roundNo: round.roundNo,
      startsAt: round.startsAt,
      endsAt: round.endsAt,
      timeLabel: round.timeLabel,
    })),
  };
};

/**
 * 회차별 상태를 계산한다.
 *
 * ★ 반환값에는 '신청 가능 / 마감 임박 / 마감' 세 문자열만 담긴다.
 *   남녀 인원수·잔여석·신청 인원은 어떤 필드로도 내려보내지 않는다.
 *
 * @param gender 알고 있으면 해당 성별 정원만 본다. 성별 정원이 분리되어 있어
 *               이 값이 있으면 참가자에게 정확한 상태를 보여줄 수 있다.
 */
export const getRoundAvailabilities = async (
  client: Queryable,
  gender?: Gender,
): Promise<RoundAvailabilityDto[]> => {
  const [settings, rounds, capacities] = await Promise.all([
    findEventSettings(client),
    findActiveRounds(client),
    findCapacityStates(client),
  ]);

  return rounds.map((round) => {
    const relevant = capacities.filter(
      (capacity) =>
        capacity.roundNo === round.roundNo && (gender === undefined || capacity.gender === gender),
    );

    const statuses = relevant.map((capacity) =>
      resolveAvailability({
        capacity: capacity.capacity,
        filled: capacity.filled,
        nearFullThreshold: settings.nearFullThreshold,
      }),
    );

    return {
      roundNo: round.roundNo,
      // 행사 자체가 닫혀 있으면 모든 회차를 마감으로 표시한다.
      availability: settings.isOpen ? combineAvailability(statuses) : 'closed',
    };
  });
};

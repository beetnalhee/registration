import type { EventInfoDto, Gender, GroupCode, RoundAvailabilityDto } from '../../shared/types.js';
import type { Queryable } from '../db/pool.js';
import { calculateAge } from '../domain/age.js';
import { resolveCandidateGroups } from '../domain/assignment.js';
import { availabilityForSlots } from '../domain/availability.js';
import { findSlotStates } from '../repositories/slotRepository.js';
import { findEventSettings, findGroups } from '../repositories/settingsRepository.js';
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

export interface AvailabilityQuery {
  gender?: Gender;
  /** 'YYYY-MM-DD'. 나이로 후보 그룹을 정하기 위해 필요하다. */
  birthdate?: string;
}

/**
 * 회차별 상태를 계산한다.
 *
 * ★ 반환값에는 '신청 가능 / 마감 임박 / 마감' 세 문자열만 담긴다.
 *   남녀 인원수·잔여석·그룹·Bridge Zone 은 어떤 필드로도 내려보내지 않는다.
 *
 * 정원이 (회차, 그룹, 성별) 단위이므로 정확한 상태를 알려면 참가자의 그룹을
 * 알아야 한다. 그룹은 나이로 정해지므로 생년월일을 받아 서버에서 계산한다.
 * 참가자에게는 자신이 어느 그룹인지 알려주지 않는다.
 *
 *   생년월일 + 성별 있음 → 그 사람이 들어갈 수 있는 슬롯만 보고 판단
 *   없음                 → 그 회차의 모든 슬롯을 합쳐 개괄만 보여줌(랜딩 화면)
 */
export const getRoundAvailabilities = async (
  client: Queryable,
  query: AvailabilityQuery = {},
): Promise<RoundAvailabilityDto[]> => {
  const [settings, groups, rounds, slots] = await Promise.all([
    findEventSettings(client),
    findGroups(client),
    findActiveRounds(client),
    findSlotStates(client),
  ]);

  let candidateGroups: GroupCode[] | null = null;

  if (query.birthdate !== undefined) {
    const age = calculateAge(query.birthdate, settings.eventDate);
    const candidates = resolveCandidateGroups(age, groups, settings);
    // 참가 가능 연령을 벗어나면 후보가 없다. 이때는 개괄 상태를 보여주고,
    // 연령 안내는 제출 시점에 명확한 문구로 전달한다.
    candidateGroups = candidates.length > 0 ? candidates : null;
  }

  return rounds.map((round) => {
    const relevant = slots.filter(
      (slot) =>
        slot.roundNo === round.roundNo &&
        (query.gender === undefined || slot.gender === query.gender) &&
        (candidateGroups === null || candidateGroups.includes(slot.groupCode)),
    );

    return {
      roundNo: round.roundNo,
      // 행사 자체가 닫혀 있으면 모든 회차를 마감으로 표시한다.
      availability: settings.isOpen
        ? availabilityForSlots(relevant, settings.nearFullThreshold)
        : 'closed',
    };
  });
};

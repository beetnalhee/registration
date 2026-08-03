import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE_POLICY, decideAssignment } from '../../server/domain/assignment.js';
import type {
  AgePolicy,
  AssignmentContext,
  AssignmentRequest,
  Gender,
  GroupRule,
} from '../../server/domain/types.js';

/**
 * 배정 알고리즘 시뮬레이션.
 *
 * 실제 시스템은 advisory lock 으로 배정을 직렬화하므로,
 * 동시에 들어온 신청도 결국 "한 건씩 순서대로" 처리된다.
 * 이 테스트는 그 직렬화된 흐름을 그대로 재현해
 *   - 정원을 절대 넘지 않는지
 *   - 넘치는 인원이 대기자로 떨어지는지
 *   - 그룹 성비가 무너지지 않는지
 * 를 DB 없이 검증한다.
 *
 * 락 자체의 동작은 tests/integration/concurrency.test.ts 에서 실제 DB 로 검증한다.
 */

const GROUPS: GroupRule[] = [
  { code: 'SUMMER', minAge: 18, maxAge: 25, sortOrder: 1 },
  { code: 'NIGHT', minAge: 26, maxAge: 35, sortOrder: 2 },
];

const AGE_POLICY: AgePolicy = { minAge: 18, maxAge: 35, bridgeMinAge: 24, bridgeMaxAge: 27 };

const CAPACITY_PER_GENDER = 20;
const ROUND_NOS = [1, 2, 3];

const initialContext = (capacity = CAPACITY_PER_GENDER): AssignmentContext => ({
  groups: GROUPS,
  agePolicy: AGE_POLICY,
  balancePolicy: DEFAULT_BALANCE_POLICY,
  capacities: ROUND_NOS.flatMap((roundNo) =>
    (['M', 'F'] as Gender[]).map((gender) => ({ roundNo, gender, capacity, filled: 0 })),
  ),
  tallies: ROUND_NOS.flatMap((roundNo) =>
    GROUPS.flatMap((group) =>
      (['M', 'F'] as Gender[]).map((gender) => ({
        roundNo,
        groupCode: group.code,
        gender,
        activeCount: 0,
      })),
    ),
  ),
});

interface SimulationResult {
  context: AssignmentContext;
  assigned: number;
  waitlisted: number;
}

/** 신청 1건을 처리하고 새로운 상태를 반환한다(기존 상태는 변경하지 않는다). */
const processOne = (
  context: AssignmentContext,
  request: AssignmentRequest,
): { context: AssignmentContext; outcome: 'assigned' | 'waitlisted' } => {
  const decision = decideAssignment(request, context);

  if (decision.outcome === 'waitlisted') {
    return { context, outcome: 'waitlisted' };
  }

  return {
    outcome: 'assigned',
    context: {
      ...context,
      capacities: context.capacities.map((capacity) =>
        capacity.roundNo === decision.roundNo && capacity.gender === request.gender
          ? { ...capacity, filled: capacity.filled + 1 }
          : capacity,
      ),
      tallies: context.tallies.map((tally) =>
        tally.roundNo === decision.roundNo &&
        tally.groupCode === decision.groupCode &&
        tally.gender === request.gender
          ? { ...tally, activeCount: tally.activeCount + 1 }
          : tally,
      ),
    },
  };
};

const simulate = (requests: AssignmentRequest[], capacity?: number): SimulationResult =>
  requests.reduce<SimulationResult>(
    (state, request) => {
      const { context, outcome } = processOne(state.context, request);
      return {
        context,
        assigned: state.assigned + (outcome === 'assigned' ? 1 : 0),
        waitlisted: state.waitlisted + (outcome === 'waitlisted' ? 1 : 0),
      };
    },
    { context: initialContext(capacity), assigned: 0, waitlisted: 0 },
  );

const filledOf = (result: SimulationResult, roundNo: number, gender: Gender): number =>
  result.context.capacities.find((item) => item.roundNo === roundNo && item.gender === gender)
    ?.filled ?? -1;

const tallyOf = (
  result: SimulationResult,
  roundNo: number,
  groupCode: 'SUMMER' | 'NIGHT',
  gender: Gender,
): number =>
  result.context.tallies.find(
    (item) => item.roundNo === roundNo && item.groupCode === groupCode && item.gender === gender,
  )?.activeCount ?? -1;

/** 나이를 순환시켜 Bridge Zone 안팎이 섞인 신청자 목록을 만든다. */
const buildRequests = (count: number, gender: Gender, ages = [20, 24, 26, 30]): AssignmentRequest[] =>
  Array.from({ length: count }, (_, index) => ({
    gender,
    age: ages[index % ages.length] as number,
    preferences: [1, 2, 3],
  }));

describe('정원 시뮬레이션', () => {
  it('40명이 1순위로 몰려도 1회차는 정확히 20명에서 멈추고 나머지는 2회차로 간다', () => {
    const result = simulate(buildRequests(40, 'M'));

    expect(filledOf(result, 1, 'M')).toBe(20);
    expect(filledOf(result, 2, 'M')).toBe(20);
    expect(filledOf(result, 3, 'M')).toBe(0);
    expect(result.assigned).toBe(40);
    expect(result.waitlisted).toBe(0);
  });

  it('정원(60명)을 넘는 인원은 대기자가 되고 어느 회차도 20명을 넘지 않는다', () => {
    const result = simulate(buildRequests(75, 'F'));

    for (const roundNo of ROUND_NOS) {
      expect(filledOf(result, roundNo, 'F')).toBe(20);
      expect(filledOf(result, roundNo, 'F')).toBeLessThanOrEqual(CAPACITY_PER_GENDER);
    }

    expect(result.assigned).toBe(60);
    expect(result.waitlisted).toBe(15);
  });

  it('남녀 정원은 서로를 잠식하지 않는다', () => {
    const requests = [...buildRequests(30, 'M'), ...buildRequests(30, 'F')];
    const result = simulate(requests);

    expect(filledOf(result, 1, 'M')).toBe(20);
    expect(filledOf(result, 1, 'F')).toBe(20);
    expect(result.assigned).toBe(60);
  });

  it('정원을 2명으로 줄이면 초과분이 즉시 대기자가 된다', () => {
    const result = simulate(buildRequests(10, 'M'), 2);

    expect(filledOf(result, 1, 'M')).toBe(2);
    expect(filledOf(result, 2, 'M')).toBe(2);
    expect(filledOf(result, 3, 'M')).toBe(2);
    expect(result.assigned).toBe(6);
    expect(result.waitlisted).toBe(4);
  });
});

describe('그룹 성비 보정', () => {
  it('남성이 먼저 몰려도 이후 여성 신청으로 그룹별 성비가 좁혀진다', () => {
    // 남성 24명(1회차 20 + 2회차 4) → 이어서 여성 20명이 1회차로 들어온다.
    const requests = [...buildRequests(24, 'M'), ...buildRequests(20, 'F')];
    const result = simulate(requests);

    for (const groupCode of ['SUMMER', 'NIGHT'] as const) {
      const male = tallyOf(result, 1, groupCode, 'M');
      const female = tallyOf(result, 1, groupCode, 'F');

      // Bridge Zone 참가자가 부족한 쪽으로 흘러 그룹 내 남녀 차이가 크게 벌어지지 않는다.
      expect(Math.abs(male - female)).toBeLessThanOrEqual(3);
    }
  });

  it('그룹 인원 합계는 항상 회차 정원과 일치한다', () => {
    const result = simulate(buildRequests(20, 'F'));

    const summed =
      tallyOf(result, 1, 'SUMMER', 'F') + tallyOf(result, 1, 'NIGHT', 'F');

    expect(summed).toBe(filledOf(result, 1, 'F'));
  });
});

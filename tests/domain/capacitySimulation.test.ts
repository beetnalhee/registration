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

/** 나이를 순환시켜 Bridge Zone 안팎이 섞인 신청자 목록을 만든다. 모두 같은 회차를 고른다. */
const buildRequests = (
  count: number,
  gender: Gender,
  roundNo = 1,
  ages = [20, 24, 26, 30],
): AssignmentRequest[] =>
  Array.from({ length: count }, (_, index) => ({
    gender,
    age: ages[index % ages.length] as number,
    roundNo,
  }));

describe('정원 시뮬레이션 (선착순)', () => {
  it('40명이 1회차를 고르면 20명만 배정되고 나머지는 대기자가 된다', () => {
    const result = simulate(buildRequests(40, 'M', 1));

    // ★ 예전에는 초과분이 2회차로 넘어갔지만, 선착순에서는 넘어가지 않는다.
    expect(filledOf(result, 1, 'M')).toBe(20);
    expect(filledOf(result, 2, 'M')).toBe(0);
    expect(filledOf(result, 3, 'M')).toBe(0);
    expect(result.assigned).toBe(20);
    expect(result.waitlisted).toBe(20);
  });

  it('회차를 나눠 고르면 각 회차가 독립적으로 채워진다', () => {
    const result = simulate([
      ...buildRequests(25, 'F', 1),
      ...buildRequests(10, 'F', 2),
      ...buildRequests(5, 'F', 3),
    ]);

    expect(filledOf(result, 1, 'F')).toBe(20);
    expect(filledOf(result, 2, 'F')).toBe(10);
    expect(filledOf(result, 3, 'F')).toBe(5);
    expect(result.assigned).toBe(35);
    expect(result.waitlisted).toBe(5);
  });

  it('어떤 회차도 정원을 넘지 않는다', () => {
    const result = simulate([
      ...buildRequests(30, 'F', 1),
      ...buildRequests(30, 'F', 2),
      ...buildRequests(30, 'F', 3),
    ]);

    for (const roundNo of ROUND_NOS) {
      expect(filledOf(result, roundNo, 'F')).toBe(CAPACITY_PER_GENDER);
    }
    expect(result.assigned).toBe(60);
    expect(result.waitlisted).toBe(30);
  });

  it('남녀 정원은 서로를 잠식하지 않는다', () => {
    const result = simulate([...buildRequests(30, 'M', 1), ...buildRequests(30, 'F', 1)]);

    expect(filledOf(result, 1, 'M')).toBe(20);
    expect(filledOf(result, 1, 'F')).toBe(20);
    expect(result.assigned).toBe(40);
    expect(result.waitlisted).toBe(20);
  });

  it('정원을 2명으로 줄이면 초과분이 즉시 대기자가 된다', () => {
    const result = simulate(buildRequests(10, 'M', 1), 2);

    expect(filledOf(result, 1, 'M')).toBe(2);
    expect(result.assigned).toBe(2);
    expect(result.waitlisted).toBe(8);
  });
});

describe('그룹 성비 보정', () => {
  it('남성이 먼저 몰려도 이후 여성 신청으로 그룹별 성비가 좁혀진다', () => {
    // 남성 20명이 1회차를 채운 뒤 여성 20명이 같은 회차로 들어온다.
    const requests = [...buildRequests(20, 'M', 1), ...buildRequests(20, 'F', 1)];
    const result = simulate(requests);

    for (const groupCode of ['SUMMER', 'NIGHT'] as const) {
      const male = tallyOf(result, 1, groupCode, 'M');
      const female = tallyOf(result, 1, groupCode, 'F');

      // Bridge Zone 참가자가 부족한 쪽으로 흘러 그룹 내 남녀 차이가 크게 벌어지지 않는다.
      expect(Math.abs(male - female)).toBeLessThanOrEqual(3);
    }
  });

  it('그룹 인원 합계는 항상 회차 정원과 일치한다', () => {
    const result = simulate(buildRequests(20, 'F', 1));

    const summed =
      tallyOf(result, 1, 'SUMMER', 'F') + tallyOf(result, 1, 'NIGHT', 'F');

    expect(summed).toBe(filledOf(result, 1, 'F'));
  });
});

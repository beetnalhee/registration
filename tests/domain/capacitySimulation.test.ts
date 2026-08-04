import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE_POLICY, decideAssignment } from '../../server/domain/assignment.js';
import type {
  AgePolicy,
  AssignmentContext,
  AssignmentRequest,
  Gender,
  GroupCode,
  GroupRule,
} from '../../server/domain/types.js';

/**
 * 배정 알고리즘 시뮬레이션.
 *
 * 실제 시스템은 advisory lock 으로 배정을 직렬화하므로,
 * 동시에 들어온 신청도 결국 "한 건씩 순서대로" 처리된다.
 * 이 테스트는 그 직렬화된 흐름을 그대로 재현해
 *   - (회차, 그룹, 성별) 10명 정원을 절대 넘지 않는지
 *   - 자리가 없으면 거절되는지 (대기자로 만들지 않는지)
 *   - Bridge Zone 이 정원을 확보하는지
 * 를 DB 없이 검증한다.
 *
 * 락 자체의 동작은 tests/integration/concurrency.test.ts 에서 실제 DB 로 검증한다.
 */

const GROUPS: GroupRule[] = [
  { code: 'SUMMER', minAge: 18, maxAge: 25, sortOrder: 1 },
  { code: 'NIGHT', minAge: 26, maxAge: 35, sortOrder: 2 },
];

const AGE_POLICY: AgePolicy = { minAge: 18, maxAge: 35, bridgeMinAge: 24, bridgeMaxAge: 27 };

const CAPACITY = 10;
const ROUND_NOS = [1, 2, 3];

const initialContext = (capacity = CAPACITY): AssignmentContext => ({
  groups: GROUPS,
  agePolicy: AGE_POLICY,
  balancePolicy: DEFAULT_BALANCE_POLICY,
  slots: ROUND_NOS.flatMap((roundNo) =>
    (['SUMMER', 'NIGHT'] as GroupCode[]).flatMap((groupCode) =>
      (['M', 'F'] as Gender[]).map((gender) => ({
        roundNo,
        groupCode,
        gender,
        capacity,
        filled: 0,
      })),
    ),
  ),
});

interface SimulationResult {
  context: AssignmentContext;
  assigned: number;
  rejected: number;
}

/** 신청 1건을 처리하고 새로운 상태를 반환한다(기존 상태는 변경하지 않는다). */
const processOne = (
  context: AssignmentContext,
  request: AssignmentRequest,
): { context: AssignmentContext; outcome: 'assigned' | 'rejected' } => {
  const decision = decideAssignment(request, context);

  if (decision.outcome === 'rejected') {
    return { context, outcome: 'rejected' };
  }

  return {
    outcome: 'assigned',
    context: {
      ...context,
      slots: context.slots.map((slot) =>
        slot.roundNo === decision.roundNo &&
        slot.groupCode === decision.groupCode &&
        slot.gender === request.gender
          ? { ...slot, filled: slot.filled + 1 }
          : slot,
      ),
    },
  };
};

const runWith = (
  requests: AssignmentRequest[],
  startingContext: AssignmentContext,
): SimulationResult =>
  requests.reduce<SimulationResult>(
    (state, request) => {
      const { context, outcome } = processOne(state.context, request);
      return {
        context,
        assigned: state.assigned + (outcome === 'assigned' ? 1 : 0),
        rejected: state.rejected + (outcome === 'rejected' ? 1 : 0),
      };
    },
    { context: startingContext, assigned: 0, rejected: 0 },
  );

const simulate = (requests: AssignmentRequest[], capacity?: number): SimulationResult =>
  runWith(requests, initialContext(capacity));

/** 성비 보정 가중치를 바꿔 같은 신청 목록을 돌려본다. */
const simulateWith = (
  requests: AssignmentRequest[],
  balancePolicy: AssignmentContext['balancePolicy'],
): SimulationResult => runWith(requests, { ...initialContext(), balancePolicy });

const filledOf = (
  result: SimulationResult,
  roundNo: number,
  groupCode: GroupCode,
  gender: Gender,
): number =>
  result.context.slots.find(
    (slot) => slot.roundNo === roundNo && slot.groupCode === groupCode && slot.gender === gender,
  )?.filled ?? -1;

const totalFilled = (result: SimulationResult): number =>
  result.context.slots.reduce((sum, slot) => sum + slot.filled, 0);

const requests = (
  count: number,
  gender: Gender,
  age: number,
  roundNo = 1,
): AssignmentRequest[] => Array.from({ length: count }, () => ({ gender, age, roundNo }));

describe('정원 시뮬레이션 (그룹별 10명, 대기자 없음)', () => {
  it('한 그룹·성별에 20명이 몰리면 10명만 배정되고 나머지는 거절된다', () => {
    const result = simulate(requests(20, 'F', 22, 1));

    expect(filledOf(result, 1, 'SUMMER', 'F')).toBe(10);
    expect(result.assigned).toBe(10);
    expect(result.rejected).toBe(10);
  });

  it('그룹·성별이 다르면 서로 잠식하지 않는다', () => {
    const result = simulate([
      ...requests(15, 'F', 22, 1), // SUMMER 여성
      ...requests(15, 'M', 22, 1), // SUMMER 남성
      ...requests(15, 'F', 30, 1), // NIGHT 여성
      ...requests(15, 'M', 30, 1), // NIGHT 남성
    ]);

    expect(filledOf(result, 1, 'SUMMER', 'F')).toBe(10);
    expect(filledOf(result, 1, 'SUMMER', 'M')).toBe(10);
    expect(filledOf(result, 1, 'NIGHT', 'F')).toBe(10);
    expect(filledOf(result, 1, 'NIGHT', 'M')).toBe(10);
    expect(result.assigned).toBe(40);
    expect(result.rejected).toBe(20);
  });

  it('전체 정원은 120명이다 (3회차 × 2그룹 × 2성별 × 10)', () => {
    const everyone = ROUND_NOS.flatMap((roundNo) => [
      ...requests(15, 'F', 20, roundNo),
      ...requests(15, 'M', 20, roundNo),
      ...requests(15, 'F', 30, roundNo),
      ...requests(15, 'M', 30, roundNo),
    ]);

    const result = simulate(everyone);

    expect(totalFilled(result)).toBe(120);
    expect(result.assigned).toBe(120);
  });

  it('고른 회차가 차면 다른 회차가 비어 있어도 거절된다', () => {
    const result = simulate(requests(12, 'F', 22, 1));

    expect(filledOf(result, 2, 'SUMMER', 'F')).toBe(0);
    expect(filledOf(result, 3, 'SUMMER', 'F')).toBe(0);
    expect(result.rejected).toBe(2);
  });

  it('정원을 2명으로 줄이면 초과분이 즉시 거절된다', () => {
    const result = simulate(requests(10, 'M', 22, 1), 2);

    expect(filledOf(result, 1, 'SUMMER', 'M')).toBe(2);
    expect(result.assigned).toBe(2);
    expect(result.rejected).toBe(8);
  });
});

describe('Bridge Zone 이 정원을 확보한다', () => {
  it('기본 그룹이 차면 경계 연령은 반대 그룹으로 들어간다', () => {
    // 22세 여성 10명이 SUMMER 를 채운 뒤 25세(경계) 여성 10명이 들어온다.
    const result = simulate([...requests(10, 'F', 22, 1), ...requests(10, 'F', 25, 1)]);

    expect(filledOf(result, 1, 'SUMMER', 'F')).toBe(10);
    expect(filledOf(result, 1, 'NIGHT', 'F')).toBe(10);
    expect(result.assigned).toBe(20);
    expect(result.rejected).toBe(0);
  });

  it('경계 연령이 아니면 기본 그룹이 차는 순간 거절된다', () => {
    const result = simulate([...requests(10, 'F', 22, 1), ...requests(5, 'F', 20, 1)]);

    expect(filledOf(result, 1, 'NIGHT', 'F')).toBe(0);
    expect(result.rejected).toBe(5);
  });
});

describe('그룹 내 성비 보정', () => {
  it('경계 연령이 성비가 부족한 그룹으로 흘러간다', () => {
    // NIGHT 남성만 6명 있는 상태에서 경계 연령 여성이 들어오면 NIGHT 로 간다.
    const result = simulate([...requests(6, 'M', 30, 1), ...requests(4, 'F', 25, 1)]);

    expect(filledOf(result, 1, 'NIGHT', 'F')).toBeGreaterThan(0);
  });

  it('보정을 켜면 성비 불균형이 줄고 더 많은 사람이 들어간다', () => {
    // 경계 연령이 앞에 오고 고정 연령이 뒤에 오는, 성비가 기울기 쉬운 순서.
    const mixed = [
      ...requests(8, 'M', 24, 1), // 경계 (기본 SUMMER)
      ...requests(8, 'F', 26, 1), // 경계 (기본 NIGHT)
      ...requests(4, 'M', 20, 1), // 고정 SUMMER
      ...requests(4, 'F', 30, 1), // 고정 NIGHT
    ];

    const imbalanceOf = (result: SimulationResult): number =>
      (['SUMMER', 'NIGHT'] as GroupCode[]).reduce(
        (sum, groupCode) =>
          sum +
          Math.abs(filledOf(result, 1, groupCode, 'M') - filledOf(result, 1, groupCode, 'F')),
        0,
      );

    const corrected = simulate(mixed);
    // 기본 그룹 가산점을 아주 크게 주면 경계 연령이 절대 이동하지 않는다(보정 없음).
    const uncorrected = simulateWith(mixed, { balanceWeight: 1, defaultGroupBonus: 999 });

    expect(imbalanceOf(corrected)).toBeLessThan(imbalanceOf(uncorrected));
    // 한쪽 그룹이 한 성별로만 채워지지 않으므로 거절되는 사람도 줄어든다.
    expect(corrected.assigned).toBeGreaterThan(uncorrected.assigned);
  });
});

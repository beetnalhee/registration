import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BALANCE_POLICY,
  IneligibleAgeError,
  chooseGroup,
  decideAssignment,
  genderDeficit,
} from '../../server/domain/assignment';
import type {
  AgePolicy,
  AssignmentContext,
  Gender,
  GroupCode,
  GroupRule,
  GroupTallyState,
  RoundCapacityState,
} from '../../server/domain/types';

const GROUPS: GroupRule[] = [
  { code: 'SUMMER', minAge: 18, maxAge: 25, sortOrder: 1 },
  { code: 'NIGHT', minAge: 26, maxAge: 35, sortOrder: 2 },
];

const AGE_POLICY: AgePolicy = { minAge: 18, maxAge: 35, bridgeMinAge: 24, bridgeMaxAge: 27 };

const ROUNDS = [1, 2, 3];

/** 모든 회차/성별 정원을 지정한 값으로 채운 상태를 만든다. */
const capacities = (filled: Partial<Record<`${number}-${Gender}`, number>> = {}): RoundCapacityState[] =>
  ROUNDS.flatMap((roundNo) =>
    (['M', 'F'] as Gender[]).map((gender) => ({
      roundNo,
      gender,
      capacity: 20,
      filled: filled[`${roundNo}-${gender}`] ?? 0,
    })),
  );

const tallies = (
  counts: Partial<Record<`${number}-${GroupCode}-${Gender}`, number>> = {},
): GroupTallyState[] =>
  ROUNDS.flatMap((roundNo) =>
    (['SUMMER', 'NIGHT'] as GroupCode[]).flatMap((groupCode) =>
      (['M', 'F'] as Gender[]).map((gender) => ({
        roundNo,
        groupCode,
        gender,
        activeCount: counts[`${roundNo}-${groupCode}-${gender}`] ?? 0,
      })),
    ),
  );

const context = (overrides: Partial<AssignmentContext> = {}): AssignmentContext => ({
  groups: GROUPS,
  agePolicy: AGE_POLICY,
  balancePolicy: DEFAULT_BALANCE_POLICY,
  capacities: capacities(),
  tallies: tallies(),
  ...overrides,
});

describe('decideAssignment — 회차 우선순위', () => {
  it('1순위에 자리가 있으면 1순위로 배정한다', () => {
    const result = decideAssignment({ gender: 'F', age: 22, preferences: [2, 1, 3] }, context());

    expect(result).toMatchObject({
      outcome: 'assigned',
      roundNo: 2,
      groupCode: 'SUMMER',
      matchedPreferenceRank: 1,
    });
  });

  it('1순위가 마감이면 2순위로 내려간다', () => {
    const result = decideAssignment(
      { gender: 'M', age: 22, preferences: [1, 3, 2] },
      context({ capacities: capacities({ '1-M': 20 }) }),
    );

    expect(result).toMatchObject({ outcome: 'assigned', roundNo: 3, matchedPreferenceRank: 2 });
  });

  it('1·2순위가 마감이면 3순위로 내려간다', () => {
    const result = decideAssignment(
      { gender: 'M', age: 30, preferences: [1, 2, 3] },
      context({ capacities: capacities({ '1-M': 20, '2-M': 20 }) }),
    );

    expect(result).toMatchObject({ outcome: 'assigned', roundNo: 3, matchedPreferenceRank: 3 });
  });

  it('세 회차 모두 마감이면 대기자로 등록한다', () => {
    const result = decideAssignment(
      { gender: 'M', age: 30, preferences: [1, 2, 3] },
      context({ capacities: capacities({ '1-M': 20, '2-M': 20, '3-M': 20 }) }),
    );

    expect(result).toEqual({ outcome: 'waitlisted', reason: 'all_rounds_full' });
  });

  it('정원은 성별로 분리되어 있다 — 남성이 꽉 차도 여성은 배정된다', () => {
    const state = context({ capacities: capacities({ '1-M': 20, '2-M': 20, '3-M': 20 }) });

    expect(decideAssignment({ gender: 'M', age: 30, preferences: [1, 2, 3] }, state)).toMatchObject({
      outcome: 'waitlisted',
    });
    expect(decideAssignment({ gender: 'F', age: 30, preferences: [1, 2, 3] }, state)).toMatchObject({
      outcome: 'assigned',
      roundNo: 1,
    });
  });

  it('존재하지 않는 회차 번호는 건너뛴다', () => {
    const result = decideAssignment({ gender: 'F', age: 20, preferences: [9, 1, 2] }, context());
    expect(result).toMatchObject({ outcome: 'assigned', roundNo: 1, matchedPreferenceRank: 2 });
  });

  it('배정 가능한 나이가 아니면 예외를 던진다', () => {
    expect(() =>
      decideAssignment({ gender: 'F', age: 40, preferences: [1, 2, 3] }, context()),
    ).toThrow(IneligibleAgeError);
  });
});

describe('decideAssignment — 그룹 결정', () => {
  it('Bridge Zone 이 아니면 성비와 무관하게 기본 그룹을 유지한다', () => {
    // SUMMER 여성이 10명 부족한 상황이지만 30세는 이동 대상이 아니다.
    const result = decideAssignment(
      { gender: 'F', age: 30, preferences: [1, 2, 3] },
      context({ tallies: tallies({ '1-SUMMER-M': 10, '1-NIGHT-M': 0 }) }),
    );

    expect(result).toMatchObject({ groupCode: 'NIGHT', movedFromDefaultGroup: false });
  });

  it('Bridge Zone 이어도 성비가 평온하면 기본 그룹을 유지한다', () => {
    const result = decideAssignment(
      { gender: 'F', age: 25, preferences: [1, 2, 3] },
      context({ tallies: tallies({ '1-SUMMER-M': 5, '1-SUMMER-F': 5, '1-NIGHT-M': 5, '1-NIGHT-F': 5 }) }),
    );

    expect(result).toMatchObject({ groupCode: 'SUMMER', movedFromDefaultGroup: false });
  });

  it('Bridge Zone 이고 반대 그룹의 성비 결손이 크면 그룹을 옮긴다', () => {
    // NIGHT 는 남성 8 / 여성 0 → 여성이 8명 부족. SUMMER 는 균형.
    const result = decideAssignment(
      { gender: 'F', age: 25, preferences: [1, 2, 3] },
      context({
        tallies: tallies({
          '1-SUMMER-M': 5,
          '1-SUMMER-F': 5,
          '1-NIGHT-M': 8,
          '1-NIGHT-F': 0,
        }),
      }),
    );

    expect(result).toMatchObject({ groupCode: 'NIGHT', movedFromDefaultGroup: true });
  });

  it('26세(Bridge Zone) 도 반대 방향(SUMMER)으로 이동할 수 있다', () => {
    const result = decideAssignment(
      { gender: 'M', age: 26, preferences: [1, 2, 3] },
      context({
        tallies: tallies({
          '1-SUMMER-M': 0,
          '1-SUMMER-F': 9,
          '1-NIGHT-M': 5,
          '1-NIGHT-F': 5,
        }),
      }),
    );

    expect(result).toMatchObject({ groupCode: 'SUMMER', movedFromDefaultGroup: true });
  });

  it('기본 그룹 가산점 때문에 결손 차이가 2 이하면 이동하지 않는다', () => {
    // NIGHT 결손 2, SUMMER 결손 0 → 2*1 vs 0*1+2 → 동점이므로 기본 그룹 유지
    const result = decideAssignment(
      { gender: 'F', age: 24, preferences: [1, 2, 3] },
      context({ tallies: tallies({ '1-NIGHT-M': 2, '1-NIGHT-F': 0 }) }),
    );

    expect(result).toMatchObject({ groupCode: 'SUMMER', movedFromDefaultGroup: false });
  });

  it('결손 차이가 3이면 이동한다 (경계값)', () => {
    const result = decideAssignment(
      { gender: 'F', age: 24, preferences: [1, 2, 3] },
      context({ tallies: tallies({ '1-NIGHT-M': 3, '1-NIGHT-F': 0 }) }),
    );

    expect(result).toMatchObject({ groupCode: 'NIGHT', movedFromDefaultGroup: true });
  });

  it('그룹 판단은 실제로 배정된 회차의 성비만 본다', () => {
    // 1회차 남성 마감 → 2회차로 배정. 2회차 성비를 기준으로 판단해야 한다.
    const result = decideAssignment(
      { gender: 'M', age: 27, preferences: [1, 2, 3] },
      context({
        capacities: capacities({ '1-M': 20 }),
        // 1회차는 SUMMER 남성이 크게 부족하지만 무시되어야 한다.
        tallies: tallies({ '1-SUMMER-F': 15, '2-SUMMER-F': 0, '2-NIGHT-F': 0 }),
      }),
    );

    expect(result).toMatchObject({ roundNo: 2, groupCode: 'NIGHT', movedFromDefaultGroup: false });
  });
});

describe('genderDeficit', () => {
  it('반대 성별이 많으면 양수다', () => {
    const state = tallies({ '1-SUMMER-M': 7, '1-SUMMER-F': 2 });
    expect(genderDeficit(state, 1, 'SUMMER', 'F')).toBe(5);
    expect(genderDeficit(state, 1, 'SUMMER', 'M')).toBe(-5);
  });

  it('카운터가 없는 조합은 0으로 취급한다', () => {
    expect(genderDeficit([], 1, 'NIGHT', 'M')).toBe(0);
  });
});

describe('chooseGroup', () => {
  it('그룹이 하나뿐이면 그 그룹을 반환한다', () => {
    const single: GroupRule[] = [{ code: 'SUMMER', minAge: 18, maxAge: 35, sortOrder: 1 }];

    expect(
      chooseGroup({
        roundNo: 1,
        gender: 'F',
        defaultGroup: 'SUMMER',
        eligibleForBothGroups: true,
        context: { groups: single, tallies: tallies(), balancePolicy: DEFAULT_BALANCE_POLICY },
      }),
    ).toBe('SUMMER');
  });

  it('가중치를 바꾸면 이동 민감도가 달라진다', () => {
    const shared = {
      roundNo: 1 as const,
      gender: 'F' as const,
      defaultGroup: 'SUMMER' as const,
      eligibleForBothGroups: true,
      tallies: tallies({ '1-NIGHT-M': 2, '1-NIGHT-F': 0 }),
    };

    expect(
      chooseGroup({
        ...shared,
        context: { groups: GROUPS, tallies: shared.tallies, balancePolicy: DEFAULT_BALANCE_POLICY },
      }),
    ).toBe('SUMMER');

    expect(
      chooseGroup({
        ...shared,
        context: {
          groups: GROUPS,
          tallies: shared.tallies,
          balancePolicy: { balanceWeight: 2, defaultGroupBonus: 2 },
        },
      }),
    ).toBe('NIGHT');
  });
});

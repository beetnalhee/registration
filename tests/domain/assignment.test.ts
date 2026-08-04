import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BALANCE_POLICY,
  IneligibleAgeError,
  chooseGroup,
  decideAssignment,
  genderDeficit,
} from '../../server/domain/assignment.js';
import type {
  AgePolicy,
  AssignmentContext,
  Gender,
  GroupCode,
  GroupRule,
  GroupTallyState,
  RoundCapacityState,
} from '../../server/domain/types.js';

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

describe('decideAssignment — 선착순', () => {
  it('고른 회차에 자리가 있으면 그 회차로 배정한다', () => {
    const result = decideAssignment({ gender: 'F', age: 22, roundNo: 2 }, context());

    expect(result).toEqual({
      outcome: 'assigned',
      roundNo: 2,
      groupCode: 'SUMMER',
      movedFromDefaultGroup: false,
    });
  });

  it('고른 회차가 마감이면 다른 회차에 자리가 있어도 대기자가 된다', () => {
    // ★ 선착순의 핵심 규칙. 예전에는 2·3순위로 내려갔지만 이제는 내려가지 않는다.
    const result = decideAssignment(
      { gender: 'M', age: 22, roundNo: 1 },
      context({ capacities: capacities({ '1-M': 20 }) }),
    );

    expect(result).toEqual({ outcome: 'waitlisted', reason: 'round_full' });
  });

  it('다른 회차가 마감이어도 고른 회차가 비어 있으면 배정된다', () => {
    const result = decideAssignment(
      { gender: 'M', age: 30, roundNo: 3 },
      context({ capacities: capacities({ '1-M': 20, '2-M': 20 }) }),
    );

    expect(result).toMatchObject({ outcome: 'assigned', roundNo: 3 });
  });

  it('정원은 성별로 분리되어 있다 — 남성이 꽉 차도 여성은 배정된다', () => {
    const state = context({ capacities: capacities({ '1-M': 20 }) });

    expect(decideAssignment({ gender: 'M', age: 30, roundNo: 1 }, state)).toMatchObject({
      outcome: 'waitlisted',
    });
    expect(decideAssignment({ gender: 'F', age: 30, roundNo: 1 }, state)).toMatchObject({
      outcome: 'assigned',
      roundNo: 1,
    });
  });

  it('존재하지 않는 회차를 받으면 배정하지 않는다', () => {
    // 서비스가 미리 검증하지만 도메인도 방어적으로 동작해야 한다.
    const result = decideAssignment({ gender: 'F', age: 20, roundNo: 9 }, context());
    expect(result).toEqual({ outcome: 'waitlisted', reason: 'round_full' });
  });

  it('배정 가능한 나이가 아니면 예외를 던진다', () => {
    expect(() => decideAssignment({ gender: 'F', age: 40, roundNo: 1 }, context())).toThrow(
      IneligibleAgeError,
    );
  });
});

describe('decideAssignment — 그룹 결정', () => {
  it('Bridge Zone 이 아니면 성비와 무관하게 기본 그룹을 유지한다', () => {
    // SUMMER 여성이 10명 부족한 상황이지만 30세는 이동 대상이 아니다.
    const result = decideAssignment(
      { gender: 'F', age: 30, roundNo: 1 },
      context({ tallies: tallies({ '1-SUMMER-M': 10, '1-NIGHT-M': 0 }) }),
    );

    expect(result).toMatchObject({ groupCode: 'NIGHT', movedFromDefaultGroup: false });
  });

  it('Bridge Zone 이어도 성비가 평온하면 기본 그룹을 유지한다', () => {
    const result = decideAssignment(
      { gender: 'F', age: 25, roundNo: 1 },
      context({
        tallies: tallies({ '1-SUMMER-M': 5, '1-SUMMER-F': 5, '1-NIGHT-M': 5, '1-NIGHT-F': 5 }),
      }),
    );

    expect(result).toMatchObject({ groupCode: 'SUMMER', movedFromDefaultGroup: false });
  });

  it('Bridge Zone 이고 반대 그룹의 성비 결손이 크면 그룹을 옮긴다', () => {
    // NIGHT 는 남성 8 / 여성 0 → 여성이 8명 부족. SUMMER 는 균형.
    const result = decideAssignment(
      { gender: 'F', age: 25, roundNo: 1 },
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
      { gender: 'M', age: 26, roundNo: 1 },
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
      { gender: 'F', age: 24, roundNo: 1 },
      context({ tallies: tallies({ '1-NIGHT-M': 2, '1-NIGHT-F': 0 }) }),
    );

    expect(result).toMatchObject({ groupCode: 'SUMMER', movedFromDefaultGroup: false });
  });

  it('결손 차이가 3이면 이동한다 (경계값)', () => {
    const result = decideAssignment(
      { gender: 'F', age: 24, roundNo: 1 },
      context({ tallies: tallies({ '1-NIGHT-M': 3, '1-NIGHT-F': 0 }) }),
    );

    expect(result).toMatchObject({ groupCode: 'NIGHT', movedFromDefaultGroup: true });
  });

  it('그룹 판단은 고른 회차의 성비만 본다', () => {
    // 1회차는 SUMMER 남성이 크게 부족하지만 2회차를 골랐으므로 무시되어야 한다.
    const result = decideAssignment(
      { gender: 'M', age: 27, roundNo: 2 },
      context({
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

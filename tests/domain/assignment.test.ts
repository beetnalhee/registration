import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BALANCE_POLICY,
  IneligibleAgeError,
  chooseGroup,
  decideAssignment,
  genderDeficit,
  resolveCandidateGroups,
} from '../../server/domain/assignment.js';
import type {
  AgePolicy,
  AssignmentContext,
  Gender,
  GroupCode,
  GroupRule,
  SlotState,
} from '../../server/domain/types.js';

const GROUPS: GroupRule[] = [
  { code: 'SUMMER', minAge: 18, maxAge: 25, sortOrder: 1 },
  { code: 'NIGHT', minAge: 26, maxAge: 35, sortOrder: 2 },
];

const AGE_POLICY: AgePolicy = { minAge: 18, maxAge: 35, bridgeMinAge: 24, bridgeMaxAge: 27 };

const ROUNDS = [1, 2, 3];
const CAPACITY = 10;

type SlotKey = `${number}-${GroupCode}-${Gender}`;

/** (회차, 그룹, 성별) 정원 10명. 지정한 조합만 채워진 상태를 만든다. */
const slots = (filled: Partial<Record<SlotKey, number>> = {}): SlotState[] =>
  ROUNDS.flatMap((roundNo) =>
    (['SUMMER', 'NIGHT'] as GroupCode[]).flatMap((groupCode) =>
      (['M', 'F'] as Gender[]).map((gender) => ({
        roundNo,
        groupCode,
        gender,
        capacity: CAPACITY,
        filled: filled[`${roundNo}-${groupCode}-${gender}`] ?? 0,
      })),
    ),
  );

const context = (overrides: Partial<AssignmentContext> = {}): AssignmentContext => ({
  groups: GROUPS,
  agePolicy: AGE_POLICY,
  balancePolicy: DEFAULT_BALANCE_POLICY,
  slots: slots(),
  ...overrides,
});

describe('resolveCandidateGroups', () => {
  it('일반 참가자는 기본 그룹 하나뿐이다', () => {
    expect(resolveCandidateGroups(20, GROUPS, AGE_POLICY)).toEqual(['SUMMER']);
    expect(resolveCandidateGroups(30, GROUPS, AGE_POLICY)).toEqual(['NIGHT']);
  });

  it('Bridge Zone 은 기본 그룹을 앞에 두고 두 그룹 모두 후보다', () => {
    expect(resolveCandidateGroups(25, GROUPS, AGE_POLICY)).toEqual(['SUMMER', 'NIGHT']);
    expect(resolveCandidateGroups(26, GROUPS, AGE_POLICY)).toEqual(['NIGHT', 'SUMMER']);
  });

  it('참가 가능 연령이 아니면 후보가 없다', () => {
    expect(resolveCandidateGroups(17, GROUPS, AGE_POLICY)).toEqual([]);
    expect(resolveCandidateGroups(40, GROUPS, AGE_POLICY)).toEqual([]);
  });
});

describe('decideAssignment — 선착순, 대기자 없음', () => {
  it('자리가 있으면 고른 회차·기본 그룹으로 배정한다', () => {
    const result = decideAssignment({ gender: 'F', age: 22, roundNo: 2 }, context());

    expect(result).toEqual({
      outcome: 'assigned',
      roundNo: 2,
      groupCode: 'SUMMER',
      movedFromDefaultGroup: false,
    });
  });

  it('내 그룹·성별 자리가 차면 거절한다 (대기자로 만들지 않는다)', () => {
    const result = decideAssignment(
      { gender: 'F', age: 22, roundNo: 1 },
      context({ slots: slots({ '1-SUMMER-F': CAPACITY }) }),
    );

    expect(result).toEqual({ outcome: 'rejected', reason: 'round_full' });
  });

  it('다른 그룹이 차 있어도 내 그룹에 자리가 있으면 배정된다', () => {
    // 정원이 그룹 단위이므로 NIGHT 가 꽉 차도 SUMMER 는 영향받지 않는다.
    const result = decideAssignment(
      { gender: 'F', age: 22, roundNo: 1 },
      context({ slots: slots({ '1-NIGHT-F': CAPACITY }) }),
    );

    expect(result).toMatchObject({ outcome: 'assigned', groupCode: 'SUMMER' });
  });

  it('같은 그룹의 반대 성별이 차 있어도 영향받지 않는다', () => {
    const result = decideAssignment(
      { gender: 'F', age: 22, roundNo: 1 },
      context({ slots: slots({ '1-SUMMER-M': CAPACITY }) }),
    );

    expect(result).toMatchObject({ outcome: 'assigned', groupCode: 'SUMMER' });
  });

  it('다른 회차가 비어 있어도 고른 회차가 차면 거절한다', () => {
    const result = decideAssignment(
      { gender: 'M', age: 30, roundNo: 1 },
      context({ slots: slots({ '1-NIGHT-M': CAPACITY }) }),
    );

    expect(result).toEqual({ outcome: 'rejected', reason: 'round_full' });
  });

  it('존재하지 않는 회차를 받으면 배정하지 않는다', () => {
    // 서비스가 미리 검증하지만 도메인도 방어적으로 동작해야 한다.
    expect(decideAssignment({ gender: 'F', age: 20, roundNo: 9 }, context())).toEqual({
      outcome: 'rejected',
      reason: 'round_full',
    });
  });

  it('배정 가능한 나이가 아니면 예외를 던진다', () => {
    expect(() => decideAssignment({ gender: 'F', age: 40, roundNo: 1 }, context())).toThrow(
      IneligibleAgeError,
    );
  });
});

describe('decideAssignment — Bridge Zone 이 정원을 확보한다', () => {
  it('기본 그룹이 마감이면 반대 그룹으로 배정된다', () => {
    // ★ 정원이 그룹 단위가 되면서 Bridge Zone 은 성비 보정이 아니라
    //   실제로 참가 가능 여부를 가르는 요소가 된다.
    const result = decideAssignment(
      { gender: 'F', age: 25, roundNo: 1 },
      context({ slots: slots({ '1-SUMMER-F': CAPACITY }) }),
    );

    expect(result).toMatchObject({
      outcome: 'assigned',
      groupCode: 'NIGHT',
      movedFromDefaultGroup: true,
    });
  });

  it('두 그룹 모두 마감이면 거절한다', () => {
    const result = decideAssignment(
      { gender: 'F', age: 25, roundNo: 1 },
      context({ slots: slots({ '1-SUMMER-F': CAPACITY, '1-NIGHT-F': CAPACITY }) }),
    );

    expect(result).toEqual({ outcome: 'rejected', reason: 'round_full' });
  });

  it('Bridge Zone 이 아니면 기본 그룹이 마감이어도 옮기지 않는다', () => {
    const result = decideAssignment(
      { gender: 'F', age: 22, roundNo: 1 },
      context({ slots: slots({ '1-SUMMER-F': CAPACITY }) }),
    );

    expect(result).toEqual({ outcome: 'rejected', reason: 'round_full' });
  });
});

describe('decideAssignment — 그룹 내 성비 보정', () => {
  it('Bridge Zone 이어도 성비가 평온하면 기본 그룹을 유지한다', () => {
    const result = decideAssignment(
      { gender: 'F', age: 25, roundNo: 1 },
      context({
        slots: slots({ '1-SUMMER-M': 5, '1-SUMMER-F': 5, '1-NIGHT-M': 5, '1-NIGHT-F': 5 }),
      }),
    );

    expect(result).toMatchObject({ groupCode: 'SUMMER', movedFromDefaultGroup: false });
  });

  it('반대 그룹의 성비 결손이 3 이상 크면 그룹을 옮긴다', () => {
    const result = decideAssignment(
      { gender: 'F', age: 25, roundNo: 1 },
      context({ slots: slots({ '1-NIGHT-M': 3, '1-NIGHT-F': 0 }) }),
    );

    expect(result).toMatchObject({ groupCode: 'NIGHT', movedFromDefaultGroup: true });
  });

  it('결손 차이가 2 이하면 기본 그룹 가산점 때문에 이동하지 않는다', () => {
    const result = decideAssignment(
      { gender: 'F', age: 24, roundNo: 1 },
      context({ slots: slots({ '1-NIGHT-M': 2, '1-NIGHT-F': 0 }) }),
    );

    expect(result).toMatchObject({ groupCode: 'SUMMER', movedFromDefaultGroup: false });
  });

  it('성비가 좋아지는 쪽이라도 자리가 없으면 가지 않는다', () => {
    // NIGHT 결손이 크지만 여성 정원이 다 찼으므로 SUMMER 로 배정되어야 한다.
    const result = decideAssignment(
      { gender: 'F', age: 25, roundNo: 1 },
      context({ slots: slots({ '1-NIGHT-M': 9, '1-NIGHT-F': CAPACITY }) }),
    );

    expect(result).toMatchObject({ groupCode: 'SUMMER', movedFromDefaultGroup: false });
  });

  it('그룹 판단은 고른 회차의 성비만 본다', () => {
    const result = decideAssignment(
      { gender: 'M', age: 27, roundNo: 2 },
      context({ slots: slots({ '1-SUMMER-F': 9 }) }),
    );

    expect(result).toMatchObject({ roundNo: 2, groupCode: 'NIGHT', movedFromDefaultGroup: false });
  });
});

describe('genderDeficit', () => {
  it('반대 성별이 많으면 양수다', () => {
    const state = slots({ '1-SUMMER-M': 7, '1-SUMMER-F': 2 });
    expect(genderDeficit(state, 1, 'SUMMER', 'F')).toBe(5);
    expect(genderDeficit(state, 1, 'SUMMER', 'M')).toBe(-5);
  });

  it('슬롯이 없는 조합은 0으로 취급한다', () => {
    expect(genderDeficit([], 1, 'NIGHT', 'M')).toBe(0);
  });
});

describe('chooseGroup', () => {
  it('자리가 없으면 null 을 반환한다', () => {
    expect(
      chooseGroup({
        roundNo: 1,
        gender: 'F',
        defaultGroup: 'SUMMER',
        candidates: ['SUMMER'],
        slots: slots({ '1-SUMMER-F': CAPACITY }),
        balancePolicy: DEFAULT_BALANCE_POLICY,
      }),
    ).toBeNull();
  });

  it('가중치를 바꾸면 이동 민감도가 달라진다', () => {
    const shared = {
      roundNo: 1 as const,
      gender: 'F' as const,
      defaultGroup: 'SUMMER' as const,
      candidates: ['SUMMER', 'NIGHT'] as GroupCode[],
      slots: slots({ '1-NIGHT-M': 2, '1-NIGHT-F': 0 }),
    };

    expect(chooseGroup({ ...shared, balancePolicy: DEFAULT_BALANCE_POLICY })).toBe('SUMMER');
    expect(
      chooseGroup({ ...shared, balancePolicy: { balanceWeight: 2, defaultGroupBonus: 2 } }),
    ).toBe('NIGHT');
  });
});

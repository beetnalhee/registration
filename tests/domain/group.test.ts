import { describe, expect, it } from 'vitest';
import { isBridgeZone, resolveDefaultGroup } from '../../server/domain/group';
import type { AgePolicy, GroupRule } from '../../server/domain/types';

const GROUPS: GroupRule[] = [
  { code: 'SUMMER', minAge: 18, maxAge: 25, sortOrder: 1 },
  { code: 'NIGHT', minAge: 26, maxAge: 35, sortOrder: 2 },
];

const POLICY: AgePolicy = { minAge: 18, maxAge: 35, bridgeMinAge: 24, bridgeMaxAge: 27 };

describe('resolveDefaultGroup', () => {
  it('18~25세는 SUMMER 로 분류된다', () => {
    expect(resolveDefaultGroup(18, GROUPS)).toBe('SUMMER');
    expect(resolveDefaultGroup(22, GROUPS)).toBe('SUMMER');
    expect(resolveDefaultGroup(25, GROUPS)).toBe('SUMMER');
  });

  it('26~35세는 NIGHT 로 분류된다', () => {
    expect(resolveDefaultGroup(26, GROUPS)).toBe('NIGHT');
    expect(resolveDefaultGroup(35, GROUPS)).toBe('NIGHT');
  });

  it('어떤 그룹에도 속하지 않으면 null 을 반환한다', () => {
    expect(resolveDefaultGroup(17, GROUPS)).toBeNull();
    expect(resolveDefaultGroup(36, GROUPS)).toBeNull();
  });
});

describe('isBridgeZone', () => {
  it('24·25·26·27세만 Bridge Zone 이다', () => {
    expect(isBridgeZone(24, POLICY)).toBe(true);
    expect(isBridgeZone(25, POLICY)).toBe(true);
    expect(isBridgeZone(26, POLICY)).toBe(true);
    expect(isBridgeZone(27, POLICY)).toBe(true);
  });

  it('경계 바로 밖은 Bridge Zone 이 아니다', () => {
    expect(isBridgeZone(23, POLICY)).toBe(false);
    expect(isBridgeZone(28, POLICY)).toBe(false);
  });
});

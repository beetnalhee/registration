import { describe, expect, it } from 'vitest';
import {
  applicationSchema,
  lookupSchema,
  normalizePhone,
  adminReassignSchema,
} from '../../shared/schemas';

const validApplication = {
  name: '김희주',
  nickname: '희주',
  birthdate: '2000-05-14',
  gender: 'F',
  phone: '010-1234-8241',
  email: 'Heeju@Example.com',
  preferences: [2, 1, 3],
};

describe('normalizePhone', () => {
  it('숫자만 남긴다', () => {
    expect(normalizePhone('010-1234-5678')).toBe('01012345678');
    expect(normalizePhone('010 1234 5678')).toBe('01012345678');
    expect(normalizePhone('(010)1234-5678')).toBe('01012345678');
  });
});

describe('applicationSchema', () => {
  it('정상 입력을 통과시키고 값을 정규화한다', () => {
    const result = applicationSchema.safeParse(validApplication);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.phone).toBe('01012348241');
      expect(result.data.email).toBe('heeju@example.com');
    }
  });

  it('이름 앞뒤 공백을 제거한다', () => {
    const result = applicationSchema.safeParse({ ...validApplication, name: '  김희주  ' });
    expect(result.success && result.data.name).toBe('김희주');
  });

  it('빈 이름을 거절한다', () => {
    expect(applicationSchema.safeParse({ ...validApplication, name: '   ' }).success).toBe(false);
  });

  it('존재하지 않는 날짜를 거절한다', () => {
    expect(applicationSchema.safeParse({ ...validApplication, birthdate: '2001-02-30' }).success).toBe(
      false,
    );
    expect(applicationSchema.safeParse({ ...validApplication, birthdate: '2001-13-01' }).success).toBe(
      false,
    );
  });

  it('날짜 형식이 아니면 거절한다', () => {
    expect(applicationSchema.safeParse({ ...validApplication, birthdate: '2001/02/03' }).success).toBe(
      false,
    );
  });

  it('휴대폰 번호가 아니면 거절한다', () => {
    expect(applicationSchema.safeParse({ ...validApplication, phone: '02-123-4567' }).success).toBe(
      false,
    );
    expect(applicationSchema.safeParse({ ...validApplication, phone: '010-1234' }).success).toBe(false);
  });

  it('이메일 형식을 검사한다', () => {
    expect(applicationSchema.safeParse({ ...validApplication, email: 'not-an-email' }).success).toBe(
      false,
    );
  });

  it('성별은 M 또는 F 만 허용한다', () => {
    expect(applicationSchema.safeParse({ ...validApplication, gender: 'X' }).success).toBe(false);
  });

  it('희망 회차가 3개가 아니면 거절한다', () => {
    expect(applicationSchema.safeParse({ ...validApplication, preferences: [1, 2] }).success).toBe(
      false,
    );
  });

  it('희망 회차가 중복되면 거절한다', () => {
    expect(applicationSchema.safeParse({ ...validApplication, preferences: [1, 1, 2] }).success).toBe(
      false,
    );
  });
});

describe('lookupSchema', () => {
  it('생년월일과 전화 뒤 4자리를 받는다', () => {
    const result = lookupSchema.safeParse({ birthdate: '2000-05-14', phoneLast4: '8241' });
    expect(result.success).toBe(true);
  });

  it('4자리가 아니면 거절한다', () => {
    expect(lookupSchema.safeParse({ birthdate: '2000-05-14', phoneLast4: '824' }).success).toBe(false);
    expect(lookupSchema.safeParse({ birthdate: '2000-05-14', phoneLast4: '82415' }).success).toBe(
      false,
    );
  });

  it('숫자가 아닌 문자는 제거한 뒤 검사한다', () => {
    const result = lookupSchema.safeParse({ birthdate: '2000-05-14', phoneLast4: '-8241 ' });
    expect(result.success && result.data.phoneLast4).toBe('8241');
  });
});

describe('adminReassignSchema', () => {
  it('회차나 그룹 중 하나는 있어야 한다', () => {
    expect(adminReassignSchema.safeParse({}).success).toBe(false);
    expect(adminReassignSchema.safeParse({ roundNo: 2 }).success).toBe(true);
    expect(adminReassignSchema.safeParse({ groupCode: 'NIGHT' }).success).toBe(true);
  });

  it('허용되지 않은 그룹 코드는 거절한다', () => {
    expect(adminReassignSchema.safeParse({ groupCode: 'YB' }).success).toBe(false);
  });
});

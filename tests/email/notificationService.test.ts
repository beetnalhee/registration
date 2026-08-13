import { beforeAll, describe, expect, it } from 'vitest';
import type { Mailer, MailMessage } from '../../server/email/mailer.js';
import { ConsoleMailer } from '../../server/email/mailer.js';
import type { ParticipantRecord } from '../../server/repositories/participantRepository.js';
import type { Queryable } from '../../server/db/pool.js';

/**
 * 이메일 발송 기록의 정직성을 검증한다.
 *
 * 실제로 배달하지 않았는데 '성공'으로 기록되면 관리자 화면이 거짓을 말하고,
 * 운영진은 메일이 안 나간 사실을 행사 당일까지 모른다. 실제로 겪은 버그다.
 */

let notifyParticipant: typeof import('../../server/email/notificationService.js').notifyParticipant;

/** query 호출을 기록하는 가짜 클라이언트. DB 없이 검증한다. */
const createFakeClient = () => {
  const calls: { text: string; values: unknown[] }[] = [];

  const client = {
    query: async (text: string, values?: unknown[]) => {
      calls.push({ text, values: values ?? [] });
      return { rows: [], rowCount: 0 } as never;
    },
  } as unknown as Queryable;

  return { client, calls };
};

const participant: ParticipantRecord = {
  id: '11111111-1111-4111-8111-111111111111',
  name: '김희주',
  nickname: '희주',
  birthdate: '2001-05-14',
  gender: 'F',
  phone: '01012348241',
  phoneLast4: '8241',
  email: 'heeju@example.com',
  ageAtEvent: 25,
  defaultGroupCode: 'SUMMER',
  isBridgeZone: true,
  preferredRoundNo: 2,
  status: 'assigned',
  assignedRoundId: '22222222-2222-4222-8222-222222222222',
  assignedRoundNo: 2,
  assignedGroupCode: 'SUMMER',
  sequenceNo: 13,
  participantCode: 'SUMMER-2-F-013',
  waitlistedAt: null,
  cancelledAt: null,
  checkedInAt: null,
  createdAt: '2026-08-01T00:00:00.000Z',
};

const baseParams = {
  participant,
  kind: 'assignment' as const,
  eventName: '사랑은 돌아오는 거야',
  timeLabel: '22:05 ~ 22:25',
};

/** 발송된 메시지를 담아두는 가짜 배달 구현 */
class RecordingMailer implements Mailer {
  readonly delivers = true;
  readonly sent: MailMessage[] = [];

  async send(message: MailMessage): Promise<void> {
    this.sent.push(message);
  }
}

class FailingMailer implements Mailer {
  readonly delivers = true;

  async send(): Promise<void> {
    throw new Error('SMTP 연결 실패');
  }
}

const insertedStatus = (calls: { text: string; values: unknown[] }[]): unknown[] | null => {
  const insert = calls.find((call) => call.text.includes('insert into email_logs'));
  return insert ? insert.values : null;
};

beforeAll(async () => {
  process.env.DATABASE_URL = 'postgresql://user:pw@localhost:5432/postgres';
  process.env.SUPABASE_URL = 'http://localhost:54321';
  process.env.SUPABASE_ANON_KEY = 'test-anon-key';

  ({ notifyParticipant } = await import('../../server/email/notificationService.js'));
});

describe('notifyParticipant', () => {
  it('실제로 배달하면 성공으로 기록한다', async () => {
    const { client, calls } = createFakeClient();
    const mailer = new RecordingMailer();

    const result = await notifyParticipant(client, mailer, baseParams);

    expect(result).toBe(true);
    expect(mailer.sent).toHaveLength(1);
    expect(insertedStatus(calls)).toContain('sent');
  });

  it('배달하지 않는 구현이면 성공으로 기록하지 않는다', async () => {
    const { client, calls } = createFakeClient();

    const result = await notifyParticipant(client, new ConsoleMailer(), baseParams);

    expect(result).toBe(false);

    const values = insertedStatus(calls);
    expect(values).not.toBeNull();
    expect(values).not.toContain('sent');
    expect(values).toContain('failed');
    // 왜 안 나갔는지 관리자가 알 수 있어야 한다
    expect(values?.some((value) => typeof value === 'string' && value.includes('GMAIL'))).toBe(true);
  });

  it('발송이 실패해도 예외를 던지지 않고 실패로 기록한다', async () => {
    const { client, calls } = createFakeClient();

    const result = await notifyParticipant(client, new FailingMailer(), baseParams);

    expect(result).toBe(false);
    const values = insertedStatus(calls);
    expect(values).toContain('failed');
    expect(values?.some((value) => typeof value === 'string' && value.includes('SMTP'))).toBe(true);
  });

  it('배정 정보가 없으면 발송을 건너뛰고 기록도 남기지 않는다', async () => {
    const { client, calls } = createFakeClient();
    const mailer = new RecordingMailer();

    const result = await notifyParticipant(client, mailer, {
      ...baseParams,
      participant: { ...participant, participantCode: null },
    });

    expect(result).toBe(false);
    expect(mailer.sent).toHaveLength(0);
    expect(insertedStatus(calls)).toBeNull();
  });

  it('메일 본문에 배정 정보가 담긴다', async () => {
    const { client } = createFakeClient();
    const mailer = new RecordingMailer();

    await notifyParticipant(client, mailer, baseParams);

    const message = mailer.sent[0];
    expect(message?.to).toBe('heeju@example.com');
    expect(message?.subject).toContain('SUMMER-2-F-013');
    expect(message?.html).toContain('22:05 ~ 22:25');
    // 내부 운영 정보는 참가자 메일에 절대 들어가지 않는다.
    // ('25' 같은 숫자로 검사하면 시간(22:25)·색상(rgba(255..))에 걸려 의미가 없다)
    expect(message?.html.toLowerCase()).not.toContain('bridge');
    expect(message?.html).not.toContain(`만 ${participant.ageAtEvent}`);
    expect(message?.html).not.toContain('성비');
    expect(message?.html).not.toContain('기본 그룹');
  });
});

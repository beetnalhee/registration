export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * 메일 발송 추상화.
 *
 * 서비스 레이어는 이 인터페이스에만 의존하므로
 * Gmail SMTP 를 다른 공급자로 바꾸거나 테스트에서 가짜 구현을 끼워도
 * 서비스 코드는 그대로다.
 */
export interface Mailer {
  /**
   * 이 구현이 실제로 메일을 배달하는지.
   *
   * false 인 구현은 send() 가 성공해도 수신자에게 아무것도 가지 않는다.
   * 발송 기록을 '성공'으로 남기지 않기 위해 호출자가 반드시 확인해야 한다.
   */
  readonly delivers: boolean;

  send(message: MailMessage): Promise<void>;
}

/** 이메일 설정이 없는 환경(로컬 개발·테스트)에서 콘솔에만 남긴다. */
export class ConsoleMailer implements Mailer {
  readonly delivers = false;

  async send(message: MailMessage): Promise<void> {
    console.info(
      `[mail:console] 이메일 설정이 없어 발송을 건너뜁니다.\n  to: ${message.to}\n  subject: ${message.subject}`,
    );
  }
}

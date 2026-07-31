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
  send(message: MailMessage): Promise<void>;
}

/** 이메일 설정이 없는 환경(로컬 개발·테스트)에서 콘솔에만 남긴다. */
export class ConsoleMailer implements Mailer {
  async send(message: MailMessage): Promise<void> {
    console.info(
      `[mail:console] 이메일 설정이 없어 발송을 건너뜁니다.\n  to: ${message.to}\n  subject: ${message.subject}`,
    );
  }
}

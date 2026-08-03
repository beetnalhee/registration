import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { isEmailConfigured, loadEnv, type Env } from '../config/env.js';
import { ConsoleMailer, type Mailer, type MailMessage } from './mailer.js';

/** Gmail SMTP 발송. 앱 비밀번호(16자리)가 필요하다. */
export class NodemailerMailer implements Mailer {
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(config: { user: string; appPassword: string; fromName: string }) {
    this.transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: config.user, pass: config.appPassword },
      // 서버리스 함수는 짧게 살기 때문에 커넥션 풀을 쓰지 않는다(nodemailer 기본값).
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });
    this.from = `"${config.fromName}" <${config.user}>`;
  }

  async send(message: MailMessage): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  }
}

let cached: Mailer | null = null;

/** 환경 변수에 Gmail 설정이 있으면 실제 발송, 없으면 콘솔 출력. */
export const getMailer = (env: Env = loadEnv()): Mailer => {
  if (cached) {
    return cached;
  }

  if (isEmailConfigured(env) && env.GMAIL_USER && env.GMAIL_APP_PASSWORD) {
    cached = new NodemailerMailer({
      user: env.GMAIL_USER,
      appPassword: env.GMAIL_APP_PASSWORD,
      fromName: env.MAIL_FROM_NAME,
    });
  } else {
    cached = new ConsoleMailer();
  }

  return cached;
};

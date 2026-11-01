import 'server-only';
import nodemailer, { type Transporter } from 'nodemailer';
import { db } from '../db';
import { getSettings } from '../settings';
import { getConnections, type MailConfig } from '../connections';

export type OutgoingEmail = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  template: string;
  replyTo?: string;
  orderId?: string | null;
  customerId?: string | null;
};

const g = globalThis as unknown as { __mailer?: { key: string; t: Transporter } };

function transporter(c: MailConfig): Transporter {
  // Rebuilt when the details change in Admin › Settings › Connections.
  const key = JSON.stringify([c.host, c.port, c.secure, c.user, c.pass]);
  if (g.__mailer?.key !== key) {
    g.__mailer = {
      key,
      t: nodemailer.createTransport({ host: c.host, port: c.port, secure: c.secure, auth: c.user ? { user: c.user, pass: c.pass } : undefined }),
    };
  }
  return g.__mailer.t;
}

/** True when SMTP details are set, in .env or in Admin › Settings › Connections. */
export const emailReady = async () => !!(await getConnections()).mail;

/** Connect and sign in to the SMTP server without sending anything. Returns the server's complaint, if any. */
export async function checkMailConfig(c: MailConfig): Promise<string | null> {
  try {
    await nodemailer.createTransport({ host: c.host, port: c.port, secure: c.secure, auth: c.user ? { user: c.user, pass: c.pass } : undefined, connectionTimeout: 15_000, greetingTimeout: 15_000 }).verify();
    return null;
  } catch (e) {
    return e instanceof Error ? e.message.slice(0, 300) : String(e);
  }
}

export function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href, label) => `${label.replace(/<[^>]+>/g, '')} (${href})`)
    .replace(/<\/(p|div|tr|h[1-6]|li|table)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim();
}

/**
 * Send an email and record it in the email log. Never throws: a mail problem must not break checkout.
 * Without SMTP settings the message is only logged, so the site can be tested before email is set up.
 * `via` sends through details that are not saved yet (the test email in Settings › Connections).
 */
export async function sendEmail(msg: OutgoingEmail, via?: MailConfig): Promise<{ ok: boolean; status: 'sent' | 'logged' | 'failed' }> {
  const [settings, saved] = await Promise.all([getSettings(), getConnections()]);
  const mail = via ?? saved.mail;
  const from = mail?.from || `${settings.storeName} <${settings.supportEmail}>`;
  const text = msg.text ?? htmlToText(msg.html);
  let status: 'sent' | 'logged' | 'failed' = 'logged';
  let error: string | null = null;

  if (mail) {
    try {
      await transporter(mail).sendMail({ from, to: msg.to, subject: msg.subject, html: msg.html, text, replyTo: msg.replyTo || settings.supportEmail });
      status = 'sent';
    } catch (e) {
      status = 'failed';
      error = e instanceof Error ? e.message.slice(0, 500) : String(e);
      console.error('[email] send failed:', msg.template, msg.to, error);
    }
  } else if (process.env.NODE_ENV !== 'production') {
    console.info(`[email] (not sent, SMTP not configured) ${msg.template} → ${msg.to}: ${msg.subject}`);
  }

  try {
    await db.emailLog.create({
      data: {
        to: msg.to,
        subject: msg.subject.slice(0, 300),
        template: msg.template,
        status,
        error,
        html: msg.html.length > 200_000 ? msg.html.slice(0, 200_000) : msg.html,
        orderId: msg.orderId ?? null,
        customerId: msg.customerId ?? null,
      },
    });
  } catch (e) {
    console.error('[email] could not write log', e);
  }
  return { ok: status !== 'failed', status };
}

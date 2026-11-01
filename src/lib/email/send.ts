import 'server-only';
import nodemailer, { type Transporter } from 'nodemailer';
import { db } from '../db';
import { getSettings } from '../settings';

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

const g = globalThis as unknown as { __mailer?: Transporter };

function transporter(): Transporter {
  if (!g.__mailer) {
    const port = Number(process.env.SMTP_PORT || 587);
    g.__mailer = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: process.env.SMTP_SECURE === 'true' || port === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
  }
  return g.__mailer;
}

export const emailConfigured = () => !!process.env.SMTP_HOST;

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
 */
export async function sendEmail(msg: OutgoingEmail): Promise<{ ok: boolean; status: 'sent' | 'logged' | 'failed' }> {
  const settings = await getSettings();
  const from = process.env.MAIL_FROM || `${settings.storeName} <${settings.supportEmail}>`;
  const text = msg.text ?? htmlToText(msg.html);
  let status: 'sent' | 'logged' | 'failed' = 'logged';
  let error: string | null = null;

  if (emailConfigured()) {
    try {
      await transporter().sendMail({ from, to: msg.to, subject: msg.subject, html: msg.html, text, replyTo: msg.replyTo || settings.supportEmail });
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

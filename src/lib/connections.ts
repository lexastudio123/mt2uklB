import 'server-only';
import { cache } from 'react';
import { db } from './db';
import { encryptionOn, seal, unseal } from './crypto';

// Credentials for the services the shop talks to: email (SMTP), Stripe, the AI chat key and
// UK address lookup. Owners type them into Admin › Settings › Connections, where secrets are
// saved encrypted with ENCRYPTION_KEY. A value in the server's .env file always wins, so a
// host who prefers environment variables can keep them out of the database.

const KEY = 'connections';

export type Source = 'env' | 'admin' | null;

type Stored = {
  smtp?: { host?: string; port?: number; user?: string; pass?: string | null; from?: string };
  stripeSecretKey?: string | null;
  stripeWebhookSecret?: string | null;
  anthropicKey?: string | null;
  postcodesKey?: string | null;
};

export type MailConfig = { host: string; port: number; secure: boolean; user: string; pass: string; from: string };

export type Connections = {
  mail: MailConfig | null;
  mailSource: Source;
  /** Email details saved on the Connections page, without the password, to fill in the form. */
  mailForm: { host: string; port: number; user: string; from: string; hasPassword: boolean } | null;
  stripeKey: string | null;
  stripeKeySource: Source;
  stripeWebhookSecret: string | null;
  stripeWebhookSource: Source;
  anthropicKey: string | null;
  anthropicSource: Source;
  postcodesKey: string | null;
  postcodesSource: Source;
  /** Saved secrets that no longer decrypt (ENCRYPTION_KEY missing or changed). They need typing in again. */
  unreadable: string[];
};

async function readStored(): Promise<Stored> {
  const row = await db.setting.findUnique({ where: { key: KEY } });
  if (!row) return {};
  try {
    return JSON.parse(row.value) as Stored;
  } catch {
    return {};
  }
}

const env = (name: string) => process.env[name]?.trim() || '';

/** What the shop uses for this request: the .env value when set, otherwise the one saved in admin. */
export const getConnections = cache(async (): Promise<Connections> => {
  const s = await readStored();
  const unreadable: string[] = [];
  const open = (label: string, v: string | null | undefined) => {
    const out = unseal(v);
    if (out === undefined) unreadable.push(label);
    return out || null;
  };
  const pick = (envName: string, label: string, saved: string | null | undefined): [string | null, Source] => {
    if (env(envName)) return [env(envName), 'env'];
    const v = open(label, saved);
    return v ? [v, 'admin'] : [null, null];
  };

  let mail: MailConfig | null = null;
  let mailSource: Source = null;
  let mailForm: Connections['mailForm'] = null;
  if (env('SMTP_HOST')) {
    const port = Number(env('SMTP_PORT') || 587);
    mail = { host: env('SMTP_HOST'), port, secure: env('SMTP_SECURE') === 'true' || port === 465, user: env('SMTP_USER'), pass: process.env.SMTP_PASS || '', from: env('MAIL_FROM') };
    mailSource = 'env';
  } else if (s.smtp?.host) {
    const pass = open('Email password', s.smtp.pass);
    const port = s.smtp.port || 587;
    mailForm = { host: s.smtp.host, port, user: s.smtp.user || '', from: s.smtp.from || '', hasPassword: !!pass };
    // A saved password that no longer decrypts would only be refused by the mail server, so email counts as not set up.
    if (pass || !s.smtp.pass) {
      mail = { host: s.smtp.host, port, secure: port === 465, user: s.smtp.user || '', pass: pass || '', from: s.smtp.from || env('MAIL_FROM') };
      mailSource = 'admin';
    }
  }

  const [stripeKey, stripeKeySource] = pick('STRIPE_SECRET_KEY', 'Stripe secret key', s.stripeSecretKey);
  const [stripeWebhookSecret, stripeWebhookSource] = pick('STRIPE_WEBHOOK_SECRET', 'Stripe webhook secret', s.stripeWebhookSecret);
  const [anthropicKey, anthropicSource] = pick('ANTHROPIC_API_KEY', 'AI key', s.anthropicKey);
  const [postcodesKey, postcodesSource] = pick('IDEAL_POSTCODES_API_KEY', 'Address lookup key', s.postcodesKey);
  return {
    mail,
    mailSource,
    mailForm,
    stripeKey,
    stripeKeySource,
    stripeWebhookSecret,
    stripeWebhookSource,
    anthropicKey,
    anthropicSource,
    postcodesKey,
    postcodesSource,
    unreadable,
  };
});

/** Last few characters, enough to recognise a key without revealing it. */
export const keyHint = (v: string | null | undefined) => (v ? `ending ${v.slice(-4)}` : '');

export type ConnectionPatch = {
  smtp?: { host: string; port: number; user: string; pass?: string; from: string } | null;
  stripeSecretKey?: string | null;
  stripeWebhookSecret?: string | null;
  anthropicKey?: string | null;
  postcodesKey?: string | null;
};

/**
 * Save connection details. A secret left undefined keeps the saved one; null removes it.
 * Refuses to store secrets unless ENCRYPTION_KEY is set, so they never sit in the database readable.
 */
export async function saveConnections(patch: ConnectionPatch): Promise<void> {
  const secrets = [patch.smtp?.pass, patch.stripeSecretKey, patch.stripeWebhookSecret, patch.anthropicKey, patch.postcodesKey];
  if (secrets.some((v) => typeof v === 'string' && v) && !encryptionOn()) {
    throw new ConnectionError('Set ENCRYPTION_KEY in the server’s .env file first, so these details are stored encrypted.');
  }
  const s = await readStored();
  if (patch.smtp === null) delete s.smtp;
  else if (patch.smtp) {
    const { pass, ...rest } = patch.smtp;
    s.smtp = { ...rest, pass: pass === undefined ? (s.smtp?.pass ?? null) : seal(pass) };
  }
  for (const k of ['stripeSecretKey', 'stripeWebhookSecret', 'anthropicKey', 'postcodesKey'] as const) {
    if (patch[k] !== undefined) s[k] = patch[k] ? seal(patch[k]) : null;
  }
  const value = JSON.stringify(s);
  await db.setting.upsert({ where: { key: KEY }, update: { value }, create: { key: KEY, value } });
}

/** Problems the owner can fix, shown as-is. */
export class ConnectionError extends Error {}

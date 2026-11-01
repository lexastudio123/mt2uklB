import 'server-only';
import crypto from 'node:crypto';
import type { Order, OrderItem } from '@prisma/client';
import { siteUrl } from '../site';
import { getConnections } from '../connections';

// Stripe Checkout over the REST API (no SDK needed). Checkout hosts the card form,
// so card numbers never touch this server. Apple Pay and Google Pay appear automatically.

// STRIPE_API_BASE is only for local testing against a mock server (for example stripe-mock).
const API = (process.env.STRIPE_API_BASE || 'https://api.stripe.com/v1').replace(/\/+$/, '');

/** True when a Stripe secret key is set, in .env or in Admin › Settings › Connections. */
export const stripeReady = async () => !!(await getConnections()).stripeKey;

function encode(obj: Record<string, unknown>, prefix = '', out = new URLSearchParams()): URLSearchParams {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((item, i) => (typeof item === 'object' ? encode(item as Record<string, unknown>, `${key}[${i}]`, out) : out.append(`${key}[${i}]`, String(item))));
    else if (typeof v === 'object') encode(v as Record<string, unknown>, key, out);
    else out.append(key, String(v));
  }
  return out;
}

async function call<T>(path: string, method: 'GET' | 'POST', body?: Record<string, unknown>, idempotencyKey?: string, apiKey?: string): Promise<T> {
  const key = apiKey ?? (await getConnections()).stripeKey;
  if (!key) throw new Error('Card payments are not configured');
  const res = await fetch(API + path, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
    body: body ? encode(body).toString() : undefined,
    cache: 'no-store',
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!res.ok) throw new Error(json.error?.message || `Stripe request failed (${res.status})`);
  return json;
}

export type StripeSession = {
  id: string;
  url: string | null;
  status: 'open' | 'complete' | 'expired';
  payment_status: 'paid' | 'unpaid' | 'no_payment_required';
  payment_intent: string | null;
  client_reference_id: string | null;
  metadata: Record<string, string>;
  amount_total: number | null;
};

/** Create a hosted checkout page for an order. One line for the whole order keeps the amount exact. */
export async function createCheckoutSession(order: Order & { items: OrderItem[] }, storeName: string): Promise<StripeSession> {
  const summary = order.items.map((i) => `${i.qty} × ${i.productName} (${i.packLabel.split(' · ')[0]})`).join(', ');
  return call<StripeSession>(
    '/checkout/sessions',
    'POST',
    {
      mode: 'payment',
      client_reference_id: order.number,
      customer_email: order.email,
      success_url: `${siteUrl()}/order/${order.accessToken}?paid=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl()}/order/${order.accessToken}?cancelled=1`,
      expires_at: Math.floor(Date.now() / 1000) + 60 * 60, // one hour
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: order.currency.toLowerCase(),
            unit_amount: order.total,
            product_data: { name: `${storeName} order ${order.number}`, description: summary.slice(0, 480) },
          },
        },
      ],
      metadata: { order_id: order.id, order_number: order.number },
      payment_intent_data: { description: `Order ${order.number}`, metadata: { order_id: order.id, order_number: order.number } },
    },
    `checkout-${order.id}-${Date.now()}`,
  );
}

export const retrieveSession = (id: string) => call<StripeSession>(`/checkout/sessions/${encodeURIComponent(id)}`, 'GET');

/** "Visa ending 4242" for the receipt, when Stripe can tell us. */
export async function describePayment(paymentIntentId: string): Promise<string | null> {
  try {
    const pi = await call<{ payment_method?: { card?: { brand?: string; last4?: string; wallet?: { type?: string } | null } } | null }>(
      `/payment_intents/${encodeURIComponent(paymentIntentId)}?expand[]=payment_method`,
      'GET',
    );
    const card = pi.payment_method?.card;
    if (!card?.last4) return null;
    const brand = (card.brand || 'card').replace(/^\w/, (c) => c.toUpperCase()).replace('Amex', 'American Express');
    const wallet = card.wallet?.type === 'apple_pay' ? 'Apple Pay, ' : card.wallet?.type === 'google_pay' ? 'Google Pay, ' : '';
    return `${wallet}${brand} ending ${card.last4}`;
  } catch {
    return null;
  }
}

export async function refundPayment(paymentIntentId: string, amount: number, reason?: string): Promise<{ id: string; status: string }> {
  return call('/refunds', 'POST', { payment_intent: paymentIntentId, amount, metadata: reason ? { reason: reason.slice(0, 200) } : undefined }, `refund-${paymentIntentId}-${amount}-${Date.now()}`);
}

/** Check a secret key before saving it. Returns Stripe's complaint, or null when the key works. */
export async function checkStripeKey(key: string): Promise<string | null> {
  try {
    await call('/checkout/sessions?limit=1', 'GET', undefined, undefined, key);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message.slice(0, 300) : String(e);
  }
}

/** Verify a webhook signature (Stripe-Signature header, HMAC-SHA256, five-minute tolerance). */
export function verifyWebhook(payload: string, header: string | null, secret: string | null): boolean {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(
    header.split(',').map((kv) => {
      const i = kv.indexOf('=');
      return [kv.slice(0, i).trim(), kv.slice(i + 1).trim()];
    }),
  );
  const t = Number(parts.t);
  if (!t || Math.abs(Date.now() / 1000 - t) > 300) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${t}.${payload}`).digest('hex');
  const sigs = header
    .split(',')
    .filter((kv) => kv.trim().startsWith('v1='))
    .map((kv) => kv.trim().slice(3));
  return sigs.some((sig) => sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)));
}

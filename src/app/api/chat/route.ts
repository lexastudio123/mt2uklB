import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { db } from '@/lib/db';
import { getCustomer } from '@/lib/auth';
import { getCatalog, toClientProduct } from '@/lib/catalog';
import { activeMethods, bankTransferAvailable, cardPaymentsReady, getSettings } from '@/lib/settings';
import { etaPlain } from '@/lib/eta';
import { clientIp, rateLimit, sameOrigin } from '@/lib/security';
import { REFUSAL, mustDecline, ruleAnswer } from '@/lib/chat/rules';
import { aiReady, aiReply, type ChatTurn, type ClientAction } from '@/lib/chat/assistant';
import { allHelp, helpContent } from '@/content/help';

type Stored = { role: 'user' | 'assistant'; text: string; at: string };

export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: 'Bad request' }, { status: 403 });
  const s = await getSettings();
  if (!s.chat.enabled) return NextResponse.json({ error: 'Chat is closed' }, { status: 404 });
  const ip = clientIp(req.headers);
  if (!rateLimit(`chat:${ip}`, 30, 10 * 60_000).ok)
    return NextResponse.json({ text: 'I am getting a lot of messages right now. Give me a moment and try again, or use the [contact form](/contact).', actions: [] });

  const body = (await req.json().catch(() => ({}))) as { visitorId?: string; text?: string };
  const visitorId = String(body.visitorId || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  const text = String(body.text || '').trim().slice(0, 1000);
  if (!visitorId || !text) return NextResponse.json({ error: 'Empty message' }, { status: 400 });

  // One running conversation per visitor per day, stored for the team (Admin › Inbox › Chats).
  const since = new Date(Date.now() - 24 * 36e5);
  const customer = await getCustomer();
  let convo = await db.chatConversation.findFirst({ where: { visitorId, updatedAt: { gt: since } }, orderBy: { updatedAt: 'desc' } });
  const stored: Stored[] = convo ? (JSON.parse(convo.messages) as Stored[]) : [];
  if (stored.length >= 80) return NextResponse.json({ text: 'This chat is getting long. Please use the [contact form](/contact) and the team will pick it up.', actions: [] });
  stored.push({ role: 'user', text, at: new Date().toISOString() });

  const [catalog] = await Promise.all([getCatalog()]);
  const pay = { card: await cardPaymentsReady(s), bank: bankTransferAvailable(s) };
  const method = activeMethods(s)[0];
  const eta = method ? etaPlain({ cutoffHour: s.shipping.cutoffHour, closedDates: s.shipping.closedDates }, method) : '';

  let reply = '';
  let actions: ClientAction[] = [];
  let flagged = convo?.flagged ?? false;

  if (mustDecline(text)) {
    reply = REFUSAL;
    flagged = true;
  } else if (await aiReady(s)) {
    try {
      const history: ChatTurn[] = stored.slice(-12).map((m) => ({ role: m.role, text: m.text }));
      const r = await aiReply(history, { s, catalog, pay, eta });
      reply = r.text;
      actions = r.actions;
      if (r.refused) flagged = true;
    } catch (e) {
      if (e instanceof Anthropic.RateLimitError) console.warn('[chat] rate limited by the AI provider');
      else if (e instanceof Anthropic.APIError) console.error('[chat] AI error', e.status, e.message);
      else console.error('[chat] AI failure', e);
    }
  }
  if (!reply) {
    const client = catalog.map(toClientProduct);
    reply = ruleAnswer(text, { catalog: client, s, card: pay.card, bank: pay.bank, eta, help: allHelp(helpContent(client, s, pay)) });
  }

  stored.push({ role: 'assistant', text: reply, at: new Date().toISOString() });
  const data = { messages: JSON.stringify(stored.slice(-80)), messageCount: stored.length, flagged, customerId: customer?.id ?? convo?.customerId ?? null };
  if (convo) await db.chatConversation.update({ where: { id: convo.id }, data });
  else convo = await db.chatConversation.create({ data: { visitorId, ...data } });

  return NextResponse.json({ text: reply, actions });
}

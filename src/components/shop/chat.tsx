'use client';

import Link from 'next/link';
import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { IconChat, IconSend, IconX } from '../icons';
import { useCart, useShop, useUI } from './providers';

type Msg = { role: 'user' | 'assistant'; text: string; pending?: boolean };

const CHAT_KEY = 'mt-chat';
const VISITOR_KEY = 'mt-visitor';
const GREETING =
  'Hi, I am the MT2 Lab assistant. I reply instantly, 24/7. I can explain the difference between MT1 and MT2, help you pick a pack, check delivery or help with an order. What do you need?';
const SUGGESTIONS = ['What is the difference between MT1 and MT2?', 'Which pack is best value?', 'When will my order arrive?', 'How do I check a lot report?'];

function visitorId(): string {
  try {
    let v = localStorage.getItem(VISITOR_KEY);
    if (!v) {
      v = (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36)).replace(/-/g, '');
      localStorage.setItem(VISITOR_KEY, v);
    }
    return v;
  } catch {
    return 'anon' + Math.random().toString(36).slice(2);
  }
}

/** Safe mini-markdown: [label](/path) links, **bold**, "- " bullets and line breaks. */
function Rich({ text, onLink }: { text: string; onLink: () => void }) {
  const lines = text.split('\n');
  return (
    <>
      {lines.map((line, li) => {
        const bullet = /^\s*-\s+/.test(line);
        const body = bullet ? line.replace(/^\s*-\s+/, '') : line;
        const parts: ReactNode[] = [];
        const re = /\[([^\]]+)\]\((\/[^)\s]*)\)|\*\*([^*]+)\*\*/g;
        let last = 0;
        let m: RegExpExecArray | null;
        while ((m = re.exec(body))) {
          if (m.index > last) parts.push(body.slice(last, m.index));
          if (m[1])
            parts.push(
              <Link key={m.index} href={m[2]} onClick={onLink}>
                {m[1]}
              </Link>,
            );
          else parts.push(<b key={m.index}>{m[3]}</b>);
          last = m.index + m[0].length;
        }
        if (last < body.length) parts.push(body.slice(last));
        return (
          <Fragment key={li}>
            {bullet && '• '}
            {parts}
            {li < lines.length - 1 && <br />}
          </Fragment>
        );
      })}
    </>
  );
}

export function ChatWidget() {
  const { chatOpen, setChatOpen, openCart, toast } = useUI();
  const { add } = useCart();
  const { config } = useShop();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const body = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(CHAT_KEY) || '[]');
      if (Array.isArray(saved)) setMsgs(saved.filter((m: Msg) => m && !m.pending));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(CHAT_KEY, JSON.stringify(msgs.filter((m) => !m.pending).slice(-30)));
    } catch {}
    body.current?.scrollTo({ top: body.current.scrollHeight });
  }, [msgs]);

  useEffect(() => {
    if (!chatOpen) return;
    if (!msgs.length) setMsgs([{ role: 'assistant', text: GREETING }]);
    setTimeout(() => field.current?.focus(), 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatOpen]);

  const send = async (raw: string) => {
    const text = raw.trim();
    if (!text || busy) return;
    setInput('');
    if (field.current) field.current.style.height = 'auto';
    setMsgs((m) => [...m, { role: 'user', text }, { role: 'assistant', text: '', pending: true }]);
    setBusy(true);
    let reply = 'Sorry, I could not answer that. Try again, or use the [contact form](/contact).';
    try {
      const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ visitorId: visitorId(), text }) });
      const j = (await r.json()) as { text?: string; actions?: { type: 'add'; packId: string; qty: number }[] };
      if (j.text) reply = j.text;
      let added = 0;
      for (const a of j.actions ?? []) if (a.type === 'add' && add(a.packId, a.qty, { quiet: true })) added++;
      if (added) {
        toast('Added to your basket');
        if (innerWidth >= 700) openCart();
      }
    } catch {
      reply = 'I could not connect just now. Check your connection and try again, or use the [contact form](/contact).';
    }
    setMsgs((m) => [...m.filter((x) => !x.pending), { role: 'assistant', text: reply }]);
    setBusy(false);
  };

  const closeOnSmall = () => {
    if (innerWidth < 700) setChatOpen(false);
  };
  const userCount = msgs.filter((m) => m.role === 'user').length;

  return (
    <>
      <button className={`k-chatbtn${chatOpen ? ' hide' : ''}`} aria-label="Chat with us, instant replies 24/7" onClick={() => setChatOpen(true)}>
        <IconChat />
        <span>Chat with us</span>
        <i className="live" aria-hidden="true" />
      </button>
      <div className="k-chat" role="dialog" aria-label="MT2 Lab assistant" hidden={!chatOpen}>
        <div className="k-chat-h">
          <span className="av">M</span>
          <span className="t">
            <b>{config.storeName} assistant</b>
            <span>
              <i className="live" />
              Online now · replies instantly, 24/7
            </span>
          </span>
          <button className="x" aria-label="Close chat" onClick={() => setChatOpen(false)}>
            <IconX />
          </button>
        </div>
        <div className="k-chat-b" ref={body} aria-live="polite">
          {msgs.map((m, i) => (
            <div key={i} className={`k-msg${m.role === 'user' ? ' me' : ''}`}>
              <div className="bub">
                {m.pending ? (
                  <span className="typing" aria-label="Typing">
                    <i />
                    <i />
                    <i />
                  </span>
                ) : (
                  <Rich text={m.text} onLink={closeOnSmall} />
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="k-chat-s">
          {userCount < 1 &&
            SUGGESTIONS.map((q) => (
              <button key={q} onClick={() => send(q)}>
                {q}
              </button>
            ))}
        </div>
        <form
          className="k-chat-f"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <label htmlFor="kChatIn" className="k-sr">
            Message
          </label>
          <textarea
            id="kChatIn"
            ref={field}
            rows={1}
            value={input}
            maxLength={1000}
            placeholder="Ask about products, delivery or an order"
            autoComplete="off"
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(120, e.target.scrollHeight) + 'px';
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
          />
          <button aria-label="Send" disabled={busy}>
            <IconSend />
          </button>
        </form>
        <div className="k-chat-foot">
          Automated assistant. It never gives dosing advice.{' '}
          <button
            className="k-link"
            style={{ fontSize: 11.5 }}
            onClick={() =>
              setMsgs((m) => [
                ...m,
                {
                  role: 'assistant',
                  text: 'Of course. Send the team a message and they will reply by email. [Open the contact form](/contact). If it is about an order, include the order number so they can help faster.',
                },
              ])
            }
          >
            Talk to a person
          </button>
        </div>
      </div>
    </>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { EMAIL_RE } from '@/lib/site';
import { IconX } from '../icons';
import { CopyButton } from './bits';
import { PROMO_KEY, store, useShop, useUI } from './providers';

async function subscribe(email: string, source: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const r = await fetch('/api/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, source }) });
    const j = await r.json().catch(() => ({}));
    return r.ok ? { ok: true } : { ok: false, error: j.error || 'Something went wrong. Try again.' };
  } catch {
    return { ok: false, error: 'You appear to be offline. Try again.' };
  }
}

/** Footer sign-up for new lot alerts. */
export function NewsForm() {
  const { toast } = useUI();
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="news"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = e.currentTarget;
        const email = (f.elements.namedItem('email') as HTMLInputElement).value.trim();
        if (!EMAIL_RE.test(email)) return toast('Enter a valid email address');
        setBusy(true);
        const r = await subscribe(email, 'footer');
        setBusy(false);
        if (r.ok) {
          toast('You are on the list for new lot alerts.');
          f.reset();
        } else toast(r.error!);
      }}
    >
      <label htmlFor="ne" style={{ position: 'absolute', left: -9999 }}>
        Email
      </label>
      <input id="ne" name="email" type="email" placeholder="Email for new lot alerts" required autoComplete="email" />
      <button disabled={busy}>Join</button>
    </form>
  );
}

const CAP_KEY = 'mt-cap';
const HIDDEN_ON = ['/checkout', '/basket', '/order', '/account', '/support'];

/** First-order discount pop-up: after a delay or once the visitor has scrolled through most of a page. */
export function EmailCapture() {
  const { config } = useShop();
  const { chatOpen } = useUI();
  const P = config.popup;
  const path = usePathname() || '/';
  const [show, setShow] = useState(false);
  const [on, setOn] = useState(false);
  const [done, setDone] = useState(false);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const blocked = HIDDEN_ON.some((p) => path.startsWith(p));
  const chatRef = useRef(chatOpen);
  chatRef.current = chatOpen;

  useEffect(() => {
    if (!P.popupEnabled || blocked || show) return;
    const seen = store<number | 'done'>(CAP_KEY);
    if (seen === 'done' || (typeof seen === 'number' && Date.now() - seen < 14 * 864e5)) return;
    const open = () => {
      if (document.querySelector('.gate') || chatRef.current) return;
      setShow(true);
      requestAnimationFrame(() => setOn(true));
    };
    const t = setTimeout(open, (P.popupDelay || 25) * 1000);
    const onScroll = () => {
      if (scrollY > document.documentElement.scrollHeight * 0.45) {
        removeEventListener('scroll', onScroll);
        clearTimeout(t);
        setTimeout(open, 800);
      }
    };
    addEventListener('scroll', onScroll, { passive: true });
    return () => {
      clearTimeout(t);
      removeEventListener('scroll', onScroll);
    };
  }, [P.popupEnabled, P.popupDelay, blocked, show]);

  useEffect(() => {
    if (chatOpen && show && !done) close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatOpen]);

  if (!show || (blocked && !done)) return null;

  function close() {
    if (!done) store(CAP_KEY, Date.now());
    setOn(false);
    setTimeout(() => setShow(false), 300);
  }

  return (
    <div className={`k-cap${on ? ' on' : ''}`} role="dialog" aria-labelledby="kCapT">
      <button className="x" aria-label="Close" onClick={close}>
        <IconX width={18} height={18} />
      </button>
      <p className="big" id="kCapT">
        {P.welcomePct}% off your first order
      </p>
      <p>Get new lot reports and restock alerts by email. Your code arrives straight away.</p>
      {done ? (
        <div style={{ marginTop: 14 }}>
          <p style={{ margin: '0 0 8px' }}>Your code for {P.welcomePct}% off your first order:</p>
          <div className="k-copy">
            <span>{P.welcomeCode}</span>
            <CopyButton text={P.welcomeCode} />
          </div>
          <p className="k-small" style={{ marginTop: 8 }}>
            It is applied automatically at checkout too.
          </p>
        </div>
      ) : (
        <form
          noValidate
          onSubmit={async (e) => {
            e.preventDefault();
            const email = (e.currentTarget.elements.namedItem('email') as HTMLInputElement).value.trim();
            if (!EMAIL_RE.test(email)) return setMsg('Enter a valid email address.');
            setBusy(true);
            const r = await subscribe(email, 'popup');
            setBusy(false);
            if (!r.ok) return setMsg(r.error!);
            store(CAP_KEY, 'done');
            store(PROMO_KEY, P.welcomeCode);
            setDone(true);
          }}
        >
          <label htmlFor="kCapE" className="k-sr">
            Email
          </label>
          <input id="kCapE" name="email" type="email" placeholder="Your email" autoComplete="email" inputMode="email" />
          <button className="k-btn block" disabled={busy}>
            Get my code
          </button>
          <span className="k-small" aria-live="polite">
            {msg}
          </span>
        </form>
      )}
      <p className="fine">One or two emails a month. Unsubscribe any time.</p>
    </div>
  );
}

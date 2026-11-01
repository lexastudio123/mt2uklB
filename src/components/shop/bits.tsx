'use client';

// Small interactive pieces used across server-rendered pages.
import { useEffect, useState, type ReactNode } from 'react';
import { arrival, etaParts, fday, type ShipMethod } from '@/lib/eta';
import { useCart, useShop, useUI } from './providers';

/** Renders "**bold**" segments from the ETA helpers. */
export function Bolded({ text }: { text: string }) {
  return (
    <>
      {text.split('**').map((part, i) => (i % 2 ? <b key={i}>{part}</b> : <span key={i}>{part}</span>))}
    </>
  );
}

/** Live dispatch countdown and delivery estimate. Renders after mount so server and browser clocks never disagree. */
export function EtaLine({ methodId, className }: { methodId?: string; className?: string }) {
  const { config } = useShop();
  const [, tick] = useState(0);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const t = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);
  const m: ShipMethod | undefined = config.methods.find((x) => x.id === methodId) ?? config.methods[0];
  if (!m) return null;
  const cfg = { cutoffHour: config.cutoffHour, closedDates: config.closedDates };
  return (
    <div className={`k-eta ${className ?? ''}`}>
      <span className="dot" />
      <span>
        {mounted ? (
          <>
            <Bolded text={etaParts(cfg, m).lead} />. <Bolded text={etaParts(cfg, m).rest} />
          </>
        ) : (
          <>Orders placed before {config.cutoffHour > 12 ? `${config.cutoffHour - 12}pm` : `${config.cutoffHour}am`} UK time on a working day are dispatched the same day.</>
        )}
      </span>
    </div>
  );
}

export function arrivalText(config: { cutoffHour: number; closedDates: string[] }, m: ShipMethod) {
  const [a, b] = arrival({ cutoffHour: config.cutoffHour, closedDates: config.closedDates }, m);
  return `Arrives ${fday(a)}${+a === +b ? '' : ' to ' + fday(b)}`;
}

/** Add a pack to the basket (opens the drawer, like the design). */
export function AddButton({ packId, qty = 1, className = 'add', children, quiet, style }: { packId: string; qty?: number; className?: string; children?: ReactNode; quiet?: boolean; style?: React.CSSProperties }) {
  const { add } = useCart();
  return (
    <button type="button" className={className} style={style} onClick={() => add(packId, qty, { quiet })}>
      {children ?? 'Add'}
    </button>
  );
}

export function OpenChatButton({ className, children, style }: { className?: string; children: ReactNode; style?: React.CSSProperties }) {
  const { setChatOpen } = useUI();
  const { config } = useShop();
  if (!config.chatEnabled) {
    return (
      <a className={className} style={style} href="/contact">
        {children}
      </a>
    );
  }
  return (
    <button type="button" className={className} style={style} onClick={() => setChatOpen(true)}>
      {children}
    </button>
  );
}

export function CopyButton({ text, className = 'k-btn sm', label }: { text: string; className?: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={className}
      aria-label={label && !done ? label : undefined}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1600);
        } catch {}
      }}
    >
      {done ? 'Copied' : 'Copy'}
    </button>
  );
}

'use client';

import { useState } from 'react';
import type { LotInfo } from '@/lib/catalog-types';
import { LotReport, fdateLong } from './lot-report';

/** "Check the lot on your label" form. Looks the lot up on the server. */
export function LotLookup({ initial, hint, outStyle, formStyle }: { initial?: LotInfo | null; hint: React.ReactNode; outStyle?: React.CSSProperties; formStyle?: React.CSSProperties }) {
  const [lot, setLot] = useState<LotInfo | null>(initial ?? null);
  const [msg, setMsg] = useState<React.ReactNode>(hint);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <form
        className="lotf"
        style={formStyle}
        onSubmit={async (e) => {
          e.preventDefault();
          const v = (e.currentTarget.elements.namedItem('lot') as HTMLInputElement).value.trim().toUpperCase().replace(/\s/g, '');
          if (!/^[A-Z0-9]{2,6}-?\d{3,6}$/.test(v)) {
            setMsg(
              <>
                Lot numbers look like <b>MT2-2611</b>. Check the label and try again.
              </>,
            );
            return;
          }
          setBusy(true);
          try {
            const r = await fetch(`/api/lots/${encodeURIComponent(v)}`);
            if (r.status === 404) {
              setLot(null);
              setMsg(`We have no lot ${v} on record. Message us with a photo of the label and we will check it.`);
              return;
            }
            const hit = (await r.json()) as LotInfo;
            setLot(hit);
            setMsg(
              <>
                Lot <b>{hit.code}</b> found: {hit.productName}, {hit.purity}% purity, tested {fdateLong(hit.testedAt)}.
              </>,
            );
          } catch {
            setMsg('Could not check that lot just now. Try again in a moment.');
          } finally {
            setBusy(false);
          }
        }}
      >
        <label htmlFor="lotIn" style={{ position: 'absolute', left: -9999 }}>
          Lot number
        </label>
        <input id="lotIn" name="lot" placeholder="e.g. MT2-2611" autoComplete="off" />
        <button className="btn" disabled={busy}>
          Check
        </button>
      </form>
      <p className="mute" style={{ fontSize: 14, marginTop: 10 }} aria-live="polite">
        {msg}
      </p>
      {outStyle !== undefined ? <div style={outStyle}>{lot && <LotReport lot={lot} />}</div> : null}
    </>
  );
}

/** Home page variant: the report sits in the right-hand column and updates after a lookup. */
export function LotLookupSplit({ initial, hint }: { initial: LotInfo | null; hint: React.ReactNode }) {
  const [lot, setLot] = useState<LotInfo | null>(initial);
  const [msg, setMsg] = useState<React.ReactNode>(hint);
  const [busy, setBusy] = useState(false);
  return (
    <div className="wrap lot">
      <div>
        <span className="kick">Verify your vial</span>
        <h2 className="disp" style={{ fontSize: 'clamp(44px,5.4vw,80px)', marginTop: 10 }}>
          Check the lot on your label
        </h2>
        <p className="mute" style={{ marginTop: 14, maxWidth: '44ch' }}>
          Every vial label carries a lot number. Enter it to see the purity, identity result and test date for that exact lot.
        </p>
        <form
          className="lotf"
          onSubmit={async (e) => {
            e.preventDefault();
            const v = (e.currentTarget.elements.namedItem('lot') as HTMLInputElement).value.trim().toUpperCase().replace(/\s/g, '');
            if (!/^[A-Z0-9]{2,6}-?\d{3,6}$/.test(v)) {
              setMsg(
                <>
                  Lot numbers look like <b>MT2-2611</b>. Check the label and try again.
                </>,
              );
              return;
            }
            setBusy(true);
            try {
              const r = await fetch(`/api/lots/${encodeURIComponent(v)}`);
              if (r.status === 404) {
                setMsg(`We have no lot ${v} on record. Message us with a photo of the label and we will check it.`);
                return;
              }
              const hit = (await r.json()) as LotInfo;
              setLot(hit);
              setMsg(
                <>
                  Lot <b>{hit.code}</b> found: {hit.productName}, {hit.purity}% purity, tested {fdateLong(hit.testedAt)}.
                </>,
              );
            } catch {
              setMsg('Could not check that lot just now. Try again in a moment.');
            } finally {
              setBusy(false);
            }
          }}
        >
          <label htmlFor="lotIn" style={{ position: 'absolute', left: -9999 }}>
            Lot number
          </label>
          <input id="lotIn" name="lot" placeholder="e.g. MT2-2611" autoComplete="off" />
          <button className="btn" disabled={busy}>
            Check
          </button>
        </form>
        <p className="mute" style={{ fontSize: 14, marginTop: 10 }} aria-live="polite">
          {msg}
        </p>
      </div>
      <div>{lot && <LotReport lot={lot} />}</div>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { m2 } from '@/lib/money';
import { fday, arrival } from '@/lib/eta';
import { EMAIL_RE, UK_POSTCODE_RE, formatPostcode } from '@/lib/site';
import { IconBank, IconLock } from '../icons';
import { PROMO_KEY, store, useCart, useShop } from './providers';
import { EtaLine } from './bits';
import { Assure, PromoBox, SummaryLines, Totals, useQuote } from './summary';

type Address = { id: string; name: string; line1: string; line2: string; city: string; postcode: string; country: string; phone: string };
type Profile = { email: string; name: string; phone: string; credit: number; addresses: Address[] } | null;

type Info = { email: string; name: string; country: string; addr1: string; addr2: string; city: string; post: string; phone: string; news: boolean };
type FieldKey = 'email' | 'name' | 'country' | 'addr1' | 'addr2' | 'city' | 'post' | 'phone';

const DRAFT_KEY = 'mt-ck';

const FIELDS: { k: FieldKey; label: string; type: string; ac: string; req: boolean; full: boolean; hint?: string }[] = [
  { k: 'email', label: 'Email', type: 'email', ac: 'email', req: true, full: true, hint: 'For your order confirmation and tracking' },
  { k: 'name', label: 'Full name', type: 'text', ac: 'name', req: true, full: true },
  { k: 'country', label: 'Country', type: 'select', ac: 'country-name', req: true, full: true },
  { k: 'addr1', label: 'Address', type: 'text', ac: 'address-line1', req: true, full: true },
  { k: 'addr2', label: 'Flat, suite or building', type: 'text', ac: 'address-line2', req: false, full: true },
  { k: 'city', label: 'Town or city', type: 'text', ac: 'address-level2', req: true, full: false },
  { k: 'post', label: 'Postcode', type: 'text', ac: 'postal-code', req: true, full: false },
  { k: 'phone', label: 'Phone', type: 'tel', ac: 'tel', req: false, full: true, hint: 'Only used if the courier needs to reach you' },
];

function validate(k: FieldKey, raw: string, info: Info): string {
  const v = (raw || '').trim();
  const f = FIELDS.find((x) => x.k === k)!;
  if (!v && f.req) return `Enter your ${f.label.toLowerCase()}`;
  if (k === 'email' && v && !EMAIL_RE.test(v)) return 'Enter an email address like name@example.com';
  if (k === 'post' && v && info.country === 'United Kingdom' && !UK_POSTCODE_RE.test(v)) return 'Enter a UK postcode like SW1A 1AA';
  if (k === 'phone' && v && !/^[+\d][\d\s()-]{6,}$/.test(v)) return 'Enter a phone number with digits only';
  if (k === 'name' && v && v.length < 2) return 'Enter your full name';
  return '';
}

export function Checkout({ profile }: { profile: Profile }) {
  const { config, signedIn } = useShop();
  const { lines, ready, clear } = useCart();
  const [step, setStep] = useState(1);
  const [info, setInfo] = useState<Info>({ email: '', name: '', country: config.countries[0] ?? 'United Kingdom', addr1: '', addr2: '', city: '', post: '', phone: '', news: false });
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({});
  const [ship, setShip] = useState(config.methods[0]?.id ?? '');
  const payOptions = [...(config.card ? (['card'] as const) : []), ...(config.bank ? (['bank_transfer'] as const) : [])];
  const [pay, setPay] = useState<'card' | 'bank_transfer'>(payOptions[0] ?? 'card');
  const [billSame, setBillSame] = useState(true);
  const [bill, setBill] = useState({ bill1: '', billCity: '', billPost: '' });
  const [ruo, setRuo] = useState(false);
  const [ruoErr, setRuoErr] = useState(false);
  const [useCredit, setUseCredit] = useState(false);
  const [sumOpen, setSumOpen] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [placeErr, setPlaceErr] = useState('');
  // Saving the draft waits until it has been read back, so the empty starting form never overwrites it.
  const [draftLoaded, setDraftLoaded] = useState(false);

  // Prefill: saved draft first, then the signed-in profile for anything missing.
  useEffect(() => {
    const draft = store<Partial<Info>>(DRAFT_KEY) || {};
    const def = profile?.addresses[0];
    setInfo((cur) => ({
      ...cur,
      ...draft,
      email: draft.email || profile?.email || '',
      name: draft.name || def?.name || profile?.name || '',
      addr1: draft.addr1 || def?.line1 || '',
      addr2: draft.addr2 || def?.line2 || '',
      city: draft.city || def?.city || '',
      post: draft.post || def?.postcode || '',
      phone: draft.phone || def?.phone || profile?.phone || '',
      country: config.countries.includes(draft.country || '') ? draft.country! : config.countries[0] ?? 'United Kingdom',
    }));
    setDraftLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (draftLoaded) store(DRAFT_KEY, info);
  }, [info, draftLoaded]);

  const { quote, code, setCode, synced } = useQuote({ shippingMethodId: ship, email: step > 1 ? info.email : undefined, useCredit });

  const set = (k: FieldKey, v: string) => {
    setInfo((cur) => ({ ...cur, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: validate(k, v, { ...info, [k]: v }) }));
  };
  const blur = (k: FieldKey) => {
    setTouched((t) => ({ ...t, [k]: true }));
    if (info[k].trim()) setErrors((e) => ({ ...e, [k]: validate(k, info[k], info) }));
  };

  const go = (n: number) => {
    setStep(n);
    window.scrollTo(0, 0);
  };

  const submitDetails = (e: React.FormEvent) => {
    e.preventDefault();
    const next: Partial<Record<FieldKey, string>> = {};
    for (const f of FIELDS) next[f.k] = validate(f.k, info[f.k], info);
    setErrors(next);
    setTouched(Object.fromEntries(FIELDS.map((f) => [f.k, true])));
    const bad = FIELDS.find((f) => next[f.k]);
    if (bad) {
      document.getElementById(`kf-${bad.k}`)?.focus();
      return;
    }
    if (info.country === 'United Kingdom') setInfo((cur) => ({ ...cur, post: formatPostcode(cur.post) }));
    go(2);
  };

  const place = async () => {
    setPlaceErr('');
    if (!billSame && (!bill.bill1.trim() || !bill.billCity.trim() || !bill.billPost.trim())) {
      setPlaceErr('Add your billing address, or tick “same as delivery”.');
      return;
    }
    if (!ruo) {
      setRuoErr(true);
      document.getElementById('kRuo')?.focus();
      return;
    }
    setPlacing(true);
    try {
      const r = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'place',
          lines,
          ...info,
          billSame,
          ...bill,
          shippingMethodId: ship,
          paymentMethod: pay,
          code,
          useCredit,
          ruo: true,
        }),
      });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; redirect?: string; error?: string; field?: string };
      if (j.ok && j.redirect) {
        clear();
        store(PROMO_KEY, null);
        window.location.assign(j.redirect);
        return;
      }
      const field = j.field as FieldKey | undefined;
      if (field && FIELDS.some((f) => f.k === field)) {
        setErrors((e) => ({ ...e, [field]: j.error }));
        go(1);
      }
      if (j.field === 'code') setCode('');
      setPlaceErr(j.error || 'Something went wrong. Please try again.');
    } catch {
      setPlaceErr('You appear to be offline. Check your connection and try again.');
    }
    setPlacing(false);
  };

  const methodsWithEta = useMemo(
    () => config.methods.map((m) => ({ m, eta: arrival({ cutoffHour: config.cutoffHour, closedDates: config.closedDates }, m) })),
    [config],
  );

  if (ready && !lines.length) {
    return (
      <div className="k-page">
        <div className="k-wrap k-narrow">
          <div className="k-empty" style={{ marginTop: 20 }}>
            <p style={{ margin: 0, fontSize: 17, color: 'var(--k-ink)' }}>Your basket is empty, so there is nothing to check out yet.</p>
            <Link className="k-btn" href="/shop">
              Browse the range
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const addrLine = [info.addr1, info.addr2, info.city, info.post, info.country].filter(Boolean).join(', ');
  const review = (rows: [string, string, number][]) => (
    <dl className="k-review">
      {rows.map(([a, b, s]) => (
        <div key={a} style={{ display: 'contents' }}>
          <dt>{a}</dt>
          <dd>{b}</dd>
          <dd>
            <button className="k-link" style={{ fontSize: 13.5 }} onClick={() => go(s)}>
              Change
            </button>
          </dd>
        </div>
      ))}
    </dl>
  );

  const field = (k: FieldKey) => {
    const f = FIELDS.find((x) => x.k === k)!;
    const err = errors[k];
    const ok = !err && touched[k] && info[k].trim();
    return (
      <div className={`k-field${f.full ? ' full' : ''}${err ? ' bad' : ''}${ok ? ' ok' : ''}`} key={k}>
        <label htmlFor={`kf-${k}`}>
          {f.label}
          {!f.req && <span className="opt"> (optional)</span>}
        </label>
        {f.type === 'select' ? (
          <select id={`kf-${k}`} name={k} autoComplete={f.ac} value={info.country} onChange={(e) => set('country', e.target.value)}>
            {config.countries.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        ) : (
          <input
            id={`kf-${k}`}
            name={k}
            type={f.type}
            autoComplete={f.ac}
            value={info[k]}
            onChange={(e) => set(k, e.target.value)}
            onBlur={() => blur(k)}
            {...(f.type === 'email' ? { inputMode: 'email' as const, spellCheck: false } : {})}
            {...(k === 'post' ? { autoCapitalize: 'characters' } : {})}
          />
        )}
        {f.hint && <span className="hint">{f.hint}</span>}
        <span className="err">{err}</span>
      </div>
    );
  };

  const noPayment = payOptions.length === 0 && quote.total > 0;

  return (
    <div className="k-page" style={{ paddingTop: 8 }}>
      <div className="k-wrap">
        <nav className="k-steps" aria-label="Checkout steps">
          <Link href="/basket" className="k-link" style={{ fontWeight: 500, textDecoration: 'none', color: 'var(--k-mute)' }}>
            Basket
          </Link>
          {['Details', 'Delivery', 'Payment'].map((n, i) => (
            <span key={n} style={{ display: 'contents' }}>
              <span className="sep" aria-hidden="true">
                ›
              </span>
              <button aria-current={i + 1 === step ? 'step' : undefined} disabled={i + 1 > step} onClick={() => go(i + 1)}>
                {n}
              </button>
            </span>
          ))}
        </nav>
        <div className="k-ck">
          <div className="k-ck-main">
            <button className="k-sumtoggle" aria-expanded={sumOpen} onClick={() => setSumOpen((o) => !o)}>
              <span>{sumOpen ? 'Hide order summary' : 'Show order summary'}</span>
              <b>{m2(quote.total)}</b>
            </button>

            {step === 1 && (
              <section>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                  <h2 className="k-h2">Contact</h2>
                  {signedIn ? (
                    <span className="k-small">Signed in</span>
                  ) : (
                    <span className="k-small">
                      Have an account?{' '}
                      <Link className="k-link" href="/account?next=/checkout">
                        Sign in
                      </Link>
                    </span>
                  )}
                </div>
                <form className="k-form" noValidate onSubmit={submitDetails}>
                  {field('email')}
                  <label className="k-check full">
                    <input type="checkbox" checked={info.news} onChange={(e) => setInfo((c) => ({ ...c, news: e.target.checked }))} />
                    Email me restocks and offers. You can unsubscribe at any time.
                  </label>
                  <div className="full" style={{ marginTop: 18 }}>
                    <h2 className="k-h2">Delivery address</h2>
                  </div>
                  {profile && profile.addresses.length > 1 && (
                    <div className="k-field full">
                      <span className="k-lab">Saved addresses</span>
                      <div className="k-addrlist">
                        {profile.addresses.map((a) => (
                          <button
                            type="button"
                            key={a.id}
                            onClick={() => {
                              setInfo((c) => ({ ...c, name: a.name, addr1: a.line1, addr2: a.line2, city: a.city, post: a.postcode, phone: a.phone || c.phone, country: config.countries.includes(a.country) ? a.country : c.country }));
                              setErrors({});
                            }}
                          >
                            {a.name}, {[a.line1, a.line2, a.city, a.postcode].filter(Boolean).join(', ')}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {field('name')}
                  {field('country')}
                  {config.addressLookup && info.country === 'United Kingdom' && (
                    <AddressLookup
                      onPick={(a) => {
                        setInfo((c) => ({ ...c, addr1: a.line1, addr2: a.line2, city: a.city, post: a.postcode }));
                        setErrors((e) => ({ ...e, addr1: '', city: '', post: '' }));
                        setTouched((t) => ({ ...t, addr1: true, city: true, post: true }));
                      }}
                    />
                  )}
                  {field('addr1')}
                  {field('addr2')}
                  {field('city')}
                  {field('post')}
                  {field('phone')}
                  <div className="full" style={{ marginTop: 10 }}>
                    <button className="k-btn block">Continue to delivery</button>
                  </div>
                </form>
              </section>
            )}

            {step === 2 && (
              <section>
                {review([
                  ['Contact', info.email, 1],
                  ['Ship to', addrLine, 1],
                ])}
                <h2 className="k-h2">Delivery method</h2>
                <div className="k-radios">
                  {methodsWithEta.map(({ m, eta: [a, b] }) => {
                    const free = m.freeOver && quote.subtotal >= config.freeOver;
                    return (
                      <label className="k-radio" key={m.id}>
                        <input type="radio" name="kship" value={m.id} checked={ship === m.id} onChange={() => setShip(m.id)} />
                        <span>
                          <b>{m.name}</b>
                          <span>
                            Arrives {fday(a)}
                            {+a === +b ? '' : ` to ${fday(b)}`}
                            {m.note ? ` · ${m.note}` : ''}
                          </span>
                        </span>
                        <span className="pr">{free ? 'Free' : m2(m.price)}</span>
                      </label>
                    );
                  })}
                </div>
                <div style={{ marginTop: 14 }}>
                  <EtaLine methodId={ship} />
                </div>
                <button className="k-btn block" style={{ marginTop: 22 }} onClick={() => go(3)}>
                  Continue to payment
                </button>
              </section>
            )}

            {step === 3 && (
              <section>
                {review([
                  ['Contact', info.email, 1],
                  ['Ship to', addrLine, 1],
                  ['Delivery', `${quote.method?.name ?? ''} · ${quote.shipping ? m2(quote.shipping) : 'Free'}`, 2],
                ])}
                <h2 className="k-h2">Payment</h2>
                <p className="k-small" style={{ margin: '-6px 0 12px' }}>
                  All transactions are secure and encrypted.
                </p>
                {noPayment ? (
                  <div className="k-note">
                    Checkout is not open yet while payments are being set up. Please check back soon, or{' '}
                    <Link className="k-link" href="/contact">
                      contact us
                    </Link>
                    .
                  </div>
                ) : quote.total === 0 ? (
                  <div className="k-note" style={{ background: 'var(--k-good-bg)', color: 'var(--k-good)' }}>
                    Your store credit covers this order. Nothing more to pay.
                  </div>
                ) : (
                  <div className="k-radios">
                    {config.card && (
                      <label className="k-radio">
                        <input type="radio" name="kpay" value="card" checked={pay === 'card'} onChange={() => setPay('card')} />
                        <span>
                          <b>Card, Apple Pay or Google Pay</b>
                          <span>Visa, Mastercard, American Express</span>
                        </span>
                        <span className="k-cardlogos">
                          <i>VISA</i>
                          <i>MC</i>
                          <i>AMEX</i>
                        </span>
                        <div className="k-radio-panel">
                          You pay on our payment provider&apos;s secure page, then come straight back here. We never see or store your card number.
                        </div>
                      </label>
                    )}
                    {config.bank && (
                      <label className="k-radio">
                        <input type="radio" name="kpay" value="bank_transfer" checked={pay === 'bank_transfer'} onChange={() => setPay('bank_transfer')} />
                        <span>
                          <b>Bank transfer</b>
                          <span>Faster Payments from any UK bank account</span>
                        </span>
                        <span>
                          <IconBank width={22} height={22} />
                        </span>
                        <div className="k-radio-panel">
                          We show our bank details and your payment reference on the next page and by email. Your order is reserved and ships as soon as the
                          payment arrives.
                        </div>
                      </label>
                    )}
                  </div>
                )}
                {profile && profile.credit > 0 && (
                  <label className="k-check" style={{ marginTop: 16 }}>
                    <input type="checkbox" checked={useCredit} onChange={(e) => setUseCredit(e.target.checked)} />
                    Use my {m2(profile.credit)} store credit
                  </label>
                )}
                <label className="k-check" style={{ marginTop: 16 }}>
                  <input type="checkbox" checked={billSame} onChange={(e) => setBillSame(e.target.checked)} />
                  Billing address is the same as delivery
                </label>
                {!billSame && (
                  <div className="k-form" style={{ marginTop: 12 }}>
                    <div className="k-field full">
                      <label htmlFor="kb1">Billing address</label>
                      <input id="kb1" autoComplete="billing address-line1" value={bill.bill1} onChange={(e) => setBill((b) => ({ ...b, bill1: e.target.value }))} />
                    </div>
                    <div className="k-field">
                      <label htmlFor="kb2">Town or city</label>
                      <input id="kb2" autoComplete="billing address-level2" value={bill.billCity} onChange={(e) => setBill((b) => ({ ...b, billCity: e.target.value }))} />
                    </div>
                    <div className="k-field">
                      <label htmlFor="kb3">Postcode</label>
                      <input id="kb3" autoComplete="billing postal-code" value={bill.billPost} onChange={(e) => setBill((b) => ({ ...b, billPost: e.target.value }))} />
                    </div>
                  </div>
                )}
                <label className="k-check" style={{ marginTop: 16 }}>
                  <input
                    type="checkbox"
                    id="kRuo"
                    checked={ruo}
                    onChange={(e) => {
                      setRuo(e.target.checked);
                      if (e.target.checked) setRuoErr(false);
                    }}
                  />
                  {config.ruoText}
                </label>
                {ruoErr && (
                  <div className="k-small" style={{ color: 'var(--k-bad)', margin: '6px 0 0 30px' }}>
                    Tick to confirm before placing your order.
                  </div>
                )}
                {placeErr && (
                  <div className="k-note" style={{ marginTop: 16 }} role="alert">
                    {placeErr}
                  </div>
                )}
                <button
                  className="k-btn block"
                  style={{ marginTop: 20, minHeight: 56, fontSize: 16.5 }}
                  onClick={place}
                  disabled={placing || noPayment || !synced || quote.stockIssues.length > 0}
                >
                  <IconLock width={18} height={18} />
                  {placing ? 'Placing your order…' : quote.total === 0 ? 'Place order' : pay === 'card' ? `Pay ${m2(quote.total)}` : `Place order · ${m2(quote.total)}`}
                </button>
                {quote.stockIssues.length > 0 && (
                  <div className="k-note" style={{ marginTop: 12 }}>
                    {quote.stockIssues.join(' ')}{' '}
                    <Link className="k-link" href="/basket">
                      Update your basket
                    </Link>
                  </div>
                )}
                <p className="k-small" style={{ textAlign: 'center', marginTop: 10 }}>
                  By placing your order you agree to our{' '}
                  <Link href="/terms" className="k-link" style={{ fontWeight: 500 }}>
                    terms
                  </Link>{' '}
                  and{' '}
                  <Link href="/privacy" className="k-link" style={{ fontWeight: 500 }}>
                    privacy notice
                  </Link>
                  .
                </p>
              </section>
            )}
          </div>
          <aside className={`k-ck-side${sumOpen ? ' open' : ''}`}>
            <h2 className="k-h2" style={{ fontSize: 19, marginBottom: 6 }}>
              Order summary
            </h2>
            <SummaryLines lines={quote.lines} />
            <PromoBox code={code} setCode={setCode} result={quote.code} />
            <Totals q={quote} />
            <Assure />
          </aside>
        </div>
      </div>
    </div>
  );
}

function AddressLookup({ onPick }: { onPick: (a: { line1: string; line2: string; city: string; postcode: string }) => void }) {
  const [pc, setPc] = useState('');
  const [msg, setMsg] = useState('');
  const [list, setList] = useState<{ line1: string; line2: string; city: string; postcode: string; label: string }[]>([]);
  const [busy, setBusy] = useState(false);
  return (
    <div className="k-field full">
      <span className="k-lab">
        Find your address <span className="opt">(UK)</span>
      </span>
      <div className="k-lookup">
        <input value={pc} onChange={(e) => setPc(e.target.value)} placeholder="Enter postcode" autoComplete="postal-code" aria-label="Postcode for address lookup" />
        <button
          type="button"
          className="k-btn sm ghost"
          disabled={busy}
          onClick={async () => {
            const v = pc.trim().toUpperCase();
            if (!UK_POSTCODE_RE.test(v)) {
              setMsg('Enter a full UK postcode, for example SW1A 1AA.');
              setList([]);
              return;
            }
            setBusy(true);
            setMsg('');
            try {
              const r = await fetch(`/api/address?postcode=${encodeURIComponent(v)}`);
              const j = await r.json();
              if (!r.ok || !j.addresses?.length) setMsg(j.error || 'No addresses found. Type your address below.');
              setList(j.addresses || []);
            } catch {
              setMsg('Lookup is unavailable. Type your address below.');
            }
            setBusy(false);
          }}
        >
          Find address
        </button>
      </div>
      {msg && (
        <span className="k-small" style={{ color: 'var(--k-bad)' }}>
          {msg}
        </span>
      )}
      {list.length > 0 && (
        <div className="k-addrlist">
          {list.map((a) => (
            <button
              type="button"
              key={a.label}
              onClick={() => {
                onPick(a);
                setList([]);
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
      <span className="hint">Or type your address below.</span>
    </div>
  );
}

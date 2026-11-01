import type { Metadata } from 'next';
import Link from 'next/link';
import { getCatalog } from '@/lib/catalog';
import { getSettings } from '@/lib/settings';
import { perVial, toClientProduct, type CatalogProduct } from '@/lib/catalog-types';
import { m2, money } from '@/lib/money';
import { cutoffLabel } from '@/lib/eta';
import { AddButton, OpenChatButton } from '@/components/shop/bits';
import { PackLadder } from '@/components/shop/pack-ladder';
import { LotLookupSplit } from '@/components/shop/lot-lookup';
import { CompareTable, TIMELINE } from '@/content/science';

export const metadata: Metadata = { alternates: { canonical: '/' } };

export default async function HomePage() {
  const [catalog, s] = await Promise.all([getCatalog(), getSettings()]);
  // The design pairs MT2 and MT1; if their codes are changed in the admin, fall back to the first two vials.
  const firstSingles = catalog.filter((p) => p.kind === 'single');
  const mt2 = catalog.find((p) => p.code === 'MT2') ?? firstSingles[0];
  const mt1 = catalog.find((p) => p.code === 'MT1') ?? firstSingles.find((p) => p !== mt2);
  const duo = catalog.find((p) => p.kind === 'bundle');
  const singles = [mt2, mt1].filter(Boolean) as CatalogProduct[];
  const lead = mt2 ?? catalog[0];
  const sep = (mt1?.packs[0]?.price ?? 0) + (mt2?.packs[0]?.price ?? 0);
  const ship = s.shipping.methods.find((m) => m.active);
  const currentLots = catalog.flatMap((p) => (p.kind === 'single' ? p.lots : []));
  const lotHint = currentLots.length ? `Try ${currentLots.map((l) => l.code).join(' or ')}.` : 'Lot numbers look like MT2-2611.';

  const faq: [string, string][] = [
    ['Who can order?', `Anyone ${s.checkout.minAge} or over buying for legitimate laboratory research. By ordering you confirm the products will not be used on people or animals.`],
    [
      'How fast do you ship?',
      `Orders placed before ${cutoffLabel(s.shipping.cutoffHour)} UK time on a working day are dispatched the same day${ship ? ` by Royal Mail ${ship.name}` : ''}, in a plain padded envelope.${ship ? ` Delivery is ${m2(ship.price)}, free over ${money(s.shipping.freeOver)}.` : ''}`,
    ],
    ['Is water included?', 'No. Vials contain lyophilised peptide only.'],
    [
      'What is the difference between MT1 and MT2?',
      'Melanotan I (afamelanotide) acts mainly on the skin pigment receptor and is licensed elsewhere as a prescription implant for a rare light sensitivity condition. Melanotan II acts on several receptors and is not licensed anywhere.',
    ],
    ['Can you advise on dosing?', 'No. Our vials are for laboratory research only, and we do not give dosing, reconstitution or usage advice.'],
    ['Can I return an order?', `Sealed, unopened vials can be returned within ${s.returnsDays} days of delivery for a refund.`],
  ];

  return (
    <>
      <section className="hero">
        <div className="wrap">
          <div>
            <span className="kick">UK supplier · Laboratory research only</span>
            <h1 className="disp" style={{ marginTop: 16 }}>
              Melanotan,
              <br />
              <span className="c">tested</span> lot by lot.
            </h1>
            <p className="lede">
              Melanotan I and Melanotan II in 10 mg vials, each lot verified by HPLC and mass spectrometry before it ships. Clear background on both
              compounds, honest about what regulators say.
            </p>
            <div className="cta">
              {lead?.packs[0] && (
                <Link className="btn" href={lead.href}>
                  Shop {lead.name} · from {m2(lead.packs[0].price)}
                </Link>
              )}
              <Link className="btn ghost" href="/science">
                MT1 vs MT2 explained
              </Link>
            </div>
            <div className="facts">
              <div>
                <b>≥99%</b>
                <span>HPLC purity, every lot</span>
              </div>
              <div>
                <b>{cutoffLabel(s.shipping.cutoffHour)}</b>
                <span>Same day dispatch cutoff</span>
              </div>
              <div>
                <b>{s.chat.enabled ? '24/7' : `${s.returnsDays} day`}</b>
                <span>{s.chat.enabled ? 'Instant replies' : 'Returns on sealed vials'}</span>
              </div>
            </div>
          </div>
          <div className="stage" aria-hidden="true">
            <span className="arc" />
            <span className="ring" />
            <span className="ring b" />
            <img className="a" src={mt1?.image ?? '/img/mt1.webp'} alt="" fetchPriority="high" />
            <img className="b" src={mt2?.image ?? '/img/mt2.webp'} alt="" fetchPriority="high" />
            {mt1?.lots[0] && (
              <span className="tag t1">
                MT1 · <b>{mt1.lots[0].purity}%</b> · lot {mt1.lots[0].code}
              </span>
            )}
            {mt2?.lots[0] && (
              <span className="tag t2">
                MT2 · <b>{mt2.lots[0].purity}%</b> · lot {mt2.lots[0].code}
              </span>
            )}
          </div>
        </div>
      </section>

      <section className="sec">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <span className="kick">The range</span>
              <h2 className="disp" style={{ marginTop: 10 }}>
                Two compounds.
                <br />
                One standard.
              </h2>
            </div>
            <p className="mute">
              Both vials hold 10 mg of lyophilised peptide, sealed under nitrogen, with the lot number printed on the label and the report online.
            </p>
          </div>
          <div className="pair">
            {singles.map((p) => {
              const last = p.packs[p.packs.length - 1];
              return (
                <article className="pc" key={p.id}>
                  {p.badge && <span className="badge">{p.badge}</span>}
                  <Link className="im" href={p.href} aria-label={p.fullName}>
                    <img src={p.image} alt="" loading="lazy" />
                  </Link>
                  <div className="t">
                    <span className="nm">{p.name} · 10 mg</span>
                    <h3 className="disp">{p.code}</h3>
                    <ul>
                      {p.highlights.map((x) => (
                        <li key={x}>{x}</li>
                      ))}
                    </ul>
                    <div className="pr">
                      <span>
                        <b>{m2(p.packs[0].price)}</b>
                        {last && last !== p.packs[0] && (
                          <small>
                            or {m2(perVial(p, last))} a vial in a {last.qty} pack
                          </small>
                        )}
                      </span>
                      <span style={{ display: 'flex', gap: 8 }}>
                        <Link className="btn ghost" href={p.href} style={{ minHeight: 46, padding: '0 16px' }}>
                          Details
                        </Link>
                        {p.stockUnits === 0 ? (
                          <Link className="btn ink" href={p.href} style={{ minHeight: 46, padding: '0 18px' }}>
                            Sold out
                          </Link>
                        ) : (
                          <AddButton packId={p.packs[0].id} className="btn ink" style={{ minHeight: 46, padding: '0 18px' }} />
                        )}
                      </span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          {duo?.packs[0] && sep > 0 && (
            <div className="duo-band">
              <div>
                <span className="kick">Side by side research</span>
                <h3 className="disp" style={{ marginTop: 6 }}>
                  The {duo.name}
                </h3>
                <p>One of each, both lot reports included. {m2(sep - duo.packs[0].price)} less than buying them separately.</p>
              </div>
              <div className="r">
                <span>
                  <b>{m2(duo.packs[0].price)}</b> <s>{m2(sep)}</s>
                </span>
                <Link className="btn" href={duo.href}>
                  View the duo
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>

      {lead && lead.packs.length > 1 && (
        <section className="sec dark">
          <PackLadder product={toClientProduct(lead)} />
        </section>
      )}

      <section className="sec">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <span className="kick">Side by side</span>
              <h2 className="disp" style={{ marginTop: 10 }}>
                MT1 vs MT2
              </h2>
            </div>
            <p className="mute">The two compounds are often confused. Here is how they differ, in plain terms.</p>
          </div>
          <CompareTable mt1={mt1} mt2={mt2} />
          <p style={{ marginTop: 22 }}>
            <Link className="link" href="/science">
              Read the full background
            </Link>
          </p>
        </div>
      </section>

      <section className="sec dark">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <span className="kick">History</span>
              <h2 className="disp" style={{ marginTop: 10 }}>
                From Arizona to the clinic
              </h2>
            </div>
            <p className="mute">Both compounds came out of the same research programme. Only one became a licensed medicine.</p>
          </div>
          <div className="tl">
            {TIMELINE.map(([y, t]) => (
              <div key={y}>
                <b>{y}</b>
                <p>{t}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="sec">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <span className="kick">Straight talk</span>
              <h2 className="disp" style={{ marginTop: 10 }}>
                What you should know
              </h2>
            </div>
          </div>
          <div className="cards">
            <div className="card">
              <h3 className="disp">Research only</h3>
              <p>
                Our vials are sold for in vitro laboratory research. They are not medicines and are not for human or veterinary use. We do not give dosing or
                usage advice.
              </p>
            </div>
            <div className="card warn">
              <h3 className="disp">Regulators warn</h3>
              <p>
                Melanotan II is not licensed anywhere. The UK MHRA and other regulators have warned the public not to use melanotan products sold online.{' '}
                <Link className="link" href="/science#regulators">
                  What they say
                </Link>
              </p>
            </div>
            <div className="card">
              <h3 className="disp">Not sun protection</h3>
              <p>
                Darker skin, however it is achieved, does not protect against UV. Use a broad spectrum sunscreen of SPF 30 or higher, and see a doctor about
                any mole that changes.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="sec dark" id="lot-lookup">
        <LotLookupSplit initial={mt2?.lots[0] ?? currentLots[0] ?? null} hint={lotHint} />
      </section>

      <section className="sec">
        <div className="wrap faq">
          <div>
            <span className="kick">FAQ</span>
            <h2 className="disp" style={{ fontSize: 'clamp(44px,5vw,72px)', marginTop: 10 }}>
              Questions
            </h2>
            <p className="mute" style={{ marginTop: 12 }}>
              {s.chat.enabled ? 'Instant answers any time from our assistant.' : 'Answers to the questions we hear most.'}
            </p>
            <OpenChatButton className="btn ink" style={{ marginTop: 8 }}>
              Ask a question
            </OpenChatButton>
          </div>
          <div>
            {faq.map(([q, a], i) => (
              <details key={q} open={i === 0}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

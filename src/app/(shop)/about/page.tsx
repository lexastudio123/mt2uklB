import type { Metadata } from 'next';
import Link from 'next/link';
import { getSettings } from '@/lib/settings';
import { ABOUT } from '@/content/help';
import { KitCrumbs } from '@/components/shop/trust';
import { SupportStrip } from '@/components/shop/support-strip';

export const metadata: Metadata = { title: 'About us', description: ABOUT.lede };

export default async function AboutPage() {
  const s = await getSettings();
  return (
    <div className="k-page">
      <div className="k-wrap">
        <KitCrumbs items={[['About us']]} />
        <div className="k-about-hero">
          <div>
            <h1 className="k-h1">{ABOUT.title}</h1>
            <p className="k-lede">{ABOUT.lede}</p>
            <div style={{ display: 'flex', gap: 10, marginTop: 22, flexWrap: 'wrap' }}>
              <Link className="k-btn" href="/shop">
                Shop the range
              </Link>
              <Link className="k-btn ghost" href="/contact">
                Contact us
              </Link>
            </div>
          </div>
          <div className="art">
            <img src="/img/duo.webp" alt="Melanotan I and Melanotan II vials" className="contain" />
          </div>
        </div>
        <div className="k-values four" style={{ marginTop: 56 }}>
          {ABOUT.values.map(([h, p]) => (
            <div key={h}>
              <b>{h}</b>
              <p>{p}</p>
            </div>
          ))}
        </div>
        <div className="k-grid2" style={{ marginTop: 56, gap: 40 }}>
          {ABOUT.story.map(([h, p]) => (
            <div key={h}>
              <h2 className="k-h2" style={{ fontSize: 24, marginBottom: 10 }}>
                {h}
              </h2>
              <p className="k-mute" style={{ margin: 0, lineHeight: 1.7 }}>
                {p}
              </p>
            </div>
          ))}
        </div>
        <SupportStrip chat={s.chat.enabled} />
        <p className="k-small" style={{ marginTop: 28 }}>
          {s.company.name} · {s.company.address} · Company number {s.company.number}
        </p>
      </div>
    </div>
  );
}

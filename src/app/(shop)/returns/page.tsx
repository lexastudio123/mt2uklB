import type { Metadata } from 'next';
import { getSettings } from '@/lib/settings';
import { returnsContent } from '@/content/help';
import { Faq, KitCrumbs } from '@/components/shop/trust';
import { SupportStrip } from '@/components/shop/support-strip';

export const metadata: Metadata = { title: 'Returns and refunds', description: 'Return sealed vials within the returns window for a refund.' };

export default async function ReturnsPage() {
  const s = await getSettings();
  const R = returnsContent(s);
  return (
    <div className="k-page">
      <div className="k-wrap k-narrow">
        <KitCrumbs items={[['Returns']]} />
        <h1 className="k-h1">Returns and refunds</h1>
        <p className="k-lede">{R.lede}</p>
        <ol className="k-steps3">
          <li>
            <b>Tell us</b>Message us within {s.returnsDays} days of delivery with your order number.
          </li>
          <li>
            <b>Send it back</b>We email a prepaid label for faulty or incorrect items.
          </li>
          <li>
            <b>Get your refund</b>Refunds go to your original payment method within 3 working days of arrival.
          </li>
        </ol>
        <div className="k-grid2" style={{ marginTop: 28 }}>
          <div className="k-card">
            <b className="k-h3">We accept</b>
            <ul style={{ margin: '10px 0 0', paddingLeft: 18, color: 'var(--k-mute)', lineHeight: 1.8, fontSize: 14.5 }}>
              {R.ok.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
          <div className="k-card">
            <b className="k-h3">We can&apos;t accept</b>
            <ul style={{ margin: '10px 0 0', paddingLeft: 18, color: 'var(--k-mute)', lineHeight: 1.8, fontSize: 14.5 }}>
              {R.no.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
        </div>
        <h2 className="k-h2" style={{ margin: '34px 0 6px' }}>
          Questions
        </h2>
        <Faq items={R.faq} />
        <SupportStrip chat={s.chat.enabled} />
      </div>
    </div>
  );
}

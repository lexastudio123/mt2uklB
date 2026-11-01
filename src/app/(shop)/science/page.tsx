import type { Metadata } from 'next';
import Link from 'next/link';
import { getCatalog } from '@/lib/catalog';
import { CompareTable, TIMELINE } from '@/content/science';
import { Crumbs } from '@/components/shop/trust';

export const metadata: Metadata = {
  title: 'MT1 and MT2 explained',
  description: 'What Melanotan I and Melanotan II are, where they came from, what research has found and what regulators say. Factual background only.',
  alternates: { canonical: '/science' },
};

const TOC: [string, string][] = [
  ['what', 'What they are'],
  ['compare', 'Side by side'],
  ['history', 'History'],
  ['research', 'Research'],
  ['regulators', 'Regulators'],
  ['risks', 'Reported risks'],
  ['sun', 'Sun safety'],
];

export default async function SciencePage() {
  const catalog = await getCatalog();
  const mt1 = catalog.find((p) => p.code === 'MT1');
  const mt2 = catalog.find((p) => p.code === 'MT2');
  return (
    <>
      <section className="dark" style={{ paddingBlock: '56px 48px' }}>
        <div className="wrap">
          <Crumbs dark items={[['The science']]} />
          <h1 className="disp" style={{ fontSize: 'clamp(56px,8vw,120px)', marginTop: 14 }}>
            MT1 and MT2,
            <br />
            <span style={{ color: 'var(--copper-hi)' }}>explained</span>
          </h1>
          <p className="mute" style={{ maxWidth: '62ch', marginTop: 18, fontSize: 17 }}>
            What the two compounds are, where they came from, what research has found and what regulators say. Factual background only; nothing here is
            medical advice.
          </p>
          <div className="toc">
            {TOC.map(([id, label]) => (
              <a key={id} href={`#${id}`} style={{ color: 'var(--crema)', borderColor: 'var(--line-d)' }}>
                {label}
              </a>
            ))}
          </div>
        </div>
      </section>
      <div className="wrap">
        <article className="article">
          <h2 className="disp" id="what">
            What they are
          </h2>
          <p>
            Melanotan I and Melanotan II are lab made versions of alpha melanocyte stimulating hormone (alpha MSH), the hormone that tells pigment cells in the
            skin to make melanin. They were designed to be more stable and longer lasting than the natural hormone.
          </p>
          <p>
            Both work through melanocortin receptors. Melanotan I acts mainly on MC1, the receptor in pigment cells. Melanotan II acts on several melanocortin
            receptors, including ones in the brain linked to appetite and sexual arousal, which is why its research went in a different direction.
          </p>
          <h2 className="disp" id="compare">
            Side by side
          </h2>
          <CompareTable mt1={mt1} mt2={mt2} />
          <h2 className="disp" id="history">
            History
          </h2>
          <ul>
            {TIMELINE.map(([y, t]) => (
              <li key={y}>
                <b>{y}:</b> {t}
              </li>
            ))}
          </ul>
          <h2 className="disp" id="research">
            What research has looked at
          </h2>
          <p>
            Afamelanotide went through full clinical trials and is a licensed prescription implant for adults with erythropoietic protoporphyria, a rare
            condition in which light causes severe pain. Trials found it increased the time people could spend in daylight without pain. It has also been studied
            in vitiligo and other light sensitive skin conditions.
          </p>
          <p>
            Melanotan II was only studied in small early trials in the 1990s. Because it acts on several receptors, those studies also recorded effects beyond
            pigment, including on appetite and sexual arousal. That work led to the separate medicine bremelanotide.
          </p>
          <h2 className="disp" id="regulators">
            What regulators say
          </h2>
          <p>
            Melanotan II is not a licensed medicine in the UK, the EU, the US or Australia. Regulators including the UK Medicines and Healthcare products
            Regulatory Agency (MHRA) and Australia&apos;s Therapeutic Goods Administration have warned the public not to buy or use melanotan products sold online,
            because their quality, contents and safety are unknown.
          </p>
          <p>
            Licensed afamelanotide (Scenesse) is a prescription only medicine, given as an implant by specialist centres. Research grade Melanotan I is not that
            product.
          </p>
          <h2 className="disp" id="risks">
            Reported risks
          </h2>
          <p>
            Published studies and case reports describe nausea, facial flushing, loss of appetite, darkening of existing moles and new moles in people using
            unlicensed melanotan. A small number of melanomas have been reported in users, although a direct cause has not been proven. These reports are one
            reason regulators warn against unlicensed use.
          </p>
          <h2 className="disp" id="sun">
            A tan is not sun protection
          </h2>
          <p>
            Darker skin, however it is achieved, does not protect against ultraviolet radiation. Use a broad spectrum sunscreen of SPF 30 or higher, seek shade in
            the middle of the day, and see a doctor about any mole that changes in size, shape or colour.
          </p>
          <h2 className="disp">How we sell them</h2>
          <p>
            Our vials are sold for in vitro laboratory research only, with a published lot report. They are not for human or veterinary use, and we do not give
            dosing, reconstitution or usage advice.
          </p>
          <h2 className="disp">Further reading</h2>
          <ul>
            <li>
              <a className="link" href="https://www.ema.europa.eu/en/medicines/human/EPAR/scenesse" target="_blank" rel="noopener">
                Scenesse (afamelanotide), European Medicines Agency
              </a>
            </li>
            <li>
              <a className="link" href="https://www.gov.uk/search/all?keywords=melanotan" target="_blank" rel="noopener">
                MHRA and GOV.UK on melanotan
              </a>
            </li>
            <li>
              <a className="link" href="https://pubmed.ncbi.nlm.nih.gov/?term=melanotan" target="_blank" rel="noopener">
                Published studies on PubMed
              </a>
            </li>
          </ul>
          <p style={{ marginTop: 36, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link className="btn ink" href="/shop">
              Shop research vials
            </Link>
            <Link className="btn ghost" href="/lot-reports">
              Check a lot report
            </Link>
          </p>
        </article>
      </div>
    </>
  );
}

import { getSettings } from '@/lib/settings';
import { legal, type LegalKind } from '@/content/legal';
import { KitCrumbs } from './trust';

export async function LegalPage({ kind }: { kind: LegalKind }) {
  const s = await getSettings();
  const { title, sections } = legal(kind, s);
  const anchor = (t: string) => t.toLowerCase().replace(/[^a-z]+/g, '-');
  return (
    <div className="k-page">
      <div className="k-wrap">
        <KitCrumbs items={[[title]]} />
        <div className="k-legal">
          <h1 className="k-h1">{title}</h1>
          {!s.legalReviewed && <div className="k-note" style={{ margin: '20px 0 6px' }}>Template. Have a solicitor review and complete it before launch.</div>}
          <nav className="k-toc" aria-label="Sections">
            {sections.map(([h]) => (
              <a key={h} href={`#${anchor(h)}`}>
                {h}
              </a>
            ))}
          </nav>
          {sections.map(([h, body]) => (
            <section key={h}>
              <h2 id={anchor(h)}>{h}</h2>
              {typeof body === 'string' ? <p>{body}</p> : body}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

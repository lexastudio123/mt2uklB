// Lot report card. Works in server and client components (no hooks).
import type { LotInfo } from '@/lib/catalog-types';
import { IconFile } from '../icons';

export const fdateLong = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/London' });

/**
 * Illustrative HPLC trace for SAMPLE lots only (as in the design preview).
 * Real lots show the uploaded certificate instead: we never draw a made-up chart for real data.
 */
function SampleChromatogram({ lot }: { lot: LotInfo }) {
  const w = 560;
  const h = 170;
  const seed = lot.productCode === 'MT1' ? 7 : 3;
  let R = seed;
  const rnd = () => {
    R = (R * 9301 + 49297) % 233280;
    return R / 233280;
  };
  const main = Number(lot.retention) || (lot.productCode === 'MT1' ? 11.8 : 9.6);
  let d = `M0 ${h - 14}`;
  for (let x = 0; x <= w; x += 2) {
    const t = (x / w) * 20;
    let y = 1.5 * Math.sin(t * 3 + seed) + rnd() * 1.2;
    y += 128 * Math.exp(-Math.pow((t - main) / 0.13, 2));
    y += 6 * Math.exp(-Math.pow((t - main + 1.6) / 0.1, 2));
    y += 3.5 * Math.exp(-Math.pow((t - main + 3.9) / 0.12, 2));
    d += ` L${x} ${(h - 14 - y).toFixed(1)}`;
  }
  return (
    <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Illustrative HPLC chromatogram, main peak at ${main} minutes`}>
      <rect width={w} height={h} fill="#1A120D" />
      {[1, 2, 3].map((i) => (
        <line key={i} x1="0" x2={w} y1={(i * (h - 14)) / 4} y2={(i * (h - 14)) / 4} stroke="#F4E9DC" strokeOpacity=".06" />
      ))}
      <path d={d} fill="none" stroke="#E9A877" strokeWidth="1.4" />
      <text x={(main / 20) * w + 8} y="20" fontSize="10" fill="#F4E9DC" fontFamily="var(--mono)">
        {lot.productCode} · {main} min · {lot.purity}%
      </text>
      {[0, 5, 10, 15, 20].map((v) => (
        <text key={v} x={(v / 20) * w} y={h - 2} fontSize="9" fill="#B7A390" fontFamily="var(--mono)" textAnchor={v === 0 ? 'start' : v === 20 ? 'end' : 'middle'}>
          {v} min
        </text>
      ))}
    </svg>
  );
}

const isImage = (url: string) => /\.(png|jpe?g|webp|gif)(\?|$)/i.test(url);

export function LotReport({ lot }: { lot: LotInfo }) {
  return (
    <div className="report">
      <div className="hd">
        <span>
          Lot <b>{lot.code}</b>
          {lot.isSample && <span className="sample">Sample data</span>}
        </span>
        <span>
          Tested <b>{fdateLong(lot.testedAt)}</b>
        </span>
      </div>
      {lot.reportUrl && isImage(lot.reportUrl) ? (
        <a href={lot.reportUrl} target="_blank" rel="noopener" style={{ display: 'block', marginTop: 14 }}>
          <img src={lot.reportUrl} alt={`Certificate of analysis for lot ${lot.code}`} style={{ width: '100%', borderRadius: 3, background: '#fff' }} />
        </a>
      ) : lot.isSample ? (
        <SampleChromatogram lot={lot} />
      ) : null}
      <dl>
        <div>
          <dt>Purity (HPLC)</dt>
          <dd>{lot.purity}%</dd>
        </div>
        <div>
          <dt>Identity (MS)</dt>
          <dd>{lot.massDa ? `${lot.massDa} Da` : 'Confirmed'}</dd>
        </div>
        <div>
          <dt>Content</dt>
          <dd>{lot.content || '·'}</dd>
        </div>
        <div>
          <dt>Endotoxin</dt>
          <dd>{lot.endotoxin || '·'}</dd>
        </div>
      </dl>
      {lot.reportUrl && !isImage(lot.reportUrl) && (
        <a className="report-cert" href={lot.reportUrl} target="_blank" rel="noopener">
          <IconFile width={18} height={18} /> View the certificate of analysis{lot.lab ? ` from ${lot.lab}` : ''}
        </a>
      )}
    </div>
  );
}

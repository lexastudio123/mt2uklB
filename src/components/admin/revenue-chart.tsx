'use client';

import { useState } from 'react';
import { compactPounds } from '@/lib/admin/format';
import { m2 } from '@/lib/money';

type Pt = { key: string; label: string; long: string; revenue: number; orders: number };

/** Clean y-axis scale in pence: steps of 1, 2, 2.5 or 5 × 10ⁿ. */
function scale(maxPence: number) {
  const max = Math.max(maxPence, 10000);
  const rough = max / 4;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((s) => s * pow).find((s) => s >= rough) ?? rough;
  return { top: step * Math.ceil(max / step), step };
}

/** Single-series column chart: one copper hue, 4px rounded data ends, hover and focus tooltip. */
export function RevenueChart({ data }: { data: Pt[] }) {
  const [hi, setHi] = useState<number | null>(null);
  const W = 760, H = 236, L = 50, R = 6, T = 22, B = 28;
  const pw = W - L - R;
  const ph = H - T - B;
  const max = Math.max(0, ...data.map((d) => d.revenue));
  const { top, step } = scale(max);
  const ticks: number[] = [];
  for (let v = 0; v <= top + 0.5; v += step) ticks.push(v);
  const slot = pw / data.length;
  const bw = Math.min(24, Math.max(4, slot - 2));
  const y = (v: number) => T + ph - (v / top) * ph;
  const maxIdx = max > 0 ? data.map((d) => d.revenue).lastIndexOf(max) : -1;
  const path = (x: number, v: number) => {
    const h = (v / top) * ph;
    if (h <= 0) return null;
    const r = Math.min(4, h, bw / 2);
    const yt = T + ph - h;
    return `M${x} ${T + ph}L${x} ${yt + r}Q${x} ${yt} ${x + r} ${yt}L${x + bw - r} ${yt}Q${x + bw} ${yt} ${x + bw} ${yt + r}L${x + bw} ${T + ph}Z`;
  };
  const tick = (i: number) => (data.length - 1 - i) % 5 === 0;
  const h = hi !== null ? data[hi] : null;

  return (
    <div className="a-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label={`Revenue per day for the last ${data.length} days. Use the table below for exact values.`}>
        {ticks.map((v) => (
          <g key={v} aria-hidden="true">
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke={v === 0 ? '#CDBFAF' : '#EEE6DC'} strokeWidth="1" shapeRendering="crispEdges" />
            <text x={L - 8} y={y(v) + 3.5} textAnchor="end" fontSize="10.5" fill="#6B5646" fontFamily="var(--mono)">
              {compactPounds(v)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = L + i * slot + (slot - bw) / 2;
          const p = path(x, d.revenue);
          return (
            <g
              key={d.key}
              className="slot"
              tabIndex={0}
              role="img"
              aria-label={`${d.long}: ${m2(d.revenue)} from ${d.orders} ${d.orders === 1 ? 'order' : 'orders'}`}
              onPointerEnter={() => setHi(i)}
              onPointerLeave={() => setHi((cur) => (cur === i ? null : cur))}
              onFocus={() => setHi(i)}
              onBlur={() => setHi((cur) => (cur === i ? null : cur))}
            >
              <rect className="hit" x={L + i * slot} y={T} width={slot} height={ph} fill="transparent" />
              {p && <path className="bar" d={p} />}
              {tick(i) && (
                <text x={x + bw / 2} y={H - 8} textAnchor="middle" fontSize="10.5" fill="#6B5646" fontFamily="var(--mono)">
                  {d.label}
                </text>
              )}
            </g>
          );
        })}
        {maxIdx >= 0 && (
          <text x={L + maxIdx * slot + slot / 2} y={y(max) - 7} textAnchor="middle" fontSize="11" fontWeight="600" fill="#1A120D" fontFamily="var(--mono)" aria-hidden="true">
            {compactPounds(max)}
          </text>
        )}
      </svg>
      {h && hi !== null && (
        <div className="a-tip" style={{ left: `${((L + hi * slot + slot / 2) / W) * 100}%`, top: `${(Math.min(y(h.revenue), T + ph - 4) / H) * 100}%` }}>
          <b>{m2(h.revenue)}</b>
          {h.orders} {h.orders === 1 ? 'order' : 'orders'} · {h.long}
        </div>
      )}
      {max === 0 && <div className="a-chartnote">No paid orders in the last {data.length} days yet</div>}
    </div>
  );
}

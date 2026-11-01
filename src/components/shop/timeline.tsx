// Four-step order progress from the design (placed, packed, dispatched, delivered).
const STEPS: [string, string][] = [
  ['Order placed', 'We have your order'],
  ['Packed', 'Checked and sealed'],
  ['Dispatched', 'Tracking link sent'],
  ['Delivered', 'Signed for'],
];

export function Timeline({ stage, dates }: { stage: number; dates?: string[] }) {
  return (
    <ol className="k-timeline">
      {STEPS.map(([t, s], i) => (
        <li key={t} className={i < stage ? 'done' : i === stage ? 'now' : ''}>
          <b>{t}</b>
          {dates?.[i] || s}
        </li>
      ))}
    </ol>
  );
}

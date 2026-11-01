'use client';

export function PrintButton() {
  return (
    <button className="k-btn sm" onClick={() => window.print()}>
      Print or save as PDF
    </button>
  );
}

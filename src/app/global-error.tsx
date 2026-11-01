'use client';

// Last-resort error page if the root layout itself fails.
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en-GB">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#16100C', color: '#F4E9DC', minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <div style={{ textAlign: 'center', padding: 24 }}>
          <h1 style={{ textTransform: 'uppercase', letterSpacing: '.02em' }}>Something went wrong</h1>
          <p style={{ color: '#B7A390' }}>Please try again in a moment.</p>
          <button onClick={reset} style={{ marginTop: 16, padding: '12px 22px', border: 0, borderRadius: 4, background: '#C8794A', color: '#1A0E06', fontWeight: 700, cursor: 'pointer' }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}

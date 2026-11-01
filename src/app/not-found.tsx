import Link from 'next/link';

// Fallback 404 for routes outside the shop layout (invoices, admin).
export default function NotFound() {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bean)', color: 'var(--crema)', padding: 24 }}>
      <div style={{ textAlign: 'center' }}>
        <div className="logo" style={{ justifyContent: 'center' }}>
          MT2 LAB<small>UK</small>
        </div>
        <h1 className="disp" style={{ fontSize: 'clamp(48px,8vw,96px)', marginTop: 24 }}>
          Not found
        </h1>
        <p style={{ color: 'var(--dust)', marginTop: 12 }}>This link may be out of date.</p>
        <p style={{ marginTop: 24 }}>
          <Link className="btn" href="/">
            Go to the shop
          </Link>
        </p>
      </div>
    </div>
  );
}

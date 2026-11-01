import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="wrap ph" style={{ paddingBlock: 96 }}>
      <h1 className="disp">Page not found</h1>
      <p className="mute" style={{ marginTop: 12 }}>
        The link may be out of date.
      </p>
      <p style={{ marginTop: 24, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Link className="btn ink" href="/shop">
          Go to the shop
        </Link>
        <Link className="btn ghost" href="/help">
          Help centre
        </Link>
      </p>
    </div>
  );
}

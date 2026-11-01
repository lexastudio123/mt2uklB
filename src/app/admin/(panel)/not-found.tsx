import Link from 'next/link';

export default function AdminNotFound() {
  return (
    <div className="a-empty" style={{ marginTop: 20 }}>
      <b>Not found</b>
      <p style={{ margin: 0 }}>That record does not exist, or it was deleted.</p>
      <Link className="a-btn ghost" href="/admin" style={{ marginTop: 14 }}>
        Back to the dashboard
      </Link>
    </div>
  );
}

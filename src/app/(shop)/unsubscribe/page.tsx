import type { Metadata } from 'next';
import Link from 'next/link';
import { db } from '@/lib/db';
import { unsubscribe } from './actions';

export const metadata: Metadata = { title: 'Unsubscribe', robots: { index: false } };

export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ t?: string; done?: string }> }) {
  const { t = '', done } = await searchParams;
  const sub = t ? await db.subscriber.findUnique({ where: { token: t } }) : null;
  return (
    <div className="k-page">
      <div className="k-wrap k-narrow">
        <h1 className="k-h1">Email preferences</h1>
        {!sub ? (
          <p className="k-lede">This link is not valid any more. You can manage alerts from your account, or contact us and we will remove you.</p>
        ) : done || sub.unsubscribedAt ? (
          <>
            <p className="k-lede">
              {sub.email} is unsubscribed. You will still get emails about orders you place.
            </p>
            <Link className="k-btn" href="/" style={{ marginTop: 20 }}>
              Back to the shop
            </Link>
          </>
        ) : (
          <>
            <p className="k-lede">Stop new lot alerts and offers to {sub.email}?</p>
            <form action={unsubscribe} style={{ marginTop: 20 }}>
              <input type="hidden" name="t" value={t} />
              <button className="k-btn">Unsubscribe</button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

import Link from 'next/link';
import { IconChat } from '../icons';
import { OpenChatButton } from './bits';

export function SupportStrip({ chat }: { chat: boolean }) {
  return (
    <div className="k-card" style={{ display: 'flex', gap: 16, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', marginTop: 28 }}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        <span style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--k-well)', display: 'grid', placeItems: 'center', flex: 'none' }}>
          <IconChat width={22} height={22} />
        </span>
        <span>
          <b style={{ display: 'block', color: 'var(--k-ink)' }}>{chat ? 'Support 24 hours a day, 7 days a week' : 'Questions? We are here to help'}</b>
          <span className="k-small">{chat ? 'Instant replies from our assistant, with a person on hand when you need one.' : 'Send a message and the team replies by email, every day.'}</span>
        </span>
      </div>
      {chat ? (
        <OpenChatButton className="k-btn">Chat now</OpenChatButton>
      ) : (
        <Link className="k-btn" href="/contact">
          Contact us
        </Link>
      )}
    </div>
  );
}

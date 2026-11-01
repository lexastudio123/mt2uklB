// Presentational blocks shared by product, basket and checkout pages (no hooks).
import { Icon, IconLock, type IconName } from '../icons';

export function Trust({ items }: { items: { icon: IconName; t: string; s: string }[] }) {
  return (
    <div className="k-trust" style={{ ['--n' as string]: items.length }}>
      {items.map((x) => (
        <div key={x.t}>
          <Icon name={x.icon} />
          <span>
            <b>{x.t}</b>
            {x.s}
          </span>
        </div>
      ))}
    </div>
  );
}

export function PayBadges({ card, bank }: { card: boolean; bank: boolean }) {
  const badges = [...(card ? ['Visa', 'Mastercard', 'Amex', 'Apple Pay'] : []), ...(bank ? ['Bank transfer'] : [])];
  return (
    <div className="k-pay">
      <IconLock width={15} height={15} />
      <span style={{ border: 0, background: 'none', padding: 0, fontWeight: 500, color: 'inherit' }}>Secure checkout</span>
      {badges.map((b) => (
        <span key={b}>{b}</span>
      ))}
    </div>
  );
}

export function Faq({ items, kit = true }: { items: [string, React.ReactNode][]; kit?: boolean }) {
  return (
    <div className={kit ? 'k-faq' : undefined}>
      {items.map(([q, a]) => (
        <details key={q}>
          <summary>{q}</summary>
          <p>{a}</p>
        </details>
      ))}
    </div>
  );
}

export function Crumbs({ items, dark }: { items: [string, string?][]; dark?: boolean }) {
  return (
    <nav className="crumbs" aria-label="Breadcrumb" style={dark ? { color: 'var(--dust)' } : undefined}>
      <a href="/">Home</a>
      {items.map(([label, href]) => (
        <span key={label} style={{ display: 'contents' }}>
          <span aria-hidden="true">/</span>
          {href ? <a href={href}>{label}</a> : <span>{label}</span>}
        </span>
      ))}
    </nav>
  );
}

export function KitCrumbs({ items }: { items: [string, string?][] }) {
  return (
    <nav className="k-crumbs" aria-label="Breadcrumb">
      <a href="/">Home</a>
      {items.map(([label, href]) => (
        <span key={label} style={{ display: 'contents' }}>
          <span aria-hidden="true">/</span>
          {href ? <a href={href}>{label}</a> : <span>{label}</span>}
        </span>
      ))}
    </nav>
  );
}

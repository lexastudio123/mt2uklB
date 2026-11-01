// Presentational admin pieces (server components, no hooks).
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ORDER_LABEL, ORDER_TONE, PAYMENT_STATUS_LABEL, PAYMENT_TONE, TICKET_LABEL, TICKET_TONE } from '@/lib/admin/format';
import { AdminIcon } from './icons';

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

export function PageHead({
  title,
  sub,
  crumbs,
  actions,
  after,
}: {
  title: ReactNode;
  sub?: ReactNode;
  crumbs?: [string, string?][];
  actions?: ReactNode;
  after?: ReactNode;
}) {
  return (
    <div className="a-head">
      <div style={{ minWidth: 0 }}>
        {crumbs && crumbs.length > 0 && (
          <nav className="a-crumbs" aria-label="Breadcrumb">
            {crumbs.map(([label, href], i) => (
              <span key={i} style={{ display: 'contents' }}>
                {i > 0 && <span aria-hidden="true">/</span>}
                {href ? <Link href={href}>{label}</Link> : <span>{label}</span>}
              </span>
            ))}
          </nav>
        )}
        <h1 className="a-h1">
          {title}
          {after}
        </h1>
        {sub && <p className="a-sub">{sub}</p>}
      </div>
      {actions && <div className="a-actions">{actions}</div>}
    </div>
  );
}

export function Flash({ sp }: { sp: SP }) {
  const ok = one(sp.ok);
  const err = one(sp.err);
  const denied = one(sp.denied);
  if (!ok && !err && !denied) return null;
  return (
    <div className={`a-flash ${err || denied ? 'err' : 'ok'}`} role={err || denied ? 'alert' : 'status'}>
      <AdminIcon name={err || denied ? 'alert' : 'tick'} />
      <span>{denied ? 'Your role does not have access to that page.' : err || ok}</span>
    </div>
  );
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'ok' | 'err'; children: ReactNode }) {
  return (
    <div className={`a-flash ${tone}`}>
      <AdminIcon name={tone === 'ok' ? 'tick' : 'alert'} />
      <span>{children}</span>
    </div>
  );
}

export const Pill = ({ tone = '', children, plain }: { tone?: string; children: ReactNode; plain?: boolean }) => (
  <span className={`a-pill ${tone}${plain ? ' plain' : ''}`}>{children}</span>
);

export const OrderPill = ({ status }: { status: string }) => <Pill tone={ORDER_TONE[status] ?? ''}>{ORDER_LABEL[status] ?? status}</Pill>;
export const PaymentPill = ({ status }: { status: string }) => <Pill tone={PAYMENT_TONE[status] ?? ''}>{PAYMENT_STATUS_LABEL[status] ?? status}</Pill>;
export const TicketPill = ({ status }: { status: string }) => <Pill tone={TICKET_TONE[status] ?? ''}>{TICKET_LABEL[status] ?? status}</Pill>;

export function Tabs({ items }: { items: { href: string; label: string; n?: number; active: boolean }[] }) {
  return (
    <nav className="a-tabs" aria-label="Filter">
      {items.map((t) => (
        <Link key={t.href + t.label} href={t.href} aria-current={t.active ? 'page' : undefined}>
          {t.label}
          {t.n !== undefined && <span className="n">{t.n}</span>}
        </Link>
      ))}
    </nav>
  );
}

export function Pager({ page, total, per, href }: { page: number; total: number; per: number; href: (p: number) => string }) {
  const pages = Math.max(1, Math.ceil(total / per));
  if (total <= per) return total ? <div className="a-pager">{total} {total === 1 ? 'result' : 'results'}</div> : null;
  const from = (page - 1) * per + 1;
  const to = Math.min(total, page * per);
  return (
    <div className="a-pager">
      <span>
        {from}–{to} of {total}
      </span>
      <span className="a-actions">
        <Link className="a-btn ghost sm" href={href(page - 1)} aria-disabled={page <= 1}>
          Previous
        </Link>
        <span>
          Page {page} of {pages}
        </span>
        <Link className="a-btn ghost sm" href={href(page + 1)} aria-disabled={page >= pages}>
          Next
        </Link>
      </span>
    </div>
  );
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="a-empty">
      <b>{title}</b>
      {children}
      {action && <div>{action}</div>}
    </div>
  );
}

export function Thumb({ src, wide }: { src: string; wide?: boolean }) {
  return (
    <span className={`a-thumb${wide ? ' wide' : ''}`}>
      <img src={src} alt="" />
    </span>
  );
}

export function Field({ label, hint, children, opt, className }: { label: string; hint?: ReactNode; children: ReactNode; opt?: boolean; className?: string }) {
  return (
    <div className={`a-field ${className ?? ''}`}>
      <label>
        {label}
        {opt && <span className="opt"> (optional)</span>}
      </label>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

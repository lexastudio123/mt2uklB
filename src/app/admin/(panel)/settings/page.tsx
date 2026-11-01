import Link from 'next/link';
import { db } from '@/lib/db';
import { getSettings } from '@/lib/settings';
import { getConnections, keyHint } from '@/lib/connections';
import { encryptionOn } from '@/lib/crypto';
import { siteUrl } from '@/lib/site';
import { toPounds } from '@/lib/money';
import { can, requireArea } from '@/lib/admin/perms';
import { sp1, type SP } from '@/lib/admin/queries';
import { Flash, Notice, PageHead, Pill, Tabs } from '@/components/admin/ui';
import { SubmitButton } from '@/components/admin/client';
import {
  removeSimpleKeyAction,
  removeStripeKeysAction,
  saveChatAction,
  saveCheckoutAction,
  saveDeliveryAction,
  saveMarketingAction,
  saveOtherAction,
  savePaymentsAction,
  saveReferralAction,
  saveStoreAction,
  saveAffiliateSettingsAction,
  saveSimpleKeyAction,
  saveStripeKeysAction,
} from './actions';
import { EmailConnectionForm } from './email-form';

export const metadata = { title: 'Settings' };

const TABS: [string, string][] = [
  ['store', 'Store'],
  ['delivery', 'Delivery'],
  ['payments', 'Payments'],
  ['connections', 'Connections'],
  ['checkout', 'Checkout'],
  ['marketing', 'Marketing'],
  ['referral', 'Referrals'],
  ['affiliates', 'Affiliates'],
  ['chat', 'Chat'],
  ['other', 'Returns and VAT'],
];

const Save = ({ label = 'Save' }: { label?: string }) => (
  <div className="a-formfoot">
    <SubmitButton className="a-btn copper" pending="Saving…">
      {label}
    </SubmitButton>
  </div>
);

const Status = ({ ok, yes, no }: { ok: boolean; yes: string; no: string }) => <Pill tone={ok ? 'green' : 'amber'}>{ok ? yes : no}</Pill>;

const STRIPE_EVENTS = 'checkout.session.completed, checkout.session.async_payment_succeeded, checkout.session.async_payment_failed, checkout.session.expired, charge.refunded';
const testKey = (k: string | null) => !!k && /^(sk|rk)_test_/.test(k);

export default async function SettingsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const admin = await requireArea('settings');
  const sp = await searchParams;
  const tab = TABS.some(([k]) => k === sp1(sp, 'tab')) ? sp1(sp, 'tab') : 'store';
  const [s, c] = await Promise.all([getSettings(), getConnections()]);
  const owner = can(admin, 'connections');
  const welcome = tab === 'marketing' ? await db.discountCode.findUnique({ where: { code: s.marketing.welcomeCode } }) : null;
  const methods = [...s.shipping.methods];

  return (
    <>
      <PageHead title="Settings" sub="How the shop runs. Changes apply straight away." />
      <Flash sp={sp} />
      <Tabs items={TABS.map(([k, label]) => ({ href: `/admin/settings?tab=${k}`, label, active: tab === k }))} />

      {tab === 'store' && (
        <form action={saveStoreAction} className="a-stack" style={{ maxWidth: 900 }}>
          <div className="a-card">
            <h2 className="a-h2">Shop</h2>
            <div className="a-form">
              <div className="a-row2">
                <div className="a-field">
                  <label htmlFor="storeName">Shop name</label>
                  <input id="storeName" name="storeName" defaultValue={s.storeName} required maxLength={60} />
                </div>
                <div className="a-field">
                  <label htmlFor="phone">
                    Phone <span className="opt">(optional)</span>
                  </label>
                  <input id="phone" name="phone" defaultValue={s.phone} maxLength={40} />
                </div>
              </div>
              <div className="a-row2">
                <div className="a-field">
                  <label htmlFor="supportEmail">Support email (shown to customers, replies go here)</label>
                  <input id="supportEmail" name="supportEmail" type="email" defaultValue={s.supportEmail} required />
                </div>
                <div className="a-field">
                  <label htmlFor="notifyEmail">
                    Team notifications to <span className="opt">(optional)</span>
                  </label>
                  <input id="notifyEmail" name="notifyEmail" type="email" defaultValue={s.notifyEmail} placeholder={s.supportEmail} />
                  <span className="hint">New orders and messages are emailed here. Leave empty to use the support email.</span>
                </div>
              </div>
              <div className="a-field">
                <label htmlFor="announcement">
                  Notice bar message <span className="opt">(optional)</span>
                </label>
                <input id="announcement" name="announcement" defaultValue={s.announcement} maxLength={140} placeholder="Free tracked delivery over £50 · 24/7 support, instant replies" />
                <span className="hint">Replaces the right-hand side of the copper bar at the top of every page. Leave empty for the default.</span>
              </div>
            </div>
          </div>
          <div className="a-card">
            <h2 className="a-h2">Company (footer, invoices and legal pages)</h2>
            <div className="a-form">
              <div className="a-row2">
                <div className="a-field">
                  <label htmlFor="companyName">Registered company name</label>
                  <input id="companyName" name="companyName" defaultValue={s.company.name} maxLength={120} />
                </div>
                <div className="a-field mono">
                  <label htmlFor="companyNumber">Company number</label>
                  <input id="companyNumber" name="companyNumber" defaultValue={s.company.number} maxLength={20} />
                </div>
              </div>
              <div className="a-field">
                <label htmlFor="companyAddress">Registered office address</label>
                <input id="companyAddress" name="companyAddress" defaultValue={s.company.address} maxLength={240} />
              </div>
              <div className="a-row2">
                <div className="a-field">
                  <label htmlFor="companyJurisdiction">Registered in</label>
                  <input id="companyJurisdiction" name="companyJurisdiction" defaultValue={s.company.jurisdiction} maxLength={60} />
                </div>
                <div className="a-field mono">
                  <label htmlFor="vatNumber">
                    VAT number <span className="opt">(if registered)</span>
                  </label>
                  <input id="vatNumber" name="vatNumber" defaultValue={s.company.vatNumber} maxLength={20} placeholder="GB123456789" />
                  <span className="hint">When set, invoices show the VAT included in each price.</span>
                </div>
              </div>
            </div>
          </div>
          <div className="a-card">
            <h2 className="a-h2">Launch</h2>
            <div className="a-form">
              <label className="a-check">
                <input type="checkbox" name="noindex" defaultChecked={s.noindex} />
                <span>
                  Hide the shop from search engines
                  <small>Keep this on while you set up. Turn it off when you launch.</small>
                </span>
              </label>
              <label className="a-check">
                <input type="checkbox" name="legalReviewed" defaultChecked={s.legalReviewed} />
                <span>
                  Terms, privacy and cookie pages have been reviewed by a solicitor
                  <small>Removes the “template” note from those pages.</small>
                </span>
              </label>
              <label className="a-check">
                <input type="checkbox" name="showSampleNotice" defaultChecked={s.showSampleNotice} />
                <span>
                  Show the “sample data” note in the footer
                  <small>Turn off once your real lot reports are in.</small>
                </span>
              </label>
            </div>
          </div>
          <Save label="Save store details" />
        </form>
      )}

      {tab === 'delivery' && (
        <form action={saveDeliveryAction} className="a-stack" style={{ maxWidth: 1000 }}>
          <input type="hidden" name="methodCount" value={methods.length} />
          <div className="a-card">
            <h2 className="a-h2">Dispatch</h2>
            <div className="a-row3">
              <div className="a-field mono">
                <label htmlFor="freeOver">Free delivery over (£)</label>
                <input id="freeOver" name="freeOver" inputMode="decimal" defaultValue={toPounds(s.shipping.freeOver)} />
              </div>
              <div className="a-field mono">
                <label htmlFor="cutoffHour">Same day dispatch cutoff (hour, UK time)</label>
                <input id="cutoffHour" name="cutoffHour" type="number" min={0} max={23} defaultValue={s.shipping.cutoffHour} />
                <span className="hint">15 means 3pm.</span>
              </div>
              <div className="a-field">
                <span className="a-lab">Countries</span>
                <span className="a-input" style={{ display: 'flex', alignItems: 'center', background: 'var(--oat)' }}>
                  {s.shipping.countries.join(', ')}
                </span>
                <span className="hint">UK only. International delivery needs extra work on rates and customs.</span>
              </div>
            </div>
          </div>
          <div className="a-card">
            <h2 className="a-h2">Delivery options</h2>
            <p className="a-small" style={{ margin: '-4px 0 8px' }}>
              Shown at checkout in this order. Days are working days after dispatch.
            </p>
            {[...methods, null].map((m, i) => (
              <fieldset key={i} className="a-fieldset" style={{ marginTop: 12, background: m ? '#fff' : '#FBF6EF' }}>
                <legend>{m ? m.name : 'Add a delivery option'}</legend>
                <div className="a-form">
                  <div className="a-row4">
                    <div className="a-field">
                      <label htmlFor={`m${i}_name`}>Name</label>
                      <input id={`m${i}_name`} name={`m${i}_name`} defaultValue={m?.name ?? ''} maxLength={60} placeholder={m ? '' : 'e.g. Tracked 48'} />
                    </div>
                    <div className="a-field mono">
                      <label htmlFor={`m${i}_id`}>Id</label>
                      <input id={`m${i}_id`} name={`m${i}_id`} defaultValue={m?.id ?? ''} maxLength={20} readOnly={!!m} placeholder="tracked-48" />
                    </div>
                    <div className="a-field mono">
                      <label htmlFor={`m${i}_price`}>Price (£)</label>
                      <input id={`m${i}_price`} name={`m${i}_price`} inputMode="decimal" defaultValue={m ? toPounds(m.price) : ''} />
                    </div>
                    <div className="a-row2" style={{ gap: 8 }}>
                      <div className="a-field mono">
                        <label htmlFor={`m${i}_min`}>Days from</label>
                        <input id={`m${i}_min`} name={`m${i}_min`} type="number" min={0} max={30} defaultValue={m?.min ?? 1} />
                      </div>
                      <div className="a-field mono">
                        <label htmlFor={`m${i}_max`}>to</label>
                        <input id={`m${i}_max`} name={`m${i}_max`} type="number" min={0} max={30} defaultValue={m?.max ?? 2} />
                      </div>
                    </div>
                  </div>
                  <div className="a-field">
                    <label htmlFor={`m${i}_note`}>Description</label>
                    <input id={`m${i}_note`} name={`m${i}_note`} defaultValue={m?.note ?? ''} maxLength={120} placeholder="Royal Mail, plain padded envelope" />
                  </div>
                  <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
                    <label className="a-check">
                      <input type="checkbox" name={`m${i}_freeOver`} defaultChecked={m ? m.freeOver : true} />
                      Free above the threshold
                    </label>
                    <label className="a-check">
                      <input type="checkbox" name={`m${i}_active`} defaultChecked={m ? m.active : true} />
                      Offered at checkout
                    </label>
                    {m && (
                      <label className="a-check" style={{ color: 'var(--a-bad)' }}>
                        <input type="checkbox" name={`m${i}_remove`} />
                        Remove
                      </label>
                    )}
                  </div>
                </div>
              </fieldset>
            ))}
          </div>
          <div className="a-card">
            <h2 className="a-h2">Closed days</h2>
            <div className="a-row2">
              <div className="a-field mono">
                <label htmlFor="closedDates">No dispatch on these dates (one YYYY-MM-DD per line)</label>
                <textarea id="closedDates" name="closedDates" defaultValue={s.shipping.closedDates.join('\n')} style={{ minHeight: 200 }} />
                <span className="hint">Bank holidays for England and Wales are filled in for 2026 and 2027. Weekends are always closed.</span>
              </div>
              <div className="a-field">
                <label htmlFor="packaging">Packaging (Delivery page)</label>
                <textarea id="packaging" name="packaging" defaultValue={s.shipping.packaging} maxLength={400} style={{ minHeight: 200 }} />
              </div>
            </div>
          </div>
          <Save label="Save delivery settings" />
        </form>
      )}

      {tab === 'payments' && (
        <form action={savePaymentsAction} className="a-stack" style={{ maxWidth: 900 }}>
          <div className="a-card">
            <h2 className="a-h2">Bank transfer</h2>
            <p className="a-small" style={{ margin: '-4px 0 14px' }}>
              Customers see these details after ordering and in their order email, with the order number as the reference. Mark orders paid under Orders when the money arrives.
            </p>
            <div className="a-form">
              <label className="a-check">
                <input type="checkbox" name="bankEnabled" defaultChecked={s.payments.bankTransfer.enabled} />
                Offer bank transfer at checkout
              </label>
              <div className="a-row3">
                <div className="a-field">
                  <label htmlFor="accountName">Account name</label>
                  <input id="accountName" name="accountName" defaultValue={s.payments.bankTransfer.accountName} maxLength={80} />
                </div>
                <div className="a-field mono">
                  <label htmlFor="sortCode">Sort code</label>
                  <input id="sortCode" name="sortCode" defaultValue={s.payments.bankTransfer.sortCode} placeholder="12-34-56" maxLength={20} />
                </div>
                <div className="a-field mono">
                  <label htmlFor="accountNumber">Account number</label>
                  <input id="accountNumber" name="accountNumber" defaultValue={s.payments.bankTransfer.accountNumber} placeholder="12345678" maxLength={20} />
                </div>
              </div>
              <div className="a-row3">
                <div className="a-field mono">
                  <label htmlFor="iban">
                    IBAN <span className="opt">(optional)</span>
                  </label>
                  <input id="iban" name="iban" defaultValue={s.payments.bankTransfer.iban} maxLength={40} />
                </div>
                <div className="a-field mono">
                  <label htmlFor="bic">
                    BIC <span className="opt">(optional)</span>
                  </label>
                  <input id="bic" name="bic" defaultValue={s.payments.bankTransfer.bic} maxLength={20} />
                </div>
                <div className="a-field mono">
                  <label htmlFor="expiryDays">Days to pay before cancelling</label>
                  <input id="expiryDays" name="expiryDays" type="number" min={1} max={30} defaultValue={s.payments.bankTransfer.expiryDays} />
                  <span className="hint">Unpaid orders are cancelled and their stock released.</span>
                </div>
              </div>
            </div>
          </div>
          <div className="a-card">
            <h2 className="a-h2">Cards, Apple Pay and Google Pay (Stripe)</h2>
            <div className="a-form">
              <label className="a-check">
                <input type="checkbox" name="cardEnabled" defaultChecked={s.payments.card.enabled} />
                Offer card payment when Stripe is connected
              </label>
              <dl className="a-dl">
                <dt>Secret key</dt>
                <dd>
                  <Status ok={!!c.stripeKey} yes={testKey(c.stripeKey) ? 'Connected (test mode)' : 'Connected'} no="Not set" />
                </dd>
                <dt>Webhook secret</dt>
                <dd>
                  <Status ok={!!c.stripeWebhookSecret} yes="Set" no="Not set" />
                </dd>
              </dl>
              <p className="a-small" style={{ margin: 0 }}>
                Add the Stripe keys under{' '}
                <Link className="a-link" href="/admin/settings?tab=connections">
                  Connections
                </Link>
                . Before going live, check that your payment provider accepts research-chemical merchants.
              </p>
            </div>
          </div>
          <Save label="Save payment settings" />
        </form>
      )}

      {tab === 'connections' && (
        <div className="a-stack" style={{ maxWidth: 900 }}>
          {!owner && <Notice>Only owners can change these. You can see what is connected.</Notice>}
          {owner && !encryptionOn() && (
            <Notice tone="err">Set ENCRYPTION_KEY in the server&apos;s .env file and restart the site before saving passwords and keys here, so they are stored encrypted.</Notice>
          )}
          {c.unreadable.length > 0 && (
            <Notice tone="err">
              {c.unreadable.join(', ')} can no longer be read, because the server&apos;s ENCRYPTION_KEY has changed. Enter {c.unreadable.length === 1 ? 'it' : 'them'} again.
            </Notice>
          )}

          <div className="a-card">
            <h2 className="a-h2">
              Email sending <Status ok={!!c.mail} yes={c.mailSource === 'env' ? 'Connected (.env)' : 'Connected'} no="Not set up" />
            </h2>
            <p className="a-small" style={{ margin: '-4px 0 14px' }}>
              Order confirmations, dispatch notes and password links go out through your email provider, for example Brevo, Postmark, Mailgun, Amazon SES, Microsoft 365 or
              Google Workspace. Their help pages call these details the &ldquo;SMTP settings&rdquo;. Until they are added, emails are only recorded under Emails.
            </p>
            {c.mailSource === 'env' ? (
              <p className="a-small" style={{ margin: 0 }}>
                Set in the server&apos;s .env file ({c.mail?.host}), which takes priority over this page.
              </p>
            ) : owner ? (
              <EmailConnectionForm
                saved={c.mailForm}
                storeName={s.storeName}
                supportEmail={s.supportEmail}
              />
            ) : null}
          </div>

          <form action={saveStripeKeysAction} className="a-card" autoComplete="off">
            <h2 className="a-h2">
              Card payments (Stripe){' '}
              <Status
                ok={!!c.stripeKey && !!c.stripeWebhookSecret}
                yes={testKey(c.stripeKey) ? 'Connected (test mode)' : 'Connected'}
                no={c.stripeKey ? 'Webhook secret missing' : 'Not set up'}
              />
            </h2>
            <ol className="a-small" style={{ margin: '-4px 0 14px', paddingLeft: 18, lineHeight: 1.7 }}>
              <li>Check that Stripe accepts research-chemical merchants, then open your Stripe dashboard.</li>
              <li>
                Under Developers › API keys, copy the <b>secret key</b> into the first box below. Start with the test key (sk_test_).
              </li>
              <li>Under Developers › Webhooks, add an endpoint with the address and events below.</li>
              <li>
                Open that endpoint, reveal its <b>signing secret</b> (whsec_) and paste it into the second box.
              </li>
              <li>
                Turn on card payment under{' '}
                <Link className="a-link" href="/admin/settings?tab=payments">
                  Payments
                </Link>
                .
              </li>
            </ol>
            <dl className="a-dl" style={{ marginBottom: 16 }}>
              <dt>Endpoint address</dt>
              <dd>
                <span className="a-code">{siteUrl()}/api/webhooks/stripe</span>
              </dd>
              <dt>Events</dt>
              <dd className="a-small" style={{ color: 'var(--ink)' }}>
                {STRIPE_EVENTS}
              </dd>
            </dl>
            {owner && (
              <div className="a-form">
                <div className="a-row2">
                  <div className="a-field mono">
                    <label htmlFor="stripeKey">Secret key</label>
                    {c.stripeKeySource === 'env' ? (
                      <span className="hint">Set in the server&apos;s .env file.</span>
                    ) : (
                      <input id="stripeKey" name="stripeKey" type="password" autoComplete="off" spellCheck={false} placeholder={c.stripeKey ? `Saved, ${keyHint(c.stripeKey)}` : 'sk_test_… or sk_live_…'} />
                    )}
                  </div>
                  <div className="a-field mono">
                    <label htmlFor="stripeWebhook">Webhook signing secret</label>
                    {c.stripeWebhookSource === 'env' ? (
                      <span className="hint">Set in the server&apos;s .env file.</span>
                    ) : (
                      <input
                        id="stripeWebhook"
                        name="stripeWebhook"
                        type="password"
                        autoComplete="off"
                        spellCheck={false}
                        placeholder={c.stripeWebhookSecret ? `Saved, ${keyHint(c.stripeWebhookSecret)}` : 'whsec_…'}
                      />
                    )}
                  </div>
                </div>
                <div className="a-formfoot">
                  <SubmitButton className="a-btn copper" pending="Checking with Stripe…">
                    Save keys
                  </SubmitButton>
                  {(c.stripeKeySource === 'admin' || c.stripeWebhookSource === 'admin') && (
                    <SubmitButton className="a-btn ghost" formAction={removeStripeKeysAction} confirm="Remove the Stripe keys? Card payment stops until you add them again.">
                      Remove keys
                    </SubmitButton>
                  )}
                </div>
                <p className="a-small" style={{ margin: 0 }}>
                  Paste a new key to replace a saved one. Keys are stored encrypted and never shown again, and every owner gets an email when they change.
                </p>
              </div>
            )}
          </form>

          {(
            [
              {
                which: 'anthropic',
                title: 'AI chat replies',
                value: c.anthropicKey,
                source: c.anthropicSource,
                placeholder: 'sk-ant-…',
                about: (
                  <>
                    With a key from console.anthropic.com the chat assistant writes its own replies, and still declines dosing and personal-use questions. Without one it answers from
                    built-in replies. Switch it on or off under{' '}
                    <Link className="a-link" href="/admin/settings?tab=chat">
                      Chat
                    </Link>
                    .
                  </>
                ),
                removeNote: 'Remove the AI key? The assistant goes back to built-in replies.',
              },
              {
                which: 'postcodes',
                title: 'UK address lookup',
                value: c.postcodesKey,
                source: c.postcodesSource,
                placeholder: 'ak_…',
                about: <>Customers type their postcode at checkout and pick their address from a list. Needs an Ideal Postcodes account (ideal-postcodes.co.uk), paid per lookup.</>,
                removeNote: 'Remove the address lookup key? Customers type their address by hand.',
              },
            ] as const
          ).map((k) => (
            <form key={k.which} action={saveSimpleKeyAction} className="a-card" autoComplete="off">
              <input type="hidden" name="which" value={k.which} />
              <h2 className="a-h2">
                {k.title} <Status ok={!!k.value} yes={k.source === 'env' ? 'Set (.env)' : 'Set'} no="Optional, not set" />
              </h2>
              <p className="a-small" style={{ margin: '-4px 0 14px' }}>
                {k.about}
              </p>
              {k.source === 'env' ? (
                <p className="a-small" style={{ margin: 0 }}>
                  Set in the server&apos;s .env file, which takes priority over this page.
                </p>
              ) : owner ? (
                <div className="a-inline">
                  <div className="a-field mono">
                    <label htmlFor={`key-${k.which}`}>API key</label>
                    <input id={`key-${k.which}`} name="key" type="password" autoComplete="off" spellCheck={false} placeholder={k.value ? `Saved, ${keyHint(k.value)}` : k.placeholder} />
                  </div>
                  <SubmitButton className="a-btn copper">Save</SubmitButton>
                  {k.source === 'admin' && (
                    <SubmitButton className="a-btn ghost" formAction={removeSimpleKeyAction} confirm={k.removeNote}>
                      Remove
                    </SubmitButton>
                  )}
                </div>
              ) : null}
            </form>
          ))}
        </div>
      )}

      {tab === 'checkout' && (
        <form action={saveCheckoutAction} className="a-card" style={{ maxWidth: 820 }}>
          <div className="a-form">
            <div className="a-field">
              <label htmlFor="ruoText">Research-use confirmation (a required tick box before payment)</label>
              <textarea id="ruoText" name="ruoText" defaultValue={s.checkout.ruoText} maxLength={400} />
            </div>
            <div className="a-field mono" style={{ maxWidth: 220 }}>
              <label htmlFor="minAge">Minimum age</label>
              <input id="minAge" name="minAge" type="number" min={16} max={25} defaultValue={s.checkout.minAge} />
            </div>
            <Save />
          </div>
        </form>
      )}

      {tab === 'marketing' && (
        <form action={saveMarketingAction} className="a-card" style={{ maxWidth: 820 }}>
          <div className="a-form">
            <label className="a-check">
              <input type="checkbox" name="popupEnabled" defaultChecked={s.marketing.popupEnabled} />
              <span>
                Show the first-order discount pop-up
                <small>Appears once per visitor after the delay below or when they scroll most of a page, never in the basket or checkout.</small>
              </span>
            </label>
            <div className="a-row3">
              <div className="a-field mono">
                <label htmlFor="popupDelay">Delay (seconds)</label>
                <input id="popupDelay" name="popupDelay" type="number" min={5} max={600} defaultValue={s.marketing.popupDelay} />
              </div>
              <div className="a-field mono">
                <label htmlFor="welcomeCode">Welcome code</label>
                <input id="welcomeCode" name="welcomeCode" defaultValue={s.marketing.welcomeCode} maxLength={40} />
              </div>
              <div className="a-field mono">
                <label htmlFor="welcomePct">Discount (%)</label>
                <input id="welcomePct" name="welcomePct" type="number" min={1} max={50} defaultValue={s.marketing.welcomePct} />
              </div>
            </div>
            {welcome ? (
              <p className="a-small" style={{ margin: 0 }}>
                <Link className="a-link" href={`/admin/discounts/${welcome.id}`}>
                  {welcome.code}
                </Link>{' '}
                is {welcome.active ? 'active' : 'switched off'}: {welcome.value}% off{welcome.firstOrderOnly ? ', first order only' : ''}, used {welcome.usedCount} times.
              </p>
            ) : (
              <Notice>There is no discount code called {s.marketing.welcomeCode} yet. Saving creates it.</Notice>
            )}
            <Save />
          </div>
        </form>
      )}

      {tab === 'referral' && (
        <form action={saveReferralAction} className="a-card" style={{ maxWidth: 820 }}>
          <div className="a-form">
            <label className="a-check">
              <input type="checkbox" name="enabled" defaultChecked={s.referral.enabled} />
              <span>
                Referral codes
                <small>Every customer gets a code like MT-JANE-7K2Q in their account. A friend uses it on their first order.</small>
              </span>
            </label>
            <div className="a-row2">
              <div className="a-field mono">
                <label htmlFor="discountPct">Friend&apos;s discount (%)</label>
                <input id="discountPct" name="discountPct" type="number" min={0} max={50} defaultValue={s.referral.discountPct} />
              </div>
              <div className="a-field mono">
                <label htmlFor="credit">Credit for the referrer (£)</label>
                <input id="credit" name="credit" inputMode="decimal" defaultValue={toPounds(s.referral.creditPence)} />
                <span className="hint">Added to their account when the friend&apos;s order is dispatched.</span>
              </div>
            </div>
            <Save />
          </div>
        </form>
      )}

      {tab === 'affiliates' && (
        <form action={saveAffiliateSettingsAction} className="a-card" style={{ maxWidth: 820 }}>
          <div className="a-form">
            <label className="a-check">
              <input type="checkbox" name="enabled" defaultChecked={s.affiliates.enabled} />
              <span>
                Affiliate programme
                <small>
                  Affiliate codes work at checkout and the programme pages are live. Turning this off stops new orders being credited; existing commission is
                  unaffected. Manage affiliates under <Link href="/admin/affiliates">Affiliates</Link>.
                </small>
              </span>
            </label>
            <label className="a-check">
              <input type="checkbox" name="applicationsOpen" defaultChecked={s.affiliates.applicationsOpen} />
              <span>
                Accept applications
                <small>Anyone can apply at {siteUrl().replace(/^https?:\/\//, '')}/affiliates/apply. Every application waits for your approval.</small>
              </span>
            </label>
            <div className="a-row2">
              <div className="a-field mono">
                <label htmlFor="commissionPct">Starting commission (%)</label>
                <input id="commissionPct" name="commissionPct" inputMode="decimal" defaultValue={s.affiliates.commissionPct} />
                <span className="hint">Of the order value after discounts, excluding delivery. Set a different rate for each affiliate on their page.</span>
              </div>
              <div className="a-field mono">
                <label htmlFor="affDiscountPct">Starting customer discount (%)</label>
                <input id="affDiscountPct" name="discountPct" type="number" min={0} max={50} defaultValue={s.affiliates.discountPct} />
                <span className="hint">What customers get off with an affiliate&apos;s code. 0 credits the affiliate without a discount.</span>
              </div>
              <div className="a-field mono">
                <label htmlFor="holdDays">Hold period (days after dispatch)</label>
                <input id="holdDays" name="holdDays" type="number" min={0} max={120} defaultValue={s.affiliates.holdDays} />
                <span className="hint">Commission becomes ready to pay after this, so returns and refunds settle first.</span>
              </div>
              <div className="a-field mono">
                <label htmlFor="minPayout">Minimum payout (£)</label>
                <input id="minPayout" name="minPayout" inputMode="decimal" defaultValue={toPounds(s.affiliates.minPayout)} />
                <span className="hint">Shown to affiliates; smaller balances roll over to the next payout.</span>
              </div>
            </div>
            <div className="a-field">
              <label htmlFor="payoutSchedule">How and when you pay</label>
              <input id="payoutSchedule" name="payoutSchedule" defaultValue={s.affiliates.payoutSchedule} maxLength={200} />
              <span className="hint">Shown in the affiliate portal and on the programme page.</span>
            </div>
            <Save />
          </div>
        </form>
      )}

      {tab === 'chat' && (
        <form action={saveChatAction} className="a-card" style={{ maxWidth: 820 }}>
          <div className="a-form">
            <label className="a-check">
              <input type="checkbox" name="enabled" defaultChecked={s.chat.enabled} />
              <span>
                Show the chat assistant
                <small>The “Chat with us” button on every shop page.</small>
              </span>
            </label>
            <label className="a-check">
              <input type="checkbox" name="aiEnabled" defaultChecked={s.chat.aiEnabled} />
              <span>
                Use AI replies when a key is set
                <small>Without it the assistant answers from built-in replies about products, delivery, returns and orders.</small>
              </span>
            </label>
            <dl className="a-dl">
              <dt>AI key</dt>
              <dd>
                <Status ok={!!c.anthropicKey} yes="Set" no="Not set (built-in replies only)" />{' '}
                <Link className="a-link" href="/admin/settings?tab=connections" style={{ fontSize: 13 }}>
                  {c.anthropicKey ? 'Change' : 'Add a key'}
                </Link>
              </dd>
              <dt>Model</dt>
              <dd className="a-mono">{process.env.CHAT_MODEL || 'default'}</dd>
            </dl>
            <p className="a-small" style={{ margin: 0 }}>
              Whatever the mode, the assistant declines dosing and personal-use questions. Transcripts are under Inbox › Chat transcripts.
            </p>
            <Save />
          </div>
        </form>
      )}

      {tab === 'other' && (
        <form action={saveOtherAction} className="a-card" style={{ maxWidth: 820 }}>
          <div className="a-form">
            <div className="a-row2">
              <div className="a-field mono">
                <label htmlFor="returnsDays">Returns window (days after delivery)</label>
                <input id="returnsDays" name="returnsDays" type="number" min={0} max={365} defaultValue={s.returnsDays} />
              </div>
              <div className="a-field mono">
                <label htmlFor="vatRate">VAT rate (%)</label>
                <input id="vatRate" name="vatRate" type="number" min={0} max={30} defaultValue={s.vatRate} />
                <span className="hint">Prices already include VAT. Used to show the VAT part on invoices.</span>
              </div>
            </div>
            <dl className="a-dl">
              <dt>Email sending</dt>
              <dd>
                <Status ok={!!c.mail} yes="Connected" no="Not set up: emails are recorded only" />
              </dd>
              <dt>Web address</dt>
              <dd className="a-mono">{siteUrl()}</dd>
            </dl>
            <Save />
          </div>
        </form>
      )}
    </>
  );
}

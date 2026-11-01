// Post-deploy check: every public page loads and the key APIs answer.
//   npm run smoke                              (checks http://localhost:3000)
//   npm run smoke -- https://yourdomain.co.uk
const base = (process.argv[2] || process.env.SITE_URL || 'http://localhost:3000').replace(/\/+$/, '');

const pages = [
  '/', '/shop', '/science', '/lot-reports', '/help', '/delivery', '/returns', '/about', '/contact',
  '/terms', '/privacy', '/cookies', '/search?q=mt2', '/track', '/account', '/basket', '/checkout',
  '/admin/login', '/sitemap.xml', '/robots.txt', '/api/health',
];

let failed = 0;
const check = (ok, label, detail = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${detail ? `  ${detail}` : ''}`);
  if (!ok) failed++;
};

for (const p of pages) {
  try {
    const r = await fetch(base + p, { redirect: 'manual' });
    check(r.status === 200, `GET ${p}`, String(r.status));
  } catch (e) {
    check(false, `GET ${p}`, e.message);
  }
}

// Product pages listed in the sitemap.
try {
  const xml = await (await fetch(base + '/sitemap.xml')).text();
  const products = [...xml.matchAll(/<loc>([^<]+\/products\/[^<]+)<\/loc>/g)].map((m) => m[1]);
  check(products.length > 0, 'sitemap lists products', String(products.length));
  for (const url of products) {
    const r = await fetch(url.replace(/^https?:\/\/[^/]+/, base));
    check(r.ok, `GET ${new URL(url).pathname}`, String(r.status));
  }
} catch (e) {
  check(false, 'sitemap', e.message);
}

// Unknown pages must 404, admin must not be open.
check((await fetch(base + '/this-page-does-not-exist')).status === 404, 'unknown page returns 404');
const admin = await fetch(base + '/admin', { redirect: 'manual' });
check([302, 303, 307, 308].includes(admin.status), 'admin redirects to sign in when signed out', String(admin.status));

// Checkout quote (prices come from the database).
try {
  const r = await fetch(base + '/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: base },
    body: JSON.stringify({ action: 'quote', lines: [] }),
  });
  check(r.ok, 'checkout quote API', String(r.status));
} catch (e) {
  check(false, 'checkout quote API', e.message);
}

console.log(failed ? `\n${failed} check(s) failed` : '\nAll checks passed');
process.exit(failed ? 1 : 0);

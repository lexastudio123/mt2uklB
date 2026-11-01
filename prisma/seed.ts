// Seeds the catalogue, current lots and the welcome discount. Safe to run more than once:
// existing products, packs and lots are updated, never duplicated.
// Optional: set ADMIN_EMAIL and ADMIN_PASSWORD to create the first admin account.
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/lib/password';

const db = new PrismaClient();

const MT2_WARNING =
  'Regulators including the UK MHRA have warned the public not to use melanotan products sold online. Studies and case reports describe nausea, facial flushing, loss of appetite, darkening and new moles, and a small number of melanomas in people using unlicensed products, although a direct cause has not been proven.';

const products = [
  {
    slug: 'melanotan-ii',
    code: 'MT2',
    name: 'Melanotan II',
    fullName: 'Melanotan II 10 mg',
    altName: null,
    kind: 'single',
    tagline: '10 mg vial · lyophilised',
    lede: 'A synthetic, cyclic analogue of alpha melanocyte stimulating hormone. 10 mg of lyophilised peptide per vial, with an HPLC and mass spec report for the lot.',
    badge: 'Bestseller',
    highlights: ['Cyclic, 7 amino acids', 'Acts on MC1, MC3, MC4 and MC5', 'Not licensed anywhere; research only'],
    image: '/img/mt2.webp',
    imageWide: false,
    packImage: '/img/mt2-x5.webp',
    sequence: 'Ac-Nle-cyclo[Asp-His-D-Phe-Arg-Trp-Lys]-NH2',
    structure: '7 amino acids, cyclic',
    massDa: '1024.2',
    vial: '2 mL clear glass, crimped copper cap',
    searchTerms: 'melanotan 2 mt-2 mt 2 bremelanotide',
    seoTitle: 'Melanotan II 10 mg research vials, lot tested',
    seoDescription: 'Melanotan II 10 mg lyophilised research vials from a UK supplier. Every lot tested by HPLC and mass spectrometry, report online. For laboratory research only.',
    stock: 400,
    trackStock: true,
    sortOrder: 1,
    research: {
      level: 'pre',
      levelLabel: 'Unlicensed research compound',
      what: 'Melanotan II is a synthetic, cyclic analogue of alpha melanocyte stimulating hormone (alpha MSH), first described by University of Arizona researchers in the early 1990s.',
      findings: [
        'It activates several melanocortin receptors (MC1, MC3, MC4 and MC5), not just the MC1 receptor that controls skin pigment.',
        'Small human studies in the 1990s looked at skin darkening and, separately, at effects on sexual arousal.',
        'That second line of research led to bremelanotide, approved in the US in 2019 (as Vyleesi) for low sexual desire in premenopausal women.',
        'Melanotan II itself is not licensed as a medicine anywhere.',
      ],
      warning: MT2_WARNING,
      searchTerm: 'melanotan II',
    },
    packs: [
      { qty: 1, price: 2100 },
      { qty: 2, price: 4000 },
      { qty: 3, price: 5700, tag: 'Most popular' },
      { qty: 5, price: 9000 },
      { qty: 10, price: 16500, tag: 'Best value' },
    ],
  },
  {
    slug: 'melanotan-i',
    code: 'MT1',
    name: 'Melanotan I',
    fullName: 'Melanotan I 10 mg',
    altName: 'afamelanotide',
    kind: 'single',
    tagline: '10 mg vial · lyophilised',
    lede: 'Also known as afamelanotide: a linear analogue of alpha MSH that acts mainly on the MC1 receptor. 10 mg of lyophilised peptide per vial, with a full lot report.',
    badge: null,
    highlights: ['Linear, 13 amino acids (afamelanotide)', 'Acts mainly on MC1', 'Licensed elsewhere as Scenesse; research grade here'],
    image: '/img/mt1.webp',
    imageWide: false,
    packImage: null,
    sequence: 'Ac-Ser-Tyr-Ser-Nle-Glu-His-D-Phe-Arg-Trp-Gly-Lys-Pro-Val-NH2',
    structure: '13 amino acids, linear',
    massDa: '1646.9',
    vial: '2 mL clear glass, crimped copper cap',
    searchTerms: 'melanotan 1 mt-1 mt 1 afamelanotide scenesse',
    seoTitle: 'Melanotan I (afamelanotide) 10 mg research vials',
    seoDescription: 'Melanotan I (afamelanotide) 10 mg lyophilised research vials, lot tested by HPLC and mass spectrometry with the report online. For laboratory research only.',
    stock: 250,
    trackStock: true,
    sortOrder: 2,
    research: {
      level: 'lic',
      levelLabel: 'Licensed medicine in some countries (as Scenesse)',
      what: 'Melanotan I, also called afamelanotide, is a linear 13 amino acid analogue of alpha MSH that acts mainly on the MC1 receptor, which switches on melanin production.',
      findings: [
        'Licensed in the EU in 2014 and the US in 2019 (as Scenesse), as a prescription implant for adults with erythropoietic protoporphyria, a rare condition that makes light painful.',
        'In clinical trials it increased the time people with that condition could spend in daylight without pain.',
        'It has also been studied in vitiligo and other light sensitive skin conditions.',
        'It is not licensed for cosmetic tanning.',
      ],
      warning: 'Licensed afamelanotide is a prescription medicine given by specialists. Research grade material is not the licensed product and is not for human use.',
      searchTerm: 'afamelanotide',
    },
    packs: [
      { qty: 1, price: 2900 },
      { qty: 2, price: 5500 },
      { qty: 3, price: 7800, tag: 'Most popular' },
      { qty: 5, price: 12500 },
      { qty: 10, price: 23500, tag: 'Best value' },
    ],
  },
  {
    slug: 'mt1-mt2-duo',
    code: 'DUO',
    name: 'MT1 and MT2 duo',
    fullName: 'MT1 and MT2 duo',
    altName: null,
    kind: 'bundle',
    tagline: '2 × 10 mg vials',
    lede: 'One Melanotan I and one Melanotan II vial, 10 mg each, for side by side comparison research. Both lot reports included.',
    badge: null,
    highlights: ['One Melanotan I and one Melanotan II vial', 'Both lot reports included', 'Cheaper than buying them separately'],
    image: '/img/duo.webp',
    imageWide: true,
    packImage: null,
    sequence: null,
    structure: null,
    massDa: null,
    vial: '2 mL clear glass, crimped copper cap',
    searchTerms: 'duo pair both compare comparison bundle kit',
    seoTitle: 'MT1 and MT2 duo, one of each for comparison research',
    seoDescription: 'One Melanotan I and one Melanotan II 10 mg research vial with both lot reports. For laboratory research only.',
    stock: 0,
    trackStock: false,
    sortOrder: 3,
    research: {
      level: 'pre',
      levelLabel: 'One licensed elsewhere, one unlicensed',
      what: 'The duo pairs the two best known alpha MSH analogues so they can be compared side by side: Melanotan I (afamelanotide), which acts mainly on MC1, and Melanotan II, which acts on several melanocortin receptors.',
      findings: [
        'Melanotan I is licensed in the EU and US as Scenesse, a prescription implant for erythropoietic protoporphyria.',
        'Melanotan II is not licensed anywhere; its research led to bremelanotide (Vyleesi).',
        'See each single product page for the full research summary.',
      ],
      warning: MT2_WARNING,
      searchTerm: 'melanotan',
    },
    packs: [
      { qty: 1, price: 4800 },
      { qty: 2, price: 9200 },
      { qty: 3, price: 13200, tag: 'Best value' },
    ],
  },
];

const lots = [
  { code: 'MT2-2611', product: 'MT2', purity: '99.42', massDa: '1024.2', content: '10.2 mg', endotoxin: '<0.5 EU/mg', retention: '9.6', testedAt: '2026-10-19' },
  { code: 'MT1-2604', product: 'MT1', purity: '99.31', massDa: '1646.9', content: '10.2 mg', endotoxin: '<0.5 EU/mg', retention: '11.8', testedAt: '2026-10-07' },
];

async function ensureAdmin() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (email && password) {
    const existing = await db.adminUser.findUnique({ where: { email } });
    if (!existing) {
      await db.adminUser.create({ data: { email, name: process.env.ADMIN_NAME || 'Owner', role: 'owner', passwordHash: await hashPassword(password) } });
      console.log(`Created owner account ${email}`);
    }
  } else if ((await db.adminUser.count()) === 0) {
    console.log('No admin account yet. Create one with: npm run admin:create');
  }
}

async function main() {
  // The catalogue is only seeded into an empty shop, so restarts never undo edits made in the admin.
  if ((await db.product.count()) > 0 && !process.argv.includes('--force')) {
    console.log('Catalogue already set up; skipping (use --force to add anything missing).');
    await ensureAdmin();
    return;
  }
  const ids: Record<string, string> = {};
  for (const { packs, research, highlights, ...p } of products) {
    const data = { ...p, research: JSON.stringify(research), highlights: JSON.stringify(highlights) };
    const row = await db.product.upsert({
      where: { code: p.code },
      update: {},
      create: data,
    });
    ids[p.code] = row.id;
    for (const [i, k] of packs.entries()) {
      await db.pack.upsert({
        where: { productId_qty: { productId: row.id, qty: k.qty } },
        update: {},
        create: { productId: row.id, qty: k.qty, price: k.price, tag: k.tag ?? null, sortOrder: i },
      });
    }
  }

  for (const code of ['MT1', 'MT2']) {
    await db.bundleItem.upsert({
      where: { bundleId_productId: { bundleId: ids.DUO, productId: ids[code] } },
      update: {},
      create: { bundleId: ids.DUO, productId: ids[code], qty: 1 },
    });
  }

  for (const l of lots) {
    const exists = await db.lot.findUnique({ where: { code: l.code } });
    if (exists) continue;
    await db.lot.updateMany({ where: { productId: ids[l.product], isCurrent: true }, data: { isCurrent: false } });
    await db.lot.create({
      data: {
        code: l.code,
        productId: ids[l.product],
        purity: l.purity,
        massDa: l.massDa,
        content: l.content,
        endotoxin: l.endotoxin,
        retention: l.retention,
        testedAt: new Date(l.testedAt + 'T12:00:00Z'),
        lab: 'Independent laboratory',
        isCurrent: true,
        isPublished: true,
        isSample: true,
        notes: 'Sample lot from the design preview. Replace with your real certificate before launch.',
      },
    });
  }

  await db.discountCode.upsert({
    where: { code: 'WELCOME10' },
    update: {},
    create: { code: 'WELCOME10', description: 'Newsletter welcome offer, first order only', kind: 'percent', value: 10, firstOrderOnly: true },
  });

  await ensureAdmin();
  console.log('Seed complete:', Object.keys(ids).join(', '));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

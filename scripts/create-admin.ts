// Create an admin account or reset an admin's password.
//   npm run admin:create                       (asks for the details)
//   npm run admin:create -- you@example.com    (asks for name and password)
//   npm run admin:create -- --link you@example.com "Your Name"
//       prints a one-time link, valid for 24 hours, where the person chooses their own password,
//       so nobody else ever knows it. For an existing account the link also resets two-step sign in.
//       New accounts made this way are owners unless you add --role=admin or --role=staff.
// Roles: owner (everything), admin (everything except team), staff (orders, customers, inbox).
import { PrismaClient } from '@prisma/client';
import crypto from 'node:crypto';
import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { hashPassword, PASSWORD_MIN } from '../src/lib/password';

try {
  process.loadEnvFile?.();
} catch {}

const db = new PrismaClient();
const ROLES = ['owner', 'admin', 'staff'];

async function askHidden(rl: readline.Interface, q: string): Promise<string> {
  // Hide typed characters for the password prompt.
  const out = stdout as unknown as { write: (s: string) => boolean };
  const write = out.write.bind(stdout);
  let muted = false;
  out.write = (s: string) => (muted && s !== q ? true : write(s));
  const p = rl.question(q);
  muted = true;
  const answer = await p;
  muted = false;
  out.write = write;
  write('\n');
  return answer;
}

/** One-time link to /admin/setup. Only the SHA-256 of the token is stored. */
async function setupLink(adminId: string, kind: 'setup' | 'recover'): Promise<string> {
  const token = crypto.randomBytes(32).toString('base64url');
  await db.adminToken.deleteMany({ where: { adminId, usedAt: null } });
  await db.adminToken.create({
    data: { id: crypto.createHash('sha256').update(token).digest('hex'), adminId, kind, expiresAt: new Date(Date.now() + 24 * 36e5) },
  });
  const base = (process.env.SITE_URL || '').replace(/\/+$/, '');
  return `${base}/admin/setup?token=${token}`;
}

async function main() {
  const args = process.argv.slice(2);
  const link = args.includes('--link');
  const roleArg = args.find((a) => a.startsWith('--role='))?.slice(7);
  const [emailArg, nameArg] = args.filter((a) => !a.startsWith('--'));
  const rl = readline.createInterface({ input: stdin, output: stdout });
  const email = (emailArg || (await rl.question('Email: '))).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new Error('That does not look like an email address.');
  const existing = await db.adminUser.findUnique({ where: { email } });

  if (link) {
    rl.close();
    let admin = existing;
    if (admin && !admin.active) throw new Error(`${email} is deactivated. An owner can reactivate it under Team first.`);
    if (!admin) {
      const role = roleArg || 'owner';
      if (!ROLES.includes(role)) throw new Error('Role must be owner, admin or staff.');
      // No usable password until the link is used.
      admin = await db.adminUser.create({ data: { email, name: nameArg?.trim().slice(0, 80) || 'Owner', role, passwordHash: '' } });
      console.log(`Created ${role} account for ${email}.`);
    }
    const url = await setupLink(admin.id, existing ? 'recover' : 'setup');
    console.log(`\nOpen this link within 24 hours to choose the password. It works once:\n\n  ${url}\n`);
    if (!process.env.SITE_URL) console.log('SITE_URL is not set, so put your web address in front of the link.');
    if (existing) console.log('Using it also resets two-step sign in and signs the account out everywhere.');
    return;
  }

  const name = existing ? existing.name : (await rl.question('Name: ')).trim() || 'Owner';
  const role = existing ? existing.role : ((await rl.question('Role (owner/admin/staff) [owner]: ')).trim() || 'owner');
  if (!ROLES.includes(role)) throw new Error('Role must be owner, admin or staff.');
  const password = await askHidden(rl, existing ? 'New password: ' : 'Password: ');
  rl.close();
  if (password.length < Math.max(PASSWORD_MIN, 10)) throw new Error('Use at least 10 characters for an admin password.');
  const passwordHash = await hashPassword(password);
  if (existing) {
    // Server access is the last-resort recovery path, so this also clears two-step sign in.
    await db.adminUser.update({ where: { email }, data: { passwordHash, active: true, totpSecret: null, totpEnabledAt: null, totpLastStep: null } });
    await db.adminSession.deleteMany({ where: { adminId: existing.id } });
    console.log(`Password updated for ${email}. Two-step sign in was reset and existing sessions were signed out.`);
  } else {
    await db.adminUser.create({ data: { email, name, role, passwordHash } });
    console.log(`Created ${role} account for ${email}. Sign in at /admin/login`);
  }
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

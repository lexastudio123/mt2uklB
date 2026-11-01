// Create an admin account or reset an admin's password.
//   npm run admin:create                       (asks for the details)
//   npm run admin:create -- you@example.com    (asks for name and password)
// Roles: owner (everything), admin (everything except team), staff (orders, customers, inbox).
import { PrismaClient } from '@prisma/client';
import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { hashPassword, PASSWORD_MIN } from '../src/lib/password';

const db = new PrismaClient();

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

async function main() {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  const email = (process.argv[2] || (await rl.question('Email: '))).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new Error('That does not look like an email address.');
  const existing = await db.adminUser.findUnique({ where: { email } });
  const name = existing ? existing.name : (await rl.question('Name: ')).trim() || 'Owner';
  const role = existing ? existing.role : ((await rl.question('Role (owner/admin/staff) [owner]: ')).trim() || 'owner');
  if (!['owner', 'admin', 'staff'].includes(role)) throw new Error('Role must be owner, admin or staff.');
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

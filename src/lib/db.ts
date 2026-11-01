import 'server-only';
import { PrismaClient } from '@prisma/client';

const g = globalThis as unknown as { prisma?: PrismaClient; walReady?: Promise<void> };

export const db: PrismaClient =
  g.prisma ?? new PrismaClient({ log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'] });

if (process.env.NODE_ENV !== 'production') g.prisma = db;

// SQLite: write-ahead logging lets the shop read while the admin writes.
// The setting is stored in the database file, so this only has to succeed once.
if (!g.walReady && (process.env.DATABASE_URL || '').startsWith('file:')) {
  g.walReady = db
    .$queryRawUnsafe('PRAGMA journal_mode=WAL;')
    .then(() => undefined)
    .catch(() => undefined);
}

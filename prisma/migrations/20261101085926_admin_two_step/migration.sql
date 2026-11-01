-- AlterTable
ALTER TABLE "AdminUser" ADD COLUMN "totpEnabledAt" DATETIME;
ALTER TABLE "AdminUser" ADD COLUMN "totpLastStep" INTEGER;
ALTER TABLE "AdminUser" ADD COLUMN "totpSecret" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AdminSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "adminId" TEXT NOT NULL,
    "mfaPending" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" DATETIME NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminSession_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "AdminUser" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_AdminSession" ("adminId", "createdAt", "expiresAt", "id", "ip", "userAgent") SELECT "adminId", "createdAt", "expiresAt", "id", "ip", "userAgent" FROM "AdminSession";
DROP TABLE "AdminSession";
ALTER TABLE "new_AdminSession" RENAME TO "AdminSession";
CREATE INDEX "AdminSession_adminId_idx" ON "AdminSession"("adminId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

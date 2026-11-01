-- CreateTable
CREATE TABLE "Affiliate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "phone" TEXT,
    "company" TEXT,
    "website" TEXT,
    "socials" TEXT,
    "pitch" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "postcode" TEXT,
    "country" TEXT NOT NULL DEFAULT 'United Kingdom',
    "taxRef" TEXT,
    "bankAccountName" TEXT,
    "bankSortCode" TEXT,
    "bankAccountNumber" TEXT,
    "bankIban" TEXT,
    "bankBic" TEXT,
    "bankUpdatedAt" DATETIME,
    "commissionBps" INTEGER NOT NULL DEFAULT 1500,
    "customerDiscountPct" INTEGER NOT NULL DEFAULT 10,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "notifySales" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "termsAcceptedAt" DATETIME,
    "approvedAt" DATETIME,
    "lastLoginAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AffiliateSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "affiliateId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AffiliateSession_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AffiliateToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "affiliateId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AffiliateToken_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AffiliateClick" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "affiliateId" TEXT NOT NULL,
    "landing" TEXT NOT NULL,
    "referrer" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AffiliateClick_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AffiliateCommission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT,
    "affiliateId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'sale',
    "orderId" TEXT,
    "rateBps" INTEGER NOT NULL DEFAULT 0,
    "basis" INTEGER NOT NULL DEFAULT 0,
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "description" TEXT,
    "approvedAt" DATETIME,
    "paidAt" DATETIME,
    "voidReason" TEXT,
    "payoutId" TEXT,
    "adminId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AffiliateCommission_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AffiliateCommission_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AffiliateCommission_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "AffiliatePayout" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AffiliatePayout" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "affiliateId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'bank_transfer',
    "reference" TEXT,
    "note" TEXT,
    "paidAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "adminId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AffiliatePayout_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AffiliatePayout_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "AdminUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "number" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "customerId" TEXT,
    "referrerId" TEXT,
    "affiliateId" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "shipLine1" TEXT NOT NULL,
    "shipLine2" TEXT,
    "shipCity" TEXT NOT NULL,
    "shipPostcode" TEXT NOT NULL,
    "shipCountry" TEXT NOT NULL,
    "billSame" BOOLEAN NOT NULL DEFAULT true,
    "billLine1" TEXT,
    "billCity" TEXT,
    "billPostcode" TEXT,
    "status" TEXT NOT NULL DEFAULT 'awaiting_payment',
    "paymentMethod" TEXT NOT NULL,
    "paymentStatus" TEXT NOT NULL DEFAULT 'unpaid',
    "paymentRef" TEXT,
    "paymentIntent" TEXT,
    "paymentDetail" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "subtotal" INTEGER NOT NULL,
    "discount" INTEGER NOT NULL DEFAULT 0,
    "credit" INTEGER NOT NULL DEFAULT 0,
    "shipping" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "refundedAmount" INTEGER NOT NULL DEFAULT 0,
    "discountCode" TEXT,
    "shippingMethodId" TEXT NOT NULL,
    "shippingMethodName" TEXT NOT NULL,
    "etaFrom" DATETIME,
    "etaTo" DATETIME,
    "trackingNumber" TEXT,
    "trackingCarrier" TEXT,
    "trackingUrl" TEXT,
    "customerNote" TEXT,
    "ruoConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "marketingOptIn" BOOLEAN NOT NULL DEFAULT false,
    "placedSignedIn" BOOLEAN NOT NULL DEFAULT false,
    "ip" TEXT,
    "userAgent" TEXT,
    "paidAt" DATETIME,
    "packedAt" DATETIME,
    "dispatchedAt" DATETIME,
    "deliveredAt" DATETIME,
    "cancelledAt" DATETIME,
    "refundedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Order_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Order_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Order" ("accessToken", "billCity", "billLine1", "billPostcode", "billSame", "cancelledAt", "createdAt", "credit", "currency", "customerId", "customerNote", "deliveredAt", "discount", "discountCode", "dispatchedAt", "email", "etaFrom", "etaTo", "id", "ip", "marketingOptIn", "name", "number", "packedAt", "paidAt", "paymentDetail", "paymentIntent", "paymentMethod", "paymentRef", "paymentStatus", "phone", "placedSignedIn", "referrerId", "refundedAmount", "refundedAt", "ruoConfirmed", "shipCity", "shipCountry", "shipLine1", "shipLine2", "shipPostcode", "shipping", "shippingMethodId", "shippingMethodName", "status", "subtotal", "total", "trackingCarrier", "trackingNumber", "trackingUrl", "updatedAt", "userAgent") SELECT "accessToken", "billCity", "billLine1", "billPostcode", "billSame", "cancelledAt", "createdAt", "credit", "currency", "customerId", "customerNote", "deliveredAt", "discount", "discountCode", "dispatchedAt", "email", "etaFrom", "etaTo", "id", "ip", "marketingOptIn", "name", "number", "packedAt", "paidAt", "paymentDetail", "paymentIntent", "paymentMethod", "paymentRef", "paymentStatus", "phone", "placedSignedIn", "referrerId", "refundedAmount", "refundedAt", "ruoConfirmed", "shipCity", "shipCountry", "shipLine1", "shipLine2", "shipPostcode", "shipping", "shippingMethodId", "shippingMethodName", "status", "subtotal", "total", "trackingCarrier", "trackingNumber", "trackingUrl", "updatedAt", "userAgent" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
CREATE UNIQUE INDEX "Order_number_key" ON "Order"("number");
CREATE UNIQUE INDEX "Order_accessToken_key" ON "Order"("accessToken");
CREATE INDEX "Order_status_idx" ON "Order"("status");
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");
CREATE INDEX "Order_email_idx" ON "Order"("email");
CREATE INDEX "Order_customerId_idx" ON "Order"("customerId");
CREATE INDEX "Order_affiliateId_idx" ON "Order"("affiliateId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Affiliate_code_key" ON "Affiliate"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Affiliate_email_key" ON "Affiliate"("email");

-- CreateIndex
CREATE INDEX "Affiliate_status_idx" ON "Affiliate"("status");

-- CreateIndex
CREATE INDEX "AffiliateSession_affiliateId_idx" ON "AffiliateSession"("affiliateId");

-- CreateIndex
CREATE INDEX "AffiliateToken_affiliateId_idx" ON "AffiliateToken"("affiliateId");

-- CreateIndex
CREATE INDEX "AffiliateClick_affiliateId_createdAt_idx" ON "AffiliateClick"("affiliateId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateCommission_key_key" ON "AffiliateCommission"("key");

-- CreateIndex
CREATE INDEX "AffiliateCommission_affiliateId_status_idx" ON "AffiliateCommission"("affiliateId", "status");

-- CreateIndex
CREATE INDEX "AffiliateCommission_orderId_idx" ON "AffiliateCommission"("orderId");

-- CreateIndex
CREATE INDEX "AffiliatePayout_affiliateId_idx" ON "AffiliatePayout"("affiliateId");

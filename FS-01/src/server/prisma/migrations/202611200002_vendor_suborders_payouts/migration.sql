CREATE TYPE "SubOrderStatus" AS ENUM ('PLACED', 'PACKED', 'SHIPPED', 'DELIVERED');
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'SIMULATED');

CREATE TABLE "CommissionSetting" (
    "id" TEXT NOT NULL DEFAULT 'platform',
    "percentage" DECIMAL(5,2) NOT NULL DEFAULT 10,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommissionSetting_pkey" PRIMARY KEY ("id")
);
INSERT INTO "CommissionSetting" ("id", "percentage") VALUES ('platform', 10);

CREATE TABLE "SubOrder" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "vendorAccountId" TEXT,
    "status" "SubOrderStatus" NOT NULL DEFAULT 'PLACED',
    "subtotal" DECIMAL(12,2) NOT NULL,
    "commissionAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "vendorPayoutAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "packedAt" TIMESTAMP(3),
    "shippedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SubOrder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Payout" (
    "id" TEXT NOT NULL,
    "subOrderId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "grossAmount" DECIMAL(12,2) NOT NULL,
    "commissionAmount" DECIMAL(12,2) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "providerReference" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "OrderItem" ADD COLUMN "subOrderId" TEXT;

WITH vendor_totals AS (
    SELECT "orderId", "sellerId" AS "vendorId",
           MIN("vendorAccountId") AS "vendorAccountId",
           SUM("unitPrice" * "quantity")::DECIMAL(12,2) AS gross
    FROM "OrderItem"
    GROUP BY "orderId", "sellerId"
), order_totals AS (
    SELECT "orderId", SUM(gross) AS gross FROM vendor_totals GROUP BY "orderId"
), allocations AS (
    SELECT v."orderId", v."vendorId", v."vendorAccountId", v.gross,
           o."status", o."totalAmount", o."commissionAmount" AS old_commission,
           o."sellerPayoutAmount" AS old_payout, t.gross AS order_gross,
           ROUND(o."totalAmount" * v.gross / NULLIF(t.gross, 0), 2) AS net_amount
    FROM vendor_totals v
    JOIN "Order" o ON o.id = v."orderId"
    JOIN order_totals t ON t."orderId" = v."orderId"
)
INSERT INTO "SubOrder" (
    "id", "orderId", "vendorId", "vendorAccountId", "status", "subtotal",
    "commissionAmount", "vendorPayoutAmount", "packedAt", "shippedAt", "deliveredAt"
)
SELECT 'sub_' || MD5("orderId" || ':' || "vendorId"), "orderId", "vendorId", "vendorAccountId",
       CASE WHEN status::TEXT IN ('PACKED', 'SHIPPED', 'DELIVERED') THEN status::TEXT::"SubOrderStatus" ELSE 'PLACED'::"SubOrderStatus" END,
       gross,
       CASE WHEN old_commission > 0 THEN ROUND(old_commission * gross / NULLIF(order_gross, 0), 2)
            ELSE ROUND(net_amount * 0.10, 2) END,
       CASE WHEN old_payout > 0 THEN ROUND(old_payout * gross / NULLIF(order_gross, 0), 2)
            ELSE net_amount - ROUND(net_amount * 0.10, 2) END,
       NULL, NULL, NULL
FROM allocations;

UPDATE "OrderItem" i
SET "subOrderId" = 'sub_' || MD5(i."orderId" || ':' || i."sellerId");
ALTER TABLE "OrderItem" ALTER COLUMN "subOrderId" SET NOT NULL;

INSERT INTO "Payout" (
    "id", "subOrderId", "vendorId", "grossAmount", "commissionAmount", "amount", "status", "paidAt"
)
SELECT 'payout_' || MD5(s.id), s.id, s."vendorId", s.subtotal, s."commissionAmount", s."vendorPayoutAmount",
       CASE o."settlementStatus" WHEN 'TRANSFERRED' THEN 'PAID'::"PayoutStatus"
            WHEN 'SIMULATED' THEN 'SIMULATED'::"PayoutStatus"
            WHEN 'FAILED' THEN 'FAILED'::"PayoutStatus"
            ELSE 'PENDING'::"PayoutStatus" END,
       CASE WHEN o."settlementStatus" IN ('TRANSFERRED', 'SIMULATED') THEN o."updatedAt" ELSE NULL END
FROM "SubOrder" s
JOIN "Order" o ON o.id = s."orderId"
WHERE o."paymentStatus" = 'PAID';

CREATE UNIQUE INDEX "SubOrder_orderId_vendorId_key" ON "SubOrder"("orderId", "vendorId");
CREATE INDEX "SubOrder_vendorId_status_createdAt_idx" ON "SubOrder"("vendorId", "status", "createdAt");
CREATE INDEX "OrderItem_subOrderId_idx" ON "OrderItem"("subOrderId");
CREATE UNIQUE INDEX "Payout_subOrderId_key" ON "Payout"("subOrderId");
CREATE INDEX "Payout_vendorId_status_createdAt_idx" ON "Payout"("vendorId", "status", "createdAt");

ALTER TABLE "CommissionSetting" ADD CONSTRAINT "CommissionSetting_updatedBy_fkey"
    FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SubOrder" ADD CONSTRAINT "SubOrder_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubOrder" ADD CONSTRAINT "SubOrder_vendorId_fkey"
    FOREIGN KEY ("vendorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_subOrderId_fkey"
    FOREIGN KEY ("subOrderId") REFERENCES "SubOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_subOrderId_fkey"
    FOREIGN KEY ("subOrderId") REFERENCES "SubOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_vendorId_fkey"
    FOREIGN KEY ("vendorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

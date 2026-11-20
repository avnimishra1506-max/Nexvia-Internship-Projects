ALTER TABLE "CommissionSetting" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "SubOrder" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "Payout" ALTER COLUMN "updatedAt" DROP DEFAULT;

UPDATE "SubOrder" s
SET "packedAt" = o."packedAt",
    "shippedAt" = o."shippedAt",
    "deliveredAt" = o."deliveredAt"
FROM "Order" o
WHERE s."orderId" = o.id;

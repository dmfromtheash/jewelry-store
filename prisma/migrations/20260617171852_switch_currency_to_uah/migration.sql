-- AlterTable
ALTER TABLE "Order" ALTER COLUMN "currency" SET DEFAULT 'UAH';

-- AlterTable
ALTER TABLE "Product" ALTER COLUMN "currency" SET DEFAULT 'UAH';

-- Этап 27A: rebase the demo/catalog product currency baseline RUB → UAH.
-- Non-destructive: only the display/storage currency changes; numeric price
-- amounts (minor units) are NOT recomputed. Existing Order rows are left
-- untouched on purpose — historical orders keep their original currency.
UPDATE "Product" SET "currency" = 'UAH' WHERE "currency" = 'RUB';

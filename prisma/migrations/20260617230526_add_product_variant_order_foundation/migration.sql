-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "stockSource" TEXT,
ADD COLUMN     "variantId" TEXT,
ADD COLUMN     "variantName" TEXT,
ADD COLUMN     "variantValue" TEXT;

-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN     "priceDelta" INTEGER,
ADD COLUMN     "sku" TEXT,
ADD COLUMN     "stockQuantity" INTEGER;

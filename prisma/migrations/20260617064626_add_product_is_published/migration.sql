-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "isPublished" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "Product_isPublished_idx" ON "Product"("isPublished");

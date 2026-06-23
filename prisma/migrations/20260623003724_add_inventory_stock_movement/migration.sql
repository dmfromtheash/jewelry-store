-- CreateEnum
CREATE TYPE "StockMovementReason" AS ENUM ('order_created', 'order_cancelled_restock', 'manual_adjustment', 'admin_correction');

-- CreateTable
CREATE TABLE "InventoryStockMovement" (
    "id" TEXT NOT NULL,
    "productId" TEXT,
    "variantId" TEXT,
    "level" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "quantityBefore" INTEGER,
    "quantityAfter" INTEGER,
    "reason" "StockMovementReason" NOT NULL,
    "orderCode" TEXT,
    "actorLabel" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryStockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InventoryStockMovement_productId_idx" ON "InventoryStockMovement"("productId");

-- CreateIndex
CREATE INDEX "InventoryStockMovement_variantId_idx" ON "InventoryStockMovement"("variantId");

-- CreateIndex
CREATE INDEX "InventoryStockMovement_reason_idx" ON "InventoryStockMovement"("reason");

-- CreateIndex
CREATE INDEX "InventoryStockMovement_createdAt_idx" ON "InventoryStockMovement"("createdAt");

-- CreateIndex
CREATE INDEX "InventoryStockMovement_orderCode_idx" ON "InventoryStockMovement"("orderCode");

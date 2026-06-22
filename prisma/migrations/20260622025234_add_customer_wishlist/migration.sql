-- CreateTable
CREATE TABLE "CustomerWishlistItem" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerWishlistItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomerWishlistItem_customerId_idx" ON "CustomerWishlistItem"("customerId");

-- CreateIndex
CREATE INDEX "CustomerWishlistItem_productId_idx" ON "CustomerWishlistItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerWishlistItem_customerId_productId_key" ON "CustomerWishlistItem"("customerId", "productId");

-- AddForeignKey
ALTER TABLE "CustomerWishlistItem" ADD CONSTRAINT "CustomerWishlistItem_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerWishlistItem" ADD CONSTRAINT "CustomerWishlistItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

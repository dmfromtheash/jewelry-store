-- CreateEnum
CREATE TYPE "CustomerInterestType" AS ENUM ('back_in_stock', 'price_drop', 'general');

-- CreateEnum
CREATE TYPE "CustomerInterestStatus" AS ENUM ('active', 'fulfilled', 'cancelled');

-- CreateTable
CREATE TABLE "CustomerSavedSearch" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "query" TEXT,
    "categorySlug" TEXT,
    "sort" TEXT,
    "statusFilter" TEXT,
    "minPrice" INTEGER,
    "maxPrice" INTEGER,
    "material" TEXT,
    "lastViewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerSavedSearch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerProductInterest" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "type" "CustomerInterestType" NOT NULL DEFAULT 'back_in_stock',
    "status" "CustomerInterestStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "fulfilledAt" TIMESTAMP(3),

    CONSTRAINT "CustomerProductInterest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomerSavedSearch_customerId_idx" ON "CustomerSavedSearch"("customerId");

-- CreateIndex
CREATE INDEX "CustomerProductInterest_customerId_idx" ON "CustomerProductInterest"("customerId");

-- CreateIndex
CREATE INDEX "CustomerProductInterest_productId_idx" ON "CustomerProductInterest"("productId");

-- CreateIndex
CREATE INDEX "CustomerProductInterest_status_idx" ON "CustomerProductInterest"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerProductInterest_customerId_productId_type_key" ON "CustomerProductInterest"("customerId", "productId", "type");

-- AddForeignKey
ALTER TABLE "CustomerSavedSearch" ADD CONSTRAINT "CustomerSavedSearch_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerProductInterest" ADD CONSTRAINT "CustomerProductInterest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerProductInterest" ADD CONSTRAINT "CustomerProductInterest_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

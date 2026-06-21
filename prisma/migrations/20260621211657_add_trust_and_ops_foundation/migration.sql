-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "EmailTemplate" AS ENUM ('order_confirmation', 'order_status_update', 'password_reset', 'email_verification');

-- CreateEnum
CREATE TYPE "EmailOutboxStatus" AS ENUM ('queued', 'sent_stub', 'skipped', 'failed_stub');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "deliveryBranch" TEXT,
ADD COLUMN     "deliveryComment" TEXT;

-- CreateTable
CREATE TABLE "ProductReview" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "customerId" TEXT,
    "authorName" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'pending',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "moderatedAt" TIMESTAMP(3),

    CONSTRAINT "ProductReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailOutbox" (
    "id" TEXT NOT NULL,
    "template" "EmailTemplate" NOT NULL,
    "status" "EmailOutboxStatus" NOT NULL DEFAULT 'queued',
    "recipientEmail" TEXT,
    "relatedType" TEXT,
    "relatedId" TEXT,
    "subject" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "EmailOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductReview_productId_status_idx" ON "ProductReview"("productId", "status");

-- CreateIndex
CREATE INDEX "ProductReview_status_idx" ON "ProductReview"("status");

-- CreateIndex
CREATE INDEX "EmailOutbox_status_idx" ON "EmailOutbox"("status");

-- CreateIndex
CREATE INDEX "EmailOutbox_template_idx" ON "EmailOutbox"("template");

-- AddForeignKey
ALTER TABLE "ProductReview" ADD CONSTRAINT "ProductReview_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductReview" ADD CONSTRAINT "ProductReview_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

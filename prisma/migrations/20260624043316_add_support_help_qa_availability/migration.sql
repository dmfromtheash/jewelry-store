-- CreateEnum
CREATE TYPE "HelpQuestionStatus" AS ENUM ('new', 'triaged', 'answered', 'published', 'archived', 'spam', 'rejected');

-- CreateEnum
CREATE TYPE "ProductQuestionStatus" AS ENUM ('pending', 'answered', 'published', 'rejected', 'archived', 'spam');

-- CreateEnum
CREATE TYPE "AvailabilityInterestStatus" AS ENUM ('requested', 'pending_availability', 'queued_notification', 'notification_prepared', 'cancelled', 'expired');

-- AlterEnum
ALTER TYPE "EmailTemplate" ADD VALUE 'back_in_stock_notification';

-- CreateTable
CREATE TABLE "HelpQuestion" (
    "id" TEXT NOT NULL,
    "categorySlug" TEXT NOT NULL,
    "customerId" TEXT,
    "authorName" TEXT,
    "recipientEmail" TEXT,
    "emailHash" TEXT,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "productRef" TEXT,
    "orderRef" TEXT,
    "status" "HelpQuestionStatus" NOT NULL DEFAULT 'new',
    "answer" TEXT,
    "answeredBy" TEXT,
    "consentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "answeredAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "HelpQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductQuestion" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "customerId" TEXT,
    "authorName" TEXT NOT NULL,
    "recipientEmail" TEXT,
    "emailHash" TEXT,
    "body" TEXT NOT NULL,
    "answer" TEXT,
    "answeredBy" TEXT,
    "status" "ProductQuestionStatus" NOT NULL DEFAULT 'pending',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "consentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "answeredAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "ProductQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductAvailabilityInterest" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "customerId" TEXT,
    "email" TEXT,
    "emailHash" TEXT NOT NULL,
    "status" "AvailabilityInterestStatus" NOT NULL DEFAULT 'requested',
    "source" TEXT,
    "consentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "notifiedAt" TIMESTAMP(3),

    CONSTRAINT "ProductAvailabilityInterest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HelpQuestion_status_idx" ON "HelpQuestion"("status");

-- CreateIndex
CREATE INDEX "HelpQuestion_categorySlug_idx" ON "HelpQuestion"("categorySlug");

-- CreateIndex
CREATE INDEX "HelpQuestion_emailHash_idx" ON "HelpQuestion"("emailHash");

-- CreateIndex
CREATE INDEX "ProductQuestion_productId_status_idx" ON "ProductQuestion"("productId", "status");

-- CreateIndex
CREATE INDEX "ProductQuestion_status_idx" ON "ProductQuestion"("status");

-- CreateIndex
CREATE INDEX "ProductAvailabilityInterest_productId_status_idx" ON "ProductAvailabilityInterest"("productId", "status");

-- CreateIndex
CREATE INDEX "ProductAvailabilityInterest_emailHash_idx" ON "ProductAvailabilityInterest"("emailHash");

-- CreateIndex
CREATE UNIQUE INDEX "ProductAvailabilityInterest_productId_variantId_emailHash_key" ON "ProductAvailabilityInterest"("productId", "variantId", "emailHash");

-- AddForeignKey
ALTER TABLE "HelpQuestion" ADD CONSTRAINT "HelpQuestion_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductQuestion" ADD CONSTRAINT "ProductQuestion_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductQuestion" ADD CONSTRAINT "ProductQuestion_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAvailabilityInterest" ADD CONSTRAINT "ProductAvailabilityInterest_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAvailabilityInterest" ADD CONSTRAINT "ProductAvailabilityInterest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

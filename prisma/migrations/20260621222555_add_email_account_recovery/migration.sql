-- CreateEnum
CREATE TYPE "CustomerTokenPurpose" AS ENUM ('password_reset', 'email_verification');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EmailOutboxStatus" ADD VALUE 'skipped_no_provider';
ALTER TYPE "EmailOutboxStatus" ADD VALUE 'failed_validation';

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "EmailOutbox" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastError" TEXT;

-- CreateTable
CREATE TABLE "CustomerAccountToken" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "purpose" "CustomerTokenPurpose" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerAccountToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomerAccountToken_tokenHash_key" ON "CustomerAccountToken"("tokenHash");

-- CreateIndex
CREATE INDEX "CustomerAccountToken_customerId_idx" ON "CustomerAccountToken"("customerId");

-- CreateIndex
CREATE INDEX "CustomerAccountToken_purpose_idx" ON "CustomerAccountToken"("purpose");

-- CreateIndex
CREATE INDEX "CustomerAccountToken_expiresAt_idx" ON "CustomerAccountToken"("expiresAt");

-- AddForeignKey
ALTER TABLE "CustomerAccountToken" ADD CONSTRAINT "CustomerAccountToken_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

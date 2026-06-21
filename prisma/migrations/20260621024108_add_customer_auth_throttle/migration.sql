-- CreateTable
CREATE TABLE "CustomerAuthThrottle" (
    "id" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resetAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerAuthThrottle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomerAuthThrottle_keyHash_key" ON "CustomerAuthThrottle"("keyHash");

-- CreateIndex
CREATE INDEX "CustomerAuthThrottle_resetAt_idx" ON "CustomerAuthThrottle"("resetAt");

-- CreateIndex
CREATE INDEX "CustomerAuthThrottle_scope_idx" ON "CustomerAuthThrottle"("scope");

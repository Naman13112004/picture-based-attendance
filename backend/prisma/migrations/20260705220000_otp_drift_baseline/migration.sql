-- This migration records changes that were applied directly to the live database
-- as part of the OTP feature development (stashed). It exists solely to bring
-- Prisma migration history in sync with the actual database state.
-- All DDL statements below are idempotent (IF NOT EXISTS / IF EXISTS).

-- CreateTable (OTP feature)
CREATE TABLE IF NOT EXISTS "Otp" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "otp" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Otp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Otp_email_idx" ON "Otp"("email");

-- AlterTable: Add isVerified column to User (OTP feature)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isVerified" BOOLEAN NOT NULL DEFAULT false;

-- Add missing columns that were added to schema but not in initial migration
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "sessionsRevokedAt" TIMESTAMP(3);
ALTER TABLE "Song" ADD COLUMN IF NOT EXISTS "originalOwnerId" TEXT;

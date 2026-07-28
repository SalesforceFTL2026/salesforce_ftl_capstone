-- Add optional S3 object key for user profile picture
-- Applied locally via raw SQL due to pre-existing migration drift.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "avatarKey" TEXT;

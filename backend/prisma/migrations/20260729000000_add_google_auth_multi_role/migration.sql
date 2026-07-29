-- Google auth + one-account-per-role support.
--
-- 1. Drop the old single-column unique on email so the same email can be
--    reused across roles (help-seeker / volunteer / organization).
-- 2. Make passwordHash nullable — Google sign-in users have no password.
-- 3. Add googleId (Google's stable account "sub"); null for password users.
-- 4. Enforce uniqueness on the (email, role) pair instead of email alone.

-- DropIndex
DROP INDEX "User_email_key";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "googleId" TEXT,
ALTER COLUMN "passwordHash" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_email_role_key" ON "User"("email", "role");

-- Let volunteers sign up for org-created volunteer tasks.
-- One row per (task, volunteer); the unique constraint prevents double sign-up.

-- CreateTable
CREATE TABLE "TaskSignup" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskSignup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskSignup_taskId_idx" ON "TaskSignup"("taskId");

-- CreateIndex
CREATE INDEX "TaskSignup_userId_idx" ON "TaskSignup"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskSignup_taskId_userId_key" ON "TaskSignup"("taskId", "userId");

-- AddForeignKey
ALTER TABLE "TaskSignup" ADD CONSTRAINT "TaskSignup_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "VolunteerTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskSignup" ADD CONSTRAINT "TaskSignup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

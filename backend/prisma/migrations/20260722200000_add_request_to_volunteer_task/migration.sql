-- Attribute every volunteer task to an existing help request.
-- The VolunteerTask table is empty at this point, so adding a NOT NULL column
-- without a default is safe (no rows to backfill).

-- AlterTable
ALTER TABLE "VolunteerTask" ADD COLUMN "requestId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "VolunteerTask_requestId_idx" ON "VolunteerTask"("requestId");

-- AddForeignKey
ALTER TABLE "VolunteerTask" ADD CONSTRAINT "VolunteerTask_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

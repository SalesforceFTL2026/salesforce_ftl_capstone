-- CreateTable
CREATE TABLE "VolunteerTask" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT,
    "urgency" TEXT NOT NULL DEFAULT 'Medium',
    "skillsNeeded" TEXT,
    "minVolunteers" INTEGER NOT NULL DEFAULT 1,
    "maxVolunteers" INTEGER,
    "volunteersConfirmed" INTEGER NOT NULL DEFAULT 0,
    "resourcesReady" BOOLEAN NOT NULL DEFAULT false,
    "volunteerDate" TIMESTAMP(3),
    "readySince" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VolunteerTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VolunteerTask_organizationId_idx" ON "VolunteerTask"("organizationId");

-- CreateIndex
CREATE INDEX "VolunteerTask_status_idx" ON "VolunteerTask"("status");

-- CreateIndex
CREATE INDEX "VolunteerTask_volunteerDate_idx" ON "VolunteerTask"("volunteerDate");

-- AddForeignKey
ALTER TABLE "VolunteerTask" ADD CONSTRAINT "VolunteerTask_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

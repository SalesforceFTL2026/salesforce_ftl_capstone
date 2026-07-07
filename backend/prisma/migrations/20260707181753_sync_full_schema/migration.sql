-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "location" TEXT,
    "phoneNumber" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lastLoginAt" DATETIME
);

-- CreateTable
CREATE TABLE "Volunteer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "skills" TEXT,
    "availability" TEXT,
    "backgroundCheck" BOOLEAN NOT NULL DEFAULT false,
    "rating" REAL,
    "hoursVolunteered" INTEGER NOT NULL DEFAULT 0,
    "bio" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Volunteer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "organizationName" TEXT NOT NULL,
    "description" TEXT,
    "resourceTypes" TEXT,
    "contactInfo" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "rating" REAL,
    "responsesCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Organization_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Resource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit" TEXT NOT NULL,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "location" TEXT,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Resource_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Response" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "responderId" TEXT NOT NULL,
    "responderType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'offered',
    "notes" TEXT,
    "estimatedTime" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Response_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Response_responderId_fkey" FOREIGN KEY ("responderId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Update" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "updateType" TEXT NOT NULL DEFAULT 'comment',
    "visibility" TEXT NOT NULL DEFAULT 'public',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Update_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Update_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "volunteerId" TEXT,
    "organizationId" TEXT,
    "matchScore" REAL NOT NULL,
    "matchReasoning" TEXT,
    "status" TEXT NOT NULL DEFAULT 'suggested',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "expiresAt" DATETIME,
    CONSTRAINT "Match_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Match_volunteerId_fkey" FOREIGN KEY ("volunteerId") REFERENCES "Volunteer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Match_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CrisisEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "eventType" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "affectedArea" TEXT,
    "severity" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" DATETIME,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "totalRequests" INTEGER NOT NULL DEFAULT 0,
    "fulfilledRequests" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "RequestEvent" (
    "requestId" TEXT NOT NULL,
    "crisisEventId" TEXT NOT NULL,
    "addedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confidence" REAL,

    PRIMARY KEY ("requestId", "crisisEventId"),
    CONSTRAINT "RequestEvent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RequestEvent_crisisEventId_fkey" FOREIGN KEY ("crisisEventId") REFERENCES "CrisisEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Vote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "voteType" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Vote_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Vote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "subject" TEXT,
    "content" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "relatedRequestId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Message_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "actionUrl" TEXT,
    "relatedRequestId" TEXT,
    "relatedUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Request" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "submitterName" TEXT,
    "submitterRole" TEXT,
    "userId" TEXT,
    "category" TEXT NOT NULL,
    "urgency" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "embeddingJson" TEXT,
    "priorityScore" REAL NOT NULL DEFAULT 0,
    "reasoning" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Request_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Request" ("category", "createdAt", "description", "embeddingJson", "id", "location", "priorityScore", "reasoning", "submitterName", "submitterRole", "updatedAt", "urgency") SELECT "category", "createdAt", "description", "embeddingJson", "id", "location", "priorityScore", "reasoning", "submitterName", "submitterRole", "updatedAt", "urgency" FROM "Request";
DROP TABLE "Request";
ALTER TABLE "new_Request" RENAME TO "Request";
CREATE INDEX "Request_priorityScore_idx" ON "Request"("priorityScore");
CREATE INDEX "Request_category_idx" ON "Request"("category");
CREATE INDEX "Request_urgency_idx" ON "Request"("urgency");
CREATE INDEX "Request_status_idx" ON "Request"("status");
CREATE INDEX "Request_createdAt_idx" ON "Request"("createdAt");
CREATE INDEX "Request_userId_idx" ON "Request"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_location_idx" ON "User"("location");

-- CreateIndex
CREATE UNIQUE INDEX "Volunteer_userId_key" ON "Volunteer"("userId");

-- CreateIndex
CREATE INDEX "Volunteer_userId_idx" ON "Volunteer"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_userId_key" ON "Organization"("userId");

-- CreateIndex
CREATE INDEX "Organization_userId_idx" ON "Organization"("userId");

-- CreateIndex
CREATE INDEX "Organization_verified_idx" ON "Organization"("verified");

-- CreateIndex
CREATE INDEX "Resource_organizationId_idx" ON "Resource"("organizationId");

-- CreateIndex
CREATE INDEX "Resource_resourceType_idx" ON "Resource"("resourceType");

-- CreateIndex
CREATE INDEX "Resource_available_idx" ON "Resource"("available");

-- CreateIndex
CREATE INDEX "Response_requestId_idx" ON "Response"("requestId");

-- CreateIndex
CREATE INDEX "Response_responderId_idx" ON "Response"("responderId");

-- CreateIndex
CREATE INDEX "Response_status_idx" ON "Response"("status");

-- CreateIndex
CREATE INDEX "Update_requestId_idx" ON "Update"("requestId");

-- CreateIndex
CREATE INDEX "Update_userId_idx" ON "Update"("userId");

-- CreateIndex
CREATE INDEX "Update_createdAt_idx" ON "Update"("createdAt");

-- CreateIndex
CREATE INDEX "Match_requestId_idx" ON "Match"("requestId");

-- CreateIndex
CREATE INDEX "Match_volunteerId_idx" ON "Match"("volunteerId");

-- CreateIndex
CREATE INDEX "Match_organizationId_idx" ON "Match"("organizationId");

-- CreateIndex
CREATE INDEX "Match_status_idx" ON "Match"("status");

-- CreateIndex
CREATE INDEX "Match_matchScore_idx" ON "Match"("matchScore");

-- CreateIndex
CREATE INDEX "CrisisEvent_active_idx" ON "CrisisEvent"("active");

-- CreateIndex
CREATE INDEX "CrisisEvent_eventType_idx" ON "CrisisEvent"("eventType");

-- CreateIndex
CREATE INDEX "CrisisEvent_severity_idx" ON "CrisisEvent"("severity");

-- CreateIndex
CREATE INDEX "CrisisEvent_startDate_idx" ON "CrisisEvent"("startDate");

-- CreateIndex
CREATE INDEX "RequestEvent_crisisEventId_idx" ON "RequestEvent"("crisisEventId");

-- CreateIndex
CREATE INDEX "Vote_requestId_idx" ON "Vote"("requestId");

-- CreateIndex
CREATE INDEX "Vote_userId_idx" ON "Vote"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Vote_requestId_userId_voteType_key" ON "Vote"("requestId", "userId", "voteType");

-- CreateIndex
CREATE INDEX "Message_senderId_idx" ON "Message"("senderId");

-- CreateIndex
CREATE INDEX "Message_receiverId_idx" ON "Message"("receiverId");

-- CreateIndex
CREATE INDEX "Message_read_idx" ON "Message"("read");

-- CreateIndex
CREATE INDEX "Message_createdAt_idx" ON "Message"("createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Notification_read_idx" ON "Notification"("read");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

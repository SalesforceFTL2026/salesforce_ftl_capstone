-- CreateTable
CREATE TABLE "ResourceAllocation" (
    "id" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResourceAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ResourceAllocation_resourceId_idx" ON "ResourceAllocation"("resourceId");

-- CreateIndex
CREATE INDEX "ResourceAllocation_requestId_idx" ON "ResourceAllocation"("requestId");

-- AddForeignKey
ALTER TABLE "ResourceAllocation" ADD CONSTRAINT "ResourceAllocation_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceAllocation" ADD CONSTRAINT "ResourceAllocation_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

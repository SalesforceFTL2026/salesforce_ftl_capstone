-- AlterTable: external-feed ingestion fields on CrisisEvent (all nullable,
-- so existing internally-detected crises are unaffected).
ALTER TABLE "CrisisEvent" ADD COLUMN "source" TEXT;
ALTER TABLE "CrisisEvent" ADD COLUMN "externalId" TEXT;
ALTER TABLE "CrisisEvent" ADD COLUMN "latitude" DOUBLE PRECISION;
ALTER TABLE "CrisisEvent" ADD COLUMN "longitude" DOUBLE PRECISION;
ALTER TABLE "CrisisEvent" ADD COLUMN "url" TEXT;

-- Unique key lets the daily ingest job upsert on (source, externalId).
-- NULLs are distinct in Postgres, so internal crises (source = NULL) never
-- collide with each other or with ingested events.
CREATE UNIQUE INDEX "CrisisEvent_source_externalId_key" ON "CrisisEvent"("source", "externalId");

CREATE INDEX "CrisisEvent_source_idx" ON "CrisisEvent"("source");

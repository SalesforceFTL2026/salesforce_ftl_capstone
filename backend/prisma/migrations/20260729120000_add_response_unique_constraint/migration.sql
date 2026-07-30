-- Enforce one Response per (request, responder, responderType) at the database
-- level. The controllers already dedupe in app code (findFirst-then-create),
-- but two concurrent "I can help" / "assign" clicks could race past that check
-- and create duplicate rows. This unique index makes the DB the source of truth.
--
-- responderType is part of the key so the seeded demo admin, who can act as both
-- a volunteer and an organization on the same request, isn't wrongly blocked
-- from holding one response of each type.

-- CreateIndex
CREATE UNIQUE INDEX "Response_requestId_responderId_responderType_key" ON "Response"("requestId", "responderId", "responderType");

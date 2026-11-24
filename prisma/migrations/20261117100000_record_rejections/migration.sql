-- Record who rejected a question and when, mirroring approvedById / approvedAt.
ALTER TABLE "questions" ADD COLUMN "rejectedById" TEXT;
ALTER TABLE "questions" ADD COLUMN "rejectedAt" TIMESTAMP(3);
ALTER TABLE "questions" ADD CONSTRAINT "questions_rejectedById_fkey"
  FOREIGN KEY ("rejectedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Existing rejections predate this tracking: the reviewer is unknown, and the last
-- update is the best available rejection time. A few test rejections had no reason.
UPDATE "questions" SET "rejectedAt" = "updatedAt" WHERE "status" = 'REJECTED';
UPDATE "questions" SET "rejectionReason" = '(no reason recorded)'
  WHERE "status" = 'REJECTED' AND ("rejectionReason" IS NULL OR btrim("rejectionReason") = '');

-- rejectedAt is set exactly when the question is rejected, and every rejection has a reason.
-- (rejectedById is not included: it becomes NULL if the reviewer's account is deleted.)
ALTER TABLE "questions" ADD CONSTRAINT "questions_rejection_consistency"
  CHECK (("status" = 'REJECTED') = ("rejectedAt" IS NOT NULL));
ALTER TABLE "questions" ADD CONSTRAINT "questions_rejection_reason_required"
  CHECK ("status" <> 'REJECTED' OR btrim(coalesce("rejectionReason", '')) <> '');

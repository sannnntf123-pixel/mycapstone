-- Defence in depth: the API already validates these rules; the database now
-- enforces them too, so a bug or a manual SQL edit cannot store invalid data.

-- A question's chapter must belong to the question's curriculum.
CREATE UNIQUE INDEX "chapters_id_curriculumId_key" ON "chapters"("id", "curriculumId");
ALTER TABLE "questions" DROP CONSTRAINT "questions_chapterId_fkey";
ALTER TABLE "questions" ADD CONSTRAINT "questions_chapterId_curriculumId_fkey"
  FOREIGN KEY ("chapterId", "curriculumId") REFERENCES "chapters"("id", "curriculumId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Value ranges.
ALTER TABLE "questions" ADD CONSTRAINT "questions_difficulty_range"
  CHECK ("difficulty" BETWEEN 1 AND 5);
ALTER TABLE "questions" ADD CONSTRAINT "questions_estimated_time_range"
  CHECK ("estimatedTimeMinutes" BETWEEN 1 AND 600);
ALTER TABLE "questions" ADD CONSTRAINT "questions_times_used_non_negative"
  CHECK ("timesUsed" >= 0);
ALTER TABLE "chapters" ADD CONSTRAINT "chapters_order_index_positive"
  CHECK ("orderIndex" > 0);

-- approvedAt is set exactly when the question is approved.
-- (approvedById is not included: it becomes NULL if the approver's account is deleted.)
ALTER TABLE "questions" ADD CONSTRAINT "questions_approval_consistency"
  CHECK (("status" = 'APPROVED') = ("approvedAt" IS NOT NULL));

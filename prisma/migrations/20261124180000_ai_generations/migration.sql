-- AI question generation: one row per call to Claude, linked from the questions it produced.

-- AlterTable
ALTER TABLE "questions" ADD COLUMN     "aiGenerationId" TEXT;

-- CreateTable
CREATE TABLE "ai_generations" (
    "id" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "curriculumId" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "params" JSONB NOT NULL,
    "model" TEXT NOT NULL,
    "drafts" JSONB NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "submittedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_generations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_generations_createdById_createdAt_idx" ON "ai_generations"("createdById", "createdAt");

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_aiGenerationId_fkey" FOREIGN KEY ("aiGenerationId") REFERENCES "ai_generations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_generations" ADD CONSTRAINT "ai_generations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_generations" ADD CONSTRAINT "ai_generations_curriculumId_fkey" FOREIGN KEY ("curriculumId") REFERENCES "curricula"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Rules the API also enforces.
ALTER TABLE "ai_generations" ADD CONSTRAINT "ai_generations_counts_non_negative"
  CHECK ("inputTokens" >= 0 AND "outputTokens" >= 0 AND "submittedCount" >= 0);
-- A question linked to a generation must be labelled AI. (Older AI questions, from before
-- this table existed, have no generation, so the reverse isn't enforced.)
ALTER TABLE "questions" ADD CONSTRAINT "questions_ai_generation_is_ai"
  CHECK ("aiGenerationId" IS NULL OR "source" = 'AI');

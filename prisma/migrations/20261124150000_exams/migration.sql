-- Generated exams: an exam (DRAFT or FINAL) and its ordered questions.

-- CreateEnum
CREATE TYPE "ExamStatus" AS ENUM ('DRAFT', 'FINAL');

-- CreateTable
CREATE TABLE "exams" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "curriculumId" TEXT NOT NULL,
    "chapterIds" TEXT[],
    "targetDifficulty" INTEGER,
    "durationMinutes" INTEGER NOT NULL,
    "status" "ExamStatus" NOT NULL DEFAULT 'DRAFT',
    "warnings" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdById" TEXT NOT NULL,
    "finalizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_questions" (
    "examId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "exam_questions_pkey" PRIMARY KEY ("examId","questionId")
);

-- CreateIndex
CREATE INDEX "exams_createdById_createdAt_idx" ON "exams"("createdById", "createdAt");

-- CreateIndex
CREATE INDEX "exam_questions_questionId_idx" ON "exam_questions"("questionId");

-- AddForeignKey
ALTER TABLE "exams" ADD CONSTRAINT "exams_curriculumId_fkey" FOREIGN KEY ("curriculumId") REFERENCES "curricula"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exams" ADD CONSTRAINT "exams_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_questions" ADD CONSTRAINT "exam_questions_examId_fkey" FOREIGN KEY ("examId") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_questions" ADD CONSTRAINT "exam_questions_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Rules the API also enforces, so bad data can't be stored by a bug or manual SQL.
ALTER TABLE "exams" ADD CONSTRAINT "exams_duration_range"
  CHECK ("durationMinutes" BETWEEN 5 AND 600);
ALTER TABLE "exams" ADD CONSTRAINT "exams_target_difficulty_range"
  CHECK ("targetDifficulty" IS NULL OR "targetDifficulty" BETWEEN 1 AND 5);
ALTER TABLE "exams" ADD CONSTRAINT "exams_title_not_blank"
  CHECK (btrim("title") <> '');
ALTER TABLE "exams" ADD CONSTRAINT "exams_has_chapters"
  CHECK (cardinality("chapterIds") > 0);
-- finalizedAt is set exactly when the exam is final.
ALTER TABLE "exams" ADD CONSTRAINT "exams_final_consistency"
  CHECK (("status" = 'FINAL') = ("finalizedAt" IS NOT NULL));
ALTER TABLE "exam_questions" ADD CONSTRAINT "exam_questions_position_positive"
  CHECK ("position" > 0);

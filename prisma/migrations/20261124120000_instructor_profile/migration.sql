-- Instructor profile collected at sign-up: major, highest degree, university, courses taught.
CREATE TYPE "Degree" AS ENUM ('BACHELOR', 'MASTER', 'DOCTORATE', 'OTHER');

ALTER TABLE "users" ADD COLUMN "major" TEXT;
ALTER TABLE "users" ADD COLUMN "degree" "Degree";
ALTER TABLE "users" ADD COLUMN "university" TEXT;
ALTER TABLE "users" ADD COLUMN "courses" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Majors become a fixed list, so "same major" can be checked exactly when reviewing.
CREATE TYPE "Major" AS ENUM (
  'MATHEMATICS', 'COMPUTER_SCIENCE', 'PHYSICS', 'CHEMISTRY', 'BIOLOGY', 'ENGINEERING',
  'MEDICINE', 'PHARMACY', 'BUSINESS', 'ECONOMICS', 'LANGUAGES', 'EDUCATION',
  'PSYCHOLOGY', 'LAW', 'ARTS'
);

ALTER TABLE "users" ADD COLUMN "major_new" "Major";

-- Map the majors people typed before. Anything unrecognised becomes NULL: that
-- instructor can still review their own private questions, but no shared ones.
UPDATE "users" SET "major_new" = (CASE
  WHEN lower(btrim("major")) IN ('mathematics', 'math', 'maths', 'applied mathematics', 'applied math', 'statistics', 'mathematics and statistics') THEN 'MATHEMATICS'
  WHEN lower(btrim("major")) IN ('computer science', 'cs', 'computing', 'computer engineering', 'software engineering', 'information technology', 'it') THEN 'COMPUTER_SCIENCE'
  WHEN lower(btrim("major")) IN ('physics', 'applied physics') THEN 'PHYSICS'
  WHEN lower(btrim("major")) IN ('chemistry', 'biochemistry') THEN 'CHEMISTRY'
  WHEN lower(btrim("major")) IN ('biology', 'biological sciences', 'life sciences') THEN 'BIOLOGY'
  WHEN lower(btrim("major")) IN ('engineering', 'civil engineering', 'mechanical engineering', 'electrical engineering') THEN 'ENGINEERING'
  WHEN lower(btrim("major")) IN ('medicine', 'medical sciences') THEN 'MEDICINE'
  WHEN lower(btrim("major")) IN ('pharmacy') THEN 'PHARMACY'
  WHEN lower(btrim("major")) IN ('business', 'management', 'business administration', 'accounting', 'finance', 'marketing') THEN 'BUSINESS'
  WHEN lower(btrim("major")) IN ('economics') THEN 'ECONOMICS'
  WHEN lower(btrim("major")) IN ('english', 'arabic', 'french', 'languages', 'literature', 'linguistics') THEN 'LANGUAGES'
  WHEN lower(btrim("major")) IN ('education') THEN 'EDUCATION'
  WHEN lower(btrim("major")) IN ('psychology') THEN 'PSYCHOLOGY'
  WHEN lower(btrim("major")) IN ('law') THEN 'LAW'
  WHEN lower(btrim("major")) IN ('art', 'arts', 'design', 'graphic design', 'architecture') THEN 'ARTS'
END)::"Major";

ALTER TABLE "users" DROP COLUMN "major";
ALTER TABLE "users" RENAME COLUMN "major_new" TO "major";

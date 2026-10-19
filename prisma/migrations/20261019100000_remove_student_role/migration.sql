-- The system is instructor-only. Students could never own curricula or
-- questions, so deleting their accounts cannot orphan any data.
DELETE FROM "users" WHERE "role" = 'STUDENT';

-- PostgreSQL cannot drop a value from an enum, so the type is recreated.
CREATE TYPE "Role_new" AS ENUM ('INSTRUCTOR');
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "Role_old";
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'INSTRUCTOR';

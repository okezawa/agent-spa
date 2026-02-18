-- CreateEnum
CREATE TYPE "BranchStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- AlterTable
ALTER TABLE "Branch"
ADD COLUMN "code" TEXT,
ADD COLUMN "status" "BranchStatus" NOT NULL DEFAULT 'ACTIVE';

-- Backfill existing records
UPDATE "Branch"
SET "code" = LPAD("id"::text, 6, '0')
WHERE "code" IS NULL;

UPDATE "Branch"
SET "status" = CASE
  WHEN "isActive" = true THEN 'ACTIVE'::"BranchStatus"
  ELSE 'INACTIVE'::"BranchStatus"
END;

-- Make code required
ALTER TABLE "Branch"
ALTER COLUMN "code" SET NOT NULL;

-- Remove old column
ALTER TABLE "Branch"
DROP COLUMN "isActive";

-- CreateIndex
CREATE UNIQUE INDEX "Branch_code_key" ON "Branch"("code");

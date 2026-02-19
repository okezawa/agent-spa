ALTER TABLE "Guest" ADD COLUMN "memberCode" TEXT;

UPDATE "Guest"
SET "memberCode" = LPAD("id"::text, 6, '0')
WHERE "memberCode" IS NULL;

ALTER TABLE "Guest" ALTER COLUMN "memberCode" SET NOT NULL;

CREATE UNIQUE INDEX "Guest_memberCode_key" ON "Guest"("memberCode");

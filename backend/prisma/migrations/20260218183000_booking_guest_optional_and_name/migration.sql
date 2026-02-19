ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "guestName" TEXT;

UPDATE "Booking" b
SET "guestName" = COALESCE(g."firstName" || ' ' || g."lastName", 'Walk-in Guest')
FROM "Guest" g
WHERE b."guestId" = g."id" AND b."guestName" IS NULL;

UPDATE "Booking"
SET "guestName" = 'Walk-in Guest'
WHERE "guestName" IS NULL;

ALTER TABLE "Booking" ALTER COLUMN "guestName" SET NOT NULL;

ALTER TABLE "Booking" ALTER COLUMN "guestId" DROP NOT NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Booking_guestId_fkey') THEN
    ALTER TABLE "Booking" DROP CONSTRAINT "Booking_guestId_fkey";
  END IF;

  ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_guestId_fkey"
  FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
END
$$;

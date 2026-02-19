CREATE TABLE IF NOT EXISTS "BookingEmployee" (
  "bookingId" INTEGER NOT NULL,
  "employeeId" INTEGER NOT NULL,
  CONSTRAINT "BookingEmployee_pkey" PRIMARY KEY ("bookingId", "employeeId")
);

CREATE INDEX IF NOT EXISTS "BookingEmployee_employeeId_idx" ON "BookingEmployee"("employeeId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BookingEmployee_bookingId_fkey') THEN
    ALTER TABLE "BookingEmployee"
    ADD CONSTRAINT "BookingEmployee_bookingId_fkey"
    FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BookingEmployee_employeeId_fkey') THEN
    ALTER TABLE "BookingEmployee"
    ADD CONSTRAINT "BookingEmployee_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;

INSERT INTO "BookingEmployee" ("bookingId", "employeeId")
SELECT "id", "employeeId" FROM "Booking"
ON CONFLICT ("bookingId", "employeeId") DO NOTHING;

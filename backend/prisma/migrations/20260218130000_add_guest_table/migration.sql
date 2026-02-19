CREATE TABLE "Guest" (
    "id" SERIAL NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "citizenId" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "lineId" TEXT,
    "otherNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Guest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Guest_citizenId_key" ON "Guest"("citizenId");

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

function isGuestSchemaMissingError(error) {
  return error?.code === "P2022" && error?.meta?.modelName === "Guest";
}

async function ensureGuestSchema() {
  await prisma.$executeRawUnsafe(
    'ALTER TABLE "Guest" ADD COLUMN IF NOT EXISTS "memberCode" TEXT',
  );
  await prisma.$executeRawUnsafe(
    'ALTER TABLE "Guest" ADD COLUMN IF NOT EXISTS "dateOfBirth" TIMESTAMP(3)',
  );
  await prisma.$executeRawUnsafe(
    'UPDATE "Guest" SET "memberCode" = LPAD("id"::text, 6, \'0\') WHERE "memberCode" IS NULL',
  );
  await prisma.$executeRawUnsafe(
    'CREATE UNIQUE INDEX IF NOT EXISTS "Guest_memberCode_key" ON "Guest"("memberCode")',
  );
}

async function withGuestSchemaRepair(operation) {
  try {
    return await operation();
  } catch (error) {
    if (!isGuestSchemaMissingError(error)) {
      throw error;
    }
    await ensureGuestSchema();
    return operation();
  }
}

function calculateAge(dateOfBirth) {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  const dayDiff = today.getDate() - dob.getDate();

  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age -= 1;
  }
  return age >= 0 ? age : null;
}

function mapGuest(guest) {
  return {
    ...guest,
    age: calculateAge(guest.dateOfBirth),
  };
}

async function listGuests(_req, res, next) {
  try {
    const guests = await withGuestSchemaRepair(() =>
      prisma.guest.findMany({
        orderBy: { createdAt: "desc" },
      }),
    );
    res.json(guests.map(mapGuest));
  } catch (error) {
    next(error);
  }
}

async function searchGuests(req, res, next) {
  try {
    const q = String(req.query?.q || "").trim();
    if (!q) {
      return res.json([]);
    }

    const guests = await withGuestSchemaRepair(() =>
      prisma.guest.findMany({
        where: {
          OR: [
            { memberCode: { contains: q, mode: "insensitive" } },
            { firstName: { contains: q, mode: "insensitive" } },
            { lastName: { contains: q, mode: "insensitive" } },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    );

    res.json(guests.map(mapGuest));
  } catch (error) {
    next(error);
  }
}

async function createGuest(req, res, next) {
  try {
    const {
      firstName,
      lastName,
      citizenId,
      address,
      phone,
      country,
      lineId,
      otherNotes,
      dateOfBirth,
    } = req.body || {};

    const normalizedFirstName = String(firstName || "").trim();
    const normalizedLastName = String(lastName || "").trim();
    const normalizedCitizenId = String(citizenId || "").trim();
    const normalizedAddress = String(address || "").trim();
    const normalizedPhone = String(phone || "").trim();
    const normalizedCountry = String(country || "").trim();
    const normalizedLineId = String(lineId || "").trim();
    const normalizedOtherNotes = String(otherNotes || "").trim();
    const normalizedDateOfBirth = String(dateOfBirth || "").trim();

    if (!normalizedFirstName) {
      return res.status(400).json({ message: "firstName is required" });
    }
    if (!normalizedLastName) {
      return res.status(400).json({ message: "lastName is required" });
    }
    if (!normalizedCitizenId) {
      return res.status(400).json({ message: "citizenId is required" });
    }
    if (!/^\d{13}$/.test(normalizedCitizenId)) {
      return res.status(400).json({ message: "citizenId must be 13 digits" });
    }
    if (!normalizedPhone) {
      return res.status(400).json({ message: "phone is required" });
    }
    if (!normalizedCountry) {
      return res.status(400).json({ message: "country is required" });
    }
    if (!normalizedDateOfBirth) {
      return res.status(400).json({ message: "dateOfBirth is required" });
    }

    const parsedDateOfBirth = new Date(normalizedDateOfBirth);
    if (Number.isNaN(parsedDateOfBirth.getTime())) {
      return res.status(400).json({ message: "dateOfBirth is invalid" });
    }
    if (parsedDateOfBirth > new Date()) {
      return res.status(400).json({ message: "dateOfBirth cannot be in the future" });
    }

    const guest = await withGuestSchemaRepair(() => prisma.$transaction(async (tx) => {
      const sequenceRows = await tx.$queryRaw`
        SELECT nextval(pg_get_serial_sequence('"Guest"', 'id'))::int AS next_id
      `;
      const nextId = Number(sequenceRows?.[0]?.next_id);
      const memberCode = String(nextId).padStart(6, "0");

      return tx.guest.create({
        data: {
          id: nextId,
          memberCode,
          firstName: normalizedFirstName,
          lastName: normalizedLastName,
          citizenId: normalizedCitizenId,
          dateOfBirth: parsedDateOfBirth,
          address: normalizedAddress || null,
          phone: normalizedPhone,
          country: normalizedCountry,
          lineId: normalizedLineId || null,
          otherNotes: normalizedOtherNotes || null,
        },
      });
    }));

    res.status(201).json(mapGuest(guest));
  } catch (error) {
    if (error?.code === "P2002") {
      return res.status(409).json({ message: "citizenId already exists" });
    }
    next(error);
  }
}

async function disconnectGuestPrisma() {
  await prisma.$disconnect();
}

module.exports = {
  listGuests,
  searchGuests,
  createGuest,
  disconnectGuestPrisma,
};

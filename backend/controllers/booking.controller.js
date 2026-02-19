const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const allowedBookingStatuses = ["BOOKED", "COMPLETED", "CANCELLED"];

function isBookingSchemaMissingError(error) {
  if (error?.code === "P2021" && ["Booking", "BookingEmployee"].includes(error?.meta?.modelName)) {
    return true;
  }
  if (error?.code === "P2022") {
    const modelName = String(error?.meta?.modelName || "");
    const column = String(error?.meta?.column || "");
    return (
      modelName === "Booking" ||
      modelName === "BookingEmployee" ||
      column.includes("Booking.") ||
      column.includes("BookingEmployee.")
    );
  }
  return false;
}

async function ensureBookingSchema() {
  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BookingStatus') THEN
        CREATE TYPE "BookingStatus" AS ENUM ('BOOKED', 'COMPLETED', 'CANCELLED');
      END IF;
    END
    $$;
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Booking" (
      "id" SERIAL NOT NULL,
      "guestId" INTEGER,
      "guestName" TEXT NOT NULL,
      "guestPhone" TEXT,
      "roomId" INTEGER NOT NULL,
      "serviceId" INTEGER NOT NULL,
      "employeeId" INTEGER NOT NULL,
      "startAt" TIMESTAMP(3) NOT NULL,
      "endAt" TIMESTAMP(3) NOT NULL,
      "status" "BookingStatus" NOT NULL DEFAULT 'BOOKED',
      "notes" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "BookingEmployee" (
      "bookingId" INTEGER NOT NULL,
      "employeeId" INTEGER NOT NULL,
      CONSTRAINT "BookingEmployee_pkey" PRIMARY KEY ("bookingId", "employeeId")
    );
  `);

  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "Booking_startAt_idx" ON "Booking"("startAt")',
  );
  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "Booking_roomId_startAt_idx" ON "Booking"("roomId", "startAt")',
  );
  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "Booking_employeeId_startAt_idx" ON "Booking"("employeeId", "startAt")',
  );
  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "BookingEmployee_employeeId_idx" ON "BookingEmployee"("employeeId")',
  );

  await prisma.$executeRawUnsafe(
    'ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "guestName" TEXT',
  );
  await prisma.$executeRawUnsafe(
    'ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "guestPhone" TEXT',
  );
  await prisma.$executeRawUnsafe(
    'UPDATE "Booking" SET "guestName" = \'Walk-in Guest\' WHERE "guestName" IS NULL',
  );
  await prisma.$executeRawUnsafe(
    'ALTER TABLE "Booking" ALTER COLUMN "guestName" SET NOT NULL',
  );
  await prisma.$executeRawUnsafe(
    'ALTER TABLE "Booking" ALTER COLUMN "guestId" DROP NOT NULL',
  );

  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Booking_guestId_fkey') THEN
        ALTER TABLE "Booking"
        ADD CONSTRAINT "Booking_guestId_fkey"
        FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
      ELSE
        ALTER TABLE "Booking" DROP CONSTRAINT "Booking_guestId_fkey";
        ALTER TABLE "Booking"
        ADD CONSTRAINT "Booking_guestId_fkey"
        FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
      END IF;

      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Booking_roomId_fkey') THEN
        ALTER TABLE "Booking"
        ADD CONSTRAINT "Booking_roomId_fkey"
        FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
      END IF;

      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Booking_serviceId_fkey') THEN
        ALTER TABLE "Booking"
        ADD CONSTRAINT "Booking_serviceId_fkey"
        FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
      END IF;

      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Booking_employeeId_fkey') THEN
        ALTER TABLE "Booking"
        ADD CONSTRAINT "Booking_employeeId_fkey"
        FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
      END IF;

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
  `);

  await prisma.$executeRawUnsafe(`
    INSERT INTO "BookingEmployee" ("bookingId", "employeeId")
    SELECT "id", "employeeId" FROM "Booking"
    ON CONFLICT ("bookingId", "employeeId") DO NOTHING;
  `);
}

async function withBookingSchemaRepair(operation) {
  try {
    return await operation();
  } catch (error) {
    if (!isBookingSchemaMissingError(error)) {
      throw error;
    }
    await ensureBookingSchema();
    return operation();
  }
}

const bookingInclude = {
  guest: {
    select: {
      id: true,
      memberCode: true,
      firstName: true,
      lastName: true,
      phone: true,
    },
  },
  room: {
    include: {
      branch: {
        select: { id: true, code: true, name: true },
      },
    },
  },
  service: {
    select: {
      id: true,
      name: true,
      durationMinutes: true,
      pricePerUnit: true,
    },
  },
  employee: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      position: true,
      status: true,
    },
  },
  assignedEmployees: {
    include: {
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          position: true,
          status: true,
        },
      },
    },
  },
};

function parseDate(input) {
  if (!input) return null;
  const value = new Date(input);
  if (Number.isNaN(value.getTime())) return null;
  return value;
}

async function validateBookingPayload(payload, currentBookingId) {
  const { guestId, guestName, guestPhone, roomId, serviceId, employeeIds, employeeId, startAt, endAt, notes, status } = payload || {};

  const parsedGuestId = guestId === null || guestId === undefined || guestId === "" ? null : Number(guestId);
  const parsedGuestName = String(guestName || "").trim();
  const parsedGuestPhone = String(guestPhone || "").trim();
  const parsedRoomId = Number(roomId);
  const parsedServiceId = Number(serviceId);
  const parsedEmployeeIds = Array.isArray(employeeIds)
    ? [...new Set(employeeIds.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0))]
    : Number.isInteger(Number(employeeId)) && Number(employeeId) > 0
      ? [Number(employeeId)]
      : [];
  const parsedStartAt = parseDate(startAt);
  const parsedEndAt = parseDate(endAt);

  if (!parsedGuestName) {
    return { error: "guestName is required" };
  }
  if (!parsedGuestPhone) {
    return { error: "guestPhone is required" };
  }
  if (parsedGuestId !== null && (!Number.isInteger(parsedGuestId) || parsedGuestId <= 0)) {
    return { error: "guestId is invalid" };
  }
  if (!Number.isInteger(parsedRoomId) || parsedRoomId <= 0) {
    return { error: "roomId is required" };
  }
  if (!Number.isInteger(parsedServiceId) || parsedServiceId <= 0) {
    return { error: "serviceId is required" };
  }
  if (parsedEmployeeIds.length === 0) {
    return { error: "employeeIds is required" };
  }
  if (!parsedStartAt) {
    return { error: "startAt is required and must be valid datetime" };
  }
  if (endAt && !parsedEndAt) {
    return { error: "endAt must be valid datetime" };
  }
  if (status && !allowedBookingStatuses.includes(status)) {
    return { error: "status must be BOOKED, COMPLETED, or CANCELLED" };
  }

  const [guest, room, service, selectedEmployees, selectedProviders] = await Promise.all([
    parsedGuestId
      ? prisma.guest.findUnique({ where: { id: parsedGuestId }, select: { id: true, firstName: true, lastName: true, phone: true } })
      : Promise.resolve(null),
    prisma.room.findUnique({ where: { id: parsedRoomId }, select: { id: true, status: true } }),
    prisma.service.findUnique({ where: { id: parsedServiceId }, select: { id: true, durationMinutes: true } }),
    prisma.employee.findMany({
      where: { id: { in: parsedEmployeeIds } },
      select: { id: true, status: true, position: true },
    }),
    prisma.serviceProvider.findMany({
      where: { serviceId: parsedServiceId, employeeId: { in: parsedEmployeeIds } },
      select: { employeeId: true },
    }),
  ]);

  if (parsedGuestId && !guest) return { error: "guest not found" };
  if (!room) return { error: "room not found" };
  if (room.status !== "OPEN") return { error: "selected room is under maintenance" };
  if (!service) return { error: "service not found" };
  if (selectedEmployees.length !== parsedEmployeeIds.length) {
    return { error: "selected employees are invalid" };
  }
  if (selectedEmployees.some((employee) => employee.status !== "APPROVED")) {
    return { error: "selected employees are not approved" };
  }
  if (
    selectedEmployees.some((employee) => {
      const position = String(employee.position || "").trim().toLowerCase();
      return position !== "nurse" && position !== "therapist";
    })
  ) {
    return { error: "selected employees must be nurse or therapist" };
  }
  if (selectedProviders.length !== parsedEmployeeIds.length) {
    return { error: "some selected employees do not provide this service" };
  }

  const computedEndAt = parsedEndAt || new Date(parsedStartAt.getTime() + service.durationMinutes * 60 * 1000);
  if (computedEndAt <= parsedStartAt) {
    return { error: "endAt must be after startAt" };
  }

  const overlapWhere = {
    id: currentBookingId ? { not: currentBookingId } : undefined,
    status: { in: ["BOOKED", "COMPLETED"] },
    startAt: { lt: computedEndAt },
    endAt: { gt: parsedStartAt },
  };

  const [roomConflict, selectedEmployeeConflicts] = await Promise.all([
    prisma.booking.findFirst({
      where: {
        ...overlapWhere,
        roomId: parsedRoomId,
      },
      select: { id: true },
    }),
    prisma.booking.findFirst({
      where: {
        ...overlapWhere,
        assignedEmployees: {
          some: {
            employeeId: {
              in: parsedEmployeeIds,
            },
          },
        },
      },
      select: { id: true },
    }),
  ]);

  if (roomConflict) {
    return { error: "room is already booked in this time slot" };
  }
  if (selectedEmployeeConflicts) {
    return { error: "one or more selected employees are already booked in this time slot" };
  }

  return {
    value: {
      employeeIds: parsedEmployeeIds,
      guestId: parsedGuestId,
      guestName: parsedGuestId && guest ? `${guest.firstName} ${guest.lastName}` : parsedGuestName,
      guestPhone: parsedGuestId && guest ? guest.phone : parsedGuestPhone,
      roomId: parsedRoomId,
      serviceId: parsedServiceId,
      employeeId: parsedEmployeeIds[0],
      startAt: parsedStartAt,
      endAt: computedEndAt,
      status: status || "BOOKED",
      notes: String(notes || "").trim() || null,
    },
  };
}

async function listBookings(req, res, next) {
  try {
    const { from, to } = req.query;

    const parsedFrom = parseDate(from);
    const parsedTo = parseDate(to);

    if (from && !parsedFrom) {
      return res.status(400).json({ message: "from must be valid datetime" });
    }
    if (to && !parsedTo) {
      return res.status(400).json({ message: "to must be valid datetime" });
    }

    const bookings = await withBookingSchemaRepair(() =>
      prisma.booking.findMany({
        where: {
          ...(parsedFrom || parsedTo
            ? {
                startAt: {
                  ...(parsedFrom ? { gte: parsedFrom } : {}),
                  ...(parsedTo ? { lte: parsedTo } : {}),
                },
              }
            : {}),
        },
        include: bookingInclude,
        orderBy: { startAt: "asc" },
      }),
    );

    res.json(bookings);
  } catch (error) {
    next(error);
  }
}

async function createBooking(req, res, next) {
  try {
    await withBookingSchemaRepair(() => prisma.booking.findFirst({ select: { id: true } }));
    const validation = await validateBookingPayload(req.body);
    if (validation.error) {
      return res.status(400).json({ message: validation.error });
    }

    const booking = await withBookingSchemaRepair(async () => {
      const { employeeIds, ...bookingData } = validation.value;
      return prisma.$transaction(async (tx) => {
        const created = await tx.booking.create({
          data: bookingData,
          select: { id: true },
        });

        await tx.bookingEmployee.createMany({
          data: employeeIds.map((assignedEmployeeId) => ({
            bookingId: created.id,
            employeeId: assignedEmployeeId,
          })),
          skipDuplicates: true,
        });

        return tx.booking.findUnique({
          where: { id: created.id },
          include: bookingInclude,
        });
      });
    });

    res.status(201).json(booking);
  } catch (error) {
    next(error);
  }
}

async function updateBooking(req, res, next) {
  try {
    const bookingId = Number(req.params.id);
    if (!Number.isInteger(bookingId) || bookingId <= 0) {
      return res.status(400).json({ message: "invalid booking id" });
    }

    await withBookingSchemaRepair(() => prisma.booking.findFirst({ select: { id: true } }));
    const validation = await validateBookingPayload(req.body, bookingId);
    if (validation.error) {
      return res.status(400).json({ message: validation.error });
    }

    const booking = await withBookingSchemaRepair(async () => {
      const { employeeIds, ...bookingData } = validation.value;
      return prisma.$transaction(async (tx) => {
        await tx.booking.update({
          where: { id: bookingId },
          data: bookingData,
        });

        await tx.bookingEmployee.deleteMany({ where: { bookingId } });
        await tx.bookingEmployee.createMany({
          data: employeeIds.map((assignedEmployeeId) => ({
            bookingId,
            employeeId: assignedEmployeeId,
          })),
          skipDuplicates: true,
        });

        return tx.booking.findUnique({
          where: { id: bookingId },
          include: bookingInclude,
        });
      });
    });

    res.json(booking);
  } catch (error) {
    if (error?.code === "P2025") {
      return res.status(404).json({ message: "booking not found" });
    }
    next(error);
  }
}

function normalizeServiceIds(serviceIds) {
  if (!Array.isArray(serviceIds)) return [];
  return [...new Set(serviceIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))];
}

function normalizeEmployeeIds(employeeIds) {
  if (!Array.isArray(employeeIds)) return [];
  return [...new Set(employeeIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))];
}

function normalizeGuestBookingEntries(guestBookings) {
  if (!Array.isArray(guestBookings)) return [];
  return guestBookings
    .map((item) => ({
      guestId:
        item?.guestId === null || item?.guestId === undefined || item?.guestId === ""
          ? null
          : Number(item.guestId),
      guestName: String(item?.guestName || "").trim(),
      guestPhone: String(item?.guestPhone || "").trim(),
      startAt: parseDate(item?.startAt),
      endAt: parseDate(item?.endAt),
      serviceIds: normalizeServiceIds(item?.serviceIds),
      employeeIds: normalizeEmployeeIds(item?.employeeIds),
    }))
    .filter(
      (item) =>
        item.guestName &&
        item.guestPhone &&
        !!item.startAt &&
        !!item.endAt &&
        item.endAt > item.startAt &&
        item.serviceIds.length > 0 &&
        item.employeeIds.length > 0,
    );
}

async function createBulkBookings(req, res, next) {
  try {
    await withBookingSchemaRepair(() => prisma.booking.findFirst({ select: { id: true } }));

    const { guestBookings, roomId, notes, status } = req.body || {};
    const normalizedGuestBookings = normalizeGuestBookingEntries(guestBookings);
    const parsedRoomId = Number(roomId);

    if (normalizedGuestBookings.length === 0) {
      return res.status(400).json({ message: "guestBookings is required" });
    }
    if (!Number.isInteger(parsedRoomId) || parsedRoomId <= 0) {
      return res.status(400).json({ message: "roomId is required" });
    }
    if (status && !allowedBookingStatuses.includes(status)) {
      return res.status(400).json({ message: "status must be BOOKED, COMPLETED, or CANCELLED" });
    }

    const room = await prisma.room.findUnique({
      where: { id: parsedRoomId },
      select: { id: true, status: true },
    });
    if (!room) {
      return res.status(400).json({ message: "room not found" });
    }
    if (room.status !== "OPEN") {
      return res.status(400).json({ message: "selected room is under maintenance" });
    }

    const allServiceIds = new Set();

    for (const guestBooking of normalizedGuestBookings) {
      const { guestId, guestName, guestPhone, serviceIds, employeeIds } = guestBooking;
      serviceIds.forEach((id) => allServiceIds.add(id));

      const [guest, selectedEmployees] = await Promise.all([
        guestId
          ? prisma.guest.findUnique({
              where: { id: guestId },
              select: { id: true, firstName: true, lastName: true, phone: true },
            })
          : Promise.resolve(null),
        prisma.employee.findMany({
          where: { id: { in: employeeIds } },
          select: { id: true, status: true, position: true },
        }),
      ]);

      if (guestId && !guest) {
        return res.status(400).json({ message: `guest not found: ${guestName}` });
      }
      if (selectedEmployees.length !== employeeIds.length) {
        return res.status(400).json({ message: `selected employees are invalid for ${guestName}` });
      }
      if (selectedEmployees.some((employee) => employee.status !== "APPROVED")) {
        return res.status(400).json({ message: `selected employees are not approved for ${guestName}` });
      }
      if (
        selectedEmployees.some((employee) => {
          const position = String(employee.position || "").trim().toLowerCase();
          return position !== "nurse" && position !== "therapist";
        })
      ) {
        return res.status(400).json({ message: `selected employees must be nurse or therapist for ${guestName}` });
      }

      for (const serviceId of serviceIds) {
        const [service, selectedProviders] = await Promise.all([
          prisma.service.findUnique({
            where: { id: serviceId },
            select: { id: true },
          }),
          prisma.serviceProvider.findMany({
            where: { serviceId, employeeId: { in: employeeIds } },
            select: { employeeId: true },
          }),
        ]);

        if (!service) {
          return res.status(400).json({ message: `service not found for ${guestName}` });
        }
        if (selectedProviders.length !== employeeIds.length) {
          return res.status(400).json({ message: `some selected employees do not provide this service for ${guestName}` });
        }
      }
    }

    for (const bookingInput of normalizedGuestBookings) {
      const { guestName, startAt: guestStartAt, endAt: guestEndAt, employeeIds } = bookingInput;
      const overlapWhere = {
        status: { in: ["BOOKED", "COMPLETED"] },
        startAt: { lt: guestEndAt },
        endAt: { gt: guestStartAt },
      };

      const [roomConflict, employeeConflict] = await Promise.all([
        prisma.booking.findFirst({
          where: { ...overlapWhere, roomId: parsedRoomId },
          select: { id: true },
        }),
        prisma.booking.findFirst({
          where: {
            ...overlapWhere,
            assignedEmployees: {
              some: {
                employeeId: { in: employeeIds },
              },
            },
          },
          select: { id: true },
        }),
      ]);

      if (roomConflict) {
        return res.status(400).json({ message: `room is already booked in this time slot for ${guestName}` });
      }
      if (employeeConflict) {
        return res.status(400).json({ message: `one or more selected employees are already booked in this time slot for ${guestName}` });
      }
    }

    const serviceRows = await prisma.service.findMany({
      where: { id: { in: [...allServiceIds] } },
      select: { id: true, name: true },
    });
    const serviceNameMap = new Map(serviceRows.map((row) => [row.id, row.name]));
    const baseNotes = String(notes || "").trim();

    const createdBooking = await withBookingSchemaRepair(async () =>
      prisma.$transaction(async (tx) => {
        const allEmployeeIds = [
          ...new Set(normalizedGuestBookings.flatMap((item) => item.employeeIds)),
        ];
        const startAt = new Date(
          Math.min(...normalizedGuestBookings.map((item) => item.startAt.getTime())),
        );
        const endAt = new Date(
          Math.max(...normalizedGuestBookings.map((item) => item.endAt.getTime())),
        );
        const primary = normalizedGuestBookings[0];
        const combinedGuestName = normalizedGuestBookings.map((item) => item.guestName).join(", ");

        const bulkSummary = normalizedGuestBookings
          .map((item) => {
            const serviceNames = item.serviceIds
              .map((serviceId) => serviceNameMap.get(serviceId) || `Service#${serviceId}`)
              .join(", ");
            return `${item.guestName} (${item.guestPhone}) time:[${item.startAt.toISOString()}|${item.endAt.toISOString()}] services:[${serviceNames}] employees:[${item.employeeIds.join(", ")}]`;
          })
          .join(" | ");
        const composedNotes = [baseNotes, `bulk:${bulkSummary}`].filter(Boolean).join("\n");

        const created = await tx.booking.create({
          data: {
            guestId: primary.guestId,
            guestName: combinedGuestName || primary.guestName,
            guestPhone: primary.guestPhone,
            roomId: parsedRoomId,
            serviceId: primary.serviceIds[0],
            employeeId: allEmployeeIds[0],
            startAt,
            endAt,
            status: status || "BOOKED",
            notes: composedNotes || null,
          },
          select: { id: true },
        });

        await tx.bookingEmployee.createMany({
          data: allEmployeeIds.map((employeeId) => ({
            bookingId: created.id,
            employeeId,
          })),
          skipDuplicates: true,
        });

        const fullBooking = await tx.booking.findUnique({
          where: { id: created.id },
          include: bookingInclude,
        });
        return [fullBooking];
      }),
    );

    res.status(201).json(createdBooking);
  } catch (error) {
    next(error);
  }
}

async function cancelBooking(req, res, next) {
  try {
    const bookingId = Number(req.params.id);
    if (!Number.isInteger(bookingId) || bookingId <= 0) {
      return res.status(400).json({ message: "invalid booking id" });
    }

    await withBookingSchemaRepair(() => prisma.booking.findFirst({ select: { id: true } }));
    const booking = await withBookingSchemaRepair(() =>
      prisma.booking.update({
        where: { id: bookingId },
        data: { status: "CANCELLED" },
        include: bookingInclude,
      }),
    );

    res.json(booking);
  } catch (error) {
    if (error?.code === "P2025") {
      return res.status(404).json({ message: "booking not found" });
    }
    next(error);
  }
}

async function disconnectBookingPrisma() {
  await prisma.$disconnect();
}

module.exports = {
  listBookings,
  createBooking,
  createBulkBookings,
  updateBooking,
  cancelBooking,
  disconnectBookingPrisma,
};

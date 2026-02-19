const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const allowedRoomStatuses = ["OPEN", "MAINTENANCE"];
const allowedRoomColors = [
  "#2563EB",
  "#16A34A",
  "#EA580C",
  "#DC2626",
  "#7C3AED",
  "#DB2777",
  "#0891B2",
  "#4F46E5",
  "#0F766E",
];

function isRoomSchemaMissingError(error) {
  if (error?.code !== "P2022") return false;
  const modelName = String(error?.meta?.modelName || "");
  const column = String(error?.meta?.column || "");
  return modelName === "Room" || column.includes("Room.color");
}

async function ensureRoomSchema() {
  await prisma.$executeRawUnsafe(
    'ALTER TABLE "Room" ADD COLUMN IF NOT EXISTS "color" TEXT',
  );
  await prisma.$executeRawUnsafe(
    `UPDATE "Room" SET "color" = '#2563EB' WHERE "color" IS NULL OR "color" = ''`,
  );
  await prisma.$executeRawUnsafe(
    'ALTER TABLE "Room" ALTER COLUMN "color" SET NOT NULL',
  );
}

async function withRoomSchemaRepair(operation) {
  try {
    return await operation();
  } catch (error) {
    if (!isRoomSchemaMissingError(error)) {
      throw error;
    }
    await ensureRoomSchema();
    return operation();
  }
}

const roomInclude = {
  branch: {
    select: {
      id: true,
      code: true,
      name: true,
      status: true,
    },
  },
};

async function listRooms(req, res, next) {
  try {
    const { status, branchId } = req.query;

    if (status && !allowedRoomStatuses.includes(status)) {
      return res.status(400).json({ message: "status must be OPEN or MAINTENANCE" });
    }

    const parsedBranchId = branchId ? Number(branchId) : undefined;
    if (branchId && (!Number.isInteger(parsedBranchId) || parsedBranchId <= 0)) {
      return res.status(400).json({ message: "branchId must be a positive integer" });
    }

    const rooms = await withRoomSchemaRepair(() => prisma.room.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(parsedBranchId ? { branchId: parsedBranchId } : {}),
      },
      include: roomInclude,
      orderBy: [{ branch: { name: "asc" } }, { name: "asc" }],
    }));

    res.json(rooms);
  } catch (error) {
    next(error);
  }
}

async function createRoom(req, res, next) {
  try {
    const { name, roomType, color, branchId, status } = req.body || {};

    const normalizedName = String(name || "").trim();
    const normalizedRoomType = String(roomType || "").trim();
    const normalizedColor = String(color || "#2563EB").trim().toUpperCase();
    const normalizedBranchId = Number(branchId);

    if (!normalizedName) {
      return res.status(400).json({ message: "room name is required" });
    }
    if (!normalizedRoomType) {
      return res.status(400).json({ message: "room type is required" });
    }
    if (!Number.isInteger(normalizedBranchId) || normalizedBranchId <= 0) {
      return res.status(400).json({ message: "branchId is required" });
    }
    if (status && !allowedRoomStatuses.includes(status)) {
      return res.status(400).json({ message: "status must be OPEN or MAINTENANCE" });
    }
    if (!allowedRoomColors.includes(normalizedColor)) {
      return res.status(400).json({ message: "color is invalid" });
    }

    const branch = await prisma.branch.findUnique({
      where: { id: normalizedBranchId },
      select: { id: true, status: true },
    });

    if (!branch || branch.status !== "ACTIVE") {
      return res.status(400).json({ message: "selected branch is invalid or inactive" });
    }

    const room = await withRoomSchemaRepair(() => prisma.room.create({
      data: {
        name: normalizedName,
        roomType: normalizedRoomType,
        color: normalizedColor,
        branchId: normalizedBranchId,
        status: status || "OPEN",
      },
      include: roomInclude,
    }));

    res.status(201).json(room);
  } catch (error) {
    if (error?.code === "P2002") {
      return res.status(409).json({ message: "room name already exists in this branch" });
    }
    next(error);
  }
}

async function updateRoom(req, res, next) {
  try {
    const roomId = Number(req.params.id);
    const { name, roomType, color, branchId, status } = req.body || {};

    if (!Number.isInteger(roomId) || roomId <= 0) {
      return res.status(400).json({ message: "invalid room id" });
    }

    const normalizedName = String(name || "").trim();
    const normalizedRoomType = String(roomType || "").trim();
    const normalizedColor = String(color || "#2563EB").trim().toUpperCase();
    const normalizedBranchId = Number(branchId);

    if (!normalizedName) {
      return res.status(400).json({ message: "room name is required" });
    }
    if (!normalizedRoomType) {
      return res.status(400).json({ message: "room type is required" });
    }
    if (!Number.isInteger(normalizedBranchId) || normalizedBranchId <= 0) {
      return res.status(400).json({ message: "branchId is required" });
    }
    if (status && !allowedRoomStatuses.includes(status)) {
      return res.status(400).json({ message: "status must be OPEN or MAINTENANCE" });
    }
    if (!allowedRoomColors.includes(normalizedColor)) {
      return res.status(400).json({ message: "color is invalid" });
    }

    const branch = await prisma.branch.findUnique({
      where: { id: normalizedBranchId },
      select: { id: true, status: true },
    });

    if (!branch || branch.status !== "ACTIVE") {
      return res.status(400).json({ message: "selected branch is invalid or inactive" });
    }

    const room = await withRoomSchemaRepair(() => prisma.room.update({
      where: { id: roomId },
      data: {
        name: normalizedName,
        roomType: normalizedRoomType,
        color: normalizedColor,
        branchId: normalizedBranchId,
        status: status || "OPEN",
      },
      include: roomInclude,
    }));

    res.json(room);
  } catch (error) {
    if (error?.code === "P2025") {
      return res.status(404).json({ message: "room not found" });
    }
    if (error?.code === "P2002") {
      return res.status(409).json({ message: "room name already exists in this branch" });
    }
    next(error);
  }
}

async function updateRoomStatus(req, res, next) {
  try {
    const roomId = Number(req.params.id);
    const { status } = req.body || {};

    if (!Number.isInteger(roomId) || roomId <= 0) {
      return res.status(400).json({ message: "invalid room id" });
    }
    if (!allowedRoomStatuses.includes(status)) {
      return res.status(400).json({ message: "status must be OPEN or MAINTENANCE" });
    }

    const room = await withRoomSchemaRepair(() => prisma.room.update({
      where: { id: roomId },
      data: { status },
      include: roomInclude,
    }));

    res.json(room);
  } catch (error) {
    if (error?.code === "P2025") {
      return res.status(404).json({ message: "room not found" });
    }
    next(error);
  }
}

async function deleteRoom(req, res, next) {
  try {
    const roomId = Number(req.params.id);
    if (!Number.isInteger(roomId) || roomId <= 0) {
      return res.status(400).json({ message: "invalid room id" });
    }

    await prisma.room.delete({ where: { id: roomId } });
    res.json({ message: "room deleted" });
  } catch (error) {
    if (error?.code === "P2025") {
      return res.status(404).json({ message: "room not found" });
    }
    next(error);
  }
}

async function disconnectRoomPrisma() {
  await prisma.$disconnect();
}

module.exports = {
  listRooms,
  createRoom,
  updateRoom,
  updateRoomStatus,
  deleteRoom,
  disconnectRoomPrisma,
};

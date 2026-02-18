const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function listUsers(_req, res, next) {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.json(users);
  } catch (error) {
    next(error);
  }
}

async function createUser(req, res, next) {
  try {
    const { email, name } = req.body || {};

    if (!email) {
      return res.status(400).json({ message: "email is required" });
    }

    const user = await prisma.user.create({
      data: { email, name },
    });
    res.status(201).json(user);
  } catch (error) {
    next(error);
  }
}

async function disconnectPrisma() {
  await prisma.$disconnect();
}

module.exports = {
  listUsers,
  createUser,
  disconnectPrisma,
};

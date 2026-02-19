const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const allowedBranchStatuses = ["ACTIVE", "INACTIVE"];

async function listBranches(req, res, next) {
  try {
    const { status } = req.query;
    if (status && !allowedBranchStatuses.includes(status)) {
      return res.status(400).json({ message: "status must be ACTIVE or INACTIVE" });
    }

    const branches = await prisma.branch.findMany({
      where: status ? { status } : undefined,
      orderBy: { name: "asc" },
    });
    res.json(branches);
  } catch (error) {
    next(error);
  }
}

async function createBranch(req, res, next) {
  try {
    const { code, name, address, phone, status } = req.body || {};
    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: "branch name is required" });
    }
    if (!address || !String(address).trim()) {
      return res.status(400).json({ message: "branch address is required" });
    }
    if (!phone || !String(phone).trim()) {
      return res.status(400).json({ message: "branch phone is required" });
    }
    if (!/^\d{6}$/.test(String(code || ""))) {
      return res.status(400).json({ message: "branch code must be 6 digits" });
    }
    if (status && !allowedBranchStatuses.includes(status)) {
      return res.status(400).json({ message: "status must be ACTIVE or INACTIVE" });
    }

    const branch = await prisma.branch.create({
      data: {
        code: String(code),
        name: String(name).trim(),
        address: String(address).trim(),
        phone: String(phone).trim(),
        status: status || "ACTIVE",
      },
    });
    res.status(201).json(branch);
  } catch (error) {
    if (error?.code === "P2002") {
      return res.status(409).json({ message: "branch already exists" });
    }
    next(error);
  }
}

async function updateBranchStatus(req, res, next) {
  try {
    const branchId = Number(req.params.id);
    const { status } = req.body || {};

    if (!Number.isInteger(branchId) || branchId <= 0) {
      return res.status(400).json({ message: "invalid branch id" });
    }
    if (!allowedBranchStatuses.includes(status)) {
      return res.status(400).json({ message: "status must be ACTIVE or INACTIVE" });
    }

    const branch = await prisma.branch.update({
      where: { id: branchId },
      data: { status },
    });
    res.json(branch);
  } catch (error) {
    if (error?.code === "P2025") {
      return res.status(404).json({ message: "branch not found" });
    }
    next(error);
  }
}

async function updateBranch(req, res, next) {
  try {
    const branchId = Number(req.params.id);
    const { code, name, address, phone, status } = req.body || {};

    if (!Number.isInteger(branchId) || branchId <= 0) {
      return res.status(400).json({ message: "invalid branch id" });
    }
    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: "branch name is required" });
    }
    if (!address || !String(address).trim()) {
      return res.status(400).json({ message: "branch address is required" });
    }
    if (!phone || !String(phone).trim()) {
      return res.status(400).json({ message: "branch phone is required" });
    }
    if (!/^\d{6}$/.test(String(code || ""))) {
      return res.status(400).json({ message: "branch code must be 6 digits" });
    }
    if (status && !allowedBranchStatuses.includes(status)) {
      return res.status(400).json({ message: "status must be ACTIVE or INACTIVE" });
    }

    const branch = await prisma.branch.update({
      where: { id: branchId },
      data: {
        code: String(code),
        name: String(name).trim(),
        address: String(address).trim(),
        phone: String(phone).trim(),
        status: status || "ACTIVE",
      },
    });
    res.json(branch);
  } catch (error) {
    if (error?.code === "P2025") {
      return res.status(404).json({ message: "branch not found" });
    }
    if (error?.code === "P2002") {
      return res.status(409).json({ message: "branch code or name already exists" });
    }
    next(error);
  }
}

async function deleteBranch(req, res, next) {
  try {
    const branchId = Number(req.params.id);
    if (!Number.isInteger(branchId) || branchId <= 0) {
      return res.status(400).json({ message: "invalid branch id" });
    }

    await prisma.branch.delete({
      where: { id: branchId },
    });
    res.json({ message: "branch deleted" });
  } catch (error) {
    if (error?.code === "P2025") {
      return res.status(404).json({ message: "branch not found" });
    }
    next(error);
  }
}

async function disconnectBranchPrisma() {
  await prisma.$disconnect();
}

module.exports = {
  listBranches,
  createBranch,
  updateBranchStatus,
  updateBranch,
  deleteBranch,
  disconnectBranchPrisma,
};

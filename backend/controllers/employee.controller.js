const { PrismaClient } = require("@prisma/client");
const { randomBytes, scrypt, timingSafeEqual } = require("node:crypto");
const { promisify } = require("node:util");
const jwt = require("jsonwebtoken");

const prisma = new PrismaClient();
const scryptAsync = promisify(scrypt);
const allowedPositions = [
  "Therapist",
  "sale",
  "reception",
  "nurse",
  "admin",
  "ceo",
];
const allowedApprovalStatuses = ["PENDING", "APPROVED", "REJECTED"];
const authCookieName = "employee_token";
const jwtSecret = process.env.JWT_SECRET || "change_this_jwt_secret";
const jwtExpiresIn = process.env.JWT_EXPIRES_IN || "7d";
const publicEmployeeSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  branch: true,
  position: true,
  profileImage: true,
  status: true,
  approvedAt: true,
  approvedBy: true,
  createdAt: true,
  updatedAt: true,
};

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const key = await scryptAsync(password, salt, 64);
  return `${salt}:${Buffer.from(key).toString("hex")}`;
}

async function verifyPassword(password, passwordHash) {
  if (!passwordHash || !passwordHash.includes(":")) return false;
  const [salt, storedHashHex] = passwordHash.split(":");
  const derivedKey = await scryptAsync(password, salt, 64);
  const storedHash = Buffer.from(storedHashHex, "hex");
  const computedHash = Buffer.from(derivedKey);
  if (storedHash.length !== computedHash.length) return false;
  return timingSafeEqual(storedHash, computedHash);
}

function signEmployeeToken(employee) {
  return jwt.sign(
    {
      sub: employee.id,
      email: employee.email,
      type: "employee",
    },
    jwtSecret,
    { expiresIn: jwtExpiresIn },
  );
}

async function listEmployees(req, res, next) {
  try {
    const { status } = req.query;
    if (status && !allowedApprovalStatuses.includes(status)) {
      return res.status(400).json({
        message: "status must be one of PENDING, APPROVED, REJECTED",
      });
    }

    const employees = await prisma.employee.findMany({
      select: publicEmployeeSelect,
      where: status ? { status } : undefined,
      orderBy: { createdAt: "desc" },
    });
    res.json(employees);
  } catch (error) {
    next(error);
  }
}

async function createEmployee(req, res, next) {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      branch,
      position,
      profileImage,
      password,
      confirmPassword,
    } = req.body || {};

    if (
      !firstName ||
      !lastName ||
      !email ||
      !branch ||
      !position ||
      !password ||
      !confirmPassword
    ) {
      return res.status(400).json({
        message:
          "firstName, lastName, email, branch, position, password, and confirmPassword are required",
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: "password and confirmPassword do not match" });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: "password must be at least 8 characters" });
    }

    if (!allowedPositions.includes(position)) {
      return res.status(400).json({
        message:
          "position must be one of Therapist, sale, reception, nurse, admin, ceo",
      });
    }

    const passwordHash = await hashPassword(password);

    const employee = await prisma.employee.create({
      select: publicEmployeeSelect,
      data: {
        firstName,
        lastName,
        email,
        phone,
        branch,
        position,
        profileImage,
        passwordHash,
      },
    });

    res.status(201).json(employee);
  } catch (error) {
    if (error?.code === "P2002") {
      return res.status(409).json({ message: "email already exists" });
    }
    next(error);
  }
}

async function listPendingEmployees(_req, res, next) {
  try {
    const employees = await prisma.employee.findMany({
      select: publicEmployeeSelect,
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
    });
    res.json(employees);
  } catch (error) {
    next(error);
  }
}

async function loginEmployee(req, res, next) {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: "email and password are required" });
    }

    const employee = await prisma.employee.findUnique({
      where: { email },
      select: {
        ...publicEmployeeSelect,
        passwordHash: true,
      },
    });

    if (!employee?.passwordHash) {
      return res.status(401).json({ message: "invalid email or password" });
    }

    const isValidPassword = await verifyPassword(password, employee.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({ message: "invalid email or password" });
    }

    if (employee.status !== "APPROVED") {
      return res.status(403).json({ message: "employee is not approved yet" });
    }

    const token = signEmployeeToken(employee);
    res.cookie(authCookieName, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    const { passwordHash, ...employeeWithoutHash } = employee;
    res.json({
      message: "login successful",
      employee: employeeWithoutHash,
    });
  } catch (error) {
    next(error);
  }
}

async function getCurrentEmployee(req, res, next) {
  try {
    const token = req.cookies?.[authCookieName];
    if (!token) {
      return res.status(401).json({ message: "not authenticated" });
    }

    const payload = jwt.verify(token, jwtSecret);
    const employeeId = Number(payload?.sub);
    if (!Number.isInteger(employeeId) || employeeId <= 0) {
      return res.status(401).json({ message: "invalid token" });
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: publicEmployeeSelect,
    });

    if (!employee) {
      return res.status(404).json({ message: "employee not found" });
    }

    res.json({ employee });
  } catch (error) {
    if (error?.name === "JsonWebTokenError" || error?.name === "TokenExpiredError") {
      return res.status(401).json({ message: "invalid token" });
    }
    next(error);
  }
}

function logoutEmployee(_req, res) {
  res.clearCookie(authCookieName, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  res.json({ message: "logout successful" });
}

async function approveEmployee(req, res, next) {
  try {
    const employeeId = Number(req.params.id);
    if (!Number.isInteger(employeeId) || employeeId <= 0) {
      return res.status(400).json({ message: "invalid employee id" });
    }

    const { approvedBy } = req.body || {};

    const employee = await prisma.employee.update({
      select: publicEmployeeSelect,
      where: { id: employeeId },
      data: {
        status: "APPROVED",
        approvedAt: new Date(),
        approvedBy: approvedBy || "system",
      },
    });

    res.json(employee);
  } catch (error) {
    next(error);
  }
}

async function disconnectEmployeePrisma() {
  await prisma.$disconnect();
}

module.exports = {
  listEmployees,
  createEmployee,
  listPendingEmployees,
  loginEmployee,
  getCurrentEmployee,
  logoutEmployee,
  approveEmployee,
  disconnectEmployeePrisma,
};

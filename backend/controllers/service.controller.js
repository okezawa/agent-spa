const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const employeeSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  position: true,
  status: true,
};

function normalizeProviderIds(providerIds) {
  if (!Array.isArray(providerIds)) {
    return [];
  }

  return [
    ...new Set(
      providerIds
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0),
    ),
  ];
}

function mapService(service) {
  return {
    id: service.id,
    name: service.name,
    durationMinutes: service.durationMinutes,
    pricePerUnit: Number(service.pricePerUnit),
    providers: service.providers.map((item) => item.employee),
    createdAt: service.createdAt,
    updatedAt: service.updatedAt,
  };
}

async function validateServicePayload(payload) {
  const { name, durationMinutes, pricePerUnit, providerIds } = payload || {};

  const normalizedName = String(name || "").trim();
  const normalizedDuration = Number(durationMinutes);
  const normalizedPrice = Number(pricePerUnit);
  const normalizedProviderIds = normalizeProviderIds(providerIds);

  if (!normalizedName) {
    return { error: "service name is required" };
  }

  if (!Number.isInteger(normalizedDuration) || normalizedDuration <= 0) {
    return { error: "durationMinutes must be a positive integer" };
  }

  if (!Number.isFinite(normalizedPrice) || normalizedPrice < 0) {
    return { error: "pricePerUnit must be a number >= 0" };
  }

  if (normalizedProviderIds.length === 0) {
    return { error: "please select at least one employee" };
  }

  const approvedProviders = await prisma.employee.findMany({
    where: {
      id: { in: normalizedProviderIds },
      status: "APPROVED",
    },
    select: { id: true, position: true },
  });

  if (approvedProviders.length !== normalizedProviderIds.length) {
    return { error: "some selected employees are invalid or not approved" };
  }

  const hasInvalidPosition = approvedProviders.some((employee) => {
    const position = String(employee.position || "").trim().toLowerCase();
    return position !== "nurse" && position !== "therapist";
  });

  if (hasInvalidPosition) {
    return { error: "providers must be nurse or therapist" };
  }

  return {
    value: {
      name: normalizedName,
      durationMinutes: normalizedDuration,
      pricePerUnit: normalizedPrice,
      providerIds: normalizedProviderIds,
    },
  };
}

async function listServices(_req, res, next) {
  try {
    const services = await prisma.service.findMany({
      orderBy: { name: "asc" },
      include: {
        providers: {
          include: { employee: { select: employeeSelect } },
          orderBy: { employeeId: "asc" },
        },
      },
    });

    res.json(services.map(mapService));
  } catch (error) {
    next(error);
  }
}

async function createService(req, res, next) {
  try {
    const validation = await validateServicePayload(req.body);
    if (validation.error) {
      return res.status(400).json({ message: validation.error });
    }

    const { name, durationMinutes, pricePerUnit, providerIds } = validation.value;

    const service = await prisma.service.create({
      data: {
        name,
        durationMinutes,
        pricePerUnit,
        providers: {
          create: providerIds.map((employeeId) => ({
            employee: { connect: { id: employeeId } },
          })),
        },
      },
      include: {
        providers: {
          include: { employee: { select: employeeSelect } },
          orderBy: { employeeId: "asc" },
        },
      },
    });

    res.status(201).json(mapService(service));
  } catch (error) {
    if (error?.code === "P2002") {
      return res.status(409).json({ message: "service name already exists" });
    }
    next(error);
  }
}

async function updateService(req, res, next) {
  try {
    const serviceId = Number(req.params.id);
    if (!Number.isInteger(serviceId) || serviceId <= 0) {
      return res.status(400).json({ message: "invalid service id" });
    }

    const validation = await validateServicePayload(req.body);
    if (validation.error) {
      return res.status(400).json({ message: validation.error });
    }

    const { name, durationMinutes, pricePerUnit, providerIds } = validation.value;

    const service = await prisma.service.update({
      where: { id: serviceId },
      data: {
        name,
        durationMinutes,
        pricePerUnit,
        providers: {
          deleteMany: {},
          create: providerIds.map((employeeId) => ({
            employee: { connect: { id: employeeId } },
          })),
        },
      },
      include: {
        providers: {
          include: { employee: { select: employeeSelect } },
          orderBy: { employeeId: "asc" },
        },
      },
    });

    res.json(mapService(service));
  } catch (error) {
    if (error?.code === "P2025") {
      return res.status(404).json({ message: "service not found" });
    }
    if (error?.code === "P2002") {
      return res.status(409).json({ message: "service name already exists" });
    }
    next(error);
  }
}

async function deleteService(req, res, next) {
  try {
    const serviceId = Number(req.params.id);
    if (!Number.isInteger(serviceId) || serviceId <= 0) {
      return res.status(400).json({ message: "invalid service id" });
    }

    const bookingUsingService = await prisma.booking.findFirst({
      where: { serviceId },
      select: { id: true },
    });

    if (bookingUsingService) {
      return res.status(409).json({
        message: "cannot delete service: it is used by booking(s)",
      });
    }

    await prisma.service.delete({ where: { id: serviceId } });
    res.json({ message: "service deleted" });
  } catch (error) {
    if (error?.code === "P2025") {
      return res.status(404).json({ message: "service not found" });
    }
    if (error?.code === "P2003") {
      return res.status(409).json({ message: "cannot delete service: it is used by booking(s)" });
    }
    next(error);
  }
}

async function disconnectServicePrisma() {
  await prisma.$disconnect();
}

module.exports = {
  listServices,
  createService,
  updateService,
  deleteService,
  disconnectServicePrisma,
};

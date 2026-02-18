require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const healthRoutes = require("./routes/health.routes");
const userRoutes = require("./routes/user.routes");
const employeeRoutes = require("./routes/employee.routes");
const { disconnectPrisma } = require("./controllers/user.controller");
const { disconnectEmployeePrisma } = require("./controllers/employee.controller");

const app = express();
const port = Number(process.env.PORT) || 4000;
const frontendUrl = process.env.FRONTEND_URL || "http://localhost:4200";

app.use(helmet());
app.use(
  cors({
    origin: frontendUrl,
    credentials: true,
  }),
);
app.use(express.json({ limit: "5mb" }));
app.use(cookieParser());

app.use("/api", healthRoutes);
app.use("/api", userRoutes);
app.use("/api", employeeRoutes);

app.use((err, _req, res, _next) => {
  if (err?.type === "entity.too.large") {
    return res.status(413).json({
      message: "Payload too large. Please upload a smaller image.",
    });
  }

  console.error(err);
  res.status(500).json({ message: "Internal server error" });
});

const server = app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
  console.log(`CORS allowed origin: ${frontendUrl}`);
});

const shutdown = async () => {
  await Promise.all([disconnectPrisma(), disconnectEmployeePrisma()]);
  server.close(() => process.exit(0));
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

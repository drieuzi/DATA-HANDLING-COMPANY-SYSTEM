require("dotenv").config();

const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const pool = require("./config/db");
const authRoutes = require("./routes/authroutes");
const adminRoutes = require("./routes/adminroutes");
const supplierRoutes = require("./routes/supplierRoutes");
const clientRoutes = require("./routes/clientroutes");
const paymentRoutes = require("./routes/paymentroutes");
const reportRoutes = require("./routes/reportRoutes");
const auditRoutes = require("./routes/auditRoutes");
const outsideServiceRoutes = require("./routes/outsideserviceroutes");
const { errorHandler, notFoundHandler } = require("./middleware/errormiddleware");

const app = express();
const port = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === "production";

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET with at least 32 characters is required.");
}

if (isProduction) app.set("trust proxy", 1);

const allowedOrigins = (process.env.CLIENT_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim().replace(/\/+$/, ""))
  .filter(Boolean);

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const cleanOrigin = origin.replace(/\/+$/, "");
    if (
      allowedOrigins.includes(cleanOrigin) ||
      allowedOrigins.includes("*") ||
      cleanOrigin.endsWith(".onrender.com") ||
      cleanOrigin.endsWith(".vercel.app") ||
      (!isProduction && cleanOrigin.startsWith("http://localhost"))
    ) {
      return callback(null, true);
    }
    callback(new Error(`Origin ${origin} is not allowed by CORS.`));
  },
  credentials: true
}));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());


app.get("/api/health", async (_request, response, next) => {
  try {
    await pool.query("SELECT 1");
    response.json({ status: "ok" });
  } catch (error) {
    next(error);
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/suppliers", supplierRoutes);
app.use("/api/clients", clientRoutes);
app.use("/api", paymentRoutes);
app.use("/api/dashboard", reportRoutes);
app.use("/api/audit-logs", auditRoutes);
app.use("/api/outside-services", outsideServiceRoutes);
app.use("/api", notFoundHandler);

const frontendDist = path.join(__dirname, "../frontend/dist");
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.use((request, response) => {
    if (request.path.startsWith("/api") || request.path.startsWith("/assets") || request.path.includes(".")) {
      return response.status(404).send("Not found");
    }
    response.sendFile(path.join(frontendDist, "index.html"));
  });
} else {
  app.get("/", (_request, response) => {
    response.json({
      name: "Illuminux Management System API",
      status: "online",
      health: "/api/health"
    });
  });
}

app.use(errorHandler);

app.listen(port, () => {
  console.log(`Illuminux API running at http://localhost:${port}`);
});

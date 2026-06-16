import compression from "compression";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { rateLimit } from "express-rate-limit";
import { connectDb } from "./config/db.js";
import authRoutes from "./routes/auth.js";
import dashboardRoutes from "./routes/dashboard.js";
import resourceRoutes from "./routes/resources.js";

dotenv.config();

// ── Validate required env vars on startup ────────────────────────────────────
const REQUIRED_ENV = ["MONGO_URI", "JWT_SECRET", "CLIENT_ORIGIN"];
const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`❌ Missing required environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

const app = express();
const port = process.env.PORT || 5000;
const isProd = process.env.NODE_ENV === "production";

const allowedOrigins = process.env.CLIENT_ORIGIN.split(",").map((o) => o.trim());

// ── Security ─────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(compression());

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
    credentials: true
  })
);

// ── Rate limiting ─────────────────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { message: "Too many login attempts. Please try again in 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120,
  standardHeaders: true,
  legacyHeaders: false
});

// ── Request parsing ───────────────────────────────────────────────────────────
app.use(express.json({ limit: "2mb" }));
app.use(morgan(isProd ? "combined" : "dev"));

// ── Routes ────────────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) =>
  res.json({ ok: true, service: "CoMS API", env: process.env.NODE_ENV, ts: new Date().toISOString() })
);

app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/dashboard", apiLimiter, dashboardRoutes);
app.use("/api", apiLimiter, resourceRoutes);

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ message: "Route not found" }));

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  if (isProd) {
    // Never leak stack traces in production
    res.status(status).json({ message: err.message || "Server error" });
  } else {
    console.error(err);
    res.status(status).json({ message: err.message || "Server error", stack: err.stack });
  }
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────
let server;

async function shutdown(signal) {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  server.close(async () => {
    console.log("HTTP server closed.");
    process.exit(0);
  });
  // Force exit after 10s
  setTimeout(() => {
    console.error("Force exit after timeout.");
    process.exit(1);
  }, 10_000);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
  if (isProd) process.exit(1);
});

// ── Bootstrap ─────────────────────────────────────────────────────────────────
await connectDb();
server = app.listen(port, () =>
  console.log(`✅ CoMS API running on http://localhost:${port} [${process.env.NODE_ENV}]`)
);

import 'reflect-metadata';
import fs from 'fs';
import express from "express";
import path from "path";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import { NestFactory } from "@nestjs/core";
import { createServer as createViteServer } from "vite";
import { AppModule } from "./src/server/app.module";
import { defaultDashboardController } from "./src/server/dashboard.controller";
import { testPostgresConnection } from "./src/server/postgresDb";

async function startServer() {
  const PORT = 3000;

  // 1. Create NestJS Application
  const nestApp = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  // Get underlying Express application
  const expressApp = nestApp.getHttpAdapter().getInstance() as express.Application;

  // 0. Trust Proxy (for Express Rate Limit under reverse proxies/cloud runtime)
  expressApp.set("trust proxy", 1);

  // 1. Security Headers (Helmet configured for Vite Dev & SPA Iframe Compatibility)
  expressApp.use(
    helmet({
      contentSecurityPolicy: false, // Managed by host/preview environment
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" }
    })
  );

  // 2. High-Performance Gzip/Brotli Compression
  expressApp.use(
    compression({
      level: 6,
      threshold: 1024 // Only compress payloads larger than 1KB
    })
  );

  // 3. Body Parser with payload limit protection
  expressApp.use(express.json({ limit: "250kb" }));

  // 4. Rate Limiting Protection for Public High-Load Access
  const apiLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MINUTES || "1", 10) * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX || "3000", 10), // max 3000 requests per minute per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: "Занадто багато запитів. Будь ласка, зачекайте хвилину."
    }
  });

  expressApp.use("/api/", apiLimiter);

  // Static assets route for geo JSON maps
  expressApp.use("/assets", express.static(path.join(process.cwd(), "public/assets")));

  // Initial DB connection test asynchronously
  testPostgresConnection().then(ok => {
    console.log("[NestJS Boot] PostgreSQL (PULS_COPY) status:", ok ? "ONLINE" : "OFFLINE");
  }).catch(err => {
    console.warn("[NestJS Boot] DB check warning:", err?.message || err);
  });

  // Express Fallback API Routes for maximum route compatibility
  expressApp.post("/api/auth/login", (req, res) => defaultDashboardController.login(req, res));
  expressApp.get("/api/health", (req, res) => defaultDashboardController.getHealth(req, res));
  expressApp.get("/api/dashboard/data", (req, res) => defaultDashboardController.getData(req, res));
  expressApp.post("/api/dashboard/data", (req, res) => defaultDashboardController.postData(req, res));
  expressApp.get("/api/dashboard/regional-stats", (req, res) => defaultDashboardController.getRegionalStats(req, res));
  expressApp.post("/api/dashboard/regional-stats", (req, res) => defaultDashboardController.getRegionalStats(req, res));
  expressApp.get("/api/dashboard/all-comments", (req, res) => defaultDashboardController.getAllComments(req, res));
  expressApp.post("/api/dashboard/all-comments", (req, res) => defaultDashboardController.getAllComments(req, res));
  expressApp.get("/api/dashboard/issue-comments", (req, res) => defaultDashboardController.getIssueComments(req, res));
  expressApp.get("/api/dashboard/test-db", (req, res) => defaultDashboardController.testDb(req, res));
  expressApp.get("/api/dashboard/catalogs", (req, res) => defaultDashboardController.getCatalogs(req, res));
  expressApp.get("/api/db-config", (req, res) => defaultDashboardController.getDbConfig(req, res));
  expressApp.post("/api/db-config", (req, res) => defaultDashboardController.updateDbConfig(req, res));

  // 5. Vite middleware for dev or static serving for production
  const distIndexExists = fs.existsSync(path.join(process.cwd(), "dist/index.html"));
  const isProduction = process.env.NODE_ENV === "production" || distIndexExists;

  if (!isProduction) {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        allowedHosts: true
      },
      appType: "spa",
    });
    expressApp.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    expressApp.use(express.static(distPath));
    expressApp.use((req, res, next) => {
      if (req.method === "GET" && !req.path.startsWith("/api")) {
        res.sendFile(path.join(distPath, "index.html"));
      } else {
        next();
      }
    });
  }

  await nestApp.listen(PORT, "0.0.0.0");
  console.log(`[NestJS PULS Server] High-Load Production Ready on http://0.0.0.0:${PORT}`);
}

startServer().catch(err => {
  console.error('[Fatal Server Boot Error]', err);
});

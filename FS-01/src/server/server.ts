import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.join(__dirname, ".env") });

import type { NextFunction, Request, Response } from "express";

const express = require("express") as typeof import("express");
const cors = require("cors") as typeof import("cors");
const { prisma } = require("./src/db") as typeof import("./src/db");
const { redis } = require("./src/lib/redis") as typeof import("./src/lib/redis");
const { searchClient, indexProduct } = require("./src/lib/search") as typeof import("./src/lib/search");
const payments = require("./src/routes/payments") as typeof import("./src/routes/payments");
const authRoutes = require("./src/routes/auth").default;
const vendorRoutes = require("./src/routes/vendors").default;
const productRoutes = require("./src/routes/products").default;
const cartRoutes = require("./src/routes/cart").default;
const paymentRoutes = payments.default;
const orderRoutes = require("./src/routes/orders").default;
const reviewRoutes = require("./src/routes/reviews").default;
const couponRoutes = require("./src/routes/coupons").default;
const analyticsRoutes = require("./src/routes/analytics").default;
const suborderRoutes = require("./src/routes/suborders").default;

const app = express();
const allowedOrigins = new Set([process.env.CLIENT_URL, "http://localhost:5173", "http://localhost:4173"].filter(Boolean) as string[]);
app.use(cors({ origin: (origin, callback) => callback(null, !origin || allowedOrigins.has(origin)), credentials: false }));

app.post("/api/payments/webhook", express.raw({ type: "application/json" }), payments.handleRazorpayWebhook);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));

app.get("/api/health", async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  return res.json({ status: "ok", database: "postgresql", redis: redis.status, search: searchClient ? "elasticsearch" : "database fallback" });
});

app.use("/api/auth", authRoutes);
app.use("/api/vendors", vendorRoutes);
app.use("/api/products", productRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/suborders", suborderRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/coupons", couponRoutes);
app.use("/api/analytics", analyticsRoutes);

app.use((_req, res) => res.status(404).json({ message: "API route not found." }));
app.use((error: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error("API error:", error);
  const status = Number(error.status || error.statusCode) || 500;
  return res.status(status).json({ message: status < 500 ? error.message : "An unexpected server error occurred." });
});

async function start() {
  if (!process.env.DATABASE_URL || !process.env.JWT_SECRET) throw new Error("DATABASE_URL and JWT_SECRET are required.");
  if (process.env.PAYMENT_MODE && !["simulation", "razorpay"].includes(process.env.PAYMENT_MODE)) throw new Error("PAYMENT_MODE must be simulation or razorpay.");
  if (process.env.PAYMENT_MODE === "razorpay" && (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET)) throw new Error("Razorpay test credentials are required when PAYMENT_MODE=razorpay.");
  await prisma.$connect();
  await redis.connect();
  if (searchClient) {
    await searchClient.ping();
    const products = await prisma.product.findMany({ where: { active: true }, take: 10000 });
    for (const product of products) await indexProduct(product);
    console.log(`Elasticsearch ready; indexed ${products.length} active products.`);
  }
  const port = Number(process.env.PORT || 5000);
  const server = app.listen(port, () => console.log(`Marketplace API listening on ${port}`));
  const shutdown = async () => {
    server.close();
    await Promise.allSettled([redis.quit(), prisma.$disconnect(), searchClient?.close()]);
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

start().catch((error) => {
  console.error("API startup failed:", error);
  process.exit(1);
});

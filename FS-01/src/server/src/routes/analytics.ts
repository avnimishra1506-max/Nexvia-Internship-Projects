import { Router } from "express";
import { prisma } from "../db";
import { allowRoles, requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth, allowRoles("ADMIN"));

router.get("/commission", async (_req, res) => {
  const setting = await prisma.commissionSetting.findUnique({ where: { id: "platform" } });
  return res.json({ percentage: Number(setting?.percentage ?? 10), updatedAt: setting?.updatedAt ?? null });
});

router.put("/commission", async (req, res) => {
  const percentage = Number(req.body?.percentage);
  if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100 || Math.abs(percentage * 100 - Math.round(percentage * 100)) > 1e-8) {
    return res.status(400).json({ message: "Commission percentage must be from 0 to 100 with at most two decimal places." });
  }
  const setting = await prisma.commissionSetting.upsert({
    where: { id: "platform" },
    create: { id: "platform", percentage, updatedBy: req.auth!.id },
    update: { percentage, updatedBy: req.auth!.id },
  });
  return res.json({ percentage: Number(setting.percentage), updatedAt: setting.updatedAt });
});

router.get("/overview", async (_req, res) => {
  const [orders, users, vendors, revenue, recentOrders, orderStatuses, topVendors] = await Promise.all([
    prisma.order.count(),
    prisma.user.count({ where: { role: "CUSTOMER" } }),
    prisma.user.count({ where: { role: "VENDOR", vendorStatus: "APPROVED" } }),
    prisma.order.aggregate({ where: { paymentStatus: "PAID" }, _sum: { totalAmount: true, commissionAmount: true } }),
    prisma.order.findMany({ include: { user: { select: { name: true, email: true } }, items: true }, orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.order.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.$queryRaw<Array<{ vendorId: string; vendorName: string | null; orderCount: number; sales: unknown }>>`
      SELECT s."vendorId", u."vendorName", COUNT(*)::int AS "orderCount", SUM(s.subtotal) AS sales
      FROM "SubOrder" s JOIN "Order" o ON o.id = s."orderId" JOIN "User" u ON u.id = s."vendorId"
      WHERE o."paymentStatus" = 'PAID' GROUP BY s."vendorId", u."vendorName"
      ORDER BY sales DESC LIMIT 10
    `,
  ]);
  const activeVendors = await prisma.user.count({ where: { role: "VENDOR", vendorStatus: "APPROVED" } });
  return res.json({ orders, customers: users, vendors, activeVendors, totalSales: Number(revenue._sum.totalAmount || 0), commissions: Number(revenue._sum.commissionAmount || 0), recentOrders, orderStatuses: orderStatuses.map((row) => ({ status: row.status, count: row._count._all })), topVendors: topVendors.map((row) => ({ ...row, sales: Number(row.sales || 0) })) });
});

router.get("/revenue", async (_req, res) => {
  const end = _req.query.end ? new Date(String(_req.query.end)) : new Date();
  const start = _req.query.start ? new Date(String(_req.query.start)) : new Date(end);
  if (!_req.query.start) start.setDate(start.getDate() - 29);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start > end) return res.status(400).json({ message: "Provide a valid date range." });
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  const orders = await prisma.order.findMany({ where: { paymentStatus: "PAID", createdAt: { gte: start, lte: end } }, select: { createdAt: true, totalAmount: true } });
  const byDate = new Map<string, { revenue: number; orders: number }>();
  for (const order of orders) {
    const date = order.createdAt.toISOString().slice(0, 10);
    const data = byDate.get(date) || { revenue: 0, orders: 0 };
    data.revenue += Number(order.totalAmount);
    data.orders += 1;
    byDate.set(date, data);
  }
  return res.json([...byDate].map(([date, data]) => ({ date, ...data })).sort((a, b) => a.date.localeCompare(b.date)));
});

router.get("/users", async (req, res) => {
  const q = String(req.query.q || "").trim().slice(0, 120);
  const users = await prisma.user.findMany({
    where: q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] } : {},
    select: { id: true, name: true, email: true, role: true, vendorStatus: true, createdAt: true },
    orderBy: { createdAt: "desc" }, take: 200,
  });
  return res.json(users);
});

router.get("/top-vendors", async (_req, res) => {
  const rows = await prisma.$queryRaw<Array<{ vendorId: string; vendorName: string | null; orderCount: number; sales: unknown }>>`
    SELECT s."vendorId", u."vendorName", COUNT(*)::int AS "orderCount", SUM(s.subtotal) AS sales
    FROM "SubOrder" s JOIN "Order" o ON o.id = s."orderId" JOIN "User" u ON u.id = s."vendorId"
    WHERE o."paymentStatus" = 'PAID' GROUP BY s."vendorId", u."vendorName" ORDER BY sales DESC LIMIT 10
  `;
  return res.json(rows.map((row) => ({ ...row, sales: Number(row.sales || 0) })));
});

router.get("/top-products", async (_req, res) => {
  const rows = await prisma.$queryRaw<Array<{ productId: string; name: string; unitsSold: number; salesValue: unknown }>>`
    SELECT i."productId", i."productName" AS name,
      SUM(i.quantity)::int AS "unitsSold",
      SUM(i."unitPrice" * i.quantity) AS "salesValue"
    FROM "OrderItem" i JOIN "Order" o ON o.id = i."orderId"
    WHERE o."paymentStatus" = 'PAID'
    GROUP BY i."productId", i."productName"
    ORDER BY "unitsSold" DESC LIMIT 10
  `;
  return res.json(rows.map((row) => ({ ...row, salesValue: Number(row.salesValue) })));
});

export default router;

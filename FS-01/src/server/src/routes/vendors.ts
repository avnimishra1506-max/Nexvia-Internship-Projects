import { Router } from "express";
import { prisma } from "../db";
import { allowRoles, requireAuth } from "../middleware/auth";
import { productImageUrl } from "../lib/s3";

const router = Router();
router.use(requireAuth);

router.get("/dashboard", allowRoles("VENDOR"), async (req, res) => {
  const vendorId = req.auth!.id;
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const paidSubOrders = { vendorId, order: { paymentStatus: "PAID" as const } };
  const [monthSales, ordersToShip, earnings, ratings, fulfillmentOrders, lowStockProducts] = await Promise.all([
    prisma.subOrder.aggregate({ where: { ...paidSubOrders, createdAt: { gte: monthStart } }, _sum: { subtotal: true } }),
    prisma.subOrder.count({ where: { ...paidSubOrders, status: { in: ["PLACED", "PACKED"] } } }),
    prisma.subOrder.aggregate({ where: paidSubOrders, _sum: { vendorPayoutAmount: true } }),
    prisma.review.aggregate({ where: { product: { sellerId: vendorId } }, _avg: { rating: true }, _count: { _all: true } }),
    prisma.subOrder.findMany({
      where: { ...paidSubOrders, status: { in: ["PLACED", "PACKED"] } },
      include: { items: true, order: { select: { id: true, createdAt: true, shippingAddress: true } } },
      orderBy: { createdAt: "asc" },
      take: 10,
    }),
    prisma.product.findMany({ where: { sellerId: vendorId, active: true, stock: { lte: 5 } }, orderBy: { stock: "asc" }, take: 10 }),
  ]);
  return res.json({
    stats: {
      salesThisMonth: Number(monthSales._sum.subtotal || 0),
      ordersToShip,
      earningsAfterCommission: Number(earnings._sum.vendorPayoutAmount || 0),
      averageRating: Number(ratings._avg.rating || 0),
      reviewCount: ratings._count._all,
    },
    ordersToFulfill: fulfillmentOrders,
    lowStockProducts: lowStockProducts.map((product) => ({ ...product, imageUrl: productImageUrl(product.imageKey) })),
  });
});

router.get("/earnings", allowRoles("VENDOR"), async (req, res) => {
  const where = { vendorId: req.auth!.id, order: { paymentStatus: "PAID" as const } };
  const [totals, payouts] = await Promise.all([
    prisma.subOrder.aggregate({ where, _sum: { subtotal: true, commissionAmount: true, vendorPayoutAmount: true } }),
    prisma.payout.findMany({ where: { vendorId: req.auth!.id }, include: { subOrder: { select: { orderId: true, status: true, createdAt: true } } }, orderBy: { createdAt: "desc" }, take: 100 }),
  ]);
  return res.json({
    grossSales: Number(totals._sum.subtotal || 0),
    commission: Number(totals._sum.commissionAmount || 0),
    netEarnings: Number(totals._sum.vendorPayoutAmount || 0),
    payouts,
  });
});

router.get("/reviews", allowRoles("VENDOR"), async (req, res) => {
  const reviews = await prisma.review.findMany({
    where: { product: { sellerId: req.auth!.id } },
    include: { product: { select: { id: true, name: true, imageKey: true } }, user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return res.json(reviews.map((review) => ({ ...review, product: { ...review.product, imageUrl: productImageUrl(review.product.imageKey) } })));
});

router.post("/apply", allowRoles("CUSTOMER"), async (req, res) => {
  const vendorName = String(req.body?.vendorName || "").trim();
  const description = String(req.body?.description || "").trim();
  if (vendorName.length < 2 || description.length < 20) return res.status(400).json({ message: "Enter your store name and a description of at least 20 characters." });
  const result = await prisma.user.update({
    where: { id: req.auth!.id },
    data: { vendorName, vendorDescription: description, vendorStatus: "PENDING" },
    select: { id: true, vendorName: true, vendorDescription: true, vendorStatus: true },
  });
  return res.json({ application: result });
});

router.get("/me", allowRoles("VENDOR", "ADMIN", "CUSTOMER"), async (req, res) => {
  const application = await prisma.user.findUnique({
    where: { id: req.auth!.id },
    select: { vendorName: true, vendorDescription: true, vendorStatus: true, razorpayAccountId: true },
  });
  return res.json({ application });
});

router.patch("/me", allowRoles("VENDOR"), async (req, res) => {
  const vendorName = String(req.body?.vendorName || "").trim();
  const description = String(req.body?.description || "").trim();
  if (vendorName.length < 2 || vendorName.length > 100 || description.length < 20 || description.length > 2000) {
    return res.status(400).json({ message: "Enter a store name and a description from 20 to 2,000 characters." });
  }
  const profile = await prisma.user.update({
    where: { id: req.auth!.id },
    data: { vendorName, vendorDescription: description },
    select: { id: true, name: true, email: true, vendorName: true, vendorDescription: true, vendorStatus: true },
  });
  return res.json({ profile });
});

router.get("/applications", allowRoles("ADMIN"), async (_req, res) => {
  const applications = await prisma.user.findMany({
    where: { vendorStatus: "PENDING" },
    select: { id: true, name: true, email: true, vendorName: true, vendorDescription: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  return res.json(applications);
});

router.get("/", allowRoles("ADMIN"), async (req, res) => {
  const status = String(req.query.status || "");
  const where = status ? { role: "VENDOR" as const, vendorStatus: status as any } : { OR: [{ role: "VENDOR" as const }, { vendorStatus: { in: ["PENDING", "REJECTED"] as any } }] };
  const vendors = await prisma.user.findMany({
    where,
    select: { id: true, name: true, email: true, role: true, vendorName: true, vendorDescription: true, vendorStatus: true, createdAt: true, _count: { select: { products: true, subOrders: true } } },
    orderBy: { createdAt: "desc" },
  });
  return res.json(vendors);
});

router.patch("/:id/decision", allowRoles("ADMIN"), async (req, res) => {
  const approved = req.body?.approved === true;
  const accountId = String(req.body?.razorpayAccountId || "").trim();
  const user = await prisma.user.findUnique({ where: { id: String(req.params.id) } });
  if (!user || user.vendorStatus !== "PENDING") return res.status(404).json({ message: "Pending vendor application not found." });
  if (approved && !accountId && process.env.PAYMENT_MODE === "razorpay") return res.status(400).json({ message: "Set the vendor's Razorpay Route linked account ID before approval." });
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      vendorStatus: approved ? "APPROVED" : "REJECTED",
      role: approved ? "VENDOR" : "CUSTOMER",
      razorpayAccountId: approved ? accountId || null : null,
    },
    select: { id: true, vendorName: true, vendorStatus: true, role: true },
  });
  return res.json({ user: updated });
});

export default router;

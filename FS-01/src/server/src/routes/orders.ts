import { Router, type Request, type Response } from "express";
import { prisma } from "../db";
import { allowRoles, requireAuth } from "../middleware/auth";
import { productImageUrl } from "../lib/s3";
import { checkSubOrderTransition, deriveOrderStatus, type FulfillmentStatus } from "../domain/orderRules";

const router = Router();
router.use(requireAuth);

const orderIncludes = {
  items: true,
  subOrders: { include: { items: true, vendor: { select: { vendorName: true } }, payout: true } },
} as const;

function presentOrder(order: any, role: "CUSTOMER" | "VENDOR" | "ADMIN", vendorId?: string) {
  const items = vendorId ? order.items.filter((item: any) => item.sellerId === vendorId) : order.items;
  const subOrders = vendorId ? order.subOrders.filter((subOrder: any) => subOrder.vendorId === vendorId) : order.subOrders;
  const { commissionAmount: _orderCommission, sellerPayoutAmount: _orderPayout, ...customerOrder } = order;
  const { totalAmount: _totalAmount, subtotal: _subtotal, couponDiscount: _couponDiscount, couponCode: _couponCode, ...vendorOrder } = order;
  return {
    ...(role === "VENDOR" ? vendorOrder : role === "CUSTOMER" ? customerOrder : order),
    items: items.map((item: any) => {
      const { vendorAccountId: _vendorAccountId, ...visibleItem } = item;
      return { ...visibleItem, imageUrl: productImageUrl(item.imageKey) };
    }),
    subOrders: subOrders.map((subOrder: any) => ({
      id: subOrder.id,
      orderId: subOrder.orderId,
      vendorId: subOrder.vendorId,
      status: subOrder.status,
      ...(role !== "CUSTOMER" ? {
        subtotal: subOrder.subtotal,
        commissionAmount: subOrder.commissionAmount,
        vendorPayoutAmount: subOrder.vendorPayoutAmount,
      } : {}),
      packedAt: subOrder.packedAt,
      shippedAt: subOrder.shippedAt,
      deliveredAt: subOrder.deliveredAt,
      createdAt: subOrder.createdAt,
      updatedAt: subOrder.updatedAt,
      vendor: subOrder.vendor,
      items: subOrder.items.map((item: any) => {
        const { vendorAccountId: _vendorAccountId, ...visibleItem } = item;
        return { ...visibleItem, imageUrl: productImageUrl(item.imageKey) };
      }),
      payout: role !== "CUSTOMER" && subOrder.payout ? {
        id: subOrder.payout.id,
        grossAmount: subOrder.payout.grossAmount,
        commissionAmount: subOrder.payout.commissionAmount,
        amount: subOrder.payout.amount,
        status: subOrder.payout.status,
        paidAt: subOrder.payout.paidAt,
      } : undefined,
    })),
  };
}

router.get("/vendor", allowRoles("VENDOR"), async (req, res) => {
  const subOrders = await prisma.subOrder.findMany({
    where: { vendorId: req.auth!.id },
    include: { items: true, payout: true, order: { select: { id: true, status: true, paymentStatus: true, createdAt: true, shippingAddress: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return res.json(subOrders.map((subOrder) => {
    const { vendorAccountId: _vendorAccountId, ...visibleSubOrder } = subOrder;
    return {
      ...visibleSubOrder,
      items: subOrder.items.map((item) => {
        const { vendorAccountId: _itemVendorAccountId, ...visibleItem } = item;
        return { ...visibleItem, imageUrl: productImageUrl(item.imageKey) };
      }),
      payout: subOrder.payout ? {
        id: subOrder.payout.id,
        grossAmount: subOrder.payout.grossAmount,
        commissionAmount: subOrder.payout.commissionAmount,
        amount: subOrder.payout.amount,
        status: subOrder.payout.status,
        paidAt: subOrder.payout.paidAt,
      } : null,
    };
  }));
});

router.get("/", async (req, res) => {
  const vendorId = req.auth!.role === "VENDOR" ? req.auth!.id : undefined;
  const status = String(req.query.status || "");
  const validStatuses = ["PLACED", "PACKED", "SHIPPED", "DELIVERED", "CANCELLED"];
  if (status && !validStatuses.includes(status)) return res.status(400).json({ message: "Choose a valid fulfillment status." });
  const where = req.auth!.role === "ADMIN" ? { ...(status ? { status: status as any } : {}) }
    : vendorId ? { subOrders: { some: { vendorId } } }
      : { userId: req.auth!.id };
  const orders = await prisma.order.findMany({ where, include: orderIncludes, orderBy: { createdAt: "desc" }, take: 100 });
  return res.json(orders.map((order) => presentOrder(order, req.auth!.role, vendorId)));
});

router.get("/:id", async (req, res) => {
  const order = await prisma.order.findUnique({ where: { id: String(req.params.id) }, include: orderIncludes });
  if (!order) return res.status(404).json({ message: "Order not found." });
  const vendorId = req.auth!.role === "VENDOR" ? req.auth!.id : undefined;
  const ownsOrder = req.auth!.role === "ADMIN" || order.userId === req.auth!.id || order.subOrders.some((subOrder) => subOrder.vendorId === req.auth!.id);
  if (!ownsOrder) return res.status(403).json({ message: "You cannot view this order." });
  return res.json(presentOrder(order, req.auth!.role, vendorId));
});

// Compatibility for the current admin page: it advances every vendor suborder together.
router.patch("/:id/status", allowRoles("ADMIN"), async (req, res) => {
  const nextStatus = String(req.body?.status || "");
  const current = await prisma.order.findUnique({ where: { id: String(req.params.id) }, include: { subOrders: true } });
  if (!current) return res.status(404).json({ message: "Order not found." });
  if (current.paymentStatus !== "PAID") return res.status(409).json({ message: "Only paid orders can be fulfilled." });
  if (!current.subOrders.length) return res.status(409).json({ message: "This order has no vendor suborders to fulfill." });
  for (const subOrder of current.subOrders) {
    const decision = checkSubOrderTransition({ actorRole: "ADMIN", actorId: req.auth!.id, vendorId: subOrder.vendorId, paymentStatus: current.paymentStatus, currentStatus: subOrder.status, nextStatus });
    if (!decision.allowed) return res.status(409).json({ message: `Every vendor order must be ready for ${nextStatus}; one is currently ${subOrder.status}.` });
  }
  const timestampField = nextStatus === "PACKED" ? "packedAt" : nextStatus === "SHIPPED" ? "shippedAt" : "deliveredAt";
  const updated = await prisma.$transaction(async (tx) => {
    await tx.subOrder.updateMany({ where: { id: { in: current.subOrders.map((subOrder) => subOrder.id) } }, data: { status: nextStatus as FulfillmentStatus, [timestampField]: new Date() } });
    const statuses = await tx.subOrder.findMany({ where: { orderId: current.id }, select: { status: true } });
    const status = deriveOrderStatus(statuses.map((entry) => entry.status));
    return tx.order.update({ where: { id: current.id }, data: {
      status,
      ...(status === "PACKED" ? { packedAt: new Date() } : {}),
      ...(status === "SHIPPED" ? { shippedAt: new Date() } : {}),
      ...(status === "DELIVERED" ? { deliveredAt: new Date() } : {}),
    }, include: orderIncludes });
  });
  return res.json({ order: presentOrder(updated, "ADMIN") });
});

router.get("/:id/invoice.pdf", async (req: Request, res: Response) => {
  const order = await prisma.order.findUnique({
    where: { id: String(req.params.id) },
    include: { subOrders: { include: { items: true, vendor: { select: { vendorName: true } } } }, user: { select: { name: true, email: true } } },
  });
  if (!order) return res.status(404).json({ message: "Order not found." });
  if (req.auth!.role !== "ADMIN" && order.userId !== req.auth!.id) return res.status(403).json({ message: "You cannot download this invoice." });
  if (order.paymentStatus !== "PAID") return res.status(409).json({ message: "An invoice is available after payment is confirmed." });
  const PDFDocument = require("pdfkit");
  const doc = new PDFDocument({ margin: 48, size: "A4" });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="invoice-${order.id}.pdf"`);
  doc.pipe(res);
  doc.fontSize(24).fillColor("#182a54").text("ShoppingSphere", { continued: true }).fontSize(18).text("  INVOICE", { align: "right" });
  doc.moveDown().fontSize(10).fillColor("#475569").text(`Invoice: ${order.id}`).text(`Date: ${order.createdAt.toLocaleDateString("en-IN")}`);
  doc.moveDown().fontSize(12).fillColor("#0f172a").text(`Bill to: ${order.user.name} (${order.user.email})`);
  const address = order.shippingAddress as any;
  doc.fontSize(10).fillColor("#475569").text(`${address.fullName}\n${address.street}\n${address.city}, ${address.state} ${address.postalCode}\n${address.phone}`);
  for (const subOrder of order.subOrders) {
    doc.moveDown().fontSize(12).fillColor("#182a54").text(`Vendor: ${subOrder.vendor.vendorName || "ShoppingSphere seller"}`);
    doc.fontSize(10).fillColor("#0f172a");
    for (const item of subOrder.items) {
      doc.text(`${item.productName}  x ${item.quantity}   INR ${Number(item.unitPrice).toFixed(2)} each   INR ${(Number(item.unitPrice) * item.quantity).toFixed(2)}`);
    }
  }
  doc.moveDown().fontSize(12).fillColor("#0f172a").text(`Subtotal: INR ${Number(order.subtotal).toFixed(2)}`);
  if (Number(order.couponDiscount)) doc.text(`Coupon ${order.couponCode}: -INR ${Number(order.couponDiscount).toFixed(2)}`);
  doc.fontSize(16).text(`Total paid: INR ${Number(order.totalAmount).toFixed(2)}`);
  doc.end();
});

export default router;

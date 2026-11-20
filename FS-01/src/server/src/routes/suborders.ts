import { Router } from "express";
import { prisma } from "../db";
import { allowRoles, requireAuth } from "../middleware/auth";
import { checkSubOrderTransition, deriveOrderStatus, type FulfillmentStatus } from "../domain/orderRules";

const router = Router();

router.patch("/:id/status", requireAuth, allowRoles("VENDOR", "ADMIN"), async (req, res) => {
  const subOrder = await prisma.subOrder.findUnique({
    where: { id: String(req.params.id) },
    include: { order: { select: { paymentStatus: true } } },
  });
  if (!subOrder) return res.status(404).json({ message: "Vendor order not found." });
  const nextStatus = String(req.body?.status || "");
  const decision = checkSubOrderTransition({
    actorRole: req.auth!.role,
    actorId: req.auth!.id,
    vendorId: subOrder.vendorId,
    paymentStatus: subOrder.order.paymentStatus,
    currentStatus: subOrder.status,
    nextStatus,
  });
  if (decision.allowed === false) {
    const status = decision.reason === "payment_required" ? 409
      : decision.reason === "vendor_mismatch" || decision.reason === "role_forbidden" ? 403 : 409;
    const message = decision.reason === "payment_required" ? "Only paid orders can be fulfilled."
      : decision.reason === "vendor_mismatch" ? "You can only update your own vendor orders."
        : decision.reason === "role_forbidden" ? "You do not have permission to make this status change."
          : `Invalid status transition from ${subOrder.status} to ${nextStatus}.`;
    return res.status(status).json({ message });
  }

  const timestampField = nextStatus === "PACKED" ? "packedAt" : nextStatus === "SHIPPED" ? "shippedAt" : "deliveredAt";
  try {
    const result = await prisma.$transaction(async (tx) => {
      const changed = await tx.subOrder.updateMany({
        where: { id: subOrder.id, status: subOrder.status },
        data: { status: nextStatus as FulfillmentStatus, [timestampField]: new Date() },
      });
      if (!changed.count) throw Object.assign(new Error("This vendor order changed. Refresh and try again."), { status: 409 });
      const statuses = await tx.subOrder.findMany({ where: { orderId: subOrder.orderId }, select: { status: true } });
      const orderStatus = deriveOrderStatus(statuses.map((entry) => entry.status));
      const parent = await tx.order.findUnique({ where: { id: subOrder.orderId }, select: { status: true } });
      const order = await tx.order.update({
        where: { id: subOrder.orderId },
        data: {
          status: orderStatus,
          ...(parent?.status !== orderStatus && orderStatus === "PACKED" ? { packedAt: new Date() } : {}),
          ...(parent?.status !== orderStatus && orderStatus === "SHIPPED" ? { shippedAt: new Date() } : {}),
          ...(parent?.status !== orderStatus && orderStatus === "DELIVERED" ? { deliveredAt: new Date() } : {}),
        },
        include: { items: true, subOrders: { include: { items: true, vendor: { select: { vendorName: true } } } } },
      });
      const updatedSubOrder = order.subOrders.find((entry) => entry.id === subOrder.id);
      return { order, subOrder: updatedSubOrder };
    }, { isolationLevel: "Serializable" });
    if (req.auth!.role === "VENDOR" && result.subOrder) {
      const { vendorAccountId: _vendorAccountId, ...visibleSubOrder } = result.subOrder;
      const safeSubOrder = {
        ...visibleSubOrder,
        items: visibleSubOrder.items.map((item) => {
          const { vendorAccountId: _itemVendorAccountId, ...visibleItem } = item;
          return visibleItem;
        }),
      };
      return res.json({ subOrder: safeSubOrder, order: { id: result.order.id, status: result.order.status, paymentStatus: result.order.paymentStatus } });
    }
    return res.json(result);
  } catch (error: any) {
    if (error.status) return res.status(error.status).json({ message: error.message });
    throw error;
  }
});

export default router;

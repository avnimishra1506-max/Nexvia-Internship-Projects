import { Router, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { prisma } from "../db";
import { cartKey, redis } from "../lib/redis";
import { isPaymentSimulation, razorpayRequest, verifyPaymentSignature, verifyWebhookSignature } from "../lib/payments";
import { requireAuth } from "../middleware/auth";
import { allocateVendorAmounts } from "../domain/commission";

const router = Router();
const currency = process.env.RAZORPAY_CURRENCY || "INR";
type Address = { fullName: string; phone: string; street: string; city: string; state: string; postalCode: string };
const cleanAddress = (input: any): Address | null => {
  const fields: Array<keyof Address> = ["fullName", "phone", "street", "city", "state", "postalCode"];
  if (!input || fields.some((field) => typeof input[field] !== "string" || !input[field].trim())) return null;
  const address = Object.fromEntries(fields.map((field) => [field, input[field].trim().slice(0, 180)])) as Address;
  if (!/^\+?[0-9 ()-]{8,20}$/.test(address.phone)) return null;
  return address;
};

async function validateCoupon(code: string | undefined, userId: string, subtotal: number) {
  if (!code) return { discount: 0, couponId: undefined as string | undefined };
  const coupon = await prisma.coupon.findFirst({ where: { code: code.toUpperCase(), active: true, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } });
  if (!coupon) throw Object.assign(new Error("Coupon is invalid or expired."), { status: 400 });
  if (subtotal < Number(coupon.minimumAmount)) throw Object.assign(new Error(`Minimum order amount is ₹${Number(coupon.minimumAmount)}.`), { status: 400 });
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) throw Object.assign(new Error("Coupon usage limit reached."), { status: 400 });
  if (await prisma.couponUsage.findFirst({ where: { couponId: coupon.id, userId } })) throw Object.assign(new Error("You have already used this coupon."), { status: 400 });
  let discount = coupon.type === "PERCENT" ? subtotal * Number(coupon.value) / 100 : Number(coupon.value);
  if (coupon.maximumDiscount !== null) discount = Math.min(discount, Number(coupon.maximumDiscount));
  return { discount: Math.min(subtotal, Math.round(discount * 100) / 100), couponId: coupon.id };
}

router.post("/create-order", requireAuth, async (req, res) => {
  const shippingAddress = cleanAddress(req.body?.shippingAddress);
  if (!shippingAddress) return res.status(400).json({ message: "Provide a complete delivery address and valid phone number." });
  const cartRaw = await redis.get(cartKey(req.auth!.id));
  const cart = cartRaw ? JSON.parse(cartRaw) as Array<{ productId: string; quantity: number }> : [];
  if (!cart.length || cart.length > 50) return res.status(400).json({ message: "Your cart is empty." });
  if (new Set(cart.map((item) => item.productId)).size !== cart.length || cart.some((item) => !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20)) {
    return res.status(400).json({ message: "Cart items or quantities are invalid. Refresh your cart." });
  }
  const products = await prisma.product.findMany({ where: { id: { in: cart.map((item) => item.productId) }, active: true }, include: { seller: { select: { razorpayAccountId: true } } } });
  if (products.length !== cart.length) return res.status(409).json({ message: "A cart product is no longer available." });
  const productMap = new Map(products.map((product) => [product.id, product]));
  const subtotal = cart.reduce((sum, item) => sum + Number(productMap.get(item.productId)!.price) * item.quantity, 0);
  const couponCode = String(req.body?.couponCode || "").trim().toUpperCase() || undefined;
  const { discount } = await validateCoupon(couponCode, req.auth!.id, subtotal);
  const total = Math.round((subtotal - discount) * 100) / 100;
  const commissionSetting = await prisma.commissionSetting.findUnique({ where: { id: "platform" } });
  const commissionRate = Number(commissionSetting?.percentage ?? 10);
  const itemsByVendor = new Map<string, typeof cart>();
  for (const item of cart) {
    const product = productMap.get(item.productId)!;
    const vendorItems = itemsByVendor.get(product.sellerId) || [];
    vendorItems.push(item);
    itemsByVendor.set(product.sellerId, vendorItems);
  }
  const vendorAmounts = allocateVendorAmounts(
    [...itemsByVendor].map(([vendorId, items]) => ({
      vendorId,
      grossAmount: items.reduce((sum, item) => sum + Number(productMap.get(item.productId)!.price) * item.quantity, 0),
    })),
    discount,
    commissionRate,
  );
  const commissionAmount = vendorAmounts.reduce((sum, allocation) => sum + allocation.commissionAmount, 0);
  const sellerPayoutAmount = vendorAmounts.reduce((sum, allocation) => sum + allocation.payoutAmount, 0);
  if (total < 1) return res.status(400).json({ message: "Order total must be at least ₹1." });
  if (!isPaymentSimulation() && products.some((product) => !product.seller.razorpayAccountId)) {
    return res.status(409).json({ message: "A vendor is not configured for Razorpay Route payouts. Contact support." });
  }

  let order;
  try {
    order = await prisma.$transaction(async (tx) => {
      for (const item of cart) {
        const reservation = await tx.product.updateMany({ where: { id: item.productId, active: true, stock: { gte: item.quantity } }, data: { stock: { decrement: item.quantity } } });
        if (!reservation.count) throw Object.assign(new Error(`${productMap.get(item.productId)!.name} does not have enough stock.`), { status: 409 });
      }
      const created = await tx.order.create({
        data: {
          userId: req.auth!.id,
          status: "PLACED",
          paymentStatus: "PENDING",
          totalAmount: total,
          subtotal,
          commissionAmount,
          sellerPayoutAmount,
          couponCode,
          couponDiscount: discount,
          shippingAddress: shippingAddress as any,
        },
      });
      for (const allocation of vendorAmounts) {
        const vendorItems = itemsByVendor.get(allocation.vendorId)!;
        const firstProduct = productMap.get(vendorItems[0].productId)!;
        const subOrder = await tx.subOrder.create({
          data: {
            order: { connect: { id: created.id } },
            vendor: { connect: { id: allocation.vendorId } },
            vendorAccountId: firstProduct.seller.razorpayAccountId,
            status: "PLACED",
            subtotal: allocation.subtotal,
            commissionAmount: allocation.commissionAmount,
            vendorPayoutAmount: allocation.payoutAmount,
          },
        });
        await tx.orderItem.createMany({ data: vendorItems.map((item) => {
          const product = productMap.get(item.productId)!;
          return { orderId: created.id, subOrderId: subOrder.id, productId: product.id, sellerId: product.sellerId, vendorAccountId: product.seller.razorpayAccountId, productName: product.name, imageKey: product.imageKey, unitPrice: product.price, quantity: item.quantity };
        }) });
      }
      return tx.order.findUniqueOrThrow({ where: { id: created.id }, include: { items: true } });
    });
    let razorpayOrderId: string;
    if (isPaymentSimulation()) razorpayOrderId = `order_sim_${order.id}`;
    else {
      const paymentOrder = await razorpayRequest<{ id: string }>("/orders", "POST", {
        amount: Math.round(total * 100), currency, receipt: order.id.slice(0, 40), notes: { appOrderId: order.id },
      });
      razorpayOrderId = paymentOrder.id;
    }
    order = await prisma.order.update({ where: { id: order.id }, data: { razorpayOrderId }, include: { items: true } });
    return res.status(201).json({ appOrderId: order.id, razorpayOrderId, keyId: process.env.RAZORPAY_KEY_ID, amount: Math.round(total * 100), currency, isSimulation: isPaymentSimulation(), customer: { name: shippingAddress.fullName, phone: shippingAddress.phone } });
  } catch (error: any) {
    if (order) {
      await prisma.$transaction(async (tx) => {
        await tx.order.update({ where: { id: order.id }, data: { paymentStatus: "FAILED", status: "CANCELLED" } });
        for (const item of cart) await tx.product.update({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } });
      }).catch(() => {});
    }
    return res.status(error.status || 502).json({ message: error.message || "Could not start payment." });
  }
});

async function settleCapturedPayment(orderId: string, payment: { id: string; order_id: string; amount: number; currency: string; status: string }) {
  const order = await prisma.order.findUnique({ where: { razorpayOrderId: payment.order_id }, include: { items: true, subOrders: { include: { items: true } } } });
  if (!order || order.id !== orderId || payment.status !== "captured" || payment.amount !== Math.round(Number(order.totalAmount) * 100) || payment.currency !== currency) {
    throw new Error("Captured payment does not match the marketplace order.");
  }
  const paid = await prisma.order.updateMany({ where: { id: order.id, paymentStatus: "PENDING" }, data: { paymentStatus: "PAID", razorpayPaymentId: payment.id, settlementStatus: "PROCESSING" } });
  if (paid.count) await redis.del(cartKey(order.userId));
  if (paid.count && order.couponCode) {
    const coupon = await prisma.coupon.findUnique({ where: { code: order.couponCode } });
    if (coupon) await prisma.$transaction([
      prisma.coupon.update({ where: { id: coupon.id }, data: { usedCount: { increment: 1 } } }),
      prisma.couponUsage.create({ data: { couponId: coupon.id, userId: order.userId, orderId: order.id } }),
    ]).catch((error) => console.error("Coupon usage record failed:", error));
  }
  const latest = await prisma.order.findUnique({ where: { id: order.id }, include: { subOrders: { include: { payout: true } } } });
  if (!latest || latest.paymentStatus !== "PAID") return latest;
  if (["TRANSFERRED", "SIMULATED", "NO_VENDOR_TRANSFER"].includes(latest.settlementStatus)) return latest;
  const lockKey = `settlement:${order.id}`;
  const lockValue = randomUUID();
  const lock = await redis.set(lockKey, lockValue, "EX", 300, "NX");
  if (lock !== "OK") return latest;

  let activeSubOrderId: string | null = null;
  try {
    const payouts = await Promise.all(latest.subOrders.map((subOrder) => prisma.payout.upsert({
      where: { subOrderId: subOrder.id },
      create: {
        subOrderId: subOrder.id,
        vendorId: subOrder.vendorId,
        grossAmount: subOrder.subtotal,
        commissionAmount: subOrder.commissionAmount,
        amount: subOrder.vendorPayoutAmount,
      },
      update: {
        grossAmount: subOrder.subtotal,
        commissionAmount: subOrder.commissionAmount,
        amount: subOrder.vendorPayoutAmount,
      },
    })));

    for (const payout of payouts) {
      if (["PAID", "SIMULATED"].includes(payout.status)) continue;
      activeSubOrderId = payout.subOrderId;
      if (Number(payout.amount) === 0) {
        await prisma.payout.update({ where: { id: payout.id }, data: { status: isPaymentSimulation() ? "SIMULATED" : "PAID", paidAt: new Date() } });
        activeSubOrderId = null;
        continue;
      }
      const subOrder = latest.subOrders.find((entry) => entry.id === payout.subOrderId)!;
      if (isPaymentSimulation()) {
        await prisma.payout.update({ where: { id: payout.id }, data: { status: "SIMULATED", providerReference: `trf_sim_${subOrder.id}`, paidAt: new Date() } });
        activeSubOrderId = null;
      } else {
        if (!subOrder.vendorAccountId) throw new Error(`Vendor ${subOrder.vendorId} has no Razorpay Route account configured.`);
        const result = await razorpayRequest<{ items?: Array<{ id?: string }> }>(`/payments/${encodeURIComponent(payment.id)}/transfers`, "POST", {
          transfers: [{ account: subOrder.vendorAccountId, amount: Math.round(Number(payout.amount) * 100), currency, notes: { appOrderId: order.id, subOrderId: subOrder.id } }],
        });
        await prisma.payout.update({ where: { id: payout.id }, data: { status: "PAID", providerReference: result.items?.[0]?.id || payment.id, paidAt: new Date() } });
        activeSubOrderId = null;
      }
    }

    const settledPayouts = await prisma.payout.findMany({ where: { subOrderId: { in: latest.subOrders.map((subOrder) => subOrder.id) } } });
    const payoutStatuses = settledPayouts.map((entry) => entry.status);
    const settlementStatus = payoutStatuses.every((status) => status === "PAID") ? "TRANSFERRED"
      : payoutStatuses.every((status) => status === "SIMULATED") ? "SIMULATED"
        : payoutStatuses.some((status) => status === "FAILED") ? "FAILED" : "PROCESSING";
    const completedAmount = settledPayouts.reduce((sum, entry) => sum + Number(entry.amount), 0);
    return prisma.order.update({ where: { id: order.id }, data: {
      sellerTransfers: settledPayouts.map((entry) => ({ vendorId: entry.vendorId, amount: Math.round(Number(entry.amount) * 100), reference: entry.providerReference, status: entry.status })) as any,
      sellerPayoutAmount: completedAmount,
      settlementStatus,
    } });
  } catch (error) {
    if (activeSubOrderId) await prisma.payout.updateMany({ where: { subOrderId: activeSubOrderId, status: { in: ["PENDING", "FAILED"] } }, data: { status: "FAILED" } });
    await prisma.order.update({ where: { id: order.id }, data: { settlementStatus: "FAILED" } });
    console.error("Vendor payout failed; completed payout records are preserved for reconciliation:", error);
    return prisma.order.findUnique({ where: { id: order.id } });
  } finally {
    await redis.eval("if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end", 1, lockKey, lockValue);
  }
}

router.post("/verify", requireAuth, async (req, res) => {
  const { appOrderId, razorpay_order_id: razorpayOrderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body || {};
  const order = await prisma.order.findFirst({ where: { id: String(appOrderId || ""), userId: req.auth!.id } });
  if (!order || order.razorpayOrderId !== razorpayOrderId) return res.status(404).json({ message: "Payment order was not found." });
  try {
    let payment: { id: string; order_id: string; amount: number; currency: string; status: string };
    if (isPaymentSimulation()) payment = { id: String(paymentId || `pay_sim_${Date.now()}`), order_id: razorpayOrderId, amount: Math.round(Number(order.totalAmount) * 100), currency, status: "captured" };
    else {
      if (!verifyPaymentSignature(razorpayOrderId, paymentId, signature)) return res.status(400).json({ message: "Razorpay signature verification failed." });
      payment = await razorpayRequest("/payments/" + encodeURIComponent(paymentId));
      if (payment.status === "authorized") payment = await razorpayRequest(`/payments/${encodeURIComponent(paymentId)}/capture`, "POST", { amount: payment.amount, currency: payment.currency });
    }
    const updated = await settleCapturedPayment(order.id, payment);
    return res.json({ order: updated, isSimulation: isPaymentSimulation() });
  } catch (error: any) {
    return res.status(502).json({ message: error.message || "Could not confirm payment." });
  }
});

router.post("/cancel-checkout", requireAuth, async (req, res) => {
  const order = await prisma.order.findFirst({ where: { id: String(req.body?.appOrderId || ""), userId: req.auth!.id, paymentStatus: "PENDING" }, include: { items: true } });
  if (!order) return res.json({ cancelled: false });
  await prisma.$transaction(async (tx) => {
    const cancelled = await tx.order.updateMany({ where: { id: order.id, paymentStatus: "PENDING" }, data: { paymentStatus: "FAILED", status: "CANCELLED" } });
    if (cancelled.count) for (const item of order.items) await tx.product.update({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } });
  });
  return res.json({ cancelled: true });
});

export async function handleRazorpayWebhook(req: Request, res: Response) {
  const signature = req.get("x-razorpay-signature");
  if (!Buffer.isBuffer(req.body) || !verifyWebhookSignature(req.body, signature)) return res.status(400).send("Invalid Razorpay webhook signature.");
  const event = JSON.parse(req.body.toString("utf8"));
  if (event.event === "payment.captured") {
    const payment = event.payload?.payment?.entity;
    const order = payment?.order_id ? await prisma.order.findUnique({ where: { razorpayOrderId: payment.order_id } }) : null;
    if (order) await settleCapturedPayment(order.id, payment);
  }
  return res.json({ received: true });
}

export default router;

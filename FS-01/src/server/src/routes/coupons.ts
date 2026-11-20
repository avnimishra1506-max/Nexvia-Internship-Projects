import { Router } from "express";
import { CouponType } from "@prisma/client";
import { prisma } from "../db";
import { allowRoles, requireAuth } from "../middleware/auth";

const router = Router();

router.get("/admin", requireAuth, allowRoles("ADMIN"), async (_req, res) => {
  const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: "desc" } });
  return res.json(coupons);
});

router.get("/", async (_req, res) => {
  const coupons = await prisma.coupon.findMany({ where: { active: true, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }, select: { code: true, type: true, value: true, minimumAmount: true, maximumDiscount: true, expiresAt: true } });
  return res.json(coupons);
});

router.post("/validate", requireAuth, async (req, res) => {
  const code = String(req.body?.code || "").trim().toUpperCase();
  const amount = Number(req.body?.amount);
  if (!code || !Number.isFinite(amount) || amount <= 0) return res.status(400).json({ message: "Provide a coupon code and a positive order amount." });
  const coupon = await prisma.coupon.findFirst({ where: { code, active: true, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } });
  if (!coupon) return res.status(404).json({ message: "Coupon is invalid or expired." });
  if (amount < Number(coupon.minimumAmount)) return res.status(400).json({ message: `Minimum order amount is ₹${Number(coupon.minimumAmount).toFixed(2)}.` });
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) return res.status(400).json({ message: "Coupon usage limit reached." });
  const alreadyUsed = await prisma.couponUsage.findFirst({ where: { couponId: coupon.id, userId: req.auth!.id } });
  if (alreadyUsed) return res.status(400).json({ message: "You have already used this coupon." });
  let discount = coupon.type === CouponType.PERCENT ? amount * Number(coupon.value) / 100 : Number(coupon.value);
  if (coupon.maximumDiscount !== null) discount = Math.min(discount, Number(coupon.maximumDiscount));
  discount = Math.min(amount, Math.round(discount * 100) / 100);
  return res.json({ valid: true, code, discount, finalAmount: amount - discount });
});

router.post("/", requireAuth, allowRoles("ADMIN"), async (req, res) => {
  const code = String(req.body?.code || "").trim().toUpperCase();
  const type = String(req.body?.type || "");
  const value = Number(req.body?.value);
  const minimumAmount = Number(req.body?.minimumAmount || 0);
  if (!/^[A-Z0-9_-]{3,30}$/.test(code) || !["PERCENT", "FLAT"].includes(type) || !Number.isFinite(value) || value <= 0 || !Number.isFinite(minimumAmount) || minimumAmount < 0) {
    return res.status(400).json({ message: "Provide a valid code, discount type/value, and minimum amount." });
  }
  const maximumDiscount = req.body?.maximumDiscount === "" || req.body?.maximumDiscount === undefined || req.body?.maximumDiscount === null ? null : Number(req.body.maximumDiscount);
  const usageLimit = req.body?.usageLimit === "" || req.body?.usageLimit === undefined || req.body?.usageLimit === null ? null : Number(req.body.usageLimit);
  const expiresAt = req.body?.expiresAt ? new Date(req.body.expiresAt) : null;
  if ((maximumDiscount !== null && (!Number.isFinite(maximumDiscount) || maximumDiscount <= 0)) || (usageLimit !== null && (!Number.isInteger(usageLimit) || usageLimit <= 0)) || (expiresAt && !Number.isFinite(expiresAt.getTime())) || (type === "PERCENT" && value > 100)) return res.status(400).json({ message: "Check the maximum discount, usage limit, expiry date, and percentage value." });
  const coupon = await prisma.coupon.create({ data: { code, type: type as CouponType, value, minimumAmount, maximumDiscount, usageLimit, expiresAt } });
  return res.status(201).json(coupon);
});

router.patch("/:id", requireAuth, allowRoles("ADMIN"), async (req, res) => {
  const existing = await prisma.coupon.findUnique({ where: { id: String(req.params.id) } });
  if (!existing) return res.status(404).json({ message: "Coupon not found." });
  const data: Record<string, unknown> = {};
  if (req.body?.active !== undefined) {
    if (typeof req.body.active !== "boolean") return res.status(400).json({ message: "Active must be true or false." });
    data.active = req.body.active;
  }
  if (req.body?.code !== undefined) {
    const code = String(req.body.code).trim().toUpperCase();
    if (!/^[A-Z0-9_-]{3,30}$/.test(code)) return res.status(400).json({ message: "Coupon codes must be 3 to 30 letters, numbers, hyphens or underscores." });
    data.code = code;
  }
  if (req.body?.type !== undefined) {
    if (!Object.values(CouponType).includes(req.body.type)) return res.status(400).json({ message: "Choose PERCENT or FLAT." });
    data.type = req.body.type;
  }
  for (const field of ["value", "minimumAmount", "maximumDiscount"] as const) if (req.body?.[field] !== undefined) {
    const value = req.body[field] === "" || req.body[field] === null ? null : Number(req.body[field]);
    if (value !== null && (!Number.isFinite(value) || value < 0 || (field === "value" && value === 0))) return res.status(400).json({ message: `${field} must be a valid non-negative amount.` });
    data[field] = value;
  }
  if (req.body?.usageLimit !== undefined) {
    const limit = req.body.usageLimit === "" || req.body.usageLimit === null ? null : Number(req.body.usageLimit);
    if (limit !== null && (!Number.isInteger(limit) || limit <= 0)) return res.status(400).json({ message: "Usage limit must be a positive whole number." });
    data.usageLimit = limit;
  }
  if (req.body?.expiresAt !== undefined) {
    const expiry = req.body.expiresAt ? new Date(req.body.expiresAt) : null;
    if (expiry && !Number.isFinite(expiry.getTime())) return res.status(400).json({ message: "Expiry date is invalid." });
    data.expiresAt = expiry;
  }
  const finalType = String(data.type ?? existing.type);
  const finalValue = Number(data.value ?? existing.value);
  if (finalType === "PERCENT" && finalValue > 100) return res.status(400).json({ message: "Percentage discount cannot exceed 100." });
  const coupon = await prisma.coupon.update({ where: { id: existing.id }, data: data as any });
  return res.json(coupon);
});

export default router;

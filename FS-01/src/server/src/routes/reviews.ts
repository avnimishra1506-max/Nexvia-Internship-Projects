import { Router } from "express";
import { prisma } from "../db";
import { requireAuth } from "../middleware/auth";

const router = Router();
router.get("/product/:productId", async (req, res) => {
  const reviews = await prisma.review.findMany({ where: { productId: String(req.params.productId) }, include: { user: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 100 });
  return res.json(reviews);
});

router.post("/product/:productId", requireAuth, async (req, res) => {
  const rating = Number(req.body?.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ message: "Rating must be a whole number from 1 to 5." });
  const product = await prisma.product.findFirst({ where: { id: String(req.params.productId), active: true } });
  if (!product) return res.status(404).json({ message: "Product not found." });
  const purchase = await prisma.orderItem.findFirst({ where: { productId: product.id, order: { userId: req.auth!.id, paymentStatus: "PAID", subOrders: { some: { status: "DELIVERED", items: { some: { productId: product.id } } } } } } });
  if (!purchase) return res.status(403).json({ message: "You can review this product after its order has been delivered." });
  try {
    const review = await prisma.review.create({ data: { productId: product.id, userId: req.auth!.id, rating, title: String(req.body?.title || "").slice(0, 100), comment: String(req.body?.comment || "").slice(0, 1000), verified: true } });
    const average = await prisma.review.aggregate({ where: { productId: product.id }, _avg: { rating: true } });
    await prisma.product.update({ where: { id: product.id }, data: { rating: average._avg.rating ?? 0 } });
    return res.status(201).json(review);
  } catch (error: any) {
    if (error.code === "P2002") return res.status(409).json({ message: "You have already reviewed this product." });
    throw error;
  }
});
export default router;

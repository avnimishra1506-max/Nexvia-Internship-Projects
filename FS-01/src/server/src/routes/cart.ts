import { Router } from "express";
import { prisma } from "../db";
import { cartKey, redis } from "../lib/redis";
import { requireAuth } from "../middleware/auth";
import { productImageUrl } from "../lib/s3";

const router = Router();
router.use(requireAuth);

async function readCart(userId: string) {
  const raw = await redis.get(cartKey(userId));
  if (!raw) return [] as Array<{ productId: string; quantity: number }>;
  try { return JSON.parse(raw) as Array<{ productId: string; quantity: number }>; } catch { return []; }
}

router.get("/", async (req, res) => {
  const cart = await readCart(req.auth!.id);
  if (!cart.length) return res.json({ items: [] });
  const products = await prisma.product.findMany({ where: { id: { in: cart.map((item) => item.productId) }, active: true }, include: { seller: { select: { vendorName: true } } } });
  const byId = new Map(products.map((product) => [product.id, product]));
  return res.json({ items: cart.flatMap(({ productId, quantity }) => {
    const product = byId.get(productId);
    return product ? [{ productId, quantity, product: { id: product.id, name: product.name, price: Number(product.price), stock: product.stock, imageKey: product.imageKey, vendor: product.seller.vendorName, imageUrl: productImageUrl(product.imageKey) } }] : [];
  }) });
});

router.put("/", async (req, res) => {
  const items = req.body?.items;
  if (!Array.isArray(items) || items.length > 50) return res.status(400).json({ message: "Cart must contain up to 50 products." });
  const quantities = new Map<string, number>();
  for (const item of items) {
    const productId = String(item?.productId || "");
    const quantity = Number(item?.quantity);
    if (!productId || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) return res.status(400).json({ message: "Each cart item needs a product and a quantity from 1 to 20." });
    quantities.set(productId, (quantities.get(productId) || 0) + quantity);
  }
  if ([...quantities.values()].some((quantity) => quantity > 20)) return res.status(400).json({ message: "Cart quantity per product cannot exceed 20." });
  const products = await prisma.product.findMany({ where: { id: { in: [...quantities.keys()] }, active: true } });
  if (products.length !== quantities.size) return res.status(400).json({ message: "A product is unavailable. Refresh your cart." });
  await redis.set(cartKey(req.auth!.id), JSON.stringify([...quantities].map(([productId, quantity]) => ({ productId, quantity }))), "EX", 60 * 60 * 24 * 30);
  return res.json({ message: "Cart saved." });
});

router.delete("/", async (req, res) => {
  await redis.del(cartKey(req.auth!.id));
  return res.json({ message: "Cart cleared." });
});

export default router;

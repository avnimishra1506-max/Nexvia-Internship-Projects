import { Router } from "express";
import { prisma } from "../db";
import { allowRoles, requireAuth } from "../middleware/auth";
import { createProductUploadUrl, productImageUrl } from "../lib/s3";
import { indexProduct, removeProductFromIndex, searchProductIds } from "../lib/search";

const router = Router();

function present<T extends { imageKey: string; galleryKeys?: unknown }>(product: T) {
  const galleryKeys = Array.isArray(product.galleryKeys) ? product.galleryKeys.filter((key): key is string => typeof key === "string") : [];
  return { ...product, imageUrl: productImageUrl(product.imageKey), galleryImages: galleryKeys.map(productImageUrl) };
}

function readGalleryKeys(input: unknown, primaryImageKey = "") {
  if (input !== undefined && !Array.isArray(input)) throw Object.assign(new Error("Product images must be a list."), { status: 400 });
  const provided = input === undefined ? [] : input as unknown[];
  if (provided.length > 5 || provided.some((key) => typeof key !== "string" || key.length > 500)) {
    throw Object.assign(new Error("Upload up to five product images."), { status: 400 });
  }
  return [...new Set([primaryImageKey, ...provided].filter(Boolean) as string[])];
}

router.get("/search", async (req, res) => {
  const q = String(req.query.q || "").trim().slice(0, 120);
  const category = String(req.query.category || "").trim().slice(0, 80);
  const sort = String(req.query.sort || "relevance");
  const vendor = String(req.query.vendor || "").trim().slice(0, 120);
  const rating = req.query.rating === undefined ? undefined : Number(req.query.rating);
  const inStock = req.query.inStock === "true";
  if (rating !== undefined && (!Number.isFinite(rating) || rating < 0 || rating > 5)) return res.status(400).json({ message: "Rating must be between 0 and 5." });
  const minPrice = req.query.minPrice === undefined ? undefined : Number(req.query.minPrice);
  const maxPrice = req.query.maxPrice === undefined ? undefined : Number(req.query.maxPrice);
  if ((minPrice !== undefined && (!Number.isFinite(minPrice) || minPrice < 0)) || (maxPrice !== undefined && (!Number.isFinite(maxPrice) || maxPrice < 0))) {
    return res.status(400).json({ message: "Price filters must be non-negative numbers." });
  }
  const priceOrder = sort === "price_asc" ? { price: "asc" as const } : sort === "price_desc" ? { price: "desc" as const } : sort === "rating" ? { rating: "desc" as const } : { createdAt: "desc" as const };
  let ids: string[] | null = null;
  try { ids = await searchProductIds(q, { category: category || undefined, minPrice, maxPrice, sort }); } catch (error) { console.error("Elasticsearch search unavailable; using PostgreSQL:", error); }
  const where: any = { active: true };
  if (category) where.category = { equals: category, mode: "insensitive" };
  if (vendor) where.seller = { vendorName: { contains: vendor, mode: "insensitive" } };
  if (rating !== undefined) where.rating = { gte: rating };
  if (inStock) where.stock = { gt: 0 };
  if (minPrice !== undefined || maxPrice !== undefined) where.price = { ...(minPrice !== undefined ? { gte: minPrice } : {}), ...(maxPrice !== undefined ? { lte: maxPrice } : {}) };
  if (q && ids === null) where.OR = ["name", "description", "category"].map((field) => ({ [field]: { contains: q, mode: "insensitive" } }));
  if (ids) where.id = { in: ids };
  const rows = await prisma.product.findMany({ where, orderBy: priceOrder, take: 100, include: { seller: { select: { vendorName: true } }, _count: { select: { reviews: true } } } });
  if (ids && sort === "relevance") {
    const rank = new Map(ids.map((id, index) => [id, index]));
    rows.sort((a, b) => (rank.get(a.id) ?? 1000) - (rank.get(b.id) ?? 1000));
  }
  return res.json(rows.map(present));
});

router.get("/mine", requireAuth, allowRoles("VENDOR", "ADMIN"), async (req, res) => {
  const products = await prisma.product.findMany({ where: req.auth!.role === "ADMIN" ? {} : { sellerId: req.auth!.id }, orderBy: { updatedAt: "desc" } });
  return res.json(products.map(present));
});

router.get("/:id", async (req, res) => {
  const product = await prisma.product.findFirst({ where: { id: req.params.id, active: true }, include: { seller: { select: { vendorName: true } }, _count: { select: { reviews: true } } } });
  if (!product) return res.status(404).json({ message: "Product not found." });
  return res.json(present(product));
});

router.post("/upload-url", requireAuth, allowRoles("VENDOR", "ADMIN"), async (req, res) => {
  const contentType = String(req.body?.contentType || "");
  const result = await createProductUploadUrl(req.auth!.id, contentType);
  return res.json(result);
});

router.post("/", requireAuth, allowRoles("VENDOR", "ADMIN"), async (req, res) => {
  const { name, description = "", category, price, stock } = req.body || {};
  const priceNumber = Number(price);
  const stockNumber = Number(stock);
  if (typeof name !== "string" || name.trim().length < 2 || typeof category !== "string" || !category.trim() || !Number.isFinite(priceNumber) || priceNumber <= 0 || !Number.isInteger(stockNumber) || stockNumber < 0) {
    return res.status(400).json({ message: "Provide a product name, category, positive price, and whole-number stock." });
  }
  let galleryKeys: string[];
  try { galleryKeys = readGalleryKeys(req.body?.galleryKeys, String(req.body?.imageKey || "")); }
  catch (error: any) { return res.status(error.status || 400).json({ message: error.message }); }
  if (req.auth!.role !== "ADMIN" && galleryKeys.some((key) => !key.startsWith(`products/${req.auth!.id}/`))) return res.status(403).json({ message: "Upload each product image through your vendor account." });
  const imageKey = galleryKeys[0] || "";
  const product = await prisma.product.create({
    data: { sellerId: req.auth!.id, name: name.trim().slice(0, 180), description: String(description).slice(0, 4000), category: category.trim().slice(0, 80).toLowerCase(), price: priceNumber, stock: stockNumber, imageKey, galleryKeys: galleryKeys as any },
  });
  await indexProduct(product).catch((error) => console.error("Product search indexing failed:", error));
  return res.status(201).json(present(product));
});

router.patch("/:id", requireAuth, allowRoles("VENDOR", "ADMIN"), async (req, res) => {
  const existing = await prisma.product.findUnique({ where: { id: String(req.params.id) } });
  if (!existing || (req.auth!.role !== "ADMIN" && existing.sellerId !== req.auth!.id)) return res.status(404).json({ message: "Product not found." });
  const data: Record<string, unknown> = {};
  for (const field of ["name", "description", "category", "imageKey"] as const) if (req.body?.[field] !== undefined) data[field] = String(req.body[field]).slice(0, field === "description" ? 4000 : 500);
  if (req.body?.galleryKeys !== undefined) {
    try {
      const keys = readGalleryKeys(req.body.galleryKeys, String(req.body?.imageKey || ""));
      if (req.auth!.role !== "ADMIN" && keys.some((key) => !key.startsWith(`products/${req.auth!.id}/`))) return res.status(403).json({ message: "Upload each product image through your vendor account." });
      data.galleryKeys = keys as any;
      data.imageKey = keys[0] || "";
    } catch (error: any) {
      return res.status(error.status || 400).json({ message: error.message });
    }
  } else if (req.body?.imageKey && req.auth!.role !== "ADMIN" && !String(req.body.imageKey).startsWith(`products/${req.auth!.id}/`)) {
    return res.status(403).json({ message: "Upload the product image through your vendor account." });
  }
  if (req.body?.price !== undefined) {
    const price = Number(req.body.price);
    if (!Number.isFinite(price) || price <= 0) return res.status(400).json({ message: "Price must be greater than zero." });
    data.price = price;
  }
  if (req.body?.stock !== undefined) {
    const stock = Number(req.body.stock);
    if (!Number.isInteger(stock) || stock < 0) return res.status(400).json({ message: "Stock must be a non-negative whole number." });
    data.stock = stock;
  }
  if (req.body?.active !== undefined) {
    if (typeof req.body.active !== "boolean") return res.status(400).json({ message: "Product active status must be true or false." });
    data.active = req.body.active;
  }
  const product = await prisma.product.update({ where: { id: existing.id }, data: data as any });
  await indexProduct(product).catch((error) => console.error("Product search indexing failed:", error));
  return res.json(present(product));
});

router.delete("/:id", requireAuth, allowRoles("VENDOR", "ADMIN"), async (req, res) => {
  const product = await prisma.product.findUnique({ where: { id: String(req.params.id) } });
  if (!product || (req.auth!.role !== "ADMIN" && product.sellerId !== req.auth!.id)) return res.status(404).json({ message: "Product not found." });
  await prisma.product.update({ where: { id: product.id }, data: { active: false } });
  await removeProductFromIndex(product.id).catch((error) => console.error("Product search removal failed:", error));
  return res.json({ message: "Product removed from the marketplace." });
});

export default router;

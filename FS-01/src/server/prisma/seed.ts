import bcrypt from "bcryptjs";
import { prisma } from "../src/db";

const productNames = [
  "Classic Cotton Shirt", "Everyday Oxford Shirt", "Linen Blend Kurta", "Slim Fit Chinos",
  "Comfort Crew T-Shirt", "Weekend Polo Shirt", "Printed Summer Dress", "Soft Knit Cardigan",
  "High Rise Denim", "Pleated Midi Skirt", "Essential Tote Bag", "Leather Wallet",
  "Running Sneakers", "Canvas Casual Shoes", "Minimal Wrist Watch", "Travel Backpack",
  "Ceramic Coffee Set", "Cotton Bath Towel", "Modern Table Lamp", "Indoor Planter",
  "Wireless Earbuds", "Portable Bluetooth Speaker", "Mechanical Keyboard", "Phone Stand",
  "Yoga Mat", "Stainless Water Bottle", "Resistance Band Set", "Fitness Duffle Bag",
  "Wooden Building Blocks", "Creative Art Kit", "Puzzle Adventure Set", "Plush Elephant",
  "Herbal Tea Collection", "Gourmet Snack Box", "Organic Spice Set", "Premium Coffee Beans",
];

const images = [
  "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1484101403633-562f891dc89a?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=80",
];

const categories = ["fashion", "fashion", "fashion", "fashion", "fashion", "fashion", "fashion", "fashion", "fashion", "fashion", "accessories", "accessories", "accessories", "accessories", "accessories", "accessories", "home", "home", "home", "home", "electronics", "electronics", "electronics", "electronics", "sports", "sports", "sports", "sports", "toys", "toys", "toys", "toys", "groceries", "groceries", "groceries", "groceries"];

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password || password.length < 12) throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD (at least 12 characters) to create the initial admin.");
  const vendorPassword = process.env.SAMPLE_VENDOR_PASSWORD;
  if (!vendorPassword || vendorPassword.length < 12) throw new Error("Set SAMPLE_VENDOR_PASSWORD (at least 12 characters) to create the sample vendors.");

  const adminPasswordHash = await bcrypt.hash(password, 12);
  await prisma.user.upsert({
    where: { email },
    create: { email, name: process.env.ADMIN_NAME || "Marketplace Admin", passwordHash: adminPasswordHash, role: "ADMIN" },
    update: { role: "ADMIN", name: process.env.ADMIN_NAME || "Marketplace Admin" },
  });

  const vendorPasswordHash = await bcrypt.hash(vendorPassword, 12);
  const vendors = await Promise.all([
    ["urban@shop.test", "Urban Essentials"],
    ["home@shop.test", "Home & Living Co."],
    ["everyday@shop.test", "Everyday Finds"],
  ].map(([vendorEmail, vendorName]) => prisma.user.upsert({
    where: { email: vendorEmail },
    create: { email: vendorEmail, name: vendorName, passwordHash: vendorPasswordHash, role: "VENDOR", vendorStatus: "APPROVED", vendorName },
    update: { role: "VENDOR", vendorStatus: "APPROVED", vendorName, passwordHash: vendorPasswordHash },
  })));

  for (const [index, name] of productNames.entries()) {
    const seller = vendors[index % vendors.length];
    const existing = await prisma.product.findFirst({ where: { sellerId: seller.id, name } });
    const product = {
      sellerId: seller.id,
      name,
      description: `${name} from an approved ShoppingSphere sample vendor.`,
      category: categories[index],
      price: 499 + index * 125,
      stock: 8 + (index % 20),
      rating: 3.8 + (index % 12) / 10,
      imageKey: images[index % images.length],
      active: true,
    };
    if (existing) await prisma.product.update({ where: { id: existing.id }, data: product });
    else await prisma.product.create({ data: product });
  }

  const starterCoupons = [
    { code: "WELCOME10", type: "PERCENT" as const, value: 10, minimumAmount: 0, maximumDiscount: 1000 },
    { code: "MARKET200", type: "FLAT" as const, value: 200, minimumAmount: 1000, maximumDiscount: null },
  ];
  for (const coupon of starterCoupons) await prisma.coupon.upsert({ where: { code: coupon.code }, create: coupon, update: {} });
  await prisma.commissionSetting.upsert({ where: { id: "platform" }, create: { id: "platform", percentage: 10 }, update: {} });
  console.log(`Seeded administrator ${email}, 3 sample vendors, and ${productNames.length} products.`);
}

main().finally(async () => prisma.$disconnect());

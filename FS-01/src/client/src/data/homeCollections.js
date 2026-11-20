const FESTIVE =
  /festive|fusion wear|saree|lehenga|kurta|sherwani|ethnic|nehru|dupatta|dhoti|churidar/;
const SEASONAL =
  /jacket|sweater|coat|boot|thermal|shawl|stole|sweatshirt|hoodie|winter|cardigan/;

export function discountPercent(product) {
  const price = Number(product?.price);
  const mrp = Number(product?.mrp);
  if (!mrp || !price || mrp <= price) return 0;
  return Math.round(((mrp - price) / mrp) * 100);
}

function categoryBlob(product) {
  return `${product.sectionTitle || ""} ${product.subCategory || ""}`.toLowerCase();
}

export function isFestiveProduct(product) {
  return FESTIVE.test(categoryBlob(product));
}

export function isSeasonalProduct(product) {
  return SEASONAL.test(categoryBlob(product)) && !isFestiveProduct(product);
}

export function isCelebrityProduct(product) {
  const label = `${product.brand || ""} ${product.vendor || ""}`.toLowerCase();
  return (
    label.includes("hrx") ||
    label.includes("wrogn") ||
    label.includes("kay beauty") ||
    label.includes("katrina")
  );
}

function trendingScore(product) {
  const rating = Number(product.rating || 0);
  const reviews = Number(product.reviews || 0);
  const street =
    `${product.sectionTitle || ""}`.toLowerCase().includes("trending") ? 2 : 0;
  return rating * Math.log10(reviews + 10) + street + discountPercent(product) / 25;
}

function byDiscount(a, b) {
  const discountGap = discountPercent(b) - discountPercent(a);
  if (discountGap) return discountGap;
  return (Number(b.rating) || 0) - (Number(a.rating) || 0);
}

function diverse(list, limit) {
  const seen = new Set();
  const picked = [];
  for (const product of list) {
    if (!product?.image || !product?._id) continue;
    const key = `${(product.subCategory || "").toLowerCase()}|${(product.brand || "").toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push(product);
    if (limit && picked.length >= limit) break;
  }
  return picked;
}

function roundRobinByBrand(list, limit) {
  const groups = new Map();
  for (const product of list) {
    if (!product?.image || !product?._id) continue;
    const brand = (product.brand || product.vendor || "other").toLowerCase();
    if (!groups.has(brand)) groups.set(brand, []);
    const bucket = groups.get(brand);
    const sub = (product.subCategory || "").toLowerCase();
    if (bucket.some((item) => (item.subCategory || "").toLowerCase() === sub)) continue;
    bucket.push(product);
  }

  const buckets = [...groups.values()];
  const picked = [];
  let index = 0;
  while (buckets.some((bucket) => bucket.length) && (!limit || picked.length < limit)) {
    const bucket = buckets[index % buckets.length];
    if (bucket.length) picked.push(bucket.shift());
    index += 1;
    if (index > list.length + buckets.length) break;
  }
  return picked;
}

export function selectCollection(products, key, limit) {
  const list = Array.isArray(products) ? products : [];
  if (key === "festive") {
    return diverse(list.filter(isFestiveProduct).sort(byDiscount), limit);
  }
  if (key === "seasonal") {
    return diverse(list.filter(isSeasonalProduct).sort(byDiscount), limit);
  }
  if (key === "celebrity") {
    return roundRobinByBrand(
      list.filter(isCelebrityProduct).sort(byDiscount),
      limit
    );
  }
  if (key === "trending") {
    const ranked = [...list].sort((a, b) => trendingScore(b) - trendingScore(a));
    return diverse(ranked, limit || 80);
  }
  if (key === "deals") {
    return diverse([...list].sort(byDiscount), limit || 8);
  }
  return [];
}

export function maxDiscount(products) {
  return products.reduce((max, product) => Math.max(max, discountPercent(product)), 0);
}

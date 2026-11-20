const API_URL = `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api`;

function normalizeMarketplaceProduct(product) {
  return {
    ...product,
    _id: product.id,
    image: product.imageUrl || "",
    fallbackImage: product.imageUrl || "",
    vendor: product.seller?.vendorName || "ShoppingSphere seller",
    sectionTitle: product.category,
    subCategory: product.category,
    mrp: product.originalPrice || product.mrp || product.price,
    stock: Number(product.stock) || 0,
    category: product.category || "",
    rating: Number(product.rating) || 0,
    reviews: Number(product._count?.reviews) || 0,
    customerReviews: [],
    currency: "INR",
  };
}

export async function getProducts(filters = {}) {
  const params = new URLSearchParams();
  const names = { search: "q", category: "category", minPrice: "minPrice", maxPrice: "maxPrice", sort: "sort", vendor: "vendor", rating: "rating", inStock: "inStock" };
  for (const [key, value] of Object.entries(filters)) if (names[key] && value !== "" && value != null) params.set(names[key], value);
  const response = await fetch(`${API_URL}/products/search${params.size ? `?${params}` : ""}`);
  if (!response.ok) throw new Error(`Could not load products (${response.status}).`);
  const products = await response.json();
  return Array.isArray(products) ? products.map(normalizeMarketplaceProduct) : [];
}

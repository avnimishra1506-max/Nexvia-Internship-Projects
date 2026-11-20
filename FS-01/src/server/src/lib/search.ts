import { Client } from "@elastic/elasticsearch";
import type { Product } from "@prisma/client";

const elasticsearchUrl = process.env.ELASTICSEARCH_URL?.trim();
export const searchClient = elasticsearchUrl ? new Client({
  node: elasticsearchUrl,
  ...(process.env.ELASTICSEARCH_USERNAME && process.env.ELASTICSEARCH_PASSWORD
    ? { auth: { username: process.env.ELASTICSEARCH_USERNAME, password: process.env.ELASTICSEARCH_PASSWORD } }
    : {}),
}) : null;

const INDEX = "marketplace-products";

export async function indexProduct(product: Product) {
  if (!searchClient) return;
  await searchClient.index({
    index: INDEX,
    id: product.id,
    document: {
      id: product.id,
      sellerId: product.sellerId,
      name: product.name,
      description: product.description,
      category: product.category,
      price: Number(product.price),
      active: product.active,
      createdAt: product.createdAt,
    },
    refresh: "wait_for",
  });
}

export async function removeProductFromIndex(id: string) {
  if (!searchClient) return;
  await searchClient.delete({ index: INDEX, id, refresh: "wait_for" }).catch((error: { meta?: { statusCode?: number } }) => {
    if (error.meta?.statusCode !== 404) throw error;
  });
}

export async function searchProductIds(query: string, filters: { category?: string; minPrice?: number; maxPrice?: number; sort?: string } = {}) {
  if (!searchClient) return null;
  const sort = filters.sort === "price_asc" ? [{ price: "asc" as const }] : filters.sort === "price_desc" ? [{ price: "desc" as const }] : filters.sort === "newest" ? [{ createdAt: "desc" as const }] : [{ _score: { order: "desc" as const } }, { createdAt: "desc" as const }];
  const priceRange = filters.minPrice !== undefined || filters.maxPrice !== undefined
    ? [{ range: { price: { ...(filters.minPrice !== undefined ? { gte: filters.minPrice } : {}), ...(filters.maxPrice !== undefined ? { lte: filters.maxPrice } : {}) } } }]
    : [];
  const result = await searchClient.search<{ id: string }>({
    index: INDEX,
    size: 100,
    query: {
      bool: {
        filter: [{ term: { active: true } }, ...(filters.category ? [{ term: { category: filters.category.toLowerCase() } }] : []), ...priceRange],
        must: query ? [{ multi_match: { query, fields: ["name^3", "description", "category"] } }] : [{ match_all: {} }],
      },
    },
    sort,
  });
  return result.hits.hits.flatMap((hit) => hit._source?.id ? [hit._source.id] : []);
}

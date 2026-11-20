import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { ArrowRight, Star } from "lucide-react";
import ProductCard from "../components/ProductCard.jsx";
import { getProducts } from "../services/api.js";
import { useCart } from "../context/CartContext.jsx";

const sorts = [["relevance", "Featured"], ["price_asc", "Price: low to high"], ["price_desc", "Price: high to low"], ["rating", "Avg. customer review"], ["newest", "Newest arrivals"]];
export default function Home() {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const [products, setProducts] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const { addToCart } = useCart();
  const isListing = location.pathname === "/products" || [...params.keys()].length > 0;
  const query = params.get("search") || ""; const category = params.get("category") || ""; const minPrice = params.get("minPrice") || ""; const maxPrice = params.get("maxPrice") || ""; const vendor = params.get("vendor") || ""; const sort = params.get("sort") || "relevance"; const rating = params.get("rating") || ""; const inStock = params.get("inStock") === "true";
  useEffect(() => { let active = true; setLoading(true); setError(""); getProducts(Object.fromEntries(params.entries())).then((items) => { if (active) setProducts(items); }).catch(() => { if (active) setError("We couldn't load products. Please try again."); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [params.toString()]);
  const categories = useMemo(() => [...new Set(products.map((p) => p.category).filter(Boolean))].sort(), [products]);
  const vendors = useMemo(() => [...new Set(products.map((p) => p.vendor).filter(Boolean))].sort(), [products]);
  const visible = products.filter((p) => (!rating || Number(p.rating) >= Number(rating)) && (!inStock || Number(p.stock) > 0) && (!vendor || p.vendor === vendor));
  const update = (key, value) => { const next = new URLSearchParams(params); value ? next.set(key, value) : next.delete(key); setParams(next); };
  const clear = () => setParams({});
  return <main className="storefront">
    {!isListing ? <>
      <section className="sale-banner"><div><small>Festive sale</small><h1>Up to 40% off from top vendors</h1><p>Use code SPHERE10 at checkout</p></div><Link to="/products?sort=price_asc">Shop now <ArrowRight size={17}/></Link></section>
      <div className="section-heading"><h2>Recommended for you</h2><Link to="/products">See all products <ArrowRight size={16}/></Link></div>
      {loading && <p className="store-message">Finding products for you…</p>}{error && <p className="store-message store-error">{error}</p>}
      {!loading && !error && <div className="product-grid">{products.slice(0, 12).map((p) => <ProductCard key={p._id} product={p} onAddToCart={addToCart}/>)}</div>}
      {!loading && !error && !products.length && <p className="store-message">No products are available yet.</p>}
    </> : <>
      <div className="listing-heading"><div><p>ShopSphere marketplace</p><h1>{query ? `Results for “${query}”` : category || "All products"}</h1><span>{loading ? "Searching…" : `${visible.length} products`}</span></div><label>Sort by <select value={sort} onChange={(e) => update("sort", e.target.value)}>{sorts.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
      <div className="listing-layout"><aside className="filter-sidebar"><div className="filter-title"><h2>Filters</h2><button onClick={clear}>Clear all</button></div>
        <fieldset><legend>Category</legend>{categories.map((item) => <label key={item}><input type="radio" name="category" checked={category.toLowerCase() === item.toLowerCase()} onChange={() => update("category", item)}/>{item}</label>)}{category && <button className="filter-clear" onClick={() => update("category", "")}>All categories</button>}</fieldset>
        <fieldset><legend>Price (₹)</legend><div className="price-fields"><input type="number" min="0" placeholder="Min" value={minPrice} onChange={(e) => update("minPrice", e.target.value)}/><input type="number" min="0" placeholder="Max" value={maxPrice} onChange={(e) => update("maxPrice", e.target.value)}/></div></fieldset>
        <fieldset><legend>Customer rating</legend>{[4, 3, 2].map((n) => <label key={n}><input type="radio" name="rating" checked={rating === String(n)} onChange={() => update("rating", String(n))}/><span className="rating-filter"><Star size={14} fill="currentColor"/> {n}+ stars</span></label>)}</fieldset>
        <fieldset><legend>Vendor</legend><select value={vendor} onChange={(e) => update("vendor", e.target.value)}><option value="">All vendors</option>{vendors.map((v) => <option key={v}>{v}</option>)}</select></fieldset>
        <fieldset className="stock-filter"><label><input type="checkbox" checked={inStock} onChange={(e) => update("inStock", e.target.checked ? "true" : "")}/> In stock only</label></fieldset>
      </aside><section className="listing-results" aria-live="polite">{error && <p className="store-message store-error">{error}</p>}{loading && <p className="store-message">Searching products…</p>}{!loading && !error && visible.length === 0 && <p className="store-message">No products match those filters. Try clearing a filter.</p>}<div className="product-grid">{visible.map((p) => <ProductCard key={p._id} product={p} onAddToCart={addToCart}/>)}</div></section></div>
    </>}
  </main>;
}

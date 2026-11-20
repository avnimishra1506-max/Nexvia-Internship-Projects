import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpRight,
  Boxes,
  Check,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  ImagePlus,
  LayoutDashboard,
  LoaderCircle,
  MessageSquareText,
  PackageCheck,
  Plus,
  Search,
  Settings2,
  Store,
  Star,
  Truck,
  X,
} from "lucide-react";
import "./VendorDashboard.css";

const API = `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api`;
const sections = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "products", label: "Products", icon: Boxes },
  { id: "orders", label: "Orders", icon: ClipboardList },
  { id: "earnings", label: "Earnings", icon: CircleDollarSign },
  { id: "reviews", label: "Reviews", icon: MessageSquareText },
  { id: "shop", label: "Shop profile", icon: Store },
];
const categories = ["fashion", "accessories", "home", "electronics", "sports", "toys", "groceries"];
const currency = (value) => `â‚¹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const niceStatus = (status = "") => status.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());

async function api(path, { method = "GET", body } = {}) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${sessionStorage.getItem("token") || ""}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.message || `Request failed (${response.status}).`);
  return data;
}

function MetricCard({ icon: Icon, label, value, detail, tone = "violet" }) {
  return (
    <article className="vendor-metric rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className={`vendor-metric-icon ${tone}`}><Icon size={19} /></div>
      <p className="mt-4 text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
      {detail && <p className="mt-1 text-xs text-slate-400">{detail}</p>}
    </article>
  );
}

function StatusBadge({ status }) {
  return <span className={`vendor-status-badge ${String(status).toLowerCase()}`}>{niceStatus(status)}</span>;
}

function EmptyState({ title, detail, icon: Icon = PackageCheck }) {
  return <div className="vendor-empty rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
    <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-violet-50 text-violet-600"><Icon size={22} /></span>
    <h3 className="mt-4 font-semibold text-slate-800">{title}</h3>
    <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">{detail}</p>
  </div>;
}

export default function VendorDashboard() {
  const user = (() => { try { return JSON.parse(sessionStorage.getItem("user") || "null"); } catch { return null; } })();
  const [section, setSection] = useState("overview");
  const [dashboard, setDashboard] = useState(null);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [earnings, setEarnings] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [profile, setProfile] = useState({ vendorName: "", description: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState("");
  const [productQuery, setProductQuery] = useState("");
  const [productEditor, setProductEditor] = useState(null);
  const [productFiles, setProductFiles] = useState([]);
  const [savingProduct, setSavingProduct] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  const loadData = useCallback(async () => {
    setError("");
    try {
      const [dashboardData, productData, orderData, earningsData, reviewData, profileData] = await Promise.all([
        api("/vendors/dashboard"),
        api("/products/mine"),
        api("/orders/vendor"),
        api("/vendors/earnings"),
        api("/vendors/reviews"),
        api("/vendors/me"),
      ]);
      setDashboard(dashboardData);
      setProducts(Array.isArray(productData) ? productData : []);
      setOrders(Array.isArray(orderData) ? orderData : []);
      setEarnings(earningsData);
      setReviews(Array.isArray(reviewData) ? reviewData : []);
      setProfile({ vendorName: profileData.application?.vendorName || "", description: profileData.application?.vendorDescription || "" });
    } catch (loadError) {
      setError(loadError.message || "Could not load your vendor workspace.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filteredProducts = useMemo(() => {
    const query = productQuery.trim().toLowerCase();
    if (!query) return products;
    return products.filter((product) => `${product.name} ${product.category}`.toLowerCase().includes(query));
  }, [productQuery, products]);

  async function advanceOrder(order) {
    const next = order.status === "PLACED" ? "PACKED" : order.status === "PACKED" ? "SHIPPED" : null;
    if (!next) return;
    setBusyId(order.id);
    setNotice("");
    try {
      await api(`/suborders/${order.id}/status`, { method: "PATCH", body: { status: next } });
      setNotice(`Order marked ${next.toLowerCase()}.`);
      await loadData();
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      setBusyId("");
    }
  }

  function openProductEditor(product = null) {
    setProductFiles([]);
    setProductEditor(product ? {
      id: product.id,
      name: product.name || "",
      description: product.description || "",
      category: product.category || "fashion",
      price: String(product.price ?? ""),
      stock: String(product.stock ?? 0),
      active: product.active !== false,
      galleryKeys: Array.isArray(product.galleryKeys) ? product.galleryKeys : [],
      imageKey: product.imageKey || "",
    } : { name: "", description: "", category: "fashion", price: "", stock: "10", active: true, galleryKeys: [], imageKey: "" });
  }

  async function uploadProductImages(files) {
    const uploadedKeys = [];
    for (const file of files) {
      if (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) throw new Error("Choose image files smaller than 10 MB each.");
      const signed = await api("/products/upload-url", { method: "POST", body: { contentType: file.type } });
      const response = await fetch(signed.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      if (!response.ok) throw new Error("An image could not be uploaded. Check the S3 bucket upload settings and try again.");
      uploadedKeys.push(signed.imageKey);
    }
    return uploadedKeys;
  }

  async function saveProduct(event) {
    event.preventDefault();
    if (!productEditor) return;
    setSavingProduct(true);
    setError("");
    setNotice("");
    try {
      if (productFiles.length > 5) throw new Error("Choose up to five images.");
      const galleryKeys = productFiles.length ? await uploadProductImages(productFiles) : productEditor.galleryKeys;
      if (!productEditor.id && !galleryKeys.length && !productEditor.imageKey) throw new Error("Add at least one product image.");
      const body = {
        name: productEditor.name.trim(),
        description: productEditor.description.trim(),
        category: productEditor.category,
        price: Number(productEditor.price),
        stock: Number(productEditor.stock),
        active: Boolean(productEditor.active),
        galleryKeys,
        imageKey: galleryKeys[0] || productEditor.imageKey || "",
      };
      await api(productEditor.id ? `/products/${productEditor.id}` : "/products", { method: productEditor.id ? "PATCH" : "POST", body });
      setProductEditor(null);
      setProductFiles([]);
      setNotice(productEditor.id ? "Product updated." : "Product added to your shop.");
      await loadData();
    } catch (saveError) {
      setError(saveError.message || "Could not save this product.");
    } finally {
      setSavingProduct(false);
    }
  }

  async function toggleProduct(product) {
    setBusyId(product.id);
    setError("");
    try {
      await api(`/products/${product.id}`, { method: "PATCH", body: { active: !product.active } });
      setNotice(product.active ? "Product paused." : "Product is live again.");
      await loadData();
    } catch (toggleError) {
      setError(toggleError.message);
    } finally {
      setBusyId("");
    }
  }

  async function saveProfile(event) {
    event.preventDefault();
    setSavingProfile(true);
    setError("");
    setNotice("");
    try {
      const result = await api("/vendors/me", { method: "PATCH", body: profile });
      setProfile({ vendorName: result.profile.vendorName || "", description: result.profile.vendorDescription || "" });
      setNotice("Shop profile saved.");
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSavingProfile(false);
    }
  }

  function renderOverview() {
    const stats = dashboard?.stats || {};
    const fulfillment = dashboard?.ordersToFulfill || [];
    const lowStock = dashboard?.lowStockProducts || [];
    return <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={CircleDollarSign} label="Sales this month" value={currency(stats.salesThisMonth)} detail="Paid vendor sales" />
        <MetricCard icon={Truck} label="Orders to ship" value={stats.ordersToShip || 0} detail="Paid orders needing fulfilment" tone="amber" />
        <MetricCard icon={ArrowUpRight} label="Earnings after commission" value={currency(stats.earningsAfterCommission)} detail="Your vendor payout share" tone="green" />
        <MetricCard icon={Star} label="Average rating" value={Number(stats.averageRating || 0).toFixed(1)} detail={`${stats.reviewCount || 0} customer reviews`} tone="blue" />
      </div>
      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(260px,0.8fr)]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-base font-bold text-slate-900">Orders to fulfil</h2><p className="mt-1 text-sm text-slate-500">Move each paid vendor order to its next step.</p></div><button className="vendor-text-link" onClick={() => setSection("orders")}>All orders <ChevronRight size={15} /></button></div>
          {fulfillment.length ? <div className="overflow-x-auto"><table className="vendor-table min-w-[650px]"><thead><tr><th>Order</th><th>Ship to</th><th>Items</th><th>Status</th><th></th></tr></thead><tbody>{fulfillment.map((order) => <tr key={order.id}><td className="font-semibold">#{order.orderId.slice(-8).toUpperCase()}</td><td>{order.order?.shippingAddress?.fullName || "Customer"}</td><td>{order.items?.reduce((count, item) => count + item.quantity, 0) || 0}</td><td><StatusBadge status={order.status} /></td><td><button className="vendor-small-primary" disabled={busyId === order.id} onClick={() => advanceOrder(order)}>{busyId === order.id ? <LoaderCircle className="animate-spin" size={15} /> : order.status === "PLACED" ? "Mark packed" : "Mark shipped"}</button></td></tr>)}</tbody></table></div> : <EmptyState title="Nothing to ship" detail="New paid orders will appear here when customers check out." />}
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between"><div><h2 className="text-base font-bold text-slate-900">Low stock</h2><p className="mt-1 text-sm text-slate-500">Active products with 5 or fewer left.</p></div><button className="vendor-text-link" onClick={() => setSection("products")}>Manage <ChevronRight size={15} /></button></div>
          {lowStock.length ? <ul className="divide-y divide-slate-100">{lowStock.map((product) => <li key={product.id} className="flex items-center gap-3 py-3"><img className="vendor-thumb" src={product.imageUrl || ""} alt="" /><span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700">{product.name}</span><span className={`text-sm font-bold ${product.stock === 0 ? "text-rose-600" : "text-amber-600"}`}>{product.stock} left</span></li>)}</ul> : <EmptyState title="Stock looks healthy" detail="Products with low inventory will appear here." icon={Boxes} />}
        </section>
      </div>
    </>;
  }

  function renderProducts() {
    return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold text-slate-900">Your products</h2><p className="mt-1 text-sm text-slate-500">Manage product details, images, price and stock.</p></div><button className="vendor-primary" onClick={() => openProductEditor()}><Plus size={16} /> Add product</button></div>
      <label className="vendor-search mb-4"><Search size={17} /><input value={productQuery} onChange={(event) => setProductQuery(event.target.value)} placeholder="Search products or categories" /></label>
      {filteredProducts.length ? <div className="overflow-x-auto"><table className="vendor-table min-w-[760px]"><thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th><th>Actions</th></tr></thead><tbody>{filteredProducts.map((product) => <tr key={product.id}><td><div className="flex items-center gap-3"><img className="vendor-thumb" src={product.imageUrl || ""} alt="" /><div><p className="font-semibold text-slate-800">{product.name}</p><p className="text-xs text-slate-400">{Array.isArray(product.galleryImages) ? product.galleryImages.length : 0} photos</p></div></div></td><td className="capitalize">{product.category}</td><td className="font-semibold">{currency(product.price)}</td><td><span className={product.stock <= 5 ? "text-amber-600 font-bold" : ""}>{product.stock}</span></td><td><span className={`vendor-live-dot ${product.active ? "is-live" : "is-paused"}`}>{product.active ? "Live" : "Paused"}</span></td><td><div className="flex gap-2"><button className="vendor-table-action" onClick={() => openProductEditor(product)}>Edit</button><button className="vendor-table-action" disabled={busyId === product.id} onClick={() => toggleProduct(product)}>{product.active ? "Pause" : "Activate"}</button></div></td></tr>)}</tbody></table></div> : <EmptyState title={productQuery ? "No matching products" : "Your product list is empty"} detail={productQuery ? "Try a different search." : "Add your first product to start selling."} icon={Boxes} />}
    </section>;
  }

  function renderOrders() {
    return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-5"><h2 className="text-lg font-bold text-slate-900">Vendor orders</h2><p className="mt-1 text-sm text-slate-500">Only the products and fulfilment details for your shop are shown.</p></div>{orders.length ? <div className="space-y-3">{orders.map((order) => <article className="vendor-order-card" key={order.id}><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-bold text-slate-800">Order #{order.orderId.slice(-8).toUpperCase()}</p><p className="mt-1 text-xs text-slate-500">Placed {new Date(order.createdAt).toLocaleDateString("en-IN")}</p></div><StatusBadge status={order.status} /></div><div className="my-4 grid gap-3 border-y border-slate-100 py-4 sm:grid-cols-2"><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Ship to</p><p className="mt-1 text-sm font-semibold text-slate-700">{order.order?.shippingAddress?.fullName}</p><p className="text-sm text-slate-500">{order.order?.shippingAddress?.street}, {order.order?.shippingAddress?.city}</p><p className="text-sm text-slate-500">{order.order?.shippingAddress?.phone}</p></div><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Your items</p><ul className="mt-1 space-y-1">{order.items.map((item) => <li className="text-sm text-slate-700" key={item.id}>{item.productName} <span className="text-slate-400">Ã— {item.quantity}</span></li>)}</ul></div></div><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-500">Your subtotal <strong className="ml-1 text-slate-800">{currency(order.subtotal)}</strong></p>{order.order?.paymentStatus === "PAID" && (order.status === "PLACED" || order.status === "PACKED") && <button className="vendor-small-primary" disabled={busyId === order.id} onClick={() => advanceOrder(order)}>{busyId === order.id && <LoaderCircle className="animate-spin" size={15} />}{order.status === "PLACED" ? "Mark packed" : "Mark shipped"}</button>}</div></article>)}</div> : <EmptyState title="No orders yet" detail="Paid orders containing your products will appear here." />}</section>;
  }

  function renderEarnings() {
    return <>
      <div className="grid gap-4 md:grid-cols-3"><MetricCard icon={CircleDollarSign} label="Gross sales" value={currency(earnings?.grossSales)} detail="Paid product subtotal" /><MetricCard icon={ArrowDownToLine} label="Platform commission" value={currency(earnings?.commission)} detail="Commission on completed sales" tone="amber" /><MetricCard icon={ArrowUpRight} label="Net earnings" value={currency(earnings?.netEarnings)} detail="After commission" tone="green" /></div>
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-bold text-slate-900">Payout history</h2><p className="mt-1 text-sm text-slate-500">Payment and simulation records for your vendor orders.</p>{earnings?.payouts?.length ? <div className="mt-4 overflow-x-auto"><table className="vendor-table min-w-[650px]"><thead><tr><th>Order</th><th>Gross</th><th>Commission</th><th>Net payout</th><th>Status</th><th>Date</th></tr></thead><tbody>{earnings.payouts.map((payout) => <tr key={payout.id}><td className="font-semibold">#{payout.subOrder.orderId.slice(-8).toUpperCase()}</td><td>{currency(payout.grossAmount)}</td><td>{currency(payout.commissionAmount)}</td><td className="font-semibold">{currency(payout.amount)}</td><td><StatusBadge status={payout.status} /></td><td>{new Date(payout.createdAt).toLocaleDateString("en-IN")}</td></tr>)}</tbody></table></div> : <div className="mt-4"><EmptyState title="No payout records yet" detail="Payout records appear after a paid order is confirmed." icon={CircleDollarSign} /></div>}</section>
    </>;
  }

  function renderReviews() {
    return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-5"><h2 className="text-lg font-bold text-slate-900">Customer reviews</h2><p className="mt-1 text-sm text-slate-500">Feedback on products in your shop.</p></div>{reviews.length ? <div className="space-y-3">{reviews.map((review) => <article className="vendor-review-card" key={review.id}><img className="vendor-thumb" src={review.product.imageUrl || ""} alt="" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold text-slate-800">{review.product.name}</h3><span className="inline-flex items-center gap-1 text-sm font-bold text-amber-600"><Star size={15} fill="currentColor" /> {review.rating}/5</span></div><p className="mt-1 text-xs text-slate-500">{review.user.name} Â· {new Date(review.createdAt).toLocaleDateString("en-IN")}{review.verified && <span className="ml-2 text-emerald-700">Verified purchase</span>}</p>{review.title && <p className="mt-2 text-sm font-semibold text-slate-700">{review.title}</p>}{review.comment && <p className="mt-1 text-sm leading-6 text-slate-600">{review.comment}</p>}</div></article>)}</div> : <EmptyState title="No reviews yet" detail="Customer reviews for your products will appear here." icon={Star} />}</section>;
  }

  function renderShopProfile() {
    return <form onSubmit={saveProfile} className="max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-5"><h2 className="text-lg font-bold text-slate-900">Shop profile</h2><p className="mt-1 text-sm text-slate-500">This name and description are shown to customers.</p></div><label className="vendor-field"><span>Shop name</span><input maxLength={100} required minLength={2} value={profile.vendorName} onChange={(event) => setProfile({ ...profile, vendorName: event.target.value })} /></label><label className="vendor-field mt-4"><span>Shop description</span><textarea rows={6} minLength={20} maxLength={2000} required value={profile.description} onChange={(event) => setProfile({ ...profile, description: event.target.value })} /><small>{profile.description.length}/2,000 characters (at least 20)</small></label><button className="vendor-primary mt-5" disabled={savingProfile}>{savingProfile ? <LoaderCircle className="animate-spin" size={16} /> : <Check size={16} />} Save profile</button></form>;
  }

  const activeSection = sections.find((entry) => entry.id === section) || sections[0];
  return <main className="vendor-portal min-h-[70vh] bg-slate-50 px-3 py-5 text-slate-800 sm:px-5 lg:px-8">
    <div className="mx-auto max-w-[1440px]">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-slate-900 px-5 py-5 text-white shadow-sm sm:px-7"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-300">Vendor workspace</p><h1 className="mt-1 text-2xl font-bold">{profile.vendorName || "Your shop"}</h1><p className="mt-1 text-sm text-slate-300">Welcome back, {user?.name || "vendor"}.</p></div><div className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm"><span className="vendor-account-dot" /> Approved vendor</div></header>
      <div className="grid items-start gap-5 lg:grid-cols-[230px_minmax(0,1fr)]">
        <aside className="vendor-sidebar rounded-2xl border border-slate-200 bg-white p-2 shadow-sm"><nav aria-label="Vendor dashboard" className="flex gap-1 overflow-x-auto lg:block">{sections.map(({ id, label, icon: Icon }) => <button key={id} className={`vendor-nav-item ${section === id ? "active" : ""}`} onClick={() => { setSection(id); setNotice(""); }}><Icon size={17} /><span>{label}</span>{section === id && <ChevronRight className="ml-auto hidden lg:block" size={15} />}</button>)}</nav><div className="mt-3 hidden rounded-xl bg-violet-50 p-3 text-xs leading-5 text-violet-800 lg:block"><strong className="block">Need a hand?</strong> Contact support for help with listings, delivery or payouts.</div></aside>
        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-violet-600">Shop management</p><h2 className="mt-1 text-2xl font-bold text-slate-900">{activeSection.label}</h2></div><span className="text-sm text-slate-500">{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</span></div>
          {error && <div className="vendor-alert" role="alert"><span>{error}</span><button onClick={() => setError("")} aria-label="Dismiss error"><X size={16} /></button></div>}
          {notice && <div className="vendor-notice" role="status"><Check size={16} /> {notice}<button onClick={() => setNotice("")} aria-label="Dismiss message"><X size={16} /></button></div>}
          {loading ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((item) => <div key={item} className="h-36 animate-pulse rounded-2xl border border-slate-200 bg-white" />)}</div>
            : section === "overview" ? renderOverview()
              : section === "products" ? renderProducts()
                : section === "orders" ? renderOrders()
                  : section === "earnings" ? renderEarnings()
                    : section === "reviews" ? renderReviews()
                      : renderShopProfile()}
        </div>
      </div>
    </div>
    {productEditor && <div className="vendor-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setProductEditor(null); }}><section className="vendor-product-modal" role="dialog" aria-modal="true" aria-labelledby="vendor-product-title"><div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4"><div><h2 id="vendor-product-title" className="text-lg font-bold text-slate-900">{productEditor.id ? "Edit product" : "Add product"}</h2><p className="mt-1 text-sm text-slate-500">Product images are stored in your configured S3 bucket.</p></div><button className="vendor-icon-button" aria-label="Close product form" onClick={() => setProductEditor(null)}><X size={19} /></button></div><form onSubmit={saveProduct} className="space-y-4 p-5"><div className="grid gap-4 sm:grid-cols-2"><label className="vendor-field sm:col-span-2"><span>Product name</span><input required minLength={2} maxLength={180} value={productEditor.name} onChange={(event) => setProductEditor({ ...productEditor, name: event.target.value })} /></label><label className="vendor-field sm:col-span-2"><span>Description</span><textarea rows={3} maxLength={4000} value={productEditor.description} onChange={(event) => setProductEditor({ ...productEditor, description: event.target.value })} /></label><label className="vendor-field"><span>Category</span><select value={productEditor.category} onChange={(event) => setProductEditor({ ...productEditor, category: event.target.value })}>{categories.map((category) => <option key={category} value={category}>{category[0].toUpperCase() + category.slice(1)}</option>)}</select></label><label className="vendor-field"><span>Price (INR)</span><input required type="number" min="0.01" step="0.01" value={productEditor.price} onChange={(event) => setProductEditor({ ...productEditor, price: event.target.value })} /></label><label className="vendor-field"><span>Stock</span><input required type="number" min="0" step="1" value={productEditor.stock} onChange={(event) => setProductEditor({ ...productEditor, stock: event.target.value })} /></label><label className="vendor-field"><span>Listing status</span><select value={String(productEditor.active)} onChange={(event) => setProductEditor({ ...productEditor, active: event.target.value === "true" })}><option value="true">Live</option><option value="false">Paused</option></select></label></div><label className="vendor-upload-field"><ImagePlus size={19} /><span><strong>Product photos</strong><small>{productEditor.galleryKeys.length ? `${productEditor.galleryKeys.length} current photo(s). ` : ""}Choose up to five images, 10 MB each. Selecting new photos replaces the gallery.</small></span><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => setProductFiles(Array.from(event.target.files || []))} /></label>{productFiles.length > 0 && <p className="text-sm text-violet-700">{productFiles.length} image(s) selected</p>}<div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" className="vendor-secondary" onClick={() => setProductEditor(null)}>Cancel</button><button className="vendor-primary" disabled={savingProduct}>{savingProduct ? <LoaderCircle className="animate-spin" size={16} /> : <Check size={16} />}{savingProduct ? "Savingâ€¦" : "Save product"}</button></div></form></section></div>}
  </main>;
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, BadgePercent, BarChart3, Check, ChevronRight, CircleDollarSign, ClipboardList, LoaderCircle, Search, Store, TicketPercent, Users, X } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import "./AdminDashboard.css";

const API = `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api`;
const sections = [
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "vendors", label: "Vendors", icon: Store },
  { id: "users", label: "Users", icon: Users },
  { id: "orders", label: "Orders", icon: ClipboardList },
  { id: "coupons", label: "Coupons", icon: TicketPercent },
  { id: "commission", label: "Commission", icon: BadgePercent },
];
const COLORS = ["#7c3aed", "#2563eb", "#10b981", "#f59e0b", "#ec4899", "#64748b"];
const money = (amount) => `â‚¹${Number(amount || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const title = (value = "") => value.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
const dateInput = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

async function api(path, { method = "GET", body } = {}) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${sessionStorage.getItem("token") || ""}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.message || `Request failed (${response.status}).`);
  return data;
}

function Metric({ icon: Icon, label, value, detail, color = "violet" }) {
  return <article className="admin-metric rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><span className={`admin-metric-icon ${color}`}><Icon size={19} /></span><p className="mt-4 text-sm font-medium text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>{detail && <p className="mt-1 text-xs text-slate-400">{detail}</p>}</article>;
}
function Badge({ value }) { return <span className={`admin-badge ${String(value || "").toLowerCase()}`}>{title(value)}</span>; }
function Empty({ children }) { return <div className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center text-sm text-slate-500">{children}</div>; }
function Panel({ children, className = "" }) { return <section className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>{children}</section>; }

const blankCoupon = { code: "", type: "PERCENT", value: "", minimumAmount: "0", maximumDiscount: "", usageLimit: "", expiresAt: "" };

export default function AdminDashboard() {
  const [section, setSection] = useState("analytics");
  const [overview, setOverview] = useState(null);
  const [revenue, setRevenue] = useState([]);
  const [products, setProducts] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [users, setUsers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [commission, setCommission] = useState(10);
  const [dateRange, setDateRange] = useState(() => { const end = new Date(); const start = new Date(); start.setDate(start.getDate() - 29); return { start: dateInput(start), end: dateInput(end) }; });
  const [orderStatus, setOrderStatus] = useState("");
  const [userQuery, setUserQuery] = useState("");
  const [pendingCounts, setPendingCounts] = useState(0);
  const [couponEditor, setCouponEditor] = useState(null);
  const [accountIds, setAccountIds] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadAll = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [overviewData, revenueData, productData, vendorData, userData, orderData, couponData, commissionData] = await Promise.all([
        api("/analytics/overview"), api(`/analytics/revenue?start=${dateRange.start}&end=${dateRange.end}`), api("/analytics/top-products"), api("/vendors"), api("/analytics/users"), api(`/orders${orderStatus ? `?status=${orderStatus}` : ""}`), api("/coupons/admin"), api("/analytics/commission"),
      ]);
      setOverview(overviewData); setRevenue(revenueData); setProducts(productData); setVendors(vendorData); setUsers(userData); setOrders(orderData); setCoupons(couponData); setCommission(commissionData.percentage);
      setPendingCounts(vendorData.filter((vendor) => vendor.vendorStatus === "PENDING").length);
    } catch (loadError) { setError(loadError.message || "Could not load admin data."); }
    finally { setLoading(false); }
  }, [dateRange, orderStatus]);
  useEffect(() => { loadAll(); }, [loadAll]);

  const filteredUsers = useMemo(() => {
    const q = userQuery.trim().toLowerCase();
    return q ? users.filter((user) => `${user.name} ${user.email} ${user.role}`.toLowerCase().includes(q)) : users;
  }, [users, userQuery]);
  const statusData = useMemo(() => (overview?.orderStatuses || []).map((row) => ({ ...row, status: title(row.status) })), [overview]);
  const vendorRows = useMemo(() => (overview?.topVendors || []).map((vendor) => ({ ...vendor, name: vendor.vendorName || "Unnamed shop" })), [overview]);

  async function perform(action, success) {
    setSaving(true); setError(""); setNotice("");
    try { await action(); setNotice(success); await loadAll(); return true; }
    catch (actionError) { setError(actionError.message || "That change could not be saved."); return false; }
    finally { setSaving(false); }
  }
  async function decideVendor(vendor, approved) {
    const razorpayAccountId = accountIds[vendor.id] || "";
    await perform(() => api(`/vendors/${vendor.id}/decision`, { method: "PATCH", body: { approved, razorpayAccountId } }), approved ? `${vendor.vendorName} approved.` : `${vendor.vendorName} rejected.`);
  }
  async function advanceSuborder(suborder) {
    const next = { PLACED: "PACKED", PACKED: "SHIPPED", SHIPPED: "DELIVERED" }[suborder.status];
    if (!next) return;
    await perform(() => api(`/suborders/${suborder.id}/status`, { method: "PATCH", body: { status: next } }), `Vendor order marked ${next.toLowerCase()}.`);
  }
  async function saveCoupon(event) {
    event.preventDefault();
    const editor = couponEditor;
    const body = { ...editor, value: Number(editor.value), minimumAmount: Number(editor.minimumAmount), maximumDiscount: editor.maximumDiscount || null, usageLimit: editor.usageLimit || null, expiresAt: editor.expiresAt || null };
    const saved = await perform(() => api(editor.id ? `/coupons/${editor.id}` : "/coupons", { method: editor.id ? "PATCH" : "POST", body }), editor.id ? "Coupon updated." : "Coupon created.");
    if (saved) setCouponEditor(null);
  }
  async function toggleCoupon(coupon) {
    await perform(() => api(`/coupons/${coupon.id}`, { method: "PATCH", body: { active: !coupon.active } }), coupon.active ? "Coupon disabled." : "Coupon enabled.");
  }
  async function saveCommission(event) {
    event.preventDefault();
    await perform(() => api("/analytics/commission", { method: "PUT", body: { percentage: Number(commission) } }), "Commission rate saved.");
  }

  function renderAnalytics() {
    return <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><p className="max-w-xl text-sm text-slate-500">Paid sales and order activity across all vendors.</p><div className="flex items-end gap-2"><label className="admin-date-field">From<input type="date" value={dateRange.start} max={dateRange.end} onChange={(event) => { if (event.target.value) setDateRange({ ...dateRange, start: event.target.value }); }} /></label><label className="admin-date-field">To<input type="date" value={dateRange.end} min={dateRange.start} onChange={(event) => { if (event.target.value) setDateRange({ ...dateRange, end: event.target.value }); }} /></label></div></div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric icon={CircleDollarSign} label="Total sales" value={money(overview?.totalSales)} detail="Captured customer payments" /><Metric icon={ClipboardList} label="Orders" value={overview?.orders || 0} detail={`${overview?.customers || 0} customers`} color="blue" /><Metric icon={BadgePercent} label="Commission earned" value={money(overview?.commissions)} detail="Platform share from paid sales" color="green" /><Metric icon={Store} label="Active vendors" value={overview?.activeVendors || 0} detail={`${pendingCounts} applications pending`} color="amber" /></div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[1.5fr_1fr]"><Panel><h3 className="font-bold text-slate-900">Revenue over time</h3><p className="mt-1 text-sm text-slate-500">Daily paid sales for selected period</p><div className="mt-4 h-72"><ResponsiveContainer width="100%" height="100%"><LineChart data={revenue}><CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" /><XAxis dataKey="date" tickFormatter={(date) => new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip formatter={(value) => money(value)} labelFormatter={(date) => new Date(`${date}T00:00:00`).toLocaleDateString("en-IN")} /><Line type="monotone" dataKey="revenue" name="Sales" stroke="#7c3aed" strokeWidth={3} dot={false} /></LineChart></ResponsiveContainer></div></Panel>
        <Panel><h3 className="font-bold text-slate-900">Orders by status</h3><p className="mt-1 text-sm text-slate-500">Current order lifecycle</p><div className="mt-4 h-72"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={statusData} dataKey="count" nameKey="status" innerRadius={58} outerRadius={95} paddingAngle={3}>{statusData.map((entry, index) => <Cell key={entry.status} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div><div className="flex flex-wrap justify-center gap-x-4 gap-y-2">{statusData.map((entry, index) => <span key={entry.status} className="inline-flex items-center gap-1.5 text-xs text-slate-500"><i className="h-2 w-2 rounded-full" style={{ background: COLORS[index % COLORS.length] }} />{entry.status}: {entry.count}</span>)}</div></Panel></div>
      <div className="mt-5 grid gap-5 xl:grid-cols-2"><Panel><h3 className="font-bold text-slate-900">Top products</h3><p className="mt-1 text-sm text-slate-500">By units sold across paid orders</p>{products.length ? <div className="mt-4 h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={products} layout="vertical" margin={{ left: 15, right: 15 }}><CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" horizontal={false} /><XAxis type="number" tick={{ fontSize: 11 }} /><YAxis type="category" dataKey="name" width={125} tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="unitsSold" name="Units sold" fill="#2563eb" radius={[0, 5, 5, 0]} /></BarChart></ResponsiveContainer></div> : <Empty>No sales data for products yet.</Empty>}</Panel>
        <Panel><h3 className="font-bold text-slate-900">Top vendors</h3><p className="mt-1 text-sm text-slate-500">By paid vendor sales</p>{vendorRows.length ? <div className="mt-4 space-y-3">{vendorRows.map((vendor, index) => <div key={vendor.vendorId} className="flex items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-lg bg-violet-50 text-xs font-bold text-violet-700">{index + 1}</span><span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-700">{vendor.name}</span><span className="text-right text-sm font-bold text-slate-800">{money(vendor.sales)}<small className="block font-normal text-slate-400">{vendor.orderCount} suborders</small></span></div>)}</div> : <Empty>No vendor sales data yet.</Empty>}</Panel></div>
      <Panel className="mt-5"><h3 className="font-bold text-slate-900">Recent orders</h3><div className="mt-3 overflow-x-auto"><table className="admin-table min-w-[680px]"><thead><tr><th>Order</th><th>Customer</th><th>Placed</th><th>Status</th><th>Payment</th><th>Total</th></tr></thead><tbody>{(overview?.recentOrders || []).map((order) => <tr key={order.id}><td>#{order.id.slice(-8).toUpperCase()}</td><td>{order.user?.name || order.user?.email}</td><td>{new Date(order.createdAt).toLocaleDateString("en-IN")}</td><td><Badge value={order.status} /></td><td><Badge value={order.paymentStatus} /></td><td>{money(order.totalAmount)}</td></tr>)}</tbody></table></div></Panel>
    </>;
  }

  function renderVendors() {
    const pending = vendors.filter((vendor) => vendor.vendorStatus === "PENDING");
    return <div className="space-y-5"><Panel><h3 className="font-bold text-slate-900">Pending applications <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">{pending.length}</span></h3>{pending.length ? <div className="mt-4 space-y-3">{pending.map((vendor) => <article className="admin-vendor-row" key={vendor.id}><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h4 className="font-bold text-slate-800">{vendor.vendorName}</h4><Badge value={vendor.vendorStatus} /></div><p className="mt-1 text-sm text-slate-500">{vendor.name} Â· {vendor.email}</p><p className="mt-2 text-sm text-slate-600">{vendor.vendorDescription}</p><p className="mt-1 text-xs text-slate-400">Applied {new Date(vendor.createdAt).toLocaleDateString("en-IN")}</p>{<input className="admin-account-input mt-3" placeholder="Razorpay linked account ID (needed in Razorpay mode)" value={accountIds[vendor.id] || ""} onChange={(event) => setAccountIds({ ...accountIds, [vendor.id]: event.target.value })} />}</div><div className="flex gap-2"><button className="admin-approve" disabled={saving} onClick={() => decideVendor(vendor, true)}><Check size={15} /> Approve</button><button className="admin-reject" disabled={saving} onClick={() => decideVendor(vendor, false)}>Reject</button></div></article>)}</div> : <Empty>No vendor applications are waiting.</Empty>}</Panel>
      <Panel><h3 className="font-bold text-slate-900">All vendor accounts</h3><div className="mt-3 overflow-x-auto"><table className="admin-table min-w-[720px]"><thead><tr><th>Shop</th><th>Owner</th><th>Status</th><th>Products</th><th>Suborders</th><th>Joined</th></tr></thead><tbody>{vendors.map((vendor) => <tr key={vendor.id}><td className="font-semibold">{vendor.vendorName || "Unnamed shop"}</td><td>{vendor.name}<small className="block text-slate-400">{vendor.email}</small></td><td><Badge value={vendor.vendorStatus} /></td><td>{vendor._count.products}</td><td>{vendor._count.subOrders}</td><td>{new Date(vendor.createdAt).toLocaleDateString("en-IN")}</td></tr>)}</tbody></table></div></Panel></div>;
  }

  function renderUsers() {
    return <Panel><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold text-slate-900">User accounts</h3><p className="mt-1 text-sm text-slate-500">Customers, vendors and administrators</p></div><label className="admin-search"><Search size={16} /><input value={userQuery} onChange={(event) => setUserQuery(event.target.value)} placeholder="Search name, email or role" /></label></div>{filteredUsers.length ? <div className="overflow-x-auto"><table className="admin-table min-w-[680px]"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Vendor status</th><th>Joined</th></tr></thead><tbody>{filteredUsers.map((user) => <tr key={user.id}><td className="font-semibold">{user.name}</td><td>{user.email}</td><td><Badge value={user.role} /></td><td>{user.vendorStatus ? <Badge value={user.vendorStatus} /> : "â€”"}</td><td>{new Date(user.createdAt).toLocaleDateString("en-IN")}</td></tr>)}</tbody></table></div> : <Empty>No users match this search.</Empty>}</Panel>;
  }

  function renderOrders() {
    return <Panel><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold text-slate-900">All orders</h3><p className="mt-1 text-sm text-slate-500">Manage fulfillment per vendor suborder.</p></div><select className="admin-select" value={orderStatus} onChange={(event) => setOrderStatus(event.target.value)}><option value="">All statuses</option>{["PLACED", "PACKED", "SHIPPED", "DELIVERED", "CANCELLED"].map((status) => <option key={status} value={status}>{title(status)}</option>)}</select></div>{orders.length ? <div className="space-y-3">{orders.map((order) => <article className="admin-order-card" key={order.id}><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3"><div><h4 className="font-bold text-slate-800">Order #{order.id.slice(-8).toUpperCase()}</h4><p className="mt-1 text-xs text-slate-500">{order.user?.name || order.user?.email} Â· {new Date(order.createdAt).toLocaleDateString("en-IN")} Â· {money(order.totalAmount)}</p></div><div className="flex items-center gap-2"><Badge value={order.status} /><Badge value={order.paymentStatus} /></div></div><div className="divide-y divide-slate-100">{order.subOrders.map((suborder) => <div key={suborder.id} className="flex flex-wrap items-center gap-3 py-3"><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-slate-700">{suborder.vendor?.vendorName || "Vendor"}</p><p className="mt-1 text-xs text-slate-500">{suborder.items.map((item) => `${item.productName} Ã— ${item.quantity}`).join(", ")} Â· {money(suborder.subtotal)}</p></div><Badge value={suborder.status} />{order.paymentStatus === "PAID" && suborder.status !== "DELIVERED" && <button className="admin-advance" disabled={saving} onClick={() => advanceSuborder(suborder)}>Mark {{ PLACED: "packed", PACKED: "shipped", SHIPPED: "delivered" }[suborder.status]} <ChevronRight size={14} /></button>}</div>)}</div></article>)}</div> : <Empty>No orders found for this status.</Empty>}</Panel>;
  }

  function renderCoupons() {
    return <Panel><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold text-slate-900">Coupons</h3><p className="mt-1 text-sm text-slate-500">Create discounts and manage availability.</p></div><button className="admin-primary" onClick={() => setCouponEditor({ ...blankCoupon })}>Create coupon</button></div>{coupons.length ? <div className="overflow-x-auto"><table className="admin-table min-w-[850px]"><thead><tr><th>Code</th><th>Discount</th><th>Minimum</th><th>Usage</th><th>Expires</th><th>Status</th><th>Actions</th></tr></thead><tbody>{coupons.map((coupon) => <tr key={coupon.id}><td className="font-bold">{coupon.code}</td><td>{coupon.type === "PERCENT" ? `${coupon.value}%` : money(coupon.value)}</td><td>{money(coupon.minimumAmount)}</td><td>{coupon.usedCount}{coupon.usageLimit ? ` / ${coupon.usageLimit}` : ""}</td><td>{coupon.expiresAt ? new Date(coupon.expiresAt).toLocaleDateString("en-IN") : "No expiry"}</td><td><Badge value={coupon.active ? "Active" : "Disabled"} /></td><td><div className="flex gap-2"><button className="admin-table-action" onClick={() => setCouponEditor({ ...coupon, value: String(coupon.value), minimumAmount: String(coupon.minimumAmount), maximumDiscount: coupon.maximumDiscount ? String(coupon.maximumDiscount) : "", usageLimit: coupon.usageLimit ? String(coupon.usageLimit) : "", expiresAt: coupon.expiresAt ? dateInput(new Date(coupon.expiresAt)) : "" })}>Edit</button><button className="admin-table-action" onClick={() => toggleCoupon(coupon)}>{coupon.active ? "Disable" : "Enable"}</button></div></td></tr>)}</tbody></table></div> : <Empty>No coupons created yet.</Empty>}</Panel>;
  }

  const active = sections.find((item) => item.id === section) || sections[0];
  return <main className="admin-portal min-h-[70vh] bg-slate-50 px-3 py-5 sm:px-5 lg:px-8"><div className="mx-auto max-w-[1440px]"><header className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-slate-900 px-5 py-5 text-white shadow-sm sm:px-7"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-violet-300">ShoppingSphere control room</p><h1 className="mt-1 text-2xl font-bold">Admin dashboard</h1><p className="mt-1 text-sm text-slate-300">Marketplace performance and operations.</p></div><span className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm"><Activity size={16} className="text-emerald-300" /> Admin access</span></header>
    <div className="grid items-start gap-5 lg:grid-cols-[230px_minmax(0,1fr)]"><aside className="admin-sidebar rounded-2xl border border-slate-200 bg-white p-2 shadow-sm"><nav aria-label="Admin dashboard" className="flex gap-1 overflow-x-auto lg:block">{sections.map(({ id, label, icon: Icon }) => <button key={id} className={`admin-nav-item ${section === id ? "active" : ""}`} onClick={() => { setSection(id); setNotice(""); }}><Icon size={17} /><span>{label}</span>{id === "vendors" && pendingCounts > 0 && <b className="admin-nav-count">{pendingCounts}</b>}{section === id && <ChevronRight className="ml-auto hidden lg:block" size={15} />}</button>)}</nav></aside>
    <div className="min-w-0"><div className="mb-4"><p className="text-xs font-bold uppercase tracking-widest text-violet-600">Marketplace management</p><h2 className="mt-1 text-2xl font-bold text-slate-900">{active.label}</h2></div>{error && <div className="admin-alert" role="alert">{error}<button onClick={() => setError("")} aria-label="Dismiss"><X size={16} /></button></div>}{notice && <div className="admin-notice" role="status"><Check size={16} />{notice}<button onClick={() => setNotice("")} aria-label="Dismiss"><X size={16} /></button></div>}
      {loading ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((item) => <div key={item} className="h-36 animate-pulse rounded-2xl border border-slate-200 bg-white" />)}</div> : section === "analytics" ? renderAnalytics() : section === "vendors" ? renderVendors() : section === "users" ? renderUsers() : section === "orders" ? renderOrders() : section === "coupons" ? renderCoupons() : <Panel className="max-w-2xl"><div className="mb-5"><h3 className="font-bold text-slate-900">Platform commission</h3><p className="mt-1 text-sm text-slate-500">This percentage is applied to future vendor sales at checkout.</p></div><form onSubmit={saveCommission} className="flex flex-wrap items-end gap-3"><label className="admin-field flex-1">Commission rate (%)<input required type="number" min="0" max="100" step="0.01" value={commission} onChange={(event) => setCommission(event.target.value)} /></label><button className="admin-primary" disabled={saving}>{saving ? "Savingâ€¦" : "Save commission"}</button></form><p className="mt-4 text-xs text-amber-700">Changing the rate does not recalculate orders that have already been placed.</p></Panel>}</div></div></div>
    {couponEditor && <div className="admin-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setCouponEditor(null); }}><section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="coupon-title"><div className="flex items-start justify-between border-b border-slate-100 px-5 py-4"><div><h3 id="coupon-title" className="text-lg font-bold text-slate-900">{couponEditor.id ? "Edit coupon" : "Create coupon"}</h3><p className="mt-1 text-sm text-slate-500">Set discount rules, usage limits and expiry.</p></div><button className="admin-close" onClick={() => setCouponEditor(null)} aria-label="Close"><X size={18} /></button></div><form onSubmit={saveCoupon} className="grid gap-4 p-5 sm:grid-cols-2"><label className="admin-field">Coupon code<input required minLength="3" maxLength="30" value={couponEditor.code} onChange={(event) => setCouponEditor({ ...couponEditor, code: event.target.value.toUpperCase() })} /></label><label className="admin-field">Discount type<select value={couponEditor.type} onChange={(event) => setCouponEditor({ ...couponEditor, type: event.target.value })}><option value="PERCENT">Percentage</option><option value="FLAT">Flat amount</option></select></label><label className="admin-field">Discount value<input required type="number" min="0.01" step="0.01" max={couponEditor.type === "PERCENT" ? 100 : undefined} value={couponEditor.value} onChange={(event) => setCouponEditor({ ...couponEditor, value: event.target.value })} /></label><label className="admin-field">Minimum order (INR)<input type="number" min="0" step="0.01" value={couponEditor.minimumAmount} onChange={(event) => setCouponEditor({ ...couponEditor, minimumAmount: event.target.value })} /></label><label className="admin-field">Maximum discount (optional)<input type="number" min="0.01" step="0.01" value={couponEditor.maximumDiscount} onChange={(event) => setCouponEditor({ ...couponEditor, maximumDiscount: event.target.value })} /></label><label className="admin-field">Usage limit (optional)<input type="number" min="1" step="1" value={couponEditor.usageLimit} onChange={(event) => setCouponEditor({ ...couponEditor, usageLimit: event.target.value })} /></label><label className="admin-field sm:col-span-2">Expiry date (optional)<input type="date" value={couponEditor.expiresAt ? dateInput(new Date(`${couponEditor.expiresAt}T00:00:00`)) : ""} onChange={(event) => setCouponEditor({ ...couponEditor, expiresAt: event.target.value })} /></label><div className="flex justify-end gap-2 border-t border-slate-100 pt-4 sm:col-span-2"><button type="button" className="admin-secondary" onClick={() => setCouponEditor(null)}>Cancel</button><button className="admin-primary" disabled={saving}>{saving ? <LoaderCircle size={16} className="animate-spin" /> : null}{couponEditor.id ? "Save changes" : "Create coupon"}</button></div></form></section></div>}
  </main>;
}

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight, Check, ChevronRight, MapPin, Package, Pencil,
  ShoppingBag, Sparkles, UserRound, X,
} from "lucide-react";
import "./Profile.css";

const API = `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api`;
const presentOrder = (order) => ({ ...order, _id: order.id, status: String(order.status || "").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()) });
async function fetchWithTimeout(url, options, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error.name === "AbortError") throw new Error("The server took too long to respond. Check that it is running and try again.", { cause: error });
    throw error;
  } finally { window.clearTimeout(timeout); }
}
const money = (amount) => `₹${Number(amount || 0).toLocaleString("en-IN")}`;

export default function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = useState(() => JSON.parse(sessionStorage.getItem("user") || "null"));
  const [orders, setOrders] = useState([]);
  const [ordersError, setOrdersError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: user?.name || "", email: user?.email || "" });
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const token = sessionStorage.getItem("token");
    if (!token) { navigate("/login", { replace: true, state: { message: "Sign in to view your profile." } }); return; }
    let active = true;
    const headers = { Authorization: `Bearer ${token}` };
    fetchWithTimeout(`${API}/auth/me`, { headers }).then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Could not load your profile");
        return data.user;
      }).then((profile) => {
        if (!active) return;
        setUser(profile);
        setForm({ name: profile.name || "", email: profile.email || "" });
        sessionStorage.setItem("user", JSON.stringify(profile));
        window.dispatchEvent(new Event("accountUserUpdated"));
      }).catch((loadError) => {
        if (!active) return;
        setError(loadError.message || "Unable to load your account details.");
        if (/token|unauthorized|forbidden/i.test(loadError.message)) {
          sessionStorage.removeItem("token"); sessionStorage.removeItem("user"); navigate("/login", { replace: true });
        }
      }).finally(() => { if (active) setLoading(false); });

    fetchWithTimeout(`${API}/orders`, { headers }).then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Could not load your orders");
        return Array.isArray(data) ? data : [];
      }).then((orderList) => { if (active) setOrders(orderList.map(presentOrder)); })
      .catch((loadError) => { if (active) setOrdersError(loadError.message || "Could not load your orders."); });
    return () => { active = false; };
  }, [navigate]);

  async function saveProfile(event) {
    event.preventDefault(); setSaving(true); setNotice(""); setError("");
    try {
      const response = await fetch(`${API}/auth/me`, {
        method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionStorage.getItem("token")}` },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not save your profile");
      setUser(data.user); setForm({ name: data.user.name, email: data.user.email });
      sessionStorage.setItem("user", JSON.stringify(data.user)); window.dispatchEvent(new Event("accountUserUpdated")); setEditing(false); setNotice("Your account details are up to date.");
    } catch (saveError) { setError(saveError.message); }
    finally { setSaving(false); }
  }

  const recentOrders = orders.slice(0, 2);
  const firstName = (user?.name || "there").trim().split(/\s+/)[0];

  return (
    <main className="profile-page">
      <div className="profile-shell">
        <div className="profile-breadcrumb"><Link to="/">Home</Link><ChevronRight size={14} /><span>My profile</span></div>
        <header className="profile-welcome">
          <div><span className="profile-eyebrow"><Sparkles size={14} /> YOUR SHOPPING SPACE</span><h1>Hey, {firstName} <span>✦</span></h1><p>Everything you need, all in one place.</p></div>
          <div className="profile-welcome-art" aria-hidden="true"><div className="profile-art-orbit" /><ShoppingBag size={39} strokeWidth={1.5} /><Sparkles className="profile-art-sparkle" size={19} /></div>
        </header>

        {error && <div className="profile-alert" role="alert">{error}</div>}
        {notice && <div className="profile-success" role="status"><Check size={16} />{notice}<button aria-label="Dismiss" onClick={() => setNotice("")}><X size={15} /></button></div>}

        {loading ? <div className="profile-loading">Getting your account ready…</div> : (
          <div className="profile-layout">
              <article className="profile-card profile-account-card">
                <div className="profile-card-heading"><div><span className="profile-icon profile-icon-blue"><UserRound size={19} /></span><div><h2>Account details</h2><p>Your personal information</p></div></div>
                  {!editing && <button className="profile-edit-button" onClick={() => { setEditing(true); setError(""); }}><Pencil size={15} /> Edit</button>}
                </div>
                {editing ? <form className="profile-edit-form" onSubmit={saveProfile}>
                  <label>Full name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="name" /></label>
                  <label>Email address<input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" /></label>
                  <div className="profile-form-actions"><button type="button" className="profile-cancel-button" onClick={() => { setForm({ name: user?.name || "", email: user?.email || "" }); setEditing(false); }}>Cancel</button><button className="profile-save-button" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button></div>
                </form> : <div className="profile-details-grid"><div><span>Full name</span><strong>{user?.name || "—"}</strong></div><div><span>Email address</span><strong>{user?.email || "—"}</strong></div><div><span>Gender</span><strong>{user?.gender || "Not added"}</strong></div><div><span>Mobile number</span><strong>{user?.phone || "Not added"}</strong></div></div>}
              </article>

              <article className="profile-card profile-orders-card">
                <div className="profile-card-heading"><div><span className="profile-icon profile-icon-peach"><Package size={19} /></span><div><h2>Recent orders</h2><p>{orders.length ? `${orders.length} ${orders.length === 1 ? "order" : "orders"} in your history` : "Your purchases at a glance"}</p></div></div><Link className="profile-text-link" to="/my-orders">All orders <ArrowRight size={15} /></Link></div>
                {ordersError ? <div className="profile-empty-orders"><span><Package size={22} /></span><div><strong>Orders are taking a while</strong><p>{ordersError}</p></div><Link to="/my-orders">Try orders page <ArrowRight size={14} /></Link></div> : recentOrders.length ? <div className="profile-recent-list">{recentOrders.map((order) => <div className="profile-recent-order" key={order._id}><span className="profile-order-glyph"><ShoppingBag size={18} /></span><div className="profile-order-copy"><strong>Order #{String(order._id).slice(-8).toUpperCase()}</strong><span>{new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} · {order.items?.length || 0} items</span></div><span className="profile-order-status">{order.status || "Processing"}</span><strong className="profile-order-price">{money(order.totalAmount)}</strong><ChevronRight className="profile-order-chevron" size={17} /></div>)}</div> : <div className="profile-empty-orders"><span><Package size={22} /></span><div><strong>No orders just yet</strong><p>Your next great find is waiting.</p></div><Link to="/">Start exploring <ArrowRight size={14} /></Link></div>}
              </article>
          </div>
        )}
        <div className="profile-footer-note"><MapPin size={14} /> Made for the way you shop <span>·</span> ShoppingSphere</div>
      </div>
    </main>
  );
}

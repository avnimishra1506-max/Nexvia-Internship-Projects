import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, ArrowUpRight, Bell, Check, Copy, MapPin, Pencil, Plus, ShieldCheck, Star, Trash2, UserRound } from "lucide-react";
import "./AccountPages.css";

const API = `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api`;
const COUPONS = [
  { code: "SSPNEW", title: "A little welcome gift", offer: "20% OFF", detail: "A warm welcome on your first order.", color: "violet" },
  { code: "WELCOME200", title: "Your cart, a little lighter", offer: "₹200 OFF", detail: "Flat savings on your next purchase.", color: "peach" },
  { code: "SPHERE10", title: "A Sphere exclusive", offer: "10% OFF", detail: "An extra saving across the catalog.", color: "blue" },
  { code: "SAVE100", title: "Everyday extra", offer: "₹100 OFF", detail: "A little something for your next find.", color: "green" },
  { code: "STYLE15", title: "Style refresh", offer: "15% OFF", detail: "Give your wardrobe a fresh start.", color: "pink" },
  { code: "GLOW12", title: "Glow a little more", offer: "12% OFF", detail: "A treat for your beauty favourites.", color: "peach" },
  { code: "HOME250", title: "Make home feel like you", offer: "₹250 OFF", detail: "Save on a home refresh.", color: "blue" },
  { code: "TECH8", title: "A smarter little deal", offer: "8% OFF", detail: "Take a little off your tech picks.", color: "violet" },
  { code: "FASHION150", title: "Wear it your way", offer: "₹150 OFF", detail: "A little extra for your next look.", color: "pink" },
  { code: "FESTIVE18", title: "Celebrate the good finds", offer: "18% OFF", detail: "Make your next occasion even brighter.", color: "green" },
];

function AccountHeading({ eyebrow, title, description }) {
  return <header className="account-page-heading"><Link to="/profile" className="account-back"><ArrowLeft size={15} /> My profile</Link><span>{eyebrow}</span><h1>{title}</h1><p>{description}</p></header>;
}

export function ProfileSettings() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", phone: "", gender: "" });
  const [savedForm, setSavedForm] = useState({ name: "", email: "", phone: "", gender: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [editingField, setEditingField] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    const token = sessionStorage.getItem("token");
    if (!token) { navigate("/login", { replace: true }); return; }
    fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.message || "Could not load account details"); return d.user; }).then((u) => {
      const details = { name: u.name || "", email: u.email || "", phone: u.phone || "", gender: u.gender || "" };
      setForm(details); setSavedForm(details);
    }).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [navigate]);
  async function save(field, e) {
    e.preventDefault(); setSaving(field); setError(""); setMessage("");
    try {
      const r = await fetch(`${API}/auth/me`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionStorage.getItem("token")}` }, body: JSON.stringify(form) });
      const d = await r.json(); if (!r.ok) throw new Error(d.message || "Could not save changes");
      const details = { name: d.user.name || "", email: d.user.email || "", phone: d.user.phone || "", gender: d.user.gender || "" };
      sessionStorage.setItem("user", JSON.stringify(d.user)); window.dispatchEvent(new Event("accountUserUpdated"));
      setForm(details); setSavedForm(details); setEditingField(""); setMessage("Your profile settings have been saved.");
    } catch (e2) { setError(e2.message); } finally { setSaving(""); }
  }
  const fields = [
    { key: "name", label: "Full name", input: <input required autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /> },
    { key: "gender", label: "Gender", input: <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}><option value="">Choose an option</option><option>Female</option><option>Male</option><option>Non-binary</option><option>Prefer not to say</option><option>Other</option></select> },
    { key: "email", label: "Email address", input: <input required type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /> },
    { key: "phone", label: "Mobile number", input: <input type="tel" inputMode="numeric" autoComplete="tel-national" pattern="[0-9]{10}" maxLength={10} placeholder="10-digit mobile number" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })} /> },
  ];
  const completedDetails = fields.filter(({ key }) => Boolean(form[key])).length;
  return <main className="account-page"><div className="account-page-shell"><AccountHeading eyebrow="ACCOUNT SETTINGS" title="Profile settings" description="Your personal details, in one easy place." />{loading ? <div className="account-panel">Loading your details…</div> : <div className="profile-settings-grid"><section className="account-panel profile-settings-form"><div className="profile-settings-form-heading"><span className="account-panel-icon"><UserRound size={21} /></span><div><h2>Personal information</h2><p>Review your details and update any field when you need to.</p></div></div><div className="profile-info-list">{fields.map(({ key, label, input }) => <form className={`profile-info-row${editingField === key ? " editing" : ""}`} key={key} onSubmit={(e) => save(key, e)}><div className="profile-info-label">{label}</div>{editingField === key ? <div className="profile-info-editor">{input}<div className="profile-info-actions"><button type="button" className="profile-info-cancel" onClick={() => { setForm(savedForm); setEditingField(""); setError(""); }}>Cancel</button><button className="profile-info-save" disabled={saving === key}>{saving === key ? "Saving…" : "Save"}</button></div></div> : <><strong className="profile-info-value">{form[key] || <span className="profile-info-empty">Not added</span>}</strong><button type="button" className="profile-info-edit" onClick={() => { setEditingField(key); setError(""); setMessage(""); }}><Pencil size={13} /> Edit</button></>}</form>)}</div>{error && <p className="account-error profile-settings-feedback">{error}</p>}{message && <p className="account-success profile-settings-feedback"><Check size={15} />{message}</p>}<p className="profile-settings-hint"><ShieldCheck size={15} /> Your details are only used to manage your account and orders.</p></section><aside className="profile-settings-aside"><article className="profile-settings-identity"><div className="profile-settings-identity-top"><span className="profile-settings-avatar">{(form.name || "S").trim().charAt(0).toUpperCase()}</span><span className="profile-settings-member"><Check size={12} /> MEMBER</span></div><h2>{form.name || "ShoppingSphere member"}</h2><p>{form.email || "Add your email to complete your profile"}</p><div className="profile-completion"><div><span>Profile details</span><strong>{completedDetails}/4</strong></div><span className="profile-completion-track"><span style={{ width: `${completedDetails * 25}%` }} /></span><small>{completedDetails === 4 ? "Your profile is all set." : "Add a few details for a more personal experience."}</small></div></article><article className="profile-settings-links"><p>MAKE IT YOURS</p><Link to="/manage-addresses"><MapPin size={17} /><span><strong>Delivery addresses</strong><small>Keep your favourite places handy</small></span><ArrowUpRight size={15} /></Link><Link to="/notification-preferences"><Bell size={17} /><span><strong>Update preferences</strong><small>Choose the updates you receive</small></span><ArrowUpRight size={15} /></Link></article></aside></div>}</div></main>;
}

const addressKey = () => `ssSavedAddresses:${JSON.parse(sessionStorage.getItem("user") || "{}")?.id || JSON.parse(sessionStorage.getItem("user") || "{}")?.email || "guest"}`;
const blankAddress = () => ({ fullName: "", phone: "", street: "", city: "", state: "", postalCode: "" });
export function ManageAddresses() {
  const navigate = useNavigate();
  const [addresses, setAddresses] = useState([]);
  const [form, setForm] = useState(blankAddress());
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  useEffect(() => {
    if (!sessionStorage.getItem("token")) { navigate("/login", { replace: true }); return; }
    try {
      const saved = JSON.parse(localStorage.getItem(addressKey()) || "[]");
      if (Array.isArray(saved) && saved.length) setAddresses(saved);
      else {
        const checkoutAddress = JSON.parse(localStorage.getItem("ssDeliveryAddress") || "null");
        if (checkoutAddress?.fullName && checkoutAddress?.postalCode) setAddresses([{ ...checkoutAddress, isDefault: true }]);
      }
    } catch { setAddresses([]); }
  }, [navigate]);
  function persist(next) {
    setAddresses(next); localStorage.setItem(addressKey(), JSON.stringify(next));
    const preferred = next.find((a) => a.isDefault);
    if (preferred) localStorage.setItem("ssDeliveryAddress", JSON.stringify(preferred));
    else if (!next.length) localStorage.removeItem("ssDeliveryAddress");
  }
  function submit(e) {
    e.preventDefault();
    const next = [...addresses];
    const record = { ...form, isDefault: !next.length || Boolean(form.isDefault) };
    if (editing !== null) next[editing] = { ...next[editing], ...record };
    else next.push(record);
    if (record.isDefault) next.forEach((a, i) => { a.isDefault = i === (editing !== null ? editing : next.length - 1); });
    persist(next); setForm(blankAddress()); setEditing(null); setShowForm(false);
  }
  function edit(index) { setForm({ ...addresses[index] }); setEditing(index); setShowForm(true); }
  function remove(index) {
    const next = addresses.filter((_, i) => i !== index);
    if (addresses[index].isDefault && next.length) next[0].isDefault = true;
    persist(next);
  }
  function makeDefault(index) { persist(addresses.map((a, i) => ({ ...a, isDefault: i === index }))); }
  return <main className="account-page"><div className="account-page-shell"><AccountHeading eyebrow="ACCOUNT SETTINGS" title="Manage addresses" description="Save your delivery details for a smoother checkout." /><div className="account-page-toolbar"><span>{addresses.length} saved {addresses.length === 1 ? "address" : "addresses"}</span><button className="account-primary-button account-add-button" onClick={() => { setForm(blankAddress()); setEditing(null); setShowForm(!showForm); }}><Plus size={16} /> Add address</button></div>{showForm && <form className="account-panel address-form" onSubmit={submit}><h2>{editing === null ? "Add a new address" : "Edit address"}</h2><div className="address-form-grid">{[["fullName", "Full name"], ["phone", "Mobile number"], ["street", "Address / House no."], ["city", "City"], ["state", "State"], ["postalCode", "PIN code"]].map(([key, label]) => <label key={key}>{label}<input required value={form[key] || ""} onChange={(e) => setForm({ ...form, [key]: e.target.value })} /></label>)}</div><label className="address-default-check"><input type="checkbox" checked={Boolean(form.isDefault)} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} /> Set as default delivery address</label><div className="address-actions"><button type="button" className="account-secondary-button" onClick={() => setShowForm(false)}>Cancel</button><button className="account-primary-button">Save address</button></div></form>}{addresses.length ? <div className="address-card-grid">{addresses.map((a, i) => <article className="account-panel address-card" key={`${a.phone}-${i}`}><div className="address-card-top"><span className="address-pin-icon"><MapPin size={18} /></span><div>{a.isDefault && <span className="address-default-tag">DEFAULT</span>}<strong>{a.fullName}</strong></div><button aria-label="Edit address" onClick={() => edit(i)}><Pencil size={15} /></button><button aria-label="Delete address" onClick={() => remove(i)}><Trash2 size={15} /></button></div><p>{a.street}<br />{a.city}, {a.state} {a.postalCode}<br />Mobile: {a.phone}</p>{!a.isDefault && <button className="address-make-default" onClick={() => makeDefault(i)}>Set as default</button>}</article>)}</div> : !showForm && <div className="account-panel address-empty"><MapPin size={28} /><h2>No saved addresses yet</h2><p>Add an address to make checkout quicker.</p><button className="account-primary-button" onClick={() => setShowForm(true)}>Add your first address</button></div>}</div></main>;
}

export function MyCoupons() {
  const [copied, setCopied] = useState("");
  const [showAllCoupons, setShowAllCoupons] = useState(false);
  async function copy(code) { try { await navigator.clipboard.writeText(code); setCopied(code); setTimeout(() => setCopied(""), 1800); } catch { setCopied("Select the code in your cart to copy it."); } }
  const visibleCoupons = showAllCoupons ? COUPONS : COUPONS.slice(0, 3);
  return <main className="account-page"><div className="account-page-shell"><AccountHeading eyebrow="REWARDS & ACTIVITY" title="Coupons for you" description="A little extra joy for your next ShoppingSphere find." />{copied && <p className="coupon-copy-notice"><Check size={15} />{copied.length < 32 ? `${copied} copied to clipboard` : copied}</p>}<div className="coupon-grid">{visibleCoupons.map((c) => <article className={`coupon-card coupon-${c.color}`} key={c.code}><div className="coupon-card-top"><span className="coupon-offer">{c.offer}</span><span className="coupon-ticket"><span /></span></div><h2>{c.title}</h2><p>{c.detail}</p><div className="coupon-card-bottom"><strong>{c.code}</strong><button onClick={() => copy(c.code)}>{copied === c.code ? <Check size={14} /> : <Copy size={14} />}{copied === c.code ? "Copied" : "Copy code"}</button></div></article>)}</div><button type="button" className="coupon-view-all" onClick={() => setShowAllCoupons((shown) => !shown)}>{showAllCoupons ? "Show fewer coupons" : `View all ${COUPONS.length} coupons`}<ArrowRight size={16} /></button><p className="coupon-fineprint">Offers are subject to availability and can be entered at checkout.</p></div></main>;
}

export function MyReviews() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [reviews, setReviews] = useState({});
  const [drafts, setDrafts] = useState({});
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const token = sessionStorage.getItem("token");
    if (!token) { navigate("/login", { replace: true }); return; }
    const key = `ssProductReviews:${addressKey().split(":").slice(1).join(":")}`;
    try { setReviews(JSON.parse(localStorage.getItem(key) || "{}")); } catch { setReviews({}); }
    fetch(`${API}/orders`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()).then((orders) => {
      if (!Array.isArray(orders)) return;
      const delivered = orders.filter((o) => String(o.status).toLowerCase() === "delivered");
      const deliveredItems = delivered.flatMap((order) =>
        (order.items || []).map((item, index) => ({
          ...item,
          id: `${order.id}-${index}`,
          productId: item.productId,
          name: item.productName,
          orderDate: order.createdAt,
        }))
      );
      setItems(deliveredItems);
    }).catch(() => {});
  }, [navigate]);
  function setRating(id, rating) { setDrafts((d) => ({ ...d, [id]: { ...d[id], rating } })); }
  async function save(id) {
    if (!drafts[id]?.rating) { setNotice("Choose a star rating before submitting."); return; }
    const key = `ssProductReviews:${addressKey().split(":").slice(1).join(":")}`;
    const item = items.find((entry) => entry.id === id);
    try {
      const response = await fetch(`${API}/reviews/product/${item.productId}`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionStorage.getItem("token")}` }, body: JSON.stringify({ rating: drafts[id].rating, comment: drafts[id].text || "" }) });
      const saved = await response.json();
      if (!response.ok) throw new Error(saved.message || "Could not save your review.");
      const next = { ...reviews, [id]: { ...drafts[id], createdAt: saved.createdAt } };
      setReviews(next); localStorage.setItem(key, JSON.stringify(next)); setNotice("Your review has been saved.");
    } catch (error) { setNotice(error.message); }
  }
  return <main className="account-page"><div className="account-page-shell"><AccountHeading eyebrow="REWARDS & ACTIVITY" title="My reviews & ratings" description="Share a little feedback on the things you’ve bought." />{notice && <p className="coupon-copy-notice"><Check size={15} />{notice}</p>}{items.length ? <div className="review-list">{items.map((item) => <article className="account-panel review-card" key={item.id}><div><span className="review-product-icon">✦</span></div><div className="review-product-copy"><strong>{item.name}</strong><small>Delivered {new Date(item.orderDate).toLocaleDateString("en-IN")}</small>{reviews[item.id] ? <p className="review-saved"><Check size={14} /> Your rating: {"★".repeat(reviews[item.id].rating)}{"☆".repeat(5 - reviews[item.id].rating)}{reviews[item.id].text ? ` · ${reviews[item.id].text}` : ""}</p> : <><div className="review-stars" aria-label="Choose a rating">{[1, 2, 3, 4, 5].map((n) => <button key={n} aria-label={`${n} stars`} onClick={() => setRating(item.id, n)} className={n <= (drafts[item.id]?.rating || 0) ? "selected" : ""}><Star size={20} fill="currentColor" /></button>)}</div><div className="review-write-row"><input placeholder="Add a note (optional)" value={drafts[item.id]?.text || ""} onChange={(e) => setDrafts((d) => ({ ...d, [item.id]: { ...d[item.id], text: e.target.value } }))} /><button onClick={() => save(item.id)}>Save review <ArrowRight size={14} /></button></div></>}</div></article>)}</div> : <div className="account-panel address-empty"><Star size={28} /><h2>Your reviews start here</h2><p>Once an order is marked delivered, you can rate its items here.</p><Link className="account-primary-button" to="/my-orders">View my orders <ArrowRight size={15} /></Link></div>}</div></main>;
}


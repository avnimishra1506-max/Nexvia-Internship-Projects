import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Store,
  TrendingUp,
  Truck,
  ShieldCheck,
  CheckCircle2,
  PlusCircle,
  LogIn,
} from "lucide-react";

export default function BecomeSeller() {
  const navigate = useNavigate();
  const user = JSON.parse(sessionStorage.getItem("user") || "null");
  const token = sessionStorage.getItem("token");

  const [form, setForm] = useState({
    name: "",
    description: "",
    price: "",
    mrp: "",
    category: "MEN",
    subCategory: "T-Shirts",
    image: "",
    stock: "10",
    vendor: user ? user.name || "My Store" : "",
  });

  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState({ type: "", text: "" });

  function handleChange(e) {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  }

  async function handleAddProduct(e) {
    e.preventDefault();
    setStatusMessage({ type: "", text: "" });

    if (!form.name || !form.price || !form.category) {
      setStatusMessage({
        type: "error",
        text: "Please provide product name, price, and category.",
      });
      return;
    }

    try {
      setLoading(true);
      const headers = { "Content-Type": "application/json" };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const isVendor = user?.role === "VENDOR";
      const response = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/${isVendor ? "products" : "vendors/apply"}`, {
        method: "POST",
        headers,
        body: JSON.stringify(isVendor ? {
          name: form.name,
          description: form.description,
          category: form.category,
          price: Number(form.price),
          stock: Number(form.stock) || 10,
          imageKey: form.image,
        } : {
          vendorName: form.vendor || user?.name || "My Store",
          description: form.description,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to create product in backend database.");
      }

      setStatusMessage({
        type: "success",
        text: isVendor ? `Product "${data.name || form.name}" listed successfully in the ShoppingSphere catalog!` : "Your seller application has been submitted for admin approval.",
      });

      setForm({
        name: "",
        description: "",
        price: "",
        mrp: "",
        category: form.category,
        subCategory: form.subCategory,
        image: "",
        stock: "10",
        vendor: form.vendor,
      });
    } catch (err) {
      setStatusMessage({
        type: "error",
        text: err.message || "Could not connect to backend server. Make sure server is running on port 5000.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "32px 20px 80px", fontFamily: "Assistant, sans-serif" }}>
      {/* Breadcrumbs */}
      <nav style={{ fontSize: "13px", color: "#696b79", marginBottom: "20px" }}>
        <Link to="/" style={{ color: "#282c3f", textDecoration: "none" }}>Home</Link>
        <span style={{ margin: "0 8px" }}>/</span>
        <span style={{ color: "#282c3f", fontWeight: 600 }}>Become a Seller</span>
      </nav>

      {/* Seller Header Hero */}
      <div
        style={{
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
          color: "#ffffff",
          borderRadius: "16px",
          padding: "44px 36px",
          marginBottom: "36px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "24px",
        }}
      >
        <div style={{ maxWidth: "600px" }}>
          <span
            style={{
              background: "rgba(37, 99, 235, 0.3)",
              color: "#60a5fa",
              padding: "4px 14px",
              borderRadius: "20px",
              fontSize: "12px",
              fontWeight: 700,
              display: "inline-block",
              marginBottom: "14px",
            }}
          >
            SHOPPINGSPHERE SELLER HUB
          </span>
          <h1 style={{ fontSize: "32px", fontWeight: 800, margin: "0 0 12px 0", lineHeight: "1.2" }}>
            Sell to millions of customers across India
          </h1>
          <p style={{ fontSize: "15px", color: "#94a3b8", lineHeight: "1.6", margin: 0 }}>
            List your fashion, electronics, home decor and beauty products with 0% setup fee, instant pan-India logistics, and automated settlements.
          </p>
        </div>

        <div>
          {user ? (
            <div
              style={{
                background: "rgba(255, 255, 255, 0.08)",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                borderRadius: "12px",
                padding: "20px 24px",
                textAlign: "center",
              }}
            >
              <p style={{ margin: "0 0 4px 0", fontSize: "13px", color: "#cbd5e1" }}>Signed in as</p>
              <h3 style={{ margin: "0 0 8px 0", fontSize: "18px", color: "#ffffff" }}>{user.name || user.email}</h3>
              <span
                style={{
                  background: "#10b981",
                  color: "#ffffff",
                  padding: "4px 10px",
                  borderRadius: "20px",
                  fontSize: "11px",
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <CheckCircle2 size={13} /> Active Seller
              </span>
            </div>
          ) : (
            <div style={{ display: "flex", gap: "12px" }}>
              <button
                type="button"
                onClick={() => navigate("/login")}
                style={{
                  background: "#2563eb",
                  color: "#ffffff",
                  padding: "14px 28px",
                  borderRadius: "8px",
                  border: "none",
                  fontWeight: 700,
                  fontSize: "15px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <LogIn size={18} /> Seller Login
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 3 Key Benefits */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "24px", marginBottom: "40px" }}>
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "24px", display: "flex", gap: "16px" }}>
          <div style={{ width: "48px", height: "48px", borderRadius: "10px", background: "#eff6ff", color: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <TrendingUp size={24} />
          </div>
          <div>
            <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#1e293b", margin: "0 0 6px 0" }}>Lowest Marketplace Fees</h3>
            <p style={{ fontSize: "13px", color: "#64748b", margin: 0 }}>Start with 0% commission on your first 30 days and transparent fees afterwards.</p>
          </div>
        </div>

        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "24px", display: "flex", gap: "16px" }}>
          <div style={{ width: "48px", height: "48px", borderRadius: "10px", background: "#ecfdf5", color: "#10b981", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Truck size={24} />
          </div>
          <div>
            <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#1e293b", margin: "0 0 6px 0" }}>Pan-India Logistics</h3>
            <p style={{ fontSize: "13px", color: "#64748b", margin: 0 }}>Doorstep pickup from your warehouse and express delivery across 19,000+ pincodes.</p>
          </div>
        </div>

        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "24px", display: "flex", gap: "16px" }}>
          <div style={{ width: "48px", height: "48px", borderRadius: "10px", background: "#fef3c7", color: "#d97706", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <ShieldCheck size={24} />
          </div>
          <div>
            <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#1e293b", margin: "0 0 6px 0" }}>Fast 24-hr Settlements</h3>
            <p style={{ fontSize: "13px", color: "#64748b", margin: 0 }}>Direct bank transfer of your earnings within 24 to 48 hours of order delivery.</p>
          </div>
        </div>
      </div>

      {/* Product submission form */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "36px", alignItems: "start" }}>
        {/* Product Submission Form connected to POST /api/products */}
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "14px", padding: "32px", boxShadow: "0 4px 16px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
            <Store size={22} color="#2563eb" />
            <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#1e293b", margin: 0 }}>
              List New Product
            </h2>
          </div>

          {statusMessage.text && (
            <div
              role="status"
              style={{
                padding: "12px 16px",
                borderRadius: "8px",
                marginBottom: "20px",
                fontSize: "14px",
                fontWeight: 600,
                background: statusMessage.type === "success" ? "#ecfdf5" : "#fee2e2",
                color: statusMessage.type === "success" ? "#065f46" : "#991b1b",
                border: `1px solid ${statusMessage.type === "success" ? "#a7f3d0" : "#fca5a5"}`,
              }}
              dangerouslySetInnerHTML={{ __html: statusMessage.text }}
            />
          )}

          <form onSubmit={handleAddProduct} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                Product Title *
              </label>
              <input
                type="text"
                name="name"
                placeholder="e.g. Roadster Men Solid Casual Shirt"
                value={form.name}
                onChange={handleChange}
                required
                style={{ width: "100%", padding: "10px 14px", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "14px", boxSizing: "border-box" }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                  Category *
                </label>
                <select
                  name="category"
                  value={form.category}
                  onChange={handleChange}
                  style={{ width: "100%", padding: "10px 14px", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "14px", boxSizing: "border-box", background: "#ffffff" }}
                >
                  <option value="MEN">MEN</option>
                  <option value="WOMEN">WOMEN</option>
                  <option value="KIDS">KIDS</option>
                  <option value="HOME & LIVING">HOME &amp; LIVING</option>
                  <option value="BEAUTY">BEAUTY</option>
                  <option value="GENZ">GENZ</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                  Sub-Category / Item
                </label>
                <input
                  type="text"
                  name="subCategory"
                  placeholder="e.g. T-Shirts, Sarees, Jeans"
                  value={form.subCategory}
                  onChange={handleChange}
                  style={{ width: "100%", padding: "10px 14px", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "14px", boxSizing: "border-box" }}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                  Selling Price (â‚¹) *
                </label>
                <input
                  type="number"
                  name="price"
                  placeholder="799"
                  value={form.price}
                  onChange={handleChange}
                  required
                  style={{ width: "100%", padding: "10px 14px", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "14px", boxSizing: "border-box" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                  MRP (â‚¹)
                </label>
                <input
                  type="number"
                  name="mrp"
                  placeholder="1999"
                  value={form.mrp}
                  onChange={handleChange}
                  style={{ width: "100%", padding: "10px 14px", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "14px", boxSizing: "border-box" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                  Stock Qty
                </label>
                <input
                  type="number"
                  name="stock"
                  placeholder="25"
                  value={form.stock}
                  onChange={handleChange}
                  style={{ width: "100%", padding: "10px 14px", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "14px", boxSizing: "border-box" }}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                  Image URL
                </label>
                <input
                  type="url"
                  name="image"
                  placeholder="https://images.unsplash.com/..."
                  value={form.image}
                  onChange={handleChange}
                  style={{ width: "100%", padding: "10px 14px", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "14px", boxSizing: "border-box" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                  Store / Vendor Name
                </label>
                <input
                  type="text"
                  name="vendor"
                  placeholder="My Brand Store"
                  value={form.vendor}
                  onChange={handleChange}
                  style={{ width: "100%", padding: "10px 14px", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "14px", boxSizing: "border-box" }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                Description
              </label>
              <textarea
                name="description"
                rows="3"
                placeholder="Product material, fit, specifications..."
                value={form.description}
                onChange={handleChange}
                style={{ width: "100%", padding: "10px 14px", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "14px", boxSizing: "border-box" }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: "10px",
                background: "#2563eb",
                color: "#ffffff",
                border: "none",
                borderRadius: "8px",
                padding: "14px 24px",
                fontSize: "15px",
                fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                opacity: loading ? 0.7 : 1,
              }}
            >
              <PlusCircle size={18} /> {loading ? "Connecting to Backend..." : "Publish to Marketplace"}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}


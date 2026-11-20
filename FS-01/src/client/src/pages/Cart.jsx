import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  UserRound,
  Heart,
  Bell,
  ShoppingBag,
  LogIn,
  LogOut,
  Package,
  Sparkles,
  Headphones,
  MapPin,
  Trash2,
  Tag,
  Gift,
  HeartHandshake,
  Check,
  ShieldCheck,
  CreditCard,
  ArrowRight,
  ChevronRight,
  AlertCircle,
  Truck,
  RotateCcw,
  Building,
  Banknote,
} from "lucide-react";
import { useCart } from "../context/CartContext.jsx";
import "./Cart.css";
import "../components/Navbar.css";

let razorpayScriptPromise;
function loadRazorpayCheckout() {
  if (window.Razorpay) return Promise.resolve();
  if (!razorpayScriptPromise) {
    razorpayScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = resolve;
      script.onerror = () => reject(new Error("Could not load Razorpay Checkout. Check your connection and try again."));
      document.body.appendChild(script);
    });
  }
  return razorpayScriptPromise;
}

const extraCoupons = {
  STYLE15: { type: "percent", value: 15, offer: "15% OFF" },
  GLOW12: { type: "percent", value: 12, offer: "12% OFF" },
  HOME250: { type: "flat", value: 250, offer: "₹250 OFF" },
  TECH8: { type: "percent", value: 8, offer: "8% OFF" },
  FASHION150: { type: "flat", value: 150, offer: "₹150 OFF" },
  FESTIVE18: { type: "percent", value: 18, offer: "18% OFF" },
};

export default function Cart() {
  const navigate = useNavigate();
  const {
    cartItems,
    cartCount,
    removeFromCart,
    updateQuantity,
    updateSize,
    toggleSelectItem,
    selectAllItems,
    removeSelectedItems,
    clearCart,
  } = useCart();

  // Profile dropdown state
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);
  const profileTimeoutRef = useRef(null);

  // Wishlist count sync
  const [wishlistCount, setWishlistCount] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("ssWishlist") || "[]");
      return Array.isArray(stored) ? stored.length : 0;
    } catch {
      return 0;
    }
  });

  const user = JSON.parse(sessionStorage.getItem("user") || "null");

  useEffect(() => {
    function handleWishlistSync() {
      try {
        const stored = JSON.parse(localStorage.getItem("ssWishlist") || "[]");
        setWishlistCount(Array.isArray(stored) ? stored.length : 0);
      } catch {
        setWishlistCount(0);
      }
    }
    window.addEventListener("wishlistUpdated", handleWishlistSync);
    window.addEventListener("storage", handleWishlistSync);
    return () => {
      window.removeEventListener("wishlistUpdated", handleWishlistSync);
      window.removeEventListener("storage", handleWishlistSync);
    };
  }, []);

  useEffect(() => {
    function handleOutsideClick(e) {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  function handleProfileMouseEnter() {
    if (profileTimeoutRef.current) clearTimeout(profileTimeoutRef.current);
    setProfileOpen(true);
  }

  function handleProfileMouseLeave() {
    profileTimeoutRef.current = setTimeout(() => {
      setProfileOpen(false);
    }, 200);
  }

  function handleLogout() {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    setProfileOpen(false);
    navigate("/login");
  }

  // Delivery address state
  const [address, setAddress] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("ssDeliveryAddress"));
      if (saved && saved.fullName && saved.postalCode) return saved;
    } catch {
      // fallback
    }
    return {
      fullName: user ? user.name : "Pushpa",
      phone: "9876543210",
      street: "Flat 402, Royal Palms, Connaught Place",
      city: "New Delhi",
      state: "Delhi",
      postalCode: "110001",
    };
  });

  // Coupons state
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState({
    code: "SSPNEW",
    type: "percent",
    value: 20,
  });
  const [showAllCoupons, setShowAllCoupons] = useState(false);
  const [couponError, setCouponError] = useState("");
  const [couponSuccess, setCouponSuccess] = useState("");

  // Gifting & donation extras
  const [giftWrap, setGiftWrap] = useState(false);
  const [donate, setDonate] = useState(false);

  // Modals state
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [tempAddress, setTempAddress] = useState(address);
  const [sizeModalItem, setSizeModalItem] = useState(null);
  const [selectedModalSize, setSelectedModalSize] = useState("M");
  const [removeModalItem, setRemoveModalItem] = useState(null);

  // Payment / Direct checkout modal state
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [orderError, setOrderError] = useState("");

  // Helper calculations
  const selectedItems = cartItems.filter((item) => item.selected !== false);
  const allSelected =
    cartItems.length > 0 && selectedItems.length === cartItems.length;

  const totalMRP = selectedItems.reduce((acc, item) => {
    const itemMRP = item.mrp || Math.round(item.price * 1.6);
    return acc + itemMRP * item.quantity;
  }, 0);

  const totalSellingPrice = selectedItems.reduce((acc, item) => {
    return acc + item.price * item.quantity;
  }, 0);

  const discountOnMRP = totalMRP - totalSellingPrice;

  const extraCharges = (donate ? 10 : 0) + (giftWrap ? 25 : 0);

  // Coupon calculation
  let couponDiscount = 0;
  if (appliedCoupon && selectedItems.length > 0) {
    if (appliedCoupon.type === "flat") {
      couponDiscount = Math.min(appliedCoupon.value, totalSellingPrice + extraCharges);
    } else if (appliedCoupon.type === "percent") {
      couponDiscount = Math.round(
        ((totalSellingPrice + extraCharges) * appliedCoupon.value) / 100
      );
    }
  }

  const finalPayable = Math.max(0, totalSellingPrice + extraCharges - couponDiscount);
  const totalSavings = discountOnMRP + couponDiscount;

  async function handleApplyCoupon(code) {
    const normalized = (code || couponInput).trim().toUpperCase();
    setCouponError("");
    setCouponSuccess("");

    if (!normalized) {
      setCouponError("Please enter a valid coupon code.");
      return;
    }

    const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";
    const token = sessionStorage.getItem("token");

    // Try backend API first (real coupon database)
    if (token && totalSellingPrice > 0) {
      try {
        const resp = await fetch(`${API_BASE}/api/coupons/validate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ code: normalized, orderAmount: totalSellingPrice }),
        });
        const data = await resp.json();
        if (resp.ok && data.valid) {
          setAppliedCoupon({ code: normalized, type: data.type, value: data.value, discount: data.discount, fromAPI: true });
          setCouponSuccess(`${normalized} applied! You save ₹${data.discount.toLocaleString("en-IN")} on this order!`);
          setCouponInput("");
          setShowAllCoupons(false);
          return;
        } else {
          // Fall through to local coupons if API returns not found
          if (resp.status !== 404) {
            setCouponError(data.message || "Invalid coupon code.");
            return;
          }
        }
      } catch {
        // Backend unreachable — fall through to local coupons
      }
    }

    // Local hardcoded coupons as fallback
    const localCoupons = {
      SSPNEW: { type: "percent", value: 20, offer: "20% OFF" },
      WELCOME200: { type: "flat", value: 200, offer: "₹200 OFF" },
      SPHERE10: { type: "percent", value: 10, offer: "10% OFF" },
      SAVE100: { type: "flat", value: 100, offer: "₹100 OFF" },
      ...extraCoupons,
    };

    if (localCoupons[normalized]) {
      const coupon = localCoupons[normalized];
      setAppliedCoupon({ code: normalized, ...coupon });
      setCouponSuccess(`${normalized} applied! ${coupon.offer} added to your order!`);
      setCouponInput("");
      setShowAllCoupons(false);
    } else {
      setCouponError("Invalid coupon code. Try WELCOME10, STYLE15, or FLAT250.");
    }
  }

  function handleSaveAddress(e) {
    e.preventDefault();
    setAddress(tempAddress);
    localStorage.setItem("ssDeliveryAddress", JSON.stringify(tempAddress));
    setAddressModalOpen(false);
  }

  function handleMoveToWishlist(item) {
    try {
      const savedWishlist =
        JSON.parse(localStorage.getItem("ssWishlist")) || [];
      if (!savedWishlist.some((w) => w._id === item._id)) {
        savedWishlist.push(item);
        localStorage.setItem("ssWishlist", JSON.stringify(savedWishlist));
        window.dispatchEvent(new Event("wishlistUpdated"));
      }
    } catch {
      // ignore
    }
    removeFromCart(item._id);
    if (removeModalItem && removeModalItem._id === item._id) {
      setRemoveModalItem(null);
    }
  }

  function getBrandName(item) {
    if (item.brand) return item.brand.toUpperCase();
    if (item.vendor && item.vendor.toLowerCase() !== "unknown") {
      return item.vendor.toUpperCase();
    }
    if (item.name) {
      const firstWord = item.name.split(" ")[0];
      return firstWord.toUpperCase();
    }
    return "SHOPPINGSPHERE";
  }

  // Create a server-priced Razorpay order and open the hosted checkout UI.
  async function handleConfirmAndPay() {
    setIsPlacingOrder(true);
    setOrderError("");

    const checkoutPayload = {
      items: selectedItems.map((item) => ({
        productId: item._id,
        quantity: item.quantity,
      })),
      shippingAddress: address,
      couponCode: appliedCoupon ? appliedCoupon.code : null,
      giftWrap,
      donate,
    };

    try {
      const headers = { "Content-Type": "application/json" };
      const token = sessionStorage.getItem("token");
      if (token) headers.Authorization = `Bearer ${token}`;
      const response = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/payments/create-order`, {
        method: "POST",
        headers,
        body: JSON.stringify(checkoutPayload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not start Razorpay Checkout.");

      if (data.isSimulation) {
        // Test simulation mode (allows testing checkout without a live Razorpay merchant account)
        const mockPaymentResponse = {
          razorpay_order_id: data.razorpayOrderId,
          razorpay_payment_id: `pay_sim_${data.appOrderId}`,
          razorpay_signature: "simulated_signature",
        };
        const verifyResponse = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/payments/verify`, {
          method: "POST",
          headers,
          body: JSON.stringify({ appOrderId: data.appOrderId, ...mockPaymentResponse }),
        });
        const verification = await verifyResponse.json();
        if (!verifyResponse.ok) throw new Error(verification.message || "Payment confirmation is pending.");
        clearCart();
        navigate(`/order-success?order_id=${encodeURIComponent(data.appOrderId)}`);
        return;
      }

      await loadRazorpayCheckout();
      const checkout = new window.Razorpay({
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        name: "ShoppingSphere",
        description: "Secure order payment",
        order_id: data.razorpayOrderId,
        prefill: { name: data.customer?.name, contact: data.customer?.phone },
        theme: { color: "#6c4df6" },
        handler: async (paymentResponse) => {
          try {
            const verifyResponse = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/payments/verify`, {
              method: "POST", headers,
              body: JSON.stringify({ appOrderId: data.appOrderId, ...paymentResponse }),
            });
            const verification = await verifyResponse.json();
            if (!verifyResponse.ok) throw new Error(verification.message || "Payment confirmation is pending.");
            clearCart();
            navigate(`/order-success?order_id=${encodeURIComponent(data.appOrderId)}`);
          } catch (error) {
            setOrderError(error.message || "Payment confirmation is pending. Check your orders before retrying.");
            setIsPlacingOrder(false);
          }
        },
        modal: {
          ondismiss: async () => {
            try {
              await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/payments/cancel-checkout`, {
                method: "POST", headers,
                body: JSON.stringify({ appOrderId: data.appOrderId }),
              });
            } finally {
              setIsPlacingOrder(false);
            }
          },
        },
      });
      checkout.open();
    } catch (err) {
      setOrderError(err.message || "Could not connect to Razorpay. Please try again.");
      setIsPlacingOrder(false);
    }
  }

  // SHARED HEADER
  const renderHeader = () => (
    <header className="ss-header ss-bag-header">
      <div className="ss-navbar" style={{ height: "78px" }}>
        {/* Brand Logo */}
        <Link
          to="/"
          className="ss-brand"
          title="ShoppingSphere Home"
          aria-label="ShoppingSphere Home"
        >
          <span className="ss-brand-icon">
            <ShoppingBag size={24} strokeWidth={2.3} />
          </span>
          <span>
            Shopping<span className="ss-brand-accent">Sphere</span>
          </span>
        </Link>

        {/* Right Corner Actions */}
        <div className="ss-actions">
          {/* Profile */}
          <div
            className="ss-profile-wrap"
            onMouseEnter={handleProfileMouseEnter}
            onMouseLeave={handleProfileMouseLeave}
            ref={profileRef}
          >
            <button
              type="button"
              className="ss-action"
              onClick={() => setProfileOpen(!profileOpen)}
            >
              <UserRound size={20} />
              <span>Profile</span>
            </button>

            {profileOpen && (
              <div
                className="ss-profile-dropdown"
                onMouseEnter={handleProfileMouseEnter}
                onMouseLeave={handleProfileMouseLeave}
              >
                {user ? (
                  <div className="ss-pdrop-user-banner">
                    <div className="ss-pdrop-avatar">
                      <UserRound size={20} />
                    </div>
                    <div className="ss-pdrop-user-info">
                      <p className="ss-pdrop-user-name">
                        {user.name || "Customer"}
                      </p>
                      <p className="ss-pdrop-user-email">{user.email}</p>
                    </div>
                  </div>
                ) : (
                  <div className="ss-pdrop-guest-banner">
                    <span className="ss-pdrop-welcome">Welcome</span>
                    <span className="ss-pdrop-subtext">
                      To access account and manage orders
                    </span>
                    <Link
                      to="/login"
                      className="ss-pdrop-login-btn"
                      onClick={() => setProfileOpen(false)}
                    >
                      <LogIn size={15} /> LOGIN / SIGN UP
                    </Link>
                  </div>
                )}

                <div className="ss-pdrop-divider" />

                <ul className="ss-pdrop-list">
                  <li>
                    <Link
                      to="/my-orders"
                      className="ss-pdrop-link"
                      onClick={() => setProfileOpen(false)}
                    >
                      <Package size={18} className="ss-pdrop-icon" />
                      <span>My Orders</span>
                    </Link>
                  </li>

                  <li>
                    <Link
                      to="/wishlist"
                      className="ss-pdrop-link"
                      onClick={() => setProfileOpen(false)}
                    >
                      <Heart size={18} className="ss-pdrop-icon" />
                      <span>Wishlist</span>
                    </Link>
                  </li>

                  <li>
                    <Link
                      to="/notification-preferences"
                      className="ss-pdrop-link"
                      onClick={() => setProfileOpen(false)}
                    >
                      <Bell size={18} className="ss-pdrop-icon" />
                      <span>Notification Preferences</span>
                    </Link>
                  </li>

                  <li>
                    <Link
                      to="/customer-care"
                      className="ss-pdrop-link"
                      onClick={() => setProfileOpen(false)}
                    >
                      <Headphones size={18} className="ss-pdrop-icon" />
                      <span>Customer Care</span>
                    </Link>
                  </li>

                  {user && (
                    <>
                      <div className="ss-pdrop-divider" />
                      <li>
                        <button
                          type="button"
                          className="ss-pdrop-link ss-pdrop-logout"
                          onClick={handleLogout}
                        >
                          <LogOut size={18} className="ss-pdrop-icon" />
                          <span>Logout</span>
                        </button>
                      </li>
                    </>
                  )}
                </ul>
              </div>
            )}
          </div>

          {/* Wishlist */}
          <Link to="/wishlist" className="ss-action">
            <div className="ss-action-bag-wrap">
              <Heart size={20} />
              {wishlistCount > 0 && (
                <span className="ss-badge">{wishlistCount}</span>
              )}
            </div>
            <span>Wishlist</span>
          </Link>

          {/* Bag */}
          <Link
            to="/cart"
            className="ss-action"
            style={{ color: "#2563eb" }}
          >
            <div className="ss-action-bag-wrap">
              <ShoppingBag size={20} />
              {cartCount > 0 && <span className="ss-badge">{cartCount}</span>}
            </div>
            <span>Bag</span>
          </Link>
        </div>
      </div>
    </header>
  );

  // FOOTER COMPONENT
  const renderFooter = () => (
    <footer className="ss-bag-footer">
      <div className="ss-bag-footer-inner">
        <div className="ss-bag-trust-badges">
          <div className="ss-trust-item">
            <ShieldCheck size={20} className="ss-trust-icon" />
            <span>100% Secure &amp; Encrypted Payments</span>
          </div>
          <div className="ss-trust-item">
            <RotateCcw size={20} className="ss-trust-icon" />
            <span>14 Days Easy Return &amp; Exchange</span>
          </div>
          <div className="ss-trust-item">
            <Truck size={20} className="ss-trust-icon" />
            <span>Fast Express Doorstep Delivery</span>
          </div>
        </div>

        <div className="ss-bag-payment-logos">
          <span className="ss-pay-pill">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M14.5 4.5L19.5 12L14.5 19.5H11L14.5 12L11 4.5H14.5Z" fill="#00833F" />
              <path d="M9.5 4.5L14.5 12L9.5 19.5H6L9.5 12L6 4.5H9.5Z" fill="#E87424" />
            </svg>
            <span>UPI</span>
          </span>

          <span className="ss-pay-pill">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M21.5 12.2c0-.7-.1-1.4-.2-2H12v4.1h5.3c-.2 1.2-1 2.3-2.1 3v2.5h3.4c2-1.9 3.1-4.7 3.1-7.6z" fill="#4285F4"/>
              <path d="M12 22c2.7 0 5-1 6.7-2.6l-3.4-2.5c-.9.6-2.1 1-3.3 1-2.6 0-4.8-1.7-5.5-4.1H3v2.6C4.7 19.8 8.1 22 12 22z" fill="#34A853"/>
              <path d="M6.5 13.8c-.2-.6-.3-1.2-.3-1.8s.1-1.2.3-1.8V7.6H3C2.4 8.9 2 10.4 2 12s.4 3.1 1 4.4l3.5-2.6z" fill="#FBBC05"/>
              <path d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.9-2.9C17 2.8 14.7 2 12 2 8.1 2 4.7 4.2 3 7.6l3.5 2.6c.7-2.4 2.9-4.3 5.5-4.3z" fill="#EA4335"/>
            </svg>
            <span>Google Pay</span>
          </span>

          <span className="ss-pay-pill">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" fill="#5F259F" />
              <path d="M13.5 8H9v8h2v-3h2.5c1.4 0 2.5-1.1 2.5-2.5S14.9 8 13.5 8zm0 3H11v-1h2.5c.3 0 .5.2.5.5s-.2.5-.5.5z" fill="#FFFFFF" />
              <path d="M10 7h6v1.5h-6z" fill="#FFFFFF" />
            </svg>
            <span>PhonePe</span>
          </span>

          <span className="ss-pay-pill">
            <svg width="22" height="15" viewBox="0 0 32 20" fill="none">
              <rect width="32" height="20" rx="3" fill="#002E6E" />
              <text x="3" y="14" fill="#00B9F5" fontSize="10" fontWeight="900" fontFamily="sans-serif">Pay</text>
              <text x="20" y="14" fill="#FFFFFF" fontSize="10" fontWeight="900" fontFamily="sans-serif">tm</text>
            </svg>
            <span>Paytm</span>
          </span>

          <span className="ss-pay-pill">
            <svg width="24" height="15" viewBox="0 0 36 20" fill="none">
              <rect width="36" height="20" rx="3" fill="#1A1F71" />
              <text x="5" y="15" fill="#FFFFFF" fontSize="13" fontStyle="italic" fontWeight="900" fontFamily="sans-serif">VISA</text>
            </svg>
            <span>VISA</span>
          </span>

          <span className="ss-pay-pill">
            <svg width="24" height="15" viewBox="0 0 36 20" fill="none">
              <rect width="36" height="20" rx="3" fill="#222222" />
              <circle cx="14" cy="10" r="6" fill="#EB001B" />
              <circle cx="22" cy="10" r="6" fill="#F79E1B" fillOpacity="0.85" />
            </svg>
            <span>MasterCard</span>
          </span>

          <span className="ss-pay-pill">
            <svg width="24" height="15" viewBox="0 0 36 20" fill="none">
              <rect width="36" height="20" rx="3" fill="#0A3A60" />
              <path d="M22 6L26 10L22 14" stroke="#00A859" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M25 6L29 10L25 14" stroke="#F37021" strokeWidth="2.5" strokeLinecap="round" />
              <text x="4" y="14" fill="#FFFFFF" fontSize="9" fontWeight="900" fontFamily="sans-serif">RuPay</text>
            </svg>
            <span>RuPay</span>
          </span>

          <span className="ss-pay-pill">
            <Building size={16} color="#1D4ED8" />
            <span>Net Banking</span>
          </span>

          <span className="ss-pay-pill">
            <Banknote size={16} color="#059669" />
            <span>Cash on Delivery</span>
          </span>
        </div>

        <div className="ss-bag-footer-bottom">
          <div className="ss-footer-links">
            <Link to="/customer-care">Need Help?</Link>
            <span className="ss-footer-bullet">•</span>
            <Link to="/">Terms &amp; Conditions</Link>
            <span className="ss-footer-bullet">•</span>
            <Link to="/">Privacy Policy</Link>
          </div>
        </div>
      </div>
    </footer>
  );

  // ========================================================
  // EMPTY BAG STATE (With Royal Blue site logo theme)
  // ========================================================
  if (cartItems.length === 0) {
    return (
      <div className="ss-bag-page-root">
        {renderHeader()}

        <main className="ss-empty-bag-container">
          <div className="ss-empty-bag-card">
            {/* Elegant Royal Blue SVG Illustration */}
            <div className="ss-empty-icon-wrap">
              <svg
                className="ss-empty-svg"
                viewBox="0 0 160 160"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle cx="80" cy="80" r="70" fill="#EFF6FF" />
                <circle cx="80" cy="80" r="54" fill="#DBEAFE" opacity="0.6" />
                {/* Bag Body */}
                <path
                  d="M45 60C45 56.6863 47.6863 54 51 54H109C112.314 54 115 56.6863 115 60L110 120C110 123.314 107.314 126 104 126H56C52.6863 126 50 123.314 50 120L45 60Z"
                  fill="#FFFFFF"
                  stroke="#2563EB"
                  strokeWidth="2.5"
                />
                {/* Bag Handle */}
                <path
                  d="M62 54V42C62 32.0589 70.0589 24 80 24C89.9411 24 98 32.0589 98 42V54"
                  stroke="#1D4ED8"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />
                {/* ShoppingSphere Center Accent */}
                <path
                  d="M80 75C78 72 73 70 70 73C66 77 72 84 80 89C88 84 94 77 90 73C87 70 82 72 80 75Z"
                  fill="#2563EB"
                  opacity="0.9"
                />
                {/* Sparkles & Dots */}
                <circle cx="40" cy="40" r="3.5" fill="#3B82F6" />
                <circle cx="125" cy="45" r="4.5" fill="#1D4ED8" />
                <circle cx="120" cy="115" r="3.5" fill="#10B981" />
                <circle cx="36" cy="105" r="3.5" fill="#F59E0B" />
              </svg>
            </div>

            <h2 className="ss-empty-title">Your Shopping Bag is Empty</h2>
            <p className="ss-empty-subtitle">
              Looks like you haven&apos;t added any items to your bag yet. Explore
              our curated collections or pick up where you left off from your Wishlist.
            </p>

            <div className="ss-empty-btn-group">
              <Link to="/wishlist" className="ss-btn-wishlist-blue">
                <Heart size={18} />
                <span>ADD ITEMS FROM WISHLIST</span>
              </Link>
            </div>
          </div>
        </main>

        {renderFooter()}
      </div>
    );
  }

  // ========================================================
  // ACTIVE / FILLED BAG STATE (Modern Eye-Catching Design)
  // ========================================================
  return (
    <div className="ss-bag-page-root">
      {renderHeader()}

      <main className="ss-bag-main-content">
        <div className="ss-bag-layout-grid">
          {/* ========================================================
              LEFT COLUMN: PRODUCTS & PREFERENCES
             ======================================================== */}
          <div className="ss-bag-left-col">
            {/* Delivery Location Banner */}
            <section className="ss-card ss-delivery-banner" aria-label="Delivery Address">
              <div className="ss-del-left">
                <div className="ss-del-pin-badge">
                  <MapPin size={20} />
                </div>
                <div className="ss-del-details">
                  <div className="ss-del-header-row">
                    <span className="ss-del-to">Deliver to:</span>
                    <strong className="ss-del-name">{address.fullName}</strong>
                    <span className="ss-del-pincode">{address.postalCode}</span>
                  </div>
                  <p className="ss-del-street">
                    {address.street}, {address.city}, {address.state}
                  </p>
                  <div className="ss-del-speed">
                    <Truck size={14} className="ss-speed-icon" />
                    <span>Free Express Delivery by <strong>Tomorrow</strong></span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="ss-btn-change-address"
                onClick={() => {
                  setTempAddress(address);
                  setAddressModalOpen(true);
                }}
              >
                CHANGE ADDRESS
              </button>
            </section>

            {/* Special Welcome Offer Alert */}
            <div className="ss-welcome-offer-callout">
              <Sparkles size={18} className="ss-callout-icon" />
              <div>
                <strong>Special Welcome Offer:</strong> Flat 20% OFF applied with code{" "}
                <span className="ss-code-badge">SSPNEW</span>. Save extra on your first order!
              </div>
            </div>

            {/* Items Header (Select All & Bulk Actions) */}
            <div className="ss-items-header-bar">
              <label className="ss-select-all-label">
                <input
                  type="checkbox"
                  className="ss-custom-checkbox"
                  checked={allSelected}
                  onChange={(e) => selectAllItems(e.target.checked)}
                />
                <span className="ss-select-all-text">
                  {selectedItems.length} of {cartItems.length} Items Selected
                </span>
              </label>

              <div className="ss-bulk-actions">
                <button
                  type="button"
                  className="ss-bulk-btn"
                  onClick={removeSelectedItems}
                  disabled={selectedItems.length === 0}
                >
                  <Trash2 size={15} />
                  <span>Remove</span>
                </button>
                <span className="ss-bulk-divider">|</span>
                <button
                  type="button"
                  className="ss-bulk-btn"
                  onClick={() => {
                    selectedItems.forEach((it) => handleMoveToWishlist(it));
                  }}
                  disabled={selectedItems.length === 0}
                >
                  <Heart size={15} />
                  <span>Move to Wishlist</span>
                </button>
              </div>
            </div>

            {/* Product Cards List */}
            <div className="ss-products-list">
              {cartItems.map((item) => {
                const itemMRP = item.mrp || Math.round(item.price * 1.6);
                const discountPct = Math.round(
                  ((itemMRP - item.price) / itemMRP) * 100
                );
                const brand = getBrandName(item);

                return (
                  <article className="ss-cart-item-card" key={item._id}>
                    {/* Checkbox */}
                    <div className="ss-item-check-col">
                      <input
                        type="checkbox"
                        className="ss-custom-checkbox"
                        checked={item.selected !== false}
                        onChange={() => toggleSelectItem(item._id)}
                        aria-label={`Select ${item.name}`}
                      />
                    </div>

                    {/* Thumbnail Image */}
                    <Link to={`/products/${item._id}`} className="ss-item-image-col">
                      <img
                        src={item.image}
                        alt={item.name}
                        className="ss-item-img"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src =
                            "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300&auto=format&fit=crop&q=60";
                        }}
                      />
                      {discountPct > 0 && (
                        <span className="ss-item-discount-tag">
                          {discountPct}% OFF
                        </span>
                      )}
                    </Link>

                    {/* Item Information & Controls */}
                    <div className="ss-item-info-col">
                      <div className="ss-item-top-row">
                        <div>
                          <span className="ss-item-brand">{brand}</span>
                          <h3 className="ss-item-title">
                            <Link to={`/products/${item._id}`}>{item.name}</Link>
                          </h3>
                        </div>

                        <button
                          type="button"
                          className="ss-item-remove-btn"
                          onClick={() => setRemoveModalItem(item)}
                          title="Remove item"
                          aria-label="Remove item"
                        >
                          ✕
                        </button>
                      </div>

                      <p className="ss-item-vendor">
                        Sold by: <span>{item.vendor || "ShoppingSphere Certified Seller"}</span>
                      </p>

                      {/* Selectors: Inline Stepper & Size Pill */}
                      <div className="ss-item-controls-row">
                        {/* Size selector */}
                        <button
                          type="button"
                          className="ss-size-pill"
                          onClick={() => {
                            setSizeModalItem(item);
                            setSelectedModalSize(item.size || "M");
                          }}
                        >
                          <span>Size: <strong>{item.size || "M"}</strong></span>
                          <ChevronRight size={14} />
                        </button>

                        {/* Inline Quantity Stepper */}
                        <div className="ss-qty-stepper">
                          <button
                            type="button"
                            className="ss-stepper-btn"
                            onClick={() =>
                              updateQuantity(item._id, Math.max(1, item.quantity - 1))
                            }
                            disabled={item.quantity <= 1}
                            title="Decrease quantity"
                          >
                            −
                          </button>
                          <span className="ss-stepper-qty">{item.quantity}</span>
                          <button
                            type="button"
                            className="ss-stepper-btn"
                            onClick={() => updateQuantity(item._id, item.quantity + 1)}
                            disabled={item.quantity >= (item.stock || 20)}
                            title="Increase quantity"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Pricing Display */}
                      <div className="ss-item-price-row">
                        <span className="ss-price-selling">
                          ₹{(item.price * item.quantity).toLocaleString("en-IN")}
                        </span>
                        <span className="ss-price-mrp">
                          ₹{(itemMRP * item.quantity).toLocaleString("en-IN")}
                        </span>
                        <span className="ss-price-off">
                          {discountPct}% OFF
                        </span>
                      </div>

                      {/* Item Policy Badges */}
                      <div className="ss-item-perks-row">
                        <div className="ss-perk">
                          <RotateCcw size={13} />
                          <span>14 Days Return Available</span>
                        </div>
                        <div className="ss-perk">
                          <Truck size={13} />
                          <span>Delivery by <strong>Tomorrow</strong></span>
                        </div>
                      </div>

                      {/* Card Footer Actions */}
                      <div className="ss-card-actions-footer">
                        <button
                          type="button"
                          className="ss-wishlist-action-btn"
                          onClick={() => handleMoveToWishlist(item)}
                        >
                          <Heart size={14} />
                          <span>Move to Wishlist</span>
                        </button>
                        <span className="ss-action-divider">•</span>
                        <button
                          type="button"
                          className="ss-delete-action-btn"
                          onClick={() => setRemoveModalItem(item)}
                        >
                          <Trash2 size={14} />
                          <span>Remove</span>
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            {/* Wishlist Link Banner */}
            <Link to="/wishlist" className="ss-card ss-more-wishlist-banner">
              <div className="ss-mw-left">
                <Heart size={20} className="ss-mw-heart" />
                <div>
                  <strong>Have more saved items in your Wishlist?</strong>
                  <p>Add them to your bag before proceeding to checkout</p>
                </div>
              </div>
              <ArrowRight size={18} />
            </Link>
          </div>

          {/* ========================================================
              RIGHT COLUMN: BILLING, COUPONS & DIRECT CHECKOUT
             ======================================================== */}
          <aside className="ss-bag-right-col">
            {/* Interactive Coupons Card */}
            <section className="ss-card ss-coupons-card" aria-label="Coupons and Discounts">
              <div className="ss-coupon-card-header">
                <Tag size={18} className="ss-coupon-header-icon" />
                <h3 className="ss-coupon-heading">Coupons &amp; Offers</h3>
              </div>

              {/* Coupon input field */}
              <div className="ss-coupon-input-group">
                <input
                  type="text"
                  className="ss-coupon-text-input"
                  placeholder="Enter promo or coupon code"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleApplyCoupon();
                    }
                  }}
                />
                <button
                  type="button"
                  className="ss-btn-apply-coupon"
                  onClick={() => handleApplyCoupon()}
                >
                  APPLY
                </button>
              </div>

              {/* Error / Success Feedback */}
              {couponError && (
                <div className="ss-coupon-alert-error">
                  <AlertCircle size={14} />
                  <span>{couponError}</span>
                </div>
              )}
              {couponSuccess && (
                <div className="ss-coupon-alert-success">
                  <Check size={14} />
                  <span>{couponSuccess}</span>
                </div>
              )}

              {/* Applied Coupon Pill */}
              {appliedCoupon && (
                <div className="ss-applied-coupon-pill">
                  <div className="ss-ac-info">
                    <Check size={16} className="ss-ac-check" />
                    <div>
                      <strong className="ss-ac-code">{appliedCoupon.code}</strong>
                      <span className="ss-ac-desc">
                        Saved ₹{couponDiscount.toLocaleString("en-IN")} on this order
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="ss-btn-remove-coupon"
                    onClick={() => {
                      setAppliedCoupon(null);
                      setCouponSuccess("");
                    }}
                  >
                    Remove
                  </button>
                </div>
              )}

              <button type="button" className="ss-view-coupons-button" aria-expanded={showAllCoupons} onClick={() => setShowAllCoupons((show) => !show)}>
                <span>{showAllCoupons ? "Hide coupons" : "View all coupons"}</span>
                <ChevronRight size={16} className={showAllCoupons ? "is-expanded" : ""} />
              </button>

              {/* Coupon choices stay collapsed until requested. */}
              {showAllCoupons && <div className="ss-quick-coupon-list">
                <div
                  className="ss-quick-coupon-item"
                  onClick={() => handleApplyCoupon("SSPNEW")}
                >
                  <div className="ss-qc-top">
                    <strong>SSPNEW</strong>
                    <span className="ss-qc-badge">20% OFF</span>
                  </div>
                  <p>Welcome offer on first order (T&amp;C Apply)</p>
                </div>

                <div
                  className="ss-quick-coupon-item"
                  onClick={() => handleApplyCoupon("WELCOME200")}
                >
                  <div className="ss-qc-top">
                    <strong>WELCOME200</strong>
                    <span className="ss-qc-badge">₹200 OFF</span>
                  </div>
                  <p>Flat ₹200 off on shopping above ₹999</p>
                </div>

                <div
                  className="ss-quick-coupon-item"
                  onClick={() => handleApplyCoupon("SPHERE10")}
                >
                  <div className="ss-qc-top">
                    <strong>SPHERE10</strong>
                    <span className="ss-qc-badge">10% OFF</span>
                  </div>
                  <p>Extra 10% instant discount across catalog</p>
                </div>
                {[
                  ["SAVE100", "₹100 OFF", "Everyday savings on your order"],
                  ["STYLE15", "15% OFF", "A fresh offer for your next look"],
                  ["GLOW12", "12% OFF", "A treat for your beauty picks"],
                  ["HOME250", "₹250 OFF", "Save on your home refresh"],
                  ["TECH8", "8% OFF", "A little extra off your tech"],
                  ["FASHION150", "₹150 OFF", "Extra savings on your next look"],
                  ["FESTIVE18", "18% OFF", "Celebrate your next great find"],
                ].map(([code, offer, detail]) => (
                  <button type="button" className="ss-quick-coupon-item" key={code} onClick={() => handleApplyCoupon(code)}>
                    <div className="ss-qc-top"><strong>{code}</strong><span className="ss-qc-badge">{offer}</span></div>
                    <p>{detail}</p>
                  </button>
                ))}
              </div>}
            </section>

            {/* Extra Options: Gifting & Donation */}
            <div className="ss-card ss-extras-card">
              <label className="ss-extra-checkbox-row">
                <input
                  type="checkbox"
                  className="ss-custom-checkbox"
                  checked={giftWrap}
                  onChange={(e) => setGiftWrap(e.target.checked)}
                />
                <Gift size={18} className="ss-extra-icon" />
                <div className="ss-extra-text-wrap">
                  <span className="ss-extra-title">
                    Gift wrap and personalized greeting card
                  </span>
                  <span className="ss-extra-price">+₹25</span>
                </div>
              </label>

              <label className="ss-extra-checkbox-row">
                <input
                  type="checkbox"
                  className="ss-custom-checkbox"
                  checked={donate}
                  onChange={(e) => setDonate(e.target.checked)}
                />
                <HeartHandshake size={18} className="ss-extra-icon" />
                <div className="ss-extra-text-wrap">
                  <span className="ss-extra-title">
                    Support underprivileged children education
                  </span>
                  <span className="ss-extra-price">+₹10</span>
                </div>
              </label>
            </div>

            {/* Price Details Breakdown */}
            <section className="ss-card ss-price-summary-card" aria-label="Price Details">
              <h3 className="ss-summary-title">
                PRICE DETAILS ({selectedItems.length} {selectedItems.length === 1 ? "Item" : "Items"})
              </h3>

              <div className="ss-price-line">
                <span className="ss-line-label">Total MRP</span>
                <span className="ss-line-val">₹{totalMRP.toLocaleString("en-IN")}</span>
              </div>

              <div className="ss-price-line">
                <span className="ss-line-label">Discount on MRP</span>
                <span className="ss-line-val text-emerald">
                  −₹{discountOnMRP.toLocaleString("en-IN")}
                </span>
              </div>

              {couponDiscount > 0 && (
                <div className="ss-price-line">
                  <span className="ss-line-label">Coupon Discount ({appliedCoupon.code})</span>
                  <span className="ss-line-val text-emerald">
                    −₹{couponDiscount.toLocaleString("en-IN")}
                  </span>
                </div>
              )}

              {giftWrap && (
                <div className="ss-price-line">
                  <span className="ss-line-label">Gift Packaging</span>
                  <span className="ss-line-val">₹25</span>
                </div>
              )}

              {donate && (
                <div className="ss-price-line">
                  <span className="ss-line-label">Social Donation</span>
                  <span className="ss-line-val">₹10</span>
                </div>
              )}

              <div className="ss-price-line">
                <span className="ss-line-label">Platform Fee</span>
                <span className="ss-line-val">
                  <s className="ss-strike-price">₹20</s>
                  <span className="text-emerald">FREE</span>
                </span>
              </div>

              <div className="ss-price-line">
                <span className="ss-line-label">Shipping Charges</span>
                <span className="ss-line-val">
                  <s className="ss-strike-price">₹79</s>
                  <span className="text-emerald">FREE</span>
                </span>
              </div>

              <div className="ss-summary-divider" />

              {/* Total Payable Row */}
              <div className="ss-total-payable-row">
                <div className="ss-tp-left">
                  <span className="ss-tp-title">Total Amount</span>
                  <span className="ss-tp-sub">Includes all applicable taxes</span>
                </div>
                <div className="ss-tp-amount">
                  ₹{finalPayable.toLocaleString("en-IN")}
                </div>
              </div>

              {/* Savings callout banner */}
              {totalSavings > 0 && (
                <div className="ss-savings-banner">
                  <Sparkles size={16} />
                  <span>
                    🎉 You are saving <strong>₹{totalSavings.toLocaleString("en-IN")}</strong> on this order!
                  </span>
                </div>
              )}

              {/* Primary Direct Order Placement Button */}
              <button
                type="button"
                className="ss-btn-place-order"
                disabled={selectedItems.length === 0}
                onClick={() => setPaymentModalOpen(true)}
              >
                <span>PROCEED TO PAYMENT</span>
                <span className="ss-po-divider">•</span>
                <span>₹{finalPayable.toLocaleString("en-IN")}</span>
                <ArrowRight size={18} className="ss-po-arrow" />
              </button>
            </section>

            {/* Safe & Secure Assurances */}
            <div className="ss-guarantee-box">
              <ShieldCheck size={20} className="ss-gb-icon" />
              <div className="ss-gb-text">
                <strong>Safe &amp; Secure Checkout</strong>
                <p>100% Payment Protection &amp; Instant Refunds Guarantee</p>
              </div>
            </div>
          </aside>
        </div>
      </main>

      {renderFooter()}

      {/* ========================================================
          MODAL: DIRECT PAYMENT & ORDER CONFIRMATION
         ======================================================== */}
      {paymentModalOpen && (
        <div
          className="ss-modal-overlay"
          onClick={() => !isPlacingOrder && setPaymentModalOpen(false)}
        >
          <div
            className="ss-modal ss-payment-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ss-modal-header">
              <div className="ss-pm-header-title">
                <CreditCard size={22} className="text-blue" />
                <h3>Choose Payment Method</h3>
              </div>
              <button
                type="button"
                className="ss-modal-close-btn"
                onClick={() => !isPlacingOrder && setPaymentModalOpen(false)}
                disabled={isPlacingOrder}
              >
                ✕
              </button>
            </div>

            <div className="ss-modal-body">
              {/* Order total header */}
              <div className="ss-pm-summary-banner">
                <div>
                  <span className="ss-pm-amount-label">Amount Payable:</span>
                  <strong className="ss-pm-amount-num">
                    ₹{finalPayable.toLocaleString("en-IN")}
                  </strong>
                </div>
                <div className="ss-pm-delivery-pill">
                  <Truck size={14} />
                  <span>Deliver to {address.fullName} ({address.postalCode})</span>
                </div>
              </div>

              {orderError && (
                <div className="ss-payment-error-alert">
                  <AlertCircle size={16} />
                  <span>{orderError}</span>
                </div>
              )}
              <div className="ss-payment-details">
                <ShieldCheck size={19} />
                <p>Pay securely with Razorpay. Your order is confirmed after the server verifies the payment.</p>
              </div>

              {/* Confirm & Place Order CTA */}
              <div className="ss-pm-footer">
                <button
                  type="button"
                  className="ss-btn-confirm-order"
                  onClick={handleConfirmAndPay}
                  disabled={isPlacingOrder}
                >
                  {isPlacingOrder ? (
                    <span>Connecting to Razorpay...</span>
                  ) : (
                    <>
                      <ShieldCheck size={20} />
                      <span>Continue to Razorpay - INR {finalPayable.toLocaleString("en-IN")}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: EDIT DELIVERY ADDRESS
         ======================================================== */}
      {addressModalOpen && (
        <div
          className="ss-modal-overlay"
          onClick={() => setAddressModalOpen(false)}
        >
          <div className="ss-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ss-modal-header">
              <h3>Change Delivery Address</h3>
              <button
                type="button"
                className="ss-modal-close-btn"
                onClick={() => setAddressModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveAddress} className="ss-modal-form">
              <label>
                Full Name
                <input
                  type="text"
                  required
                  value={tempAddress.fullName}
                  onChange={(e) =>
                    setTempAddress({ ...tempAddress, fullName: e.target.value })
                  }
                />
              </label>

              <label>
                Mobile Number
                <input
                  type="tel"
                  required
                  pattern="[0-9]{10}"
                  title="10-digit mobile number"
                  value={tempAddress.phone}
                  onChange={(e) =>
                    setTempAddress({ ...tempAddress, phone: e.target.value })
                  }
                />
              </label>

              <label>
                Street Address, Flat / House No., Locality
                <textarea
                  rows="2"
                  required
                  value={tempAddress.street}
                  onChange={(e) =>
                    setTempAddress({ ...tempAddress, street: e.target.value })
                  }
                />
              </label>

              <div className="ss-form-row">
                <label>
                  City
                  <input
                    type="text"
                    required
                    value={tempAddress.city}
                    onChange={(e) =>
                      setTempAddress({ ...tempAddress, city: e.target.value })
                    }
                  />
                </label>

                <label>
                  State
                  <input
                    type="text"
                    required
                    value={tempAddress.state}
                    onChange={(e) =>
                      setTempAddress({ ...tempAddress, state: e.target.value })
                    }
                  />
                </label>

                <label>
                  PIN Code
                  <input
                    type="text"
                    required
                    pattern="[0-9]{6}"
                    title="6-digit PIN code"
                    value={tempAddress.postalCode}
                    onChange={(e) =>
                      setTempAddress({
                        ...tempAddress,
                        postalCode: e.target.value,
                      })
                    }
                  />
                </label>
              </div>

              <div className="ss-modal-actions">
                <button
                  type="button"
                  className="ss-btn-modal-cancel"
                  onClick={() => setAddressModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="ss-btn-modal-save">
                  Save &amp; Deliver Here
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: SIZE SELECTOR
         ======================================================== */}
      {sizeModalItem && (
        <div
          className="ss-modal-overlay"
          onClick={() => setSizeModalItem(null)}
        >
          <div className="ss-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ss-modal-header">
              <h3>Select Size for {sizeModalItem.name}</h3>
              <button
                type="button"
                className="ss-modal-close-btn"
                onClick={() => setSizeModalItem(null)}
              >
                ✕
              </button>
            </div>
            <div className="ss-modal-body">
              <div className="ss-size-options-grid">
                {["XS", "S", "M", "L", "XL", "XXL", "Free Size"].map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    className={`ss-size-choice-btn ${
                      selectedModalSize === sz ? "active" : ""
                    }`}
                    onClick={() => setSelectedModalSize(sz)}
                  >
                    {sz}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="ss-btn-modal-save"
                style={{ width: "100%", marginTop: "16px" }}
                onClick={() => {
                  updateSize(sizeModalItem._id, selectedModalSize);
                  setSizeModalItem(null);
                }}
              >
                APPLY SIZE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: REMOVE CONFIRMATION
         ======================================================== */}
      {removeModalItem && (
        <div
          className="ss-modal-overlay"
          onClick={() => setRemoveModalItem(null)}
        >
          <div className="ss-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ss-modal-header">
              <h3>Remove from Bag</h3>
              <button
                type="button"
                className="ss-modal-close-btn"
                onClick={() => setRemoveModalItem(null)}
              >
                ✕
              </button>
            </div>
            <div className="ss-modal-body">
              <p style={{ margin: "0 0 16px", color: "#475569", fontSize: "14px" }}>
                Are you sure you want to remove <strong>{removeModalItem.name}</strong> from your bag?
              </p>
              <div className="ss-modal-actions">
                <button
                  type="button"
                  className="ss-btn-modal-cancel"
                  onClick={() => {
                    handleMoveToWishlist(removeModalItem);
                  }}
                >
                  Move to Wishlist
                </button>
                <button
                  type="button"
                  className="ss-btn-modal-delete"
                  onClick={() => {
                    removeFromCart(removeModalItem._id);
                    setRemoveModalItem(null);
                  }}
                >
                  Remove Item
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

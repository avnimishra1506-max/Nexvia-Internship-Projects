import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import Footer from "./components/Footer.jsx";
import { CartProvider } from "./context/CartContext.jsx";
import Home from "./pages/Home.jsx";
import Cart from "./pages/Cart.jsx";
import Checkout from "./pages/Checkout.tsx";
import OrderSuccess from "./pages/OrderSuccess.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import ProductDetails from "./pages/ProductDetails.jsx";
import Wishlist from "./pages/Wishlist.jsx";
import Profile from "./pages/Profile.jsx";
import MyOrders from "./pages/MyOrders.jsx";
import NotificationPreferences from "./pages/NotificationPreferences.jsx";
import CustomerCare from "./pages/CustomerCare.jsx";
import BecomeSeller from "./pages/BecomeSeller.jsx";
const AdminDashboard = lazy(() => import("./pages/AdminDashboard.jsx"));
import PolicyPage from "./pages/PolicyPage.jsx";
import { ManageAddresses, MyCoupons, MyReviews, ProfileSettings } from "./pages/AccountPages.jsx";
import VendorDashboard from "./pages/VendorDashboard.jsx";

function VendorOnly({ children }) {
  let user = null;
  try { user = JSON.parse(sessionStorage.getItem("user") || "null"); } catch { user = null; }
  if (!sessionStorage.getItem("token") || !user) return <Navigate to="/login" state={{ from: "/vendor" }} replace />;
  if (user.role !== "VENDOR" || user.vendorStatus !== "APPROVED") return <Navigate to="/become-seller" replace />;
  return children;
}

function AdminOnly({ children }) {
  let user = null;
  try { user = JSON.parse(sessionStorage.getItem("user") || "null"); } catch { user = null; }
  if (!sessionStorage.getItem("token") || !user) return <Navigate to="/login" state={{ from: "/admin" }} replace />;
  if (user.role !== "ADMIN") return <Navigate to="/" replace />;
  return children;
}

const policyRoutes = [
  ["/about-us", "about"], ["/payments", "payments"], ["/returns", "returns"],
  ["/terms-of-use", "terms"], ["/security", "security"], ["/privacy", "privacy"],
  ["/grievance-redressal", "grievance"], ["/epr-compliance", "epr"],
];

export default function App() {
  return <BrowserRouter><CartProvider>
    <div className="shopping-sphere-app">
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/products" element={<Home />} />
        <Route path="/products/:id" element={<ProductDetails />} />
        <Route path="/product/:id" element={<ProductDetails />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/order-success" element={<OrderSuccess />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/wishlist" element={<Wishlist />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/my-orders" element={<MyOrders />} />
        <Route path="/notification-preferences" element={<NotificationPreferences />} />
        <Route path="/customer-care" element={<CustomerCare />} />
        <Route path="/help-center" element={<CustomerCare />} />
        <Route path="/become-seller" element={<BecomeSeller />} />
        <Route path="/admin" element={<AdminOnly><Suspense fallback={<div className="p-8 text-center">Loading admin dashboard…</div>}><AdminDashboard /></Suspense></AdminOnly>} />
        <Route path="/vendor" element={<VendorOnly><VendorDashboard /></VendorOnly>} />
        <Route path="/profile-settings" element={<ProfileSettings />} />
        <Route path="/manage-addresses" element={<ManageAddresses />} />
        <Route path="/coupons" element={<MyCoupons />} />
        <Route path="/my-reviews" element={<MyReviews />} />
        {policyRoutes.map(([path, page]) => <Route key={path} path={path} element={<PolicyPage page={page} />} />)}
        <Route path="*" element={<Home />} />
      </Routes>
      <Footer />
    </div>
  </CartProvider></BrowserRouter>;
}

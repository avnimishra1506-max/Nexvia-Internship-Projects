import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ShoppingBag, Search, ChevronDown, Store, MoreHorizontal, Menu, LogOut } from "lucide-react";
import { useCart } from "../context/CartContext.jsx";
import "./Navbar.css";

const categories = ["All", "Electronics", "Fashion", "Home and kitchen", "Beauty", "Books", "Sports", "Today's deals"];
export default function Navbar() {
  const navigate = useNavigate();
  const { cartCount } = useCart();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const user = (() => { try { return JSON.parse(sessionStorage.getItem("user") || "null"); } catch { return null; } })();
  const search = (event) => { event.preventDefault(); const p = new URLSearchParams(); if (query.trim()) p.set("search", query.trim()); if (category !== "All") p.set("category", category); navigate(`/products?${p}`); };
  const logout = () => { sessionStorage.removeItem("token"); sessionStorage.removeItem("user"); window.dispatchEvent(new Event("shoppingSphereAuthChanged")); navigate("/"); };
  const dashboard = user?.role === "ADMIN" ? ["Admin dashboard", "/admin"] : user?.role === "VENDOR" ? ["Vendor dashboard", "/vendor"] : null;
  return <header className="ss-header">
    <div className="ss-navbar">
      <button className="ss-mobile-menu" aria-label="Browse categories" onClick={() => navigate("/products")}><Menu size={19}/></button>
      <Link to="/" className="ss-brand"><span className="ss-brand-icon"><ShoppingBag size={22}/></span><span>ShopSphere</span></Link>
      <form className="ss-search" onSubmit={search}>
        <label className="ss-search-category"><select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Search category">{categories.slice(0, -1).map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={14}/></label>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search products, brands and vendors" aria-label="Search products"/>
        <button aria-label="Search"><Search size={20}/></button>
      </form>
      <div className="ss-header-actions">
        {user ? <Link className="ss-account" to={dashboard?.[1] || "/profile"}><span>Hello, {user.name?.split(" ")[0] || "there"}</span><b>{dashboard?.[0] || "Account"}</b></Link> : <Link className="ss-account" to="/login"><span>Hello, sign in</span><b>Account</b></Link>}
        {user?.role !== "VENDOR" && user?.role !== "ADMIN" && <Link className="ss-orders" to="/my-orders"><span>Returns</span><b>Orders</b></Link>}
        <Link className="ss-cart-link" to="/cart" aria-label={`Cart, ${cartCount} items`}><ShoppingBag size={21}/><span>Cart</span>{cartCount > 0 && <i>{cartCount}</i>}</Link>
        {dashboard && <Link className="ss-dashboard-link" to={dashboard[1]}><Store size={18}/><span>{dashboard[0]}</span></Link>}
        {user ? <button type="button" className="ss-more" onClick={logout} aria-label="Sign out"><LogOut size={19}/></button> : <Link className="ss-more" to="/login" aria-label="More account options"><MoreHorizontal size={23}/></Link>}
      </div>
    </div>
    <nav className="ss-category-bar" aria-label="Shop categories">{categories.map((item) => <Link key={item} className={item === "Today's deals" ? "ss-deals-link" : ""} to={item === "Today's deals" ? "/products?sort=price_asc" : item === "All" ? "/products" : `/products?category=${encodeURIComponent(item)}`}>{item === "All" && <Menu size={16}/>} {item}</Link>)}</nav>
  </header>;
}

import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  Bell, ChevronRight, CircleHelp, Heart, LogOut, MapPin, Package,
  Settings2, Star, Tag, Truck, UserRound,
} from "lucide-react";
import "./AccountLayout.css";

const groups = [
  {
    title: "My orders",
    links: [{ to: "/my-orders", label: "Orders & tracking", icon: Package }],
  },
  {
    title: "Account settings",
    links: [
      { to: "/profile-settings", label: "Profile settings", icon: UserRound },
      { to: "/manage-addresses", label: "Manage addresses", icon: MapPin },
    ],
  },
  {
    title: "Rewards & activity",
    links: [
      { to: "/coupons", label: "My coupons", icon: Tag },
      { to: "/wishlist", label: "Wishlist", icon: Heart },
      { to: "/my-reviews", label: "Reviews & ratings", icon: Star },
      { to: "/notification-preferences", label: "Notifications", icon: Bell },
    ],
  },
  {
    title: "Help & support",
    links: [
      { to: "/my-orders", label: "Track an order", icon: Truck },
      { to: "/customer-care", label: "Help center", icon: CircleHelp },
    ],
  },
];

export default function AccountLayout() {
  const navigate = useNavigate();
  const [user, setUser] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem("user") || "null"); } catch { return null; }
  });

  useEffect(() => {
    function syncUser() {
      try { setUser(JSON.parse(sessionStorage.getItem("user") || "null")); } catch { setUser(null); }
    }
    window.addEventListener("accountUserUpdated", syncUser);
    return () => window.removeEventListener("accountUserUpdated", syncUser);
  }, []);

  function logout() {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    navigate("/login", { replace: true });
  }

  return (
    <main className="account-area">
      <div className="account-area-shell">
        <aside className="account-sidebar" aria-label="Account navigation">
          <Link className="account-sidebar-user" to="/profile">
            <span className="account-sidebar-avatar">{(user?.name || "S").trim().charAt(0).toUpperCase()}</span>
            <span className="account-sidebar-identity"><small>Welcome back,</small><strong>{user?.name || "Shopper"}</strong><span>My ShoppingSphere <ChevronRight size={12} /></span></span>
          </Link>
          <nav className="account-sidebar-nav">
            {groups.map((group) => (
              <section className="account-sidebar-group" key={group.title}>
                <h2>{group.title}</h2>
                {group.links.map(({ to, label, icon: Icon }) => (
                  <NavLink key={`${to}-${label}`} to={to} className={({ isActive }) => `account-nav-link${isActive && label !== "Track an order" ? " is-active" : ""}`}>
                    <Icon size={16} strokeWidth={1.8} /><span>{label}</span><ChevronRight className="account-nav-chevron" size={14} />
                  </NavLink>
                ))}
              </section>
            ))}
          </nav>
          <button className="account-sidebar-logout" onClick={logout}><LogOut size={16} /> Sign out</button>
          <div className="account-sidebar-mark"><Settings2 size={14} /> Your space, your pace.</div>
        </aside>
        <div className="account-area-content"><Outlet /></div>
      </div>
    </main>
  );
}

import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Heart, ShoppingBag, X } from "lucide-react";
import { useCart } from "../context/CartContext.jsx";
import "./Wishlist.css";

export default function Wishlist() {
  const { addToCart } = useCart();

  // Load wishlist from localStorage strictly (defaults to empty array)
  const [wishlistItems, setWishlistItems] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("ssWishlist") || "[]");
      return Array.isArray(stored) ? stored : [];
    } catch {
      return [];
    }
  });

  const [addedMessage, setAddedMessage] = useState("");

  // Sync state if another tab or component updates wishlist
  useEffect(() => {
    function handleSync() {
      try {
        const stored = JSON.parse(localStorage.getItem("ssWishlist") || "[]");
        setWishlistItems(Array.isArray(stored) ? stored : []);
      } catch {
        setWishlistItems([]);
      }
    }

    window.addEventListener("wishlistUpdated", handleSync);
    window.addEventListener("storage", handleSync);
    return () => {
      window.removeEventListener("wishlistUpdated", handleSync);
      window.removeEventListener("storage", handleSync);
    };
  }, []);

  function removeFromWishlist(id) {
    const updated = wishlistItems.filter((item) => item._id !== id);
    setWishlistItems(updated);
    localStorage.setItem("ssWishlist", JSON.stringify(updated));
    window.dispatchEvent(new Event("wishlistUpdated"));
  }

  function handleMoveToBag(product) {
    addToCart(product);
    removeFromWishlist(product._id);
    setAddedMessage(`"${product.name}" moved to your bag!`);
    setTimeout(() => setAddedMessage(""), 3000);
  }

  return (
    <div className="wishlist-container">
      {addedMessage && (
        <div role="status" className="wishlist-alert-msg">
          {addedMessage}
        </div>
      )}

      {/* EMPTY WISHLIST STATE */}
      {wishlistItems.length === 0 ? (
        <div className="wishlist-empty-wrapper">
          <div className="wishlist-empty-icon-wrap">
            <Heart size={44} strokeWidth={1.8} />
          </div>

          <h2 className="wishlist-empty-title">PLEASE LOG IN</h2>

          <p className="wishlist-empty-subtitle">
            Please log in to show items in your wishlist
          </p>

          <Link to="/login" className="wishlist-login-btn">
            LOGIN
          </Link>

          <Link to="/products" className="wishlist-continue-link">
            Explore All Products →
          </Link>
        </div>
      ) : (
        /* POPULATED WISHLIST GRID */
        <>
          <div className="wishlist-header">
            <h1>My Wishlist</h1>
            <span>
              {wishlistItems.length} {wishlistItems.length === 1 ? "item" : "items"}
            </span>
          </div>

          <div className="wishlist-grid">
          {wishlistItems.map((item) => {
            const discountPercent =
              item.mrp && item.mrp > item.price
                ? Math.round(((item.mrp - item.price) / item.mrp) * 100)
                : null;

            return (
              <div key={item._id} className="wishlist-card">
                <div className="wishlist-card-img-wrap">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="wishlist-card-img"
                    loading="lazy"
                    onError={(e) => {
                      if (
                        item.fallbackImage &&
                        e.currentTarget.src !== item.fallbackImage
                      ) {
                        e.currentTarget.src = item.fallbackImage;
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="wishlist-remove-btn"
                    onClick={() => removeFromWishlist(item._id)}
                    title="Remove item"
                    aria-label="Remove item"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="wishlist-card-info">
                  <h3 className="wishlist-item-title" title={item.name}>
                    {item.name}
                  </h3>
                  <p className="wishlist-item-category">
                    {item.brand ? <strong>{item.brand} • </strong> : null}
                    {item.category}
                    {item.subCategory ? ` / ${item.subCategory}` : ""}
                  </p>

                  <div className="wishlist-price-row">
                    <span className="wishlist-price">
                      ₹{Number(item.price).toLocaleString("en-IN")}
                    </span>
                    {item.mrp && (
                      <span className="wishlist-mrp">
                        ₹{Number(item.mrp).toLocaleString("en-IN")}
                      </span>
                    )}
                    {discountPercent && (
                      <span className="wishlist-discount">
                        ({discountPercent}% OFF)
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  className="wishlist-move-btn"
                  onClick={() => handleMoveToBag(item)}
                >
                  <ShoppingBag size={16} /> MOVE TO BAG
                </button>
              </div>
            );
          })}
        </div>
        </>
      )}
    </div>
  );
}

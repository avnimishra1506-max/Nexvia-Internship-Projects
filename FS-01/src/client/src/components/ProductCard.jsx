import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ShoppingCart, Star, Heart } from "lucide-react";

export default function ProductCard({ product, onAddToCart }) {
  const [isWishlisted, setIsWishlisted] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("ssWishlist") || "[]");
      return Array.isArray(stored) && stored.some((item) => item._id === product._id);
    } catch {
      return false;
    }
  });

  useEffect(() => {
    function syncWishlist() {
      try {
        const stored = JSON.parse(localStorage.getItem("ssWishlist") || "[]");
        if (Array.isArray(stored)) {
          setIsWishlisted(stored.some((item) => item._id === product._id));
        }
      } catch {
        // fallback
      }
    }

    window.addEventListener("wishlistUpdated", syncWishlist);
    window.addEventListener("storage", syncWishlist);
    return () => {
      window.removeEventListener("wishlistUpdated", syncWishlist);
      window.removeEventListener("storage", syncWishlist);
    };
  }, [product._id]);

  function handleToggleWishlist(e) {
    e.preventDefault();
    e.stopPropagation();
    try {
      const stored = JSON.parse(localStorage.getItem("ssWishlist") || "[]");
      const list = Array.isArray(stored) ? stored : [];
      let updated;
      if (isWishlisted) {
        updated = list.filter((item) => item._id !== product._id);
        setIsWishlisted(false);
      } else {
        updated = [...list, product];
        setIsWishlisted(true);
      }
      localStorage.setItem("ssWishlist", JSON.stringify(updated));
      window.dispatchEvent(new Event("wishlistUpdated"));
    } catch {
      // fallback
    }
  }

  return (
    <article className="product-card">
      <div className="product-image">
        <Link to={`/products/${product._id}`} aria-label={`View ${product.name}`}>
          <img
            src={product.image}
            alt={product.name}
            loading="lazy"
            onError={(e) => {
              e.currentTarget.onerror = null;
              if (product.fallbackImage && e.currentTarget.src !== product.fallbackImage) {
                e.currentTarget.src = product.fallbackImage;
              }
            }}
          />
        </Link>
        <button
          type="button"
          className="product-card-wishlist-btn"
          onClick={handleToggleWishlist}
          title={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
          aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
        >
          <Heart
            size={17}
            fill={isWishlisted ? "#ff3f6c" : "none"}
            color={isWishlisted ? "#ff3f6c" : "#282c3f"}
          />
        </button>
      </div>

      <div className="rating">
        <Star size={15} fill="currentColor" />
        {product.rating} <span>({product.reviews} reviews)</span>
      </div>

      <Link to={`/products/${product._id}`}>
        <h3>{product.name}</h3>
      </Link>
      
      <p className="vendor-name">Sold by {product.vendor}</p>
      <p className="product-price">
        ₹{Number(product.price).toLocaleString("en-IN")}
        {Number(product.mrp) > Number(product.price) && (
          <>
            <span className="product-mrp">
              ₹{Number(product.mrp).toLocaleString("en-IN")}
            </span>
            <span className="product-off">
              {Math.round(
                ((Number(product.mrp) - Number(product.price)) /
                  Number(product.mrp)) *
                  100
              )}
              % OFF
            </span>
          </>
        )}
      </p>
      <p className="product-stock">{Number(product.stock) > 0 ? `${product.stock} in stock` : "Currently unavailable"}</p>

      <button
        className="add-button"
        type="button"
        disabled={Number(product.stock) < 1}
        onClick={() => onAddToCart(product)}
      >
        <ShoppingCart size={17} />
        {Number(product.stock) > 0 ? "Add to cart" : "Out of stock"}
      </button>
    </article>
  );
}

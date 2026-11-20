import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Heart, ShoppingBag, Star } from "lucide-react";
import { getProducts } from "../services/api.js";
import { useCart } from "../context/CartContext.jsx";
import ProductCard from "../components/ProductCard.jsx";
import "./ProductDetails.css";

const APPAREL_SIZE_ORDER = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "2XL", "3XL", "4XL", "5XL"];
const COLOR_WORDS = "fluorescent green|turquoise blue|coffee brown|camel brown|grey melange|sea green|rose gold|off white|navy blue|lime green|olive green|black|white|blue|red|pink|green|yellow|beige|brown|cream|purple|maroon|grey|gray|orange|teal|gold|silver|mustard|peach|mauve|bronze|burgundy|champagne|charcoal|copper|coral|fuchsia|khaki|lavender|magenta|nude|olive|rose|rust|tan|taupe|violet|turquoise|assorted|multi|metallic|transparent";

function sortSizes(sizes = []) {
  return [...sizes].sort((left, right) => {
    const leftNumber = Number.parseFloat(left);
    const rightNumber = Number.parseFloat(right);
    if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) return leftNumber - rightNumber;
    const leftIndex = APPAREL_SIZE_ORDER.indexOf(String(left).toUpperCase());
    const rightIndex = APPAREL_SIZE_ORDER.indexOf(String(right).toUpperCase());
    if (leftIndex >= 0 && rightIndex >= 0) return leftIndex - rightIndex;
    return String(left).localeCompare(String(right), undefined, { numeric: true });
  });
}

function getVariantName(name = "") {
  return name.toLowerCase().replace(new RegExp(`\\b(?:${COLOR_WORDS})\\b`, "g"), " ").replace(/[^a-z0-9]+/g, " ").trim();
}

function getColorSwatch(color = "") {
  const normalized = color.toLowerCase().trim();
  const colors = {
    "navy blue": "#243b67", "olive green": "#71804a", "lime green": "#9bc53d",
    "sea green": "#2e8b72", "fluorescent green": "#7fff00", "turquoise blue": "#35a9c2",
    "off white": "#f7f3e8", "grey melange": "#a4a4a4", "camel brown": "#b77945",
    "coffee brown": "#594033", "rose gold": "#b76e79", beige: "#d8c3a5",
    black: "#222222", white: "#ffffff", blue: "#3974b8", red: "#cf3434",
    pink: "#e783a8", green: "#478755", yellow: "#e6c340", brown: "#805239",
    cream: "#f2e8ce", purple: "#8052a0", maroon: "#762e42", grey: "#929292",
    gray: "#929292", orange: "#e88736", teal: "#318b89", gold: "#c4a04d",
    silver: "#bfc2c5", mustard: "#c79b24", peach: "#efa98f", mauve: "#ad879d",
    bronze: "#a97142", burgundy: "#702d40", champagne: "#dfcda8", charcoal: "#464646",
    copper: "#b87333", coral: "#f08080", fuchsia: "#d13b9b", khaki: "#b7a77a",
    lavender: "#b6a0d2", magenta: "#c13b88", nude: "#d2a98e", olive: "#7b803e",
    rose: "#cc7888", rust: "#a54f32", tan: "#c49a6c", taupe: "#8c8178",
    violet: "#784aa0", turquoise: "#35a9a0", assorted: "#a49a8d", multi: "conic-gradient(#e45b5b, #e8c44b, #4d9c69, #4779c5, #a75db4, #e45b5b)",
    metallic: "linear-gradient(135deg, #aaa, #eee, #777)", transparent: "#f5f5f5",
  };
  return colors[normalized] || "#888888";
}

function getProductViews(product) {
  const primary = product.image || product.fallbackImage || "";
  const supplied = [product.galleryImages, product.images, product.imageUrls]
    .find((images) => Array.isArray(images) && images.length)
    ?.map((image) => typeof image === "string" ? image : image?.url)
    .filter(Boolean) || [];
  // Render only distinct, supplied images. Never fake extra angles with crops.
  return [...new Set([...supplied, primary].filter(Boolean))].slice(0, 5);
}

export default function ProductDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { cartItems, addToCart } = useCart();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [selectedSize, setSelectedSize] = useState("");
  const [failedGalleryImages, setFailedGalleryImages] = useState([]);
  const [customerReviews, setCustomerReviews] = useState([]);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewMessage, setReviewMessage] = useState("");
  const recommendationsRef = useRef(null);

  function scrollRecommendations(direction) {
    const track = recommendationsRef.current;
    if (track) track.scrollBy({ left: track.clientWidth * 0.8 * direction, behavior: "smooth" });
  }

  async function submitReview(event) {
    event.preventDefault();
    const token = sessionStorage.getItem("token");
    if (!token) { navigate("/login"); return; }
    setReviewMessage("");
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/reviews/product/${id}`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ rating: reviewRating, comment: reviewComment }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not submit your review.");
      setCustomerReviews((reviews) => [data, ...reviews]); setReviewComment(""); setReviewMessage("Thanks for sharing your review.");
    } catch (err) { setReviewMessage(err.message); }
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    getProducts()
      .then((items) => {
        if (active) setProducts(items);
      })
      .catch(() => {
        if (active) setError("Could not load product. Check your backend.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [id]);

  useEffect(() => {
    let active = true;
    fetch(`${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/reviews/product/${id}`)
      .then((response) => response.ok ? response.json() : [])
      .then((reviews) => { if (active) setCustomerReviews(Array.isArray(reviews) ? reviews : []); })
      .catch(() => { if (active) setCustomerReviews([]); });
    return () => { active = false; };
  }, [id]);

  const product = products.find((item) => String(item._id) === id);
  const sizes = sortSizes(product?.sizes);
  const colorVariants = product?.color
    ? products.filter((item) => item.color && item.category === product.category
      && item.subCategory === product.subCategory && item.brand === product.brand
      && getVariantName(item.name) === getVariantName(product.name))
      .filter((item, index, variants) => variants.findIndex((variant) => variant.color === item.color) === index)
      .sort((left, right) => Number(right._id === product._id) - Number(left._id === product._id))
      .slice(0, 5)
    : [];
  const productViews = product ? getProductViews(product).filter((src) => !failedGalleryImages.includes(src)) : [];
  const recommendations = useMemo(() => {
    if (!product) return [];
    const rankedProducts = products
      .filter((item) => String(item._id) !== id)
      .map((item) => ({
        item,
        score: (item.subCategory && item.subCategory === product.subCategory ? 3 : 0)
          + (item.category === product.category ? 2 : 0)
          + (item.sectionTitle && item.sectionTitle === product.sectionTitle ? 1 : 0),
      }))
      .sort((a, b) => b.score - a.score)
      .map(({ item }) => item);
    return rankedProducts.slice(0, 8);
  }, [id, product, products]);

  useEffect(() => {
    if (!product) return;
    setFailedGalleryImages([]);
    setSelectedSize(sortSizes(product.sizes)[0] || "");
    try {
      const stored = JSON.parse(localStorage.getItem("ssWishlist") || "[]");
      setIsWishlisted(Array.isArray(stored) && stored.some((item) => item._id === product._id));
    } catch {
      setIsWishlisted(false);
    }
  }, [product]);

  function handleToggleWishlist() {
    if (!product) return;
    try {
      const stored = JSON.parse(localStorage.getItem("ssWishlist") || "[]");
      const list = Array.isArray(stored) ? stored : [];
      const updated = isWishlisted
        ? list.filter((item) => item._id !== product._id)
        : [...list, product];
      localStorage.setItem("ssWishlist", JSON.stringify(updated));
      setIsWishlisted(!isWishlisted);
      window.dispatchEvent(new Event("wishlistUpdated"));
    } catch {
      // Keep the page usable if browser storage is unavailable.
    }
  }

  if (loading) return <p className="product-details-state">Loading product...</p>;
  if (error) return <p className="product-details-state">{error}</p>;
  if (!product) return <p className="product-details-state">Product not found.</p>;

  const rating = Number(product.rating) || 0;
  const reviewCount = Number(product.reviews) || 0;
  const selectedSizeIndex = Math.max(0, sizes.indexOf(selectedSize));
  const sizePriceIncrement = 20;
  const selectedPrice = Number(product.price) + selectedSizeIndex * sizePriceIncrement;
  const selectedMrp = Number(product.mrp || product.price) + selectedSizeIndex * sizePriceIncrement;
  const discount = selectedMrp > selectedPrice
    ? Math.round(((selectedMrp - selectedPrice) / selectedMrp) * 100)
    : 0;

  return (
    <main className="product-details-page">
      <nav className="product-breadcrumb" aria-label="Breadcrumb">
        <Link to="/">Home</Link><span>/</span>
        {product.category && <><span>{product.category}</span><span>/</span></>}
        <span>{product.subCategory || product.name}</span>
      </nav>

      <section className="product-details">
        <div className={`product-details-visual gallery-count-${Math.min(productViews.length, 5)}`} aria-label={`${productViews.length} product images`}>
          {productViews.map((src, index) => (
            <div className="product-gallery-tile" key={src}>
              <img src={src} alt={`${product.name} product view ${index + 1}`} className="product-details-image"
                onError={() => setFailedGalleryImages((current) => current.includes(src) ? current : [...current, src])} />
            </div>
          ))}
          {productViews.length === 0 && <div className="product-gallery-empty">Product image unavailable</div>}
        </div>

        <div className="product-details-info">
          <p className="product-details-brand">{product.brand || product.vendor}</p>
          <h1>{product.name}</h1>
          <p className="product-details-subtitle">{product.subCategory || product.category}</p>

          <div className="product-details-rating" aria-label={`${rating} out of 5 stars, ${reviewCount} reviews`}>
            <span className="product-rating-score"><Star size={16} fill="currentColor" />{rating.toFixed(1)}</span>
            <span>{reviewCount.toLocaleString("en-IN")} ratings &amp; reviews</span>
          </div>

          <div className="product-details-price">
            <strong>{"\u20B9"}{selectedPrice.toLocaleString("en-IN")}</strong>
            {selectedMrp > selectedPrice && <del>{"\u20B9"}{selectedMrp.toLocaleString("en-IN")}</del>}
            {discount > 0 && <span>{discount}% off</span>}
          </div>
          <p className={`product-stock ${product.stock > 0 ? "in-stock" : "out-of-stock"}`}>
            {product.stock > 0 ? `${product.stock} in stock` : "Currently out of stock"}
          </p>

          {product.sizes?.length > 0 && (
            <fieldset className="product-option-group">
              <legend>Select size <span>{selectedSize ? `· ${selectedSize}` : ""}</span></legend>
              <div className="product-size-options">
                {sizes.map((size, index) => (
                  <button key={size} type="button" className={selectedSize === size ? "is-selected" : ""}
                    aria-pressed={selectedSize === size} onClick={() => setSelectedSize(size)}>
                    <strong>{size}</strong><span>{"\u20B9"}{(Number(product.price) + index * sizePriceIncrement).toLocaleString("en-IN")}</span>
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          {colorVariants.length > 0 && (
            <fieldset className="product-option-group">
              <legend>Colour <span>· {product.color}</span></legend>
              <div className="product-color-options">
                {colorVariants.map((variant) => (
                  <button key={variant._id} type="button"
                    className={`product-color-option${variant._id === product._id ? " is-selected" : ""}`}
                    aria-label={`Select ${variant.color} colour`} aria-pressed={variant._id === product._id}
                    title={variant.color}
                    onClick={() => navigate(`/products/${variant._id}`)}>
                    <span className="product-color-swatch" style={{ background: getColorSwatch(variant.color) }} />
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          <div className="product-details-actions">
            {cartItems?.some((item) => item._id === product._id) ? (
              <button
                type="button"
                className="product-add-button product-go-to-bag"
                style={{ background: "#2563eb", color: "#fff" }}
                onClick={() => navigate("/cart")}
              >
                <ShoppingBag size={18} /> GO TO BAG &rarr;
              </button>
            ) : (
              <button
                type="button"
                className="product-add-button"
                disabled={product.stock < 1 || (sizes.length > 0 && !selectedSize)}
                onClick={() => addToCart({ ...product, price: selectedPrice, mrp: selectedMrp, size: selectedSize, color: product.color })}
              >
                <ShoppingBag size={18} />{product.stock > 0 ? "Add to Bag" : "Out of Stock"}
              </button>
            )}
            <button type="button" className={`product-wishlist-button${isWishlisted ? " is-wishlisted" : ""}`} onClick={handleToggleWishlist}>
              <Heart size={18} fill={isWishlisted ? "currentColor" : "none"} />
              {isWishlisted ? "Wishlisted" : "Wishlist"}
            </button>
          </div>

          <div className="product-detail-block">
            <h2>Product details</h2>
            <p>{product.description || "No description is available for this product yet."}</p>
            <dl className="product-specifications">
              {product.brand && <div><dt>Brand</dt><dd>{product.brand}</dd></div>}
              {product.color && <div><dt>Colour</dt><dd>{product.color}</dd></div>}
              {product.category && <div><dt>Category</dt><dd>{product.category}</dd></div>}
              {product.sizes?.length > 0 && <div><dt>Available sizes</dt><dd>{product.sizes.join(", ")}</dd></div>}
              <div><dt>Sold by</dt><dd>{product.vendor || "ShoppingSphere"}</dd></div>
            </dl>
          </div>

          <section className="product-detail-block product-review-summary">
            <h2>Ratings &amp; reviews</h2>
            <div className="review-summary-content">
              <strong><Star size={20} fill="currentColor" />{rating.toFixed(1)} <span>/ 5</span></strong>
              <p>{reviewCount > 0
                ? `Based on ${reviewCount.toLocaleString("en-IN")} customer ${reviewCount === 1 ? "review" : "reviews"}.`
                : "No customer reviews yet."}</p>
            </div>
            {customerReviews.length > 0 && (
              <div className="customer-review-list">
                {customerReviews.slice(0, 6).map((review) => (
                  <article className="customer-review" key={review.id}>
                    <div className="customer-review-heading">
                      <strong>{review.user?.name || review.reviewerName || "Customer"}</strong>
                      <span><Star size={13} fill="currentColor" /> {review.rating}/5</span>
                    </div>
                    <p>{review.comment}</p>
                    <small>{review.date ? new Date(review.date).toLocaleDateString() : ""} · {review.source}</small>
                  </article>
                ))}
              </div>
            )}
            {sessionStorage.getItem("token") && <form className="customer-review-form" onSubmit={submitReview}><label>Write a review <select value={reviewRating} onChange={(event) => setReviewRating(Number(event.target.value))}>{[5,4,3,2,1].map((value) => <option key={value} value={value}>{value} stars</option>)}</select></label><textarea value={reviewComment} onChange={(event) => setReviewComment(event.target.value)} maxLength={1000} placeholder="Share your experience after delivery" required/><button type="submit">Submit review</button>{reviewMessage && <p>{reviewMessage}</p>}</form>}
          </section>
        </div>
      </section>

      {recommendations.length > 0 && (
        <section className="you-may-like-section">
          <div className="you-may-like-heading">
            <div><p>Picked for you</p><h2>You may also like</h2></div>
          </div>
          <div className="you-may-like-carousel">
            {recommendations.length > 4 && <button type="button" className="you-may-like-nav you-may-like-nav-prev" aria-label="Scroll recommendations left" onClick={() => scrollRecommendations(-1)}><ChevronLeft size={22} /></button>}
            <div className="you-may-like-grid" ref={recommendationsRef}>
            {recommendations.map((item) => <ProductCard key={item._id} product={item} onAddToCart={addToCart} />)}
            </div>
            {recommendations.length > 4 && <button type="button" className="you-may-like-nav you-may-like-nav-next" aria-label="Scroll recommendations right" onClick={() => scrollRecommendations(1)}><ChevronRight size={22} /></button>}
          </div>
        </section>
      )}
    </main>
  );
}

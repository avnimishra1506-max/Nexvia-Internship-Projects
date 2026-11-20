import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Copy, Check, Sparkles } from "lucide-react";
import ProductCard from "./ProductCard.jsx";
import {
  discountPercent,
  selectCollection,
} from "../data/homeCollections.js";
import "./HomeDashboard.css";

const SLIDE_META = [
  {
    id: "caprese",
    tone: "sale",
    kicker: "Bags & Accessories",
    brandName: "CAPRESE",
    title: "Handbags",
    subtitle: "Chic totes, satchels & luxury shoulder bags. Up to 60% off on trending styles.",
    discountBadge: "Min. 60% Off",
    cta: "+ Explore Handbags",
    image: "/caprese_bag.jpg",
    fallbackImage: "https://assets.myntassets.com/assets/images/2026/JUNE/17/tI6FjTvm_9c912a4819af49ada43595348979e464.jpg",
    href: "/products?search=bag",
  },
  {
    id: "libas",
    tone: "festive",
    kicker: "Ethnic Wear — Libas",
    brandName: "LIBAS",
    title: "Festive Kurtas",
    subtitle: "Rich embroidery, suit sets & festive silhouettes. 40–70% off on select styles.",
    discountBadge: "40 – 70% Off",
    cta: "+ Explore Libas",
    image: "https://assets.myntassets.com/assets/images/2026/OCTOBER/22/5e5f40a5b0e44364a268bd3269fb81e9.jpg",
    fallbackImage: "https://assets.myntassets.com/assets/images/2026/OCTOBER/22/5e5f40a5b0e44364a268bd3269fb81e9.jpg",
    href: "/products?search=libas",
  },
  {
    id: "palmonas",
    tone: "celebrity",
    kicker: "Demi-Fine Jewellery",
    brandName: "PALMONAS",
    title: "Gold Jewellery",
    subtitle: "Anti-tarnish 18K gold-plated chunky chains, rings & layering necklaces.",
    discountBadge: "Up to 50% Off",
    cta: "+ Explore Palmonas",
    image: "https://assets.myntassets.com/assets/images/2025/MARCH/12/C65empee_b587c673c656428d9ac2a03671910a3f.jpg",
    fallbackImage: "https://assets.myntassets.com/assets/images/2025/MARCH/12/C65empee_b587c673c656428d9ac2a03671910a3f.jpg",
    href: "/products?search=necklace",
  },
  {
    id: "sneakers",
    tone: "season",
    kicker: "Footwear — Puma & HRX",
    brandName: "PUMA & HRX",
    title: "Trending Sneakers",
    subtitle: "Chunky skate sneakers, retro trainers & court shoes in bold new colourways.",
    discountBadge: "Min. 55% Off",
    cta: "+ Explore Sneakers",
    image: "https://assets.myntassets.com/assets/images/2026/JULY/17/3kK7Oh2n_f6291ca1421c4245aa70a589409e30d5.jpg",
    fallbackImage: "https://assets.myntassets.com/assets/images/2026/JULY/17/3kK7Oh2n_f6291ca1421c4245aa70a589409e30d5.jpg",
    href: "/products?search=sneakers",
  },
  {
    id: "watches",
    tone: "sale",
    kicker: "Accessories — Titan & Fossil",
    brandName: "TITAN & FOSSIL",
    title: "Luxury Watches",
    subtitle: "Chronographs, analog dials & metallic mesh straps for every wrist.",
    discountBadge: "Up to 60% Off",
    cta: "+ Explore Watches",
    image: "https://assets.myntassets.com/assets/images/8353451/2019/6/19/a66114bd-a8f0-4994-9ef5-da3cf830a03c1560948332341-Mast--Harbour-Unisex-Silver-Toned-Analogue-Watch-MFB-PN-LB-7-1.jpg",
    fallbackImage: "https://assets.myntassets.com/assets/images/2026/OCTOBER/28/f0b6fb994145495eaf4cee02e69f55a6.jpg",
    href: "/products?search=watch",
  },
  {
    id: "beauty",
    tone: "celebrity",
    kicker: "Beauty — Maybelline & Swiss Beauty",
    brandName: "MAYBELLINE",
    title: "Makeup Essentials",
    subtitle: "Long-lasting liquid lipsticks, foundations & eye palettes. Flat 40% off.",
    discountBadge: "Flat 40% Off",
    cta: "+ Explore Beauty",
    image: "https://assets.myntassets.com/assets/images/2026/OCTOBER/16/6fe4f04e7ec544cbba5ffb3dde7ca169.jpg",
    fallbackImage: "https://assets.myntassets.com/assets/images/2026/APRIL/22/dcXN3llJ_0e6541e48be54d34b6525c0b28772559.jpg",
    href: "/products?search=lipstick",
  },
  {
    id: "festive",
    tone: "festive",
    kicker: "Festive Collection — Sangria & Manyavar",
    brandName: "SANGRIA & MANYAVAR",
    title: "Festive Sarees",
    subtitle: "Embroidered zari sarees, jacquard kurtas & silk sets for every celebration.",
    discountBadge: "Min. 60% Off",
    cta: "+ Explore Festive",
    image: "https://assets.myntassets.com/assets/images/2026/MAY/21/jGmMMLgb_1aab509aeecb4bc4969d5e277faa1698.jpg",
    fallbackImage: "https://assets.myntassets.com/assets/images/2026/JUNE/16/0xslhbKX_b6d71453463d47cfbecd586a0738d41d.jpg",
    href: "/products?collection=festive",
  }
];

const RAILS = [
  {
    key: "festive",
    title: "Festive Wears",
    subtitle: "Sarees, lehengas, kurtas and sherwanis picked for celebrations.",
  },
  {
    key: "trending",
    title: "Trending",
    subtitle: "Most-loved styles, ranked by ratings, reviews and live discounts.",
  },
  {
    key: "seasonal",
    title: "Seasonal Wears",
    subtitle: "Jackets, knits, coats and boots for the colder months.",
  },
];

export default function HomeDashboard({ products, loading, onAddToCart }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [copied, setCopied] = useState(false);
  const railRefs = useRef({});

  function scrollRail(key, direction) {
    const track = railRefs.current[key];
    if (!track) return;
    const firstCard = track.querySelector(".rail-card, .celebrity-card");
    const distance = firstCard ? firstCard.getBoundingClientRect().width + 16 : track.clientWidth * 0.8;
    track.scrollBy({ left: distance * 2 * direction, behavior: "smooth" });
  }

  function handleCopyCode(e) {
    e.preventDefault();
    e.stopPropagation();
    try {
      navigator.clipboard.writeText("SSPNEW");
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }

  const slides = SLIDE_META;

  const dealTiles = useMemo(
    () => selectCollection(products, "deals", 4),
    [products]
  );

  const rails = useMemo(
    () =>
      RAILS.map((rail) => ({
        ...rail,
        items: selectCollection(products, rail.key, 12),
      })),
    [products]
  );

  const celebrity = useMemo(
    () => selectCollection(products, "celebrity", 8),
    [products]
  );

  useEffect(() => {
    if (paused) return undefined;
    const timer = setInterval(() => {
      setActive((index) => (index + 1) % slides.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [paused, slides.length]);

  const current = slides[active];

  return (
    <>
      {/* 20% OFF Welcome Coupon Banner directly below Navbar */}
      <section className="ssp-welcome-offer-bar" aria-label="Special Welcome Offer">
        <div className="ssp-offer-container">
          <div className="ssp-offer-badge">
            <Sparkles size={16} className="ssp-sparkle-icon" />
            <span>WELCOME OFFER</span>
          </div>

          <div className="ssp-offer-main-content">
            <span className="ssp-offer-highlight">FLAT 20% OFF</span>
            <span className="ssp-offer-divider">•</span>
            <span className="ssp-offer-text">On Your Very First Order!</span>
          </div>

          <div className="ssp-coupon-pill-wrap">
            <span className="ssp-coupon-label">USE CODE:</span>
            <button
              type="button"
              className="ssp-coupon-copy-btn"
              onClick={handleCopyCode}
              title="Click to copy coupon code"
              aria-label="Copy coupon code SSPNEW"
            >
              <strong className="ssp-code-text">SSPNEW</strong>
              {copied ? (
                <span className="ssp-copied-tag">
                  <Check size={14} /> COPIED!
                </span>
              ) : (
                <Copy size={14} className="ssp-copy-icon" />
              )}
            </button>
          </div>

          <div className="ssp-tc-note">
            <span>*T&amp;C Apply</span>
          </div>
        </div>
      </section>

      <section
        className="offer-strip"
        aria-label="Offers and discounts"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div className={`offer-slide tone-${current.tone}`}>
          <Link to={current.href} className="offer-slide-link">
            {/* Left: Product Image */}
            <div className="offer-visual">
              {current.image && (
                <img
                  src={current.image}
                  alt={current.title}
                  className="offer-visual-img"
                  onError={(event) => {
                    event.currentTarget.onerror = null;
                    if (
                      current.fallbackImage &&
                      event.currentTarget.src !== current.fallbackImage
                    ) {
                      event.currentTarget.src = current.fallbackImage;
                    }
                  }}
                />
              )}
            </div>

            {/* Right: Copy */}
            <div className="offer-copy">
              <span className="offer-kicker">{current.kicker}</span>
              <h2 className="offer-title">{current.title}</h2>
              <p className="offer-subtitle">{current.subtitle}</p>
              <span className="offer-discount-badge">{current.discountBadge}</span>
              <span className="offer-cta">{current.cta}</span>
            </div>
          </Link>

          <button
            type="button"
            className="offer-nav offer-nav-prev"
            aria-label="Previous offer"
            onClick={() =>
              setActive((index) => (index - 1 + slides.length) % slides.length)
            }
          >
            <ChevronLeft size={22} />
          </button>
          <button
            type="button"
            className="offer-nav offer-nav-next"
            aria-label="Next offer"
            onClick={() => setActive((index) => (index + 1) % slides.length)}
          >
            <ChevronRight size={22} />
          </button>
        </div>
        <div className="offer-dots" role="tablist" aria-label="Offer slides">
          {slides.map((slide, index) => (
            <button
              key={slide.id}
              type="button"
              role="tab"
              aria-selected={index === active}
              aria-label={slide.categoryTitle}
              className={index === active ? "is-active" : ""}
              onClick={() => setActive(index)}
            />
          ))}
        </div>

        <div className="deal-row">
          {(dealTiles.length ? dealTiles : [0, 1, 2, 3]).map((product, index) =>
            product && product._id ? (
              <Link
                key={product._id}
                className="deal-tile"
                to={`/products/${product._id}`}
              >
                <img src={product.image} alt="" />
                <div>
                  <strong>
                    {discountPercent(product)
                      ? `${discountPercent(product)}% OFF`
                      : "DEAL"}
                  </strong>
                  <span>{product.brand}</span>
                  <em>{product.subCategory}</em>
                </div>
              </Link>
            ) : (
              <div key={index} className="deal-tile deal-tile-loading">
                <span>{loading ? "Loading offers…" : "Offers"}</span>
              </div>
            )
          )}
        </div>
      </section>

      <div className="dashboard-rails">
        {rails.map((rail) => (
          <section key={rail.key} className="style-rail" aria-label={rail.title}>
            <div className="style-rail-head">
              <div>
                <h2>{rail.title}</h2>
                <p>{rail.subtitle}</p>
              </div>
              <Link to={`/products?collection=${rail.key}`}>View all</Link>
            </div>
            {loading && <p className="rail-status">Loading products…</p>}
            {!loading && rail.items.length === 0 && (
              <p className="rail-status">No products in this edit yet.</p>
            )}
            <div className="rail-carousel">
              {rail.items.length > 3 && <button type="button" className="rail-nav rail-nav-prev" aria-label={`Scroll ${rail.title} left`} onClick={() => scrollRail(rail.key, -1)}><ChevronLeft size={22} /></button>}
              <div className="rail-track" ref={(element) => { railRefs.current[rail.key] = element; }}>
                {rail.items.map((product) => (
                  <div className="rail-card" key={product._id}>
                    {discountPercent(product) > 0 && (
                      <span className="rail-badge">
                        {discountPercent(product)}% OFF
                      </span>
                    )}
                    <ProductCard product={product} onAddToCart={onAddToCart} />
                  </div>
                ))}
              </div>
              {rail.items.length > 3 && <button type="button" className="rail-nav rail-nav-next" aria-label={`Scroll ${rail.title} right`} onClick={() => scrollRail(rail.key, 1)}><ChevronRight size={22} /></button>}
            </div>
          </section>
        ))}

        <section className="style-rail celebrity-rail" aria-label="Celebrity brands">
          <div className="style-rail-head">
            <div>
              <h2>Celebrity Brands</h2>
              <p>
                Product photos from labels already tied to their founders in
                this catalog: HRX by Hrithik Roshan, WROGN by Virat Kohli, and
                Kay Beauty by Katrina Kaif.
              </p>
            </div>
            <Link to="/products?collection=celebrity">View all</Link>
          </div>
          {loading && <p className="rail-status">Loading products…</p>}
          <div className="rail-carousel">
            {celebrity.length > 3 && <button type="button" className="rail-nav rail-nav-prev" aria-label="Scroll celebrity brands left" onClick={() => scrollRail("celebrity", -1)}><ChevronLeft size={22} /></button>}
            <div className="celebrity-track" ref={(element) => { railRefs.current.celebrity = element; }}>
            {celebrity.map((product) => {
              const off = discountPercent(product);
              return (
                <Link
                  key={product._id}
                  className="celebrity-card"
                  to={`/products/${product._id}`}
                >
                  <div className="celebrity-photo">
                    <img src={product.image} alt={product.name} />
                    <span>Celebrity label</span>
                  </div>
                  <div className="celebrity-meta">
                    <strong>{product.brand}</strong>
                    <em>{product.vendor}</em>
                    <p>{product.name}</p>
                    <div className="celebrity-price">
                      <b>₹{Number(product.price).toLocaleString("en-IN")}</b>
                      {off > 0 && (
                        <>
                          <s>₹{Number(product.mrp).toLocaleString("en-IN")}</s>
                          <span>{off}% OFF</span>
                        </>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
            </div>
            {celebrity.length > 3 && <button type="button" className="rail-nav rail-nav-next" aria-label="Scroll celebrity brands right" onClick={() => scrollRail("celebrity", 1)}><ChevronRight size={22} /></button>}
          </div>
        </section>
      </div>
    </>
  );
}

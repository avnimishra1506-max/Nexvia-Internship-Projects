
import {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useState,
} from "react";

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const apiBase = import.meta.env.VITE_API_URL || "http://localhost:5000";
  const [cartItems, setCartItems] = useState(() => {
    if (sessionStorage.getItem("token")) return [];
    try {
      const saved = JSON.parse(localStorage.getItem("shoppingCart")) || [];
      return saved.map((item) => ({
        ...item,
        selected: item.selected !== false,
        size: item.size || "M",
      }));
    } catch {
      return [];
    }
  });

  const [serverCartLoaded, setServerCartLoaded] = useState(false);
  const [authRevision, setAuthRevision] = useState(0);

  useEffect(() => {
    const sync = () => { setServerCartLoaded(false); setAuthRevision((revision) => revision + 1); };
    window.addEventListener("shoppingSphereAuthChanged", sync);
    return () => window.removeEventListener("shoppingSphereAuthChanged", sync);
  }, []);

  useEffect(() => {
    let active = true;
    const token = sessionStorage.getItem("token");
    if (!token) { setServerCartLoaded(true); return undefined; }
    fetch(`${apiBase}/api/cart`, { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (!active) return;
        if (Array.isArray(data?.items) && data.items.length) {
          setCartItems(data.items.map(({ product, quantity }) => ({ ...product, _id: product.id, image: product.imageUrl || "", quantity, selected: true, size: "M" })));
        }
      })
      .catch(() => {})
      .finally(() => { if (active) setServerCartLoaded(true); });
    return () => { active = false; };
  }, [apiBase, authRevision]);

  useEffect(() => {
    const token = sessionStorage.getItem("token");
    if (!token) localStorage.setItem("shoppingCart", JSON.stringify(cartItems));
    else localStorage.removeItem("shoppingCart");
    if (!serverCartLoaded) return;
    const timer = setTimeout(() => {
      const token = sessionStorage.getItem("token");
      if (!token) return;
      fetch(`${apiBase}/api/cart`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ items: cartItems.map((item) => ({ productId: item._id, quantity: item.quantity })) }),
      }).catch(() => {});
    }, 250);
    return () => clearTimeout(timer);
  }, [apiBase, cartItems, serverCartLoaded]);

  function addToCart(product) {
    setCartItems((items) => {
      const existing = items.find(
        (item) => item._id === product._id
      );

      if (existing) {
        if (existing.quantity >= (product.stock ?? 99)) {
          return items;
        }

        return items.map((item) =>
          item._id === product._id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      if ((product.stock ?? 99) < 1) {
        return items;
      }

      return [
        ...items,
        {
          ...product,
          quantity: 1,
          selected: true,
          size: product.size || "M",
        },
      ];
    });
  }

  function removeFromCart(productId) {
    setCartItems((items) =>
      items.filter((item) => item._id !== productId)
    );
  }

  function updateQuantity(productId, quantity) {
    setCartItems((items) =>
      items.map((item) => {
        if (item._id !== productId) return item;

        const stock = item.stock ?? 99;
        const safeQuantity = Math.max(
          1,
          Math.min(stock, Number(quantity) || 1)
        );

        return { ...item, quantity: safeQuantity };
      })
    );
  }

  function updateSize(productId, size) {
    setCartItems((items) =>
      items.map((item) => {
        if (item._id !== productId) return item;
        return { ...item, size };
      })
    );
  }

  function toggleSelectItem(productId) {
    setCartItems((items) =>
      items.map((item) => {
        if (item._id !== productId) return item;
        return { ...item, selected: !item.selected };
      })
    );
  }

  function selectAllItems(selected) {
    setCartItems((items) =>
      items.map((item) => ({ ...item, selected }))
    );
  }

  function removeSelectedItems() {
    setCartItems((items) =>
      items.filter((item) => !item.selected)
    );
  }

  const clearCart = useCallback(() => {
    setCartItems([]);
  }, []);

  const cartCount = cartItems.reduce(
    (total, item) => total + item.quantity,
    0
  );

  const cartTotal = cartItems.reduce(
    (total, item) =>
      item.selected !== false
        ? total + item.price * item.quantity
        : total,
    0
  );

  return (
    <CartContext.Provider
      value={{
        cartItems,
        cartCount,
        cartTotal,
        addToCart,
        removeFromCart,
        updateQuantity,
        updateSize,
        toggleSelectItem,
        selectAllItems,
        removeSelectedItems,
        clearCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}

import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useCart } from "../context/CartContext.jsx";

export default function OrderSuccess() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("order_id");
  const { clearCart } = useCart();
  const [order, setOrder] = useState(null);
  const [status, setStatus] = useState(orderId ? "checking" : "missing");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!orderId) return undefined;
    let cancelled = false;
    let timer;
    async function fetchStatus() {
      for (let attempt = 0; attempt < 6 && !cancelled; attempt += 1) {
        try {
          const response = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/orders/${encodeURIComponent(orderId)}`, { headers: { Authorization: `Bearer ${sessionStorage.getItem("token")}` } });
          const data = await response.json();
          if (!response.ok) throw new Error(data.message || "Could not retrieve your order status.");
          if (cancelled) return;
          setOrder(data);
          if (data.paymentStatus === "PAID") {
            clearCart();
            setStatus("paid");
            return;
          }
          if (data.paymentStatus === "FAILED") {
            setStatus("failed");
            return;
          }
          setStatus("pending");
        } catch (requestError) {
          if (cancelled) return;
          setError(requestError.message);
          setStatus("error");
          return;
        }
        await new Promise((resolve) => { timer = setTimeout(resolve, 1500); });
      }
    }
    fetchStatus();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [orderId, clearCart]);

  const paid = status === "paid";
  const failed = status === "failed";
  return (
    <main className="order-success">
      <div className="success-container">
        <div className="success-icon">{paid ? "✓" : failed ? "!" : "…"}</div>
        <h1>{paid ? "Payment confirmed" : failed ? "Payment not completed" : "Confirming your payment"}</h1>
        <p>
          {paid
            ? "Razorpay confirmed your payment and your order is placed."
            : failed
              ? "The payment did not complete and reserved items have been released."
              : status === "checking"
                ? "We’re checking your payment status with Razorpay. This can take a few seconds."
                : status === "pending"
                  ? "Razorpay has not confirmed this payment yet. Check your order status again shortly before retrying."
                  : error || "Open My Orders to check whether an order was created."}
        </p>
        {order && (
          <section className="order-details">
            <h2>Order Details</h2>
            <p><strong>Order ID:</strong> {order.id}</p>
            <p><strong>Total Amount:</strong> ₹{Number(order.totalAmount).toLocaleString("en-IN")}</p>
            <p><strong>Order Status:</strong> {order.status}</p>
            <p><strong>Payment Status:</strong> {order.paymentStatus}</p>
          </section>
        )}
        {order?.items?.length > 0 && (
          <section className="order-products">
            <h2>Ordered Products</h2>
            {order.items.map((item, index) => (
              <div key={item.productId || index}>
                <p><strong>{item.productName}</strong></p>
                <p>Quantity: {item.quantity}</p>
                <p>Price: ₹{Number(item.unitPrice).toLocaleString("en-IN")}</p>
              </div>
            ))}
          </section>
        )}
        <Link to="/" className="continue-shopping">Continue Shopping</Link>
      </div>
    </main>
  );
}

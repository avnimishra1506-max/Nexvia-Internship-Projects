import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext.jsx";
import type { ShippingAddress } from "../types/commerce";
import { createPaymentOrder, verifyPayment } from "../services/checkout";

export default function Checkout() {
  const { cartItems, cartTotal, clearCart } = useCart();
  const navigate = useNavigate();
  const [address, setAddress] = useState<ShippingAddress>({ fullName: "", phone: "", street: "", city: "", state: "", postalCode: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!cartItems.length) return setError("Your cart is empty.");
    setLoading(true);
    try {
      const data = await createPaymentOrder({
        items: cartItems.filter((item) => item.selected !== false).map(({ _id, quantity }) => ({ productId: String(_id), quantity })),
        shippingAddress: address,
      });

      const confirmPayment = async (paymentResponse) => {
        await verifyPayment(data.appOrderId, paymentResponse);
        clearCart();
        navigate(`/order-success?razorpay_order_id=${encodeURIComponent(data.razorpayOrderId)}`);
      };

      if (data.isSimulation) {
        await confirmPayment({ razorpay_order_id: data.razorpayOrderId, razorpay_payment_id: `pay_sim_${Date.now()}`, razorpay_signature: "simulated_signature" });
        return;
      }
      if (!window.Razorpay) {
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://checkout.razorpay.com/v1/checkout.js";
          script.onload = resolve;
          script.onerror = () => reject(new Error("Could not load Razorpay Checkout."));
          document.body.appendChild(script);
        });
      }
      const checkout = new window.Razorpay({
        key: data.keyId, amount: data.amount, currency: data.currency,
        name: "ShoppingSphere", description: "Secure order payment", order_id: data.razorpayOrderId,
        prefill: { name: data.customer?.name, contact: data.customer?.phone },
        handler: (payment) => confirmPayment(payment).catch((issue: Error) => { setError(issue.message); setLoading(false); }),
        modal: { ondismiss: () => setLoading(false) },
      });
      checkout.open();
    } catch (issue) {
      setError(issue.message || "Could not connect to Razorpay.");
      setLoading(false);
    }
  }

  if (!cartItems.length) return <main className="checkout-page"><h1>Checkout</h1><p>Your cart is empty.</p><Link to="/cart">Return to your cart</Link></main>;

  return <main className="checkout-page mx-auto max-w-3xl px-5 py-10">
    <h1>Secure checkout</h1>
    <form onSubmit={handleSubmit} className="checkout-form">
      <h2>Delivery address</h2>
      {[["fullName", "Full name"], ["phone", "10-digit phone number"], ["street", "Street address"], ["city", "City"], ["state", "State"], ["postalCode", "6-digit PIN code"]].map(([name, label]) => <label key={name}>{label}
        <input name={name} value={address[name]} onChange={(event) => setAddress({ ...address, [name]: event.target.value })} required />
      </label>)}
      <section className="checkout-summary"><h2>Order summary</h2><p>{cartItems.filter((item) => item.selected !== false).reduce((sum, item) => sum + item.quantity, 0)} items</p><p>Estimated total: ₹{cartTotal.toLocaleString("en-IN")}</p><p>Final amount and stock are verified by the server.</p></section>
      {error && <p className="checkout-error" role="alert">{error}</p>}
      <button type="submit" disabled={loading}>{loading ? "Connecting to Razorpay…" : "Continue to secure payment"}</button>
    </form>
  </main>;
}

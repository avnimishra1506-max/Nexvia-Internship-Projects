import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Check,
  Package,
  ShoppingBag,
  RotateCcw,
  XCircle,
  AlertCircle,
  ShieldCheck,
  CheckCircle2,
  X,
} from "lucide-react";
const ORDER_STEPS = ["Placed", "Packed", "Shipped", "Delivered"];
const getStatusClass = (status = "Placed") =>
  String(status).toLowerCase().replace(/[^a-z]+/g, "-");
const displayStatus = (status) => String(status || "").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
const presentOrder = (order) => ({
  ...order,
  _id: order.id,
  status: displayStatus(order.status),
  paymentStatus: displayStatus(order.paymentStatus),
  items: (order.items || []).map((item) => ({ ...item, product: item.productId, name: item.productName, price: Number(item.unitPrice) })),
});

function getOrderProductImages(item) {
  const primary = item.imageUrl || item.image || item.product?.imageUrl || "";
  const fallback = item.fallbackImage || item.product?.fallbackImage || "";
  return { primary, fallback: fallback !== primary ? fallback : "" };
}

const CANCELLATION_REASONS = [
  "Ordered by mistake",
  "Found a better price elsewhere",
  "Delivery date is too late",
  "Need to change shipping address or mobile number",
  "Incorrect size or color selected",
  "Change of mind",
  "Other reason",
];

const RETURN_REASONS = [
  "Defective or damaged product received",
  "Size is too small or too large",
  "Quality / fabric not as expected",
  "Received wrong item or color",
  "Item looks different from website images",
  "Missing parts or accessories",
  "Other issue",
];

export default function MyOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const navigate = useNavigate();

  // Modals state
  const [cancelModalOrder, setCancelModalOrder] = useState(null);
  const [cancelReason, setCancelReason] = useState(CANCELLATION_REASONS[0]);
  const [isCancelling, setIsCancelling] = useState(false);

  const [returnModalOrder, setReturnModalOrder] = useState(null);
  const [returnReason, setReturnReason] = useState(RETURN_REASONS[0]);
  const [returnDetails, setReturnDetails] = useState("");
  const [isReturning, setIsReturning] = useState(false);

  const loadOrders = useCallback(async () => {
    const token = sessionStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/orders`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();

      if (response.status === 401 || response.status === 403) {
        sessionStorage.removeItem("token");
        sessionStorage.removeItem("user");
        navigate("/login");
        return;
      }

      if (!response.ok) {
        throw new Error(data.message || "Could not load orders.");
      }

      setOrders(data.map(presentOrder));
    } catch (err) {
      setError(err.message || "Unable to connect to the server.");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // Handle Cancellation
  async function handleConfirmCancel() {
    if (!cancelModalOrder) return;
    setIsCancelling(true);
    setActionMessage("");
    const token = sessionStorage.getItem("token");

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/orders/${cancelModalOrder._id}/cancel`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ reason: cancelReason }),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not cancel order.");

      setActionMessage(data.message || "Order cancelled successfully.");
      setCancelModalOrder(null);
      await loadOrders();
    } catch (err) {
      alert(err.message || "Failed to cancel order.");
    } finally {
      setIsCancelling(false);
    }
  }

  // Handle Return / Refund
  async function handleConfirmReturn() {
    if (!returnModalOrder) return;
    setIsReturning(true);
    setActionMessage("");
    const token = sessionStorage.getItem("token");

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/orders/${returnModalOrder._id}/return`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ reason: returnReason, details: returnDetails }),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not process return.");

      setActionMessage(data.message || "Return request submitted successfully.");
      setReturnModalOrder(null);
      setReturnDetails("");
      await loadOrders();
    } catch (err) {
      alert(err.message || "Failed to submit return request.");
    } finally {
      setIsReturning(false);
    }
  }

  async function downloadInvoice(order) {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/orders/${order._id}/invoice.pdf`, {
        headers: { Authorization: `Bearer ${sessionStorage.getItem("token")}` },
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Could not download invoice.");
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `ShoppingSphere-invoice-${order._id.slice(-8)}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setActionMessage(error.message || "Could not download invoice.");
    }
  }

  if (loading) {
    return (
      <main className="my-orders">
        <p>Loading your orders...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="my-orders">
        <h1>My Orders</h1>
        <p className="orders-error">{error}</p>
        <button onClick={() => window.location.reload()}>Try Again</button>
      </main>
    );
  }

  return (
    <main className="my-orders">
      <div className="orders-page-header">
        <div>
          <h1>My Orders</h1>
          <p>View your ShoppingSphere purchases, live tracking, returns, and refunds.</p>
        </div>
      </div>

      {actionMessage && (
        <div className="orders-action-alert">
          <CheckCircle2 size={20} color="#15803d" />
          <span>{actionMessage}</span>
          <button
            type="button"
            className="orders-alert-dismiss"
            onClick={() => setActionMessage("")}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {orders.length === 0 ? (
        <section className="orders-empty">
          <ShoppingBag size={48} color="#94a3b8" style={{ margin: "0 auto 16px" }} />
          <h2>No orders yet</h2>
          <p>Your placed orders will appear here once you make a purchase.</p>
          <Link to="/" className="ss-btn-wishlist-blue" style={{ display: "inline-block", marginTop: "16px" }}>
            Start Shopping
          </Link>
        </section>
      ) : (
        <section className="orders-list">
          {orders.map((order) => {
            const isCancelled = order.status === "Cancelled";
            const isReturned = order.status === "Returned";
            const canCancel = false;
            const canReturn = false;

            return (
              <article className="order-card" key={order._id}>
                {/* Header */}
                <div className="order-card-header">
                  <div>
                    <h2>Order #{order._id.slice(-8).toUpperCase()}</h2>
                    <p>
                      Placed on{" "}
                      {new Date(order.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>

                  <div className="order-header-badges">
                    <span className={`order-status order-status-${getStatusClass(order.status)}`}>
                      {order.status || "Placed"}
                    </span>
                    {order.paymentStatus === "Refunded" && (
                      <span className="order-refund-badge">
                        <Check size={13} /> Refunded
                      </span>
                    )}
                  </div>
                </div>

                {/* Tracking Progress */}
                {isCancelled ? (
                  <div className="order-cancelled-box">
                    <XCircle size={18} color="#dc2626" />
                    <div>
                      <strong>Order Cancelled</strong>
                      {order.cancellationReason && (
                        <p className="order-reason-text">Reason: {order.cancellationReason}</p>
                      )}
                    </div>
                  </div>
                ) : isReturned ? (
                  <div className="order-returned-box">
                    <RotateCcw size={18} color="#0284c7" />
                    <div>
                      <strong>Order Returned &amp; Refunded</strong>
                      {order.returnReason && (
                        <p className="order-reason-text">Reason: {order.returnReason}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <ol
                    className="order-tracker"
                    aria-label={`Order status: ${order.status || "Placed"}`}
                  >
                    {ORDER_STEPS.map((step, index) => {
                      const currentIndex = Math.max(
                        0,
                        ORDER_STEPS.findIndex(
                          (status) =>
                            status.toLowerCase() ===
                            String(order.status || "Placed").toLowerCase()
                        )
                      );
                      const complete = index <= currentIndex;
                      return (
                        <li
                          className={complete ? "is-complete" : ""}
                          key={step}
                          aria-current={index === currentIndex ? "step" : undefined}
                        >
                          <span className="order-tracker-dot">
                            {complete ? <Check size={12} /> : index + 1}
                          </span>
                          <span>{step}</span>
                        </li>
                      );
                    })}
                  </ol>
                )}

                {!isCancelled && !isReturned && order.subOrders?.length > 0 && (
                  <div className="vendor-delivery-statuses" aria-label="Delivery status by vendor">
                    {order.subOrders.map((subOrder) => (
                      <div key={subOrder.id} className="vendor-delivery-status">
                        <div><span>{subOrder.vendor?.vendorName || "Marketplace vendor"}</span><strong>{displayStatus(subOrder.status)}</strong></div>
                        <ol className="order-tracker vendor-suborder-tracker" aria-label={`${subOrder.vendor?.vendorName || "Vendor"} order status`}>
                          {ORDER_STEPS.map((step, index) => {
                            const currentIndex = Math.max(0, ORDER_STEPS.findIndex((status) => status.toLowerCase() === String(subOrder.status || "PLACED").toLowerCase()));
                            return <li key={step} className={index <= currentIndex ? "is-complete" : ""}><span className="order-tracker-dot">{index <= currentIndex ? <Check size={12}/> : index + 1}</span><span>{step}</span></li>;
                          })}
                        </ol>
                      </div>
                    ))}
                  </div>
                )}

                {/* Refund Notification Banner if payment was refunded */}
                {order.paymentStatus === "Refunded" && (
                  <div className="order-refund-banner">
                    <ShieldCheck size={20} color="#059669" />
                    <div className="refund-banner-text">
                      <strong>Full Refund Processed: ₹{Number(order.refundAmount || order.totalAmount).toLocaleString("en-IN")}</strong>
                      <p>
                        {order.razorpayRefundId && `Refund ID: ${order.razorpayRefundId} • `}
                        Amount is credited back to your original payment account (UPI / Bank / Card) in 5–7 business days.
                      </p>
                    </div>
                  </div>
                )}

                {/* Ordered Items */}
                <div className="order-products">
                  {order.items.map((item, index) => {
                    const { primary: productImage, fallback: fallbackImage } =
                      getOrderProductImages(item);
                    return (
                      <div
                        className="order-product"
                        key={`${item.product}-${index}`}
                      >
                        <div className="order-product-main">
                          <div className="order-product-image">
                            {productImage ? (
                              <img
                                src={productImage}
                                alt={item.name}
                                data-fallback-src={fallbackImage}
                                onError={(event) => {
                                  const image = event.currentTarget;
                                  if (
                                    image.dataset.fallbackSrc &&
                                    image.dataset.fallbackUsed !== "true"
                                  ) {
                                    image.dataset.fallbackUsed = "true";
                                    image.src = image.dataset.fallbackSrc;
                                  } else image.hidden = true;
                                }}
                              />
                            ) : (
                              <ShoppingBag size={22} aria-hidden="true" />
                            )}
                            {productImage && (
                              <Package
                                className="order-product-image-fallback"
                                size={22}
                                aria-hidden="true"
                              />
                            )}
                          </div>
                          <div className="order-product-details">
                            <strong>{item.name}</strong>
                            <p>Quantity: {item.quantity}</p>
                            <span
                              className={`order-item-status order-status-${getStatusClass(
                                item.status || order.status
                              )}`}
                            >
                              Status: {item.status || order.status || "Placed"}
                            </span>
                          </div>
                        </div>
                        <span className="order-item-price">
                          ₹{(item.price * item.quantity).toLocaleString("en-IN")}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Card Footer with Actions */}
                <div className="order-card-footer">
                  <div className="order-footer-meta">
                    <span>
                      Payment: <strong>{order.paymentStatus || "Pending"}</strong> (via {order.paymentMethod || "Razorpay"})
                    </span>
                    <strong>
                      Total: ₹{Number(order.totalAmount).toLocaleString("en-IN")}
                    </strong>
                  </div>

                  <div className="order-actions-group">
                    {order.paymentStatus === "Paid" && (
                      <button type="button" className="ss-order-action-btn" onClick={() => downloadInvoice(order)}>
                        Download invoice
                      </button>
                    )}
                    {/* Cancellation Button */}
                    {canCancel && (
                      <button
                        type="button"
                        className="ss-order-action-btn ss-btn-cancel-order"
                        onClick={() => {
                          setCancelReason(CANCELLATION_REASONS[0]);
                          setCancelModalOrder(order);
                        }}
                      >
                        <XCircle size={15} />
                        <span>Cancel Order</span>
                      </button>
                    )}

                    {/* 14-Day Return / Refund Button */}
                    {canReturn && (
                      <button
                        type="button"
                        className="ss-order-action-btn ss-btn-return-order"
                        onClick={() => {
                          setReturnReason(RETURN_REASONS[0]);
                          setReturnDetails("");
                          setReturnModalOrder(order);
                        }}
                      >
                        <RotateCcw size={15} />
                        <span>Return / Refund (14 Days)</span>
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}

      {/* ========================================================
          CANCEL ORDER MODAL
         ======================================================== */}
      {cancelModalOrder && (
        <div className="ss-modal-overlay">
          <div className="ss-modal-dialog">
            <div className="ss-modal-header">
              <h3>Cancel Order #{cancelModalOrder._id.slice(-8).toUpperCase()}</h3>
              <button
                type="button"
                className="ss-modal-close"
                onClick={() => setCancelModalOrder(null)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="ss-modal-body">
              <div className="ss-modal-info-alert">
                <AlertCircle size={20} color="#b45309" />
                <div>
                  <strong>Cancellation Policy:</strong>
                  <p>
                    {cancelModalOrder.paymentStatus === "Paid"
                      ? `Your order will be cancelled and a 100% refund of ₹${Number(
                          cancelModalOrder.totalAmount
                        ).toLocaleString("en-IN")} will be instantly initiated to your original payment method.`
                      : "Your order will be cancelled immediately."}
                  </p>
                </div>
              </div>

              <label className="ss-modal-label">
                Please select a reason for cancellation:
              </label>
              <select
                className="ss-modal-select"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
              >
                {CANCELLATION_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div className="ss-modal-actions">
              <button
                type="button"
                className="ss-modal-btn-secondary"
                onClick={() => setCancelModalOrder(null)}
                disabled={isCancelling}
              >
                Keep Order
              </button>
              <button
                type="button"
                className="ss-modal-btn-danger"
                onClick={handleConfirmCancel}
                disabled={isCancelling}
              >
                {isCancelling ? "Processing Cancellation..." : "Confirm Cancellation"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          RETURN / REFUND MODAL
         ======================================================== */}
      {returnModalOrder && (
        <div className="ss-modal-overlay">
          <div className="ss-modal-dialog">
            <div className="ss-modal-header">
              <h3>14-Day Easy Return &amp; Refund</h3>
              <button
                type="button"
                className="ss-modal-close"
                onClick={() => setReturnModalOrder(null)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="ss-modal-body">
              <div className="ss-modal-info-alert ss-alert-return">
                <ShieldCheck size={20} color="#059669" />
                <div>
                  <strong>ShoppingSphere 14-Day Return Guarantee:</strong>
                  <p>
                    A full refund of{" "}
                    <strong>₹{Number(returnModalOrder.totalAmount).toLocaleString("en-IN")}</strong>{" "}
                    will be processed back to your payment account (Razorpay/UPI/Bank) upon pickup.
                  </p>
                </div>
              </div>

              <label className="ss-modal-label">Select reason for return:</label>
              <select
                className="ss-modal-select"
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
              >
                {RETURN_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>

              <label className="ss-modal-label" style={{ marginTop: "14px" }}>
                Additional comments (optional):
              </label>
              <textarea
                className="ss-modal-textarea"
                rows="3"
                placeholder="Let us know what went wrong so we can improve..."
                value={returnDetails}
                onChange={(e) => setReturnDetails(e.target.value)}
              />

              <div className="ss-return-pickup-note">
                <p>
                  <strong>Doorstep Pickup:</strong> Our courier partner will pick up the item
                  from your delivery address within 24–48 hours. Please keep original tags intact.
                </p>
              </div>
            </div>

            <div className="ss-modal-actions">
              <button
                type="button"
                className="ss-modal-btn-secondary"
                onClick={() => setReturnModalOrder(null)}
                disabled={isReturning}
              >
                Cancel
              </button>
              <button
                type="button"
                className="ss-modal-btn-primary"
                onClick={handleConfirmReturn}
                disabled={isReturning}
              >
                {isReturning ? "Submitting Return..." : "Submit Return & Process Refund"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

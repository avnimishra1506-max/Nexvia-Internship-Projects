import type { CreatePaymentOrderRequest, CreatePaymentOrderResponse, RazorpayPaymentResponse } from "../types/commerce";

const API = `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api`;

function checkoutHeaders(): HeadersInit {
  const token = sessionStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    "X-Cart-Id": localStorage.getItem("ssCartSession") || "",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function readResponse<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Checkout request failed.");
  return data as T;
}

export async function createPaymentOrder(payload: CreatePaymentOrderRequest): Promise<CreatePaymentOrderResponse> {
  return readResponse(await fetch(`${API}/payments/create-order`, {
    method: "POST",
    headers: checkoutHeaders(),
    body: JSON.stringify(payload),
  }));
}

export async function verifyPayment(appOrderId: string, payment: RazorpayPaymentResponse): Promise<void> {
  await readResponse(await fetch(`${API}/payments/verify`, {
    method: "POST",
    headers: checkoutHeaders(),
    body: JSON.stringify({ appOrderId, ...payment }),
  }));
}

import { createHmac, timingSafeEqual } from "node:crypto";

const apiBase = "https://api.razorpay.com/v1";
const credentials = () => Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");

export function isPaymentSimulation() {
  return (process.env.PAYMENT_MODE || "simulation") === "simulation";
}

export async function razorpayRequest<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    method,
    headers: { Authorization: `Basic ${credentials()}`, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json() as T & { error?: { description?: string } };
  if (!response.ok) throw new Error(data.error?.description || "Razorpay request failed.");
  return data;
}

export function verifyPaymentSignature(orderId: string, paymentId: string, signature: string) {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) return false;
  const expected = createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest();
  let actual: Buffer;
  try { actual = Buffer.from(signature, "hex"); } catch { return false; }
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function verifyWebhookSignature(payload: Buffer, signature: string | undefined) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(payload).digest();
  const actual = Buffer.from(signature, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

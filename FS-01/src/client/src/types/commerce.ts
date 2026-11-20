export type ShippingAddress = {
  fullName: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
};

export type CheckoutLineItem = { productId: string; quantity: number };

export type CreatePaymentOrderRequest = {
  items: CheckoutLineItem[];
  shippingAddress: ShippingAddress;
  couponCode?: string | null;
};

export type CreatePaymentOrderResponse = {
  appOrderId: string;
  razorpayOrderId: string;
  keyId?: string;
  amount: number;
  currency: string;
  isSimulation: boolean;
  customer?: { name?: string; phone?: string };
};

export type RazorpayPaymentResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

export type RazorpayCheckoutOptions = {
  key?: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill?: { name?: string; contact?: string };
  handler: (payment: RazorpayPaymentResponse) => void;
  modal?: { ondismiss?: () => void };
};

declare global {
  interface Window {
    Razorpay: new (options: RazorpayCheckoutOptions) => { open(): void };
  }
}

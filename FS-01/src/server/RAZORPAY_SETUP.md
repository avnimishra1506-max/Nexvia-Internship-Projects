# Razorpay Checkout Setup

## Environment

For local checkout without Razorpay credentials, set `PAYMENT_MODE=simulation` in `server/.env`. For Razorpay test checkout, set `PAYMENT_MODE=razorpay` and configure:

```env
RAZORPAY_KEY_ID=rzp_test_your_key_id
RAZORPAY_KEY_SECRET=your_test_key_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
RAZORPAY_CURRENCY=INR
```

The API verifies payment signatures and handles captured-payment webhooks on the server. Vendor payouts require Razorpay Route and each approved vendor's linked account ID.

## Product and inventory handling

The storefront and checkout use products stored in PostgreSQL through Prisma. Inventory is reserved when an order is created and restored if checkout is cancelled. Paid orders can transfer vendor payouts when the seller account has Razorpay Route enabled.

## Webhook setup

In the Razorpay Dashboard, add a webhook pointing to `https://<your-public-api-host>/api/payments/webhook`, set the same value as `RAZORPAY_WEBHOOK_SECRET`, and subscribe to `payment.captured`.

## Start the API

```powershell
cd server
npm run dev
```

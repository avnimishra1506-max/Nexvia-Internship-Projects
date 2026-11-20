# Marketplace plan and contract

## Phase 1: cleanup and safety

Phase 1 removes old prototype and MongoDB-era code while keeping the existing storefront. Its acceptance checklist is:

- The repository has a `.gitignore` for dependencies, build output, and environment files; `.env` files are not tracked.
- MongoDB server routes, models, database configuration, and seed scripts are removed. No MongoDB environment setting remains in `.env.example`.
- The client uses `App.jsx` and `main.jsx` as its only entry point, and the old TypeScript prototype and generated `client/dist` are removed.
- The storefront reads catalog items only from `GET /api/products/search`; the bundled catalog and DummyJSON/FakeStore calls are removed.
- The Prisma seed creates three sample vendors and 36 products with images.
- Client and server typechecks pass, and the server starts with the configured database.

For a fresh local setup, copy `server/.env.example` to `server/.env`, set PostgreSQL credentials, a private `JWT_SECRET`, and distinct `ADMIN_PASSWORD` and `SAMPLE_VENDOR_PASSWORD` values (each at least 12 characters). Run `npm run db:deploy`, `npm run db:generate`, `npm run db:seed`, and `npm run dev` from `server`; run `npm run dev` from `client`. Redis and Elasticsearch are optional for local development.

## Roles

| Role | Permissions |
| --- | --- |
| Customer | Browse/search, manage Redis cart, pay, view own orders/invoices, review purchased products, use coupons |
| Vendor | Apply for onboarding, manage own products and S3 images after admin approval, view orders containing their products |
| Admin | Approve vendors, manage any product/order/coupon, move fulfillment through the lifecycle, and view analytics |

Registration always creates a customer. Vendor access is granted only after admin approval. Admin creation is a deployment-time seed operation, never a public registration option.

## Data model

```mermaid
erDiagram
  USER ||--o{ PRODUCT : sells
  USER ||--o{ ORDER : places
  ORDER ||--|{ ORDER_ITEM : contains
  PRODUCT ||--o{ ORDER_ITEM : snapshots
  USER ||--o{ REVIEW : writes
  PRODUCT ||--o{ REVIEW : receives
  COUPON ||--o| COUPON_USAGE : redeems
  USER ||--o{ COUPON_USAGE : uses
  ORDER ||--o| COUPON_USAGE : applies
  USER { string id PK; string email UK; enum role; enum vendorStatus }
  PRODUCT { string id PK; string sellerId FK; decimal price; int stock; string imageKey }
  ORDER { string id PK; string userId FK; enum status; enum paymentStatus; decimal totalAmount }
  ORDER_ITEM { string id PK; string orderId FK; string productId FK; string sellerId; int quantity }
  REVIEW { string id PK; string productId FK; string userId FK; int rating }
  COUPON { string id PK; string code UK; enum type; decimal value }
```

Cart contents and signed-in sessions live in Redis. PostgreSQL via Prisma is the source of truth for marketplace records. Product images are objects in S3; Elasticsearch is a search index that can be rebuilt from PostgreSQL.

## API contract

All routes are under `/api`; protected routes use `Authorization: Bearer <JWT>`.

| Area | Routes |
| --- | --- |
| Auth | `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` |
| Vendor | `POST /vendors/apply`, `GET /vendors/me`, `GET /vendors/applications` (admin), `PATCH /vendors/:id/decision` (admin) |
| Products/search | `GET /products/search` (q, category, minPrice, maxPrice, sort), `GET /products/mine` (vendor), `GET /products/:id`, `POST /products/upload-url`, `POST /products`, `PATCH /products/:id`, `DELETE /products/:id` |
| Cart/checkout | `GET /cart`, `PUT /cart`, `DELETE /cart`, `POST /payments/create-order`, `POST /payments/verify`, `POST /payments/webhook` |
| Orders | `GET /orders`, `GET /orders/:id`, `PATCH /orders/:id/status`, `GET /orders/:id/invoice.pdf` |
| Reviews/coupons | `GET /reviews/product/:id`, `POST /reviews/product/:id`, `GET /coupons`, `POST /coupons/validate`, `POST /coupons` (admin) |
| Admin analytics | `GET /analytics/overview`, `GET /analytics/revenue`, `GET /analytics/top-products` |

Fulfillment transitions are one-way: `PLACED → PACKED → SHIPPED → DELIVERED`. Admins perform each transition. Payment must be captured before fulfillment.

# ShoppingSphere

ShoppingSphere is a marketplace with customer, vendor, and administrator roles.

## Run locally

Start the client from `client` with `npm run dev`. For the API, copy `server/.env.example` to `server/.env`, set a PostgreSQL `DATABASE_URL`, a private `JWT_SECRET`, and separate `ADMIN_PASSWORD` and `SAMPLE_VENDOR_PASSWORD` values (at least 12 characters each). Start PostgreSQL, then run `npm run db:deploy`, `npm run db:generate`, `npm run db:seed`, and `npm run dev` from `server`. Redis and Elasticsearch are optional for local development. The client uses `http://localhost:5000` for the API by default. Set `VITE_API_URL` in `client/.env` if the API runs elsewhere.

The role model, Prisma relationships, and API contract are documented in [PROJECT_PLAN.md](PROJECT_PLAN.md).

## Product data

The storefront loads products only from `GET /api/products/search`. The seed command creates three approved sample vendors and 36 products. Sample product images use public image URLs for local development. Uploaded vendor images use the configured S3 bucket.

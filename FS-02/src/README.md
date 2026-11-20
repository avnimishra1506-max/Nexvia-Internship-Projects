# 🌐 CollabWorkspace — Real-Time Collaborative Workspace

A real-time multiplayer workspace (Notion & Figma hybrid) built with **Next.js**, **Yjs (CRDTs)**, **WebSockets**, **PostgreSQL (Prisma)**, and **Redis**.

---

## 🗂️ Project Directory Structure

```text
collab-workspace/
│
├── src/
│   ├── app/
│   │   ├── login/
│   │   │   └── page.tsx
│   │   ├── signup/
│   │   │   └── page.tsx
│   │   ├── dashboard/
│   │   │   └── page.tsx
│   │   ├── workspace/
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── document/
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx
│   │   └── api/
│   │       ├── auth/route.ts
│   │       ├── workspace/route.ts
│   │       ├── pages/route.ts
│   │       ├── comments/route.ts
│   │       └── versions/route.ts
│   │
│   ├── components/
│   │   ├── Navbar.tsx
│   │   ├── Sidebar.tsx
│   │   ├── WorkspaceCard.tsx
│   │   ├── Editor.tsx
│   │   ├── Toolbar.tsx
│   │   ├── LiveCursors.tsx
│   │   ├── Members.tsx
│   │   ├── Comments.tsx
│   │   └── VersionHistory.tsx
│   │
│   ├── lib/
│   │   ├── prisma.ts
│   │   ├── auth.ts
│   │   ├── permissions.ts
│   │   ├── redis.ts
│   │   └── yjs.ts
│   │
│   └── types/
│       └── index.ts
│
├── prisma/
│   └── schema.prisma
│
├── websocket-server/
│   ├── server.ts
│   └── package.json
│
├── public/
├── .env
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

---

## 🚀 Getting Started

### 1. Run Next.js Application
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000)

### 2. Run WebSocket Server
```bash
npm run server:ws
```
Starts Yjs WebSocket cluster on `ws://localhost:1234`
# Rich-text collaboration (Day 3)

The editor uses TipTap for rich-text editing. Each page gets its own Yjs `Y.Doc`, and the `y-websocket` provider joins a room named `document:<page-id>`. TipTap's Collaboration extension stores editor steps in a shared Yjs XML fragment; its collaboration cursor extension sends caret and selection awareness through the same provider.

Yjs resolves concurrent edits by merging causally identified operations instead of replacing the whole document with whichever save arrived last. Independent inserts can be applied in either order, while concurrent edits to the same position are deterministically ordered. This makes replicas converge after receiving the same updates. The WebSocket server currently keeps room state in memory; PostgreSQL HTML is used to seed an empty room after a server restart.

To try two local collaborators, run `npm run server:ws` in one terminal and `npm run dev` in another, sign in in two browser windows, and open the same page in both. Type in both editors; changes and colored carets should appear in the other window. `NEXT_PUBLIC_WS_URL` can override the default `ws://<current-host>:1234` address.

## Comments, access roles, history, and Redis

Comments and replies are stored as comment threads in PostgreSQL. Editors can resolve or reopen threads; Commenters and Editors can post; Viewers can read. The Share panel assigns per-page `VIEW`, `COMMENT`, or `EDIT` access to existing workspace members. Version snapshots store the page title and HTML content, and Editors can restore a saved version; restores are broadcast through the page's Yjs room.

For multi-node WebSocket deployments, set `REDIS_URL` to a reachable Redis instance. The WebSocket server publishes document updates to `yjs:doc-updates` and applies updates from other nodes. If Redis is unavailable, it logs that it is running in single-node mode. `npm run verify:yjs-sync` checks two-client presence, concurrent edit convergence, and reconnect recovery locally.

## New monorepo (Phase 1 scaffold)

The target architecture is being added alongside the existing application so this first phase does not remove or disrupt the current UI. New work lives in `apps/web` (Vite + React + TypeScript), `apps/server` (Node + TypeScript), and `packages/shared`. PostgreSQL and Redis are defined in the root `docker-compose.yml`; the initial Prisma schema and migration live under `apps/server/prisma`.

### Start Phase 1 locally (PowerShell)

1. Copy `.env.example` to `.env`, then change `POSTGRES_PASSWORD`, `DATABASE_URL` (use the same password), `JWT_SECRET`, and `DEMO_PASSWORD` to private values.
2. Start the database services: `docker compose up -d postgres redis`
3. Install workspace packages: `npm install`
4. Generate the Prisma client: `npm run db:generate --workspace @collab/server`
5. Apply the checked-in migration from the repository root: `npx prisma migrate dev --schema apps/server/prisma/schema.prisma --name init`
6. Add demo users and sample workspace/page: `npm run db:seed --workspace @collab/server`
7. Start the frontend scaffold: `npm run dev --workspace @collab/web`

Open `http://localhost:5173`. The example uses host port 5433 for PostgreSQL to avoid colliding with a local PostgreSQL service on 5432. Migration is intended for a fresh Phase 1 database; do not reset an existing database to apply it. Phase 1 is complete when the Docker services are healthy, the migration and seed commands finish successfully, and the Vite scaffold loads. Authentication and collaboration functionality are intentionally later phases.

## Phase 2: accounts, workspaces, and pages

Phase 2 adds the Express API, cookie-based login and registration, workspace and page management, direct member invites for existing accounts, and the Vite workspace screen. Email delivery and links for new accounts are added in later phases. Pages are still a placeholder; the rich-text editor is Phase 3.

From PowerShell, in the repository root:

```powershell
docker compose up -d postgres redis
npm install
npm run db:generate --workspace @collab/server
npx prisma migrate dev --schema apps/server/prisma/schema.prisma --name init
npm run db:seed --workspace @collab/server
```

Run the API and frontend in separate PowerShell windows, both opened in the repository root:

```powershell
npm run dev --workspace @collab/server
```

```powershell
npm run dev --workspace @collab/web
```

Open `http://localhost:5173`. The API listens on `http://localhost:4000`. Set `API_PORT`, `CORS_ORIGIN`, and a private `JWT_SECRET` (at least 32 characters) in `.env` to customize local settings. If `JWT_SECRET` is unset, the API can use the existing `SESSION_SECRET`.

Manual check: sign in as `alex@example.test` or `sam@example.test` with the local `DEMO_PASSWORD` from `.env`. Create a workspace and page, rename them, add a nested page, and try inviting the other demo account. Registering a new account creates a private workspace and a welcome page. Sign out and confirm the login screen returns. Phase 3 replaces the page placeholder with local rich-text editing.

## Phase 3: local rich-text editor

The Vite app now uses TipTap with a Yjs document for each page. Headings, bold and italic, lists, tasks, quotes, code blocks, links, images by URL, and tables are available. Yjs state is saved to IndexedDB in the current browser profile, so closing and reopening the same page on the same device restores its text. This local phase does not send document edits to the API or other users.

Install dependencies if needed, then run the API and web app in separate PowerShell windows from the repository root:

```powershell
npm install
npm run dev --workspace @collab/server
```

```powershell
npm run dev --workspace @collab/web
```

Open `http://localhost:5173`, sign in, and open a page. Try the toolbar formatting tools and wait for the status to say “Saved in this browser”; reload the page and confirm your text remains. The Yjs convergence check and production build can be run with:

```powershell
npm test --workspace @collab/web
npm run build --workspace @collab/web
```

Local edits are stored in this browser profile and are not yet shared between devices or users. Cross-user editing and server persistence arrive in Phase 4.

## Phase 4: live collaboration and server persistence

The page editor now joins an authenticated Yjs WebSocket room for each page. Workspace members see each other's edits and cursor labels in real time. Document updates are saved to the page's `yjsState` column in PostgreSQL and restored when the WebSocket server starts again. Browser IndexedDB remains enabled for local recovery when the connection drops. Workspace viewers get a read-only editor.

Start PostgreSQL and Redis, then run the API and web app as described in Phase 3. Start the collaboration server from a third PowerShell window at the repository root:

```powershell
npm run server:ws
```

The WebSocket server uses the same `JWT_SECRET` (or `SESSION_SECRET`) and database URL as the API. Sign in as two workspace members in separate browser profiles, open the same page at `http://localhost:5173`, and type in either editor. Both editors should update, and the remote caret should show the other member's name. Disconnect and restart the WebSocket server to confirm that the document is restored from PostgreSQL.

## Phase 5: comments, page access, and version history

Pages now support comment threads and replies. Editors can resolve or reopen threads; members with `COMMENT` access can post; all members with page access can read. Workspace owners and admins can override each member's inherited workspace role with page-level `VIEW`, `COMMENT`, or `EDIT` access. WebSocket updates are checked against the current page role, so view and comment access cannot write document changes.

Editors can save a named version from the editor and restore it later. Restoring replaces the current TipTap document through Yjs, so collaborators receive the restored content live. Comments, page permissions, and version snapshots are stored in PostgreSQL. Open a page and use the Comments, Page access, and Version history panels below the editor.

## Phase 6: workspace invitation links

Workspace owners and admins can invite existing accounts directly or create a single-use invitation link for a new account. Links expire after seven days, are stored as token hashes, and can be revoked from the Pending invitations list. Recipients can accept with an existing account or register using the invited email address; successful registration joins the invited workspace instead of creating a separate private workspace.

The invitation table is added through the checked-in additive migration under `apps/server/prisma/migrations`; apply it with `npx prisma migrate deploy --schema apps/server/prisma/schema.prisma` (or `prisma migrate dev` during local development). Phase 7 adds optional SMTP delivery; without SMTP settings, copy and share the generated link.

## Phase 7: email invitations

When SMTP is configured, the API emails new invite links and notifies existing accounts when they are added to a workspace. The invite link remains available to copy from the app. Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, and `SMTP_FROM` in `.env`; add both `SMTP_USER` and `SMTP_PASSWORD` when your mail relay requires authentication. Restart the API after changing mail settings. If SMTP is unavailable or a send fails, the invitation is still created and the app shows that the link can be shared manually.

## Phase 8: collaborative editor load test

`scripts/phase8-load-test.mjs` fetches a short Wikipedia extract or a Project Gutenberg text, creates a temporary workspace and pages, and opens multiple authenticated Yjs editor connections against the real API and WebSocket server. If internet access is unavailable, it uses a built-in Project Gutenberg excerpt. Each virtual editor has a unique cursor identity; the sessions share the configured load-test account, so this measures collaboration traffic rather than account-login scaling. It measures editor sync time, cursor presence, concurrent edit convergence, API latency, and load-generator memory, then deletes its temporary workspace. It does not modify an existing workspace or send email.

Start PostgreSQL and Redis, and run the API and WebSocket server in separate terminals:

```powershell
docker compose up -d postgres redis
npm run dev --workspace @collab/server
npm run server:ws
```

In another terminal, run the default 25-editor check. It signs in as `alex@example.test` using `DEMO_PASSWORD` from `.env` (or set `LOAD_TEST_EMAIL` and `LOAD_TEST_PASSWORD` for another account):

```powershell
npm run stress
```

Adjust the load and sample source as needed:

```powershell
npm run stress -- --editors 50 --pages 2 --source gutenberg
```

The script supports 1–250 editors and 1–20 temporary pages. Keep runs local or on a test deployment you control. The report is a functional load smoke test; use a dedicated load-testing environment for capacity claims.

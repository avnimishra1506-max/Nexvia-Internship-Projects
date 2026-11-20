# CollabSpace — Test Results & Performance Metrics

**Report date:** 2026-11-20
**Project:** Collab-Workspace (Vite + React app in `apps/web`, Express API in `apps/server`, Yjs WebSocket server in `websocket-server`)

> **Honesty note:** Is report mein sirf wahi results "PASS" hain jo is sandbox mein asli mein chale.
> Sandbox mein PostgreSQL, Redis aur internet nahi tha, isliye DB-dependent tests aur load test **NOT RUN** hain.
> Un par koi number nahi likha gaya. Unhe apni machine par chalane ke commands neeche diye hain.

## 1. Environment (jahan tests chale)

| Item | Value |
|---|---|
| OS | Linux sandbox (Ubuntu 24) |
| Node.js | v22.23.5 |
| npm | 10.9.9 |
| PostgreSQL / Redis | Not available |
| Network | Disabled |

## 2. Summary

| Status | Count |
|---|---|
| PASS (executed) | 3 |
| FAIL | 0 |
| NOT RUN (needs PostgreSQL/Redis) | 2 |

## 3. Executed test cases

| ID | Test case | Command | Result |
|---|---|---|---|
| TC-01 | Yjs documents converge after concurrent edits and can be restored from saved state | `cd apps/web && node --test test/yjs.test.mjs` | **PASS** (1/1, ~143 ms) |
| TC-02 | Workspace roles grant correct edit/manage abilities (OWNER, ADMIN, MEMBER, VIEWER) | `cd apps/server && node --test test/permissions.test.mjs` | **PASS** (1/1, ~181 ms) |
| TC-03 | Two peers share presence, converge after concurrent edits, and recover after reconnect (real y-websocket server + 2 providers) | `node scripts/verify-yjs-sync.mjs` | **PASS** (exit 0). Final doc: `"reconnect Beta Alpha baseline "` |

### Note on TC-02
Pehli baar `ERR_MODULE_NOT_FOUND` aaya kyunki zip mein `node_modules/@collab/shared` workspace link khali tha (Windows se zip karne ka packaging issue, code bug nahi). Link `node_modules/@collab/shared -> packages/shared` banane ke baad test pass hua. Apni machine par `npm install` ye link khud bana deta hai.

## 4. Test cases not executed

| ID | Test case | Why not run | How to run |
|---|---|---|---|
| TC-04 | API: authentication, workspace/page CRUD, invite roles, validation (`apps/server/test/api.test.mjs`) | Needs PostgreSQL | `docker compose up -d postgres redis` then `npm test --workspace @collab/server` |
| TC-05 | Phase 8 collaborative editor load test (`scripts/phase8-load-test.mjs`) | Needs PostgreSQL, API and WebSocket server running | See section 5 |

## 5. Performance metrics (load test)

Koi metric measure nahi hua, isliye neeche sab blank hai. Apni machine par ye chalao aur output yahan paste karo:

```powershell
docker compose up -d postgres redis
npm run dev --workspace @collab/server      # terminal 1
npm run server:ws                           # terminal 2
npm run stress                              # terminal 3 (default 25 editors)
npm run stress -- --editors 50 --pages 2 --source gutenberg
```

| Metric (script report ki lines) | 25 editors | 50 editors |
|---|---|---|
| Editors synchronized | _not measured_ | _not measured_ |
| Connect latency p50 / p95 / max (ms) | _not measured_ | _not measured_ |
| Concurrent edits converged | _not measured_ | _not measured_ |
| API request latency p50 / p95 (ms) | _not measured_ | _not measured_ |
| Load generator memory RSS / heap (MiB) | _not measured_ | _not measured_ |
| Total run time (s) | _not measured_ | _not measured_ |

Project ki README ke mutabiq ye local functional smoke test hai, production capacity benchmark nahi.

## 6. Other observations

- `.env` file zip mein included thi. Agar ye zip kisi ke saath share hua hai to `JWT_SECRET`, DB password aur `DEMO_PASSWORD` rotate kar do.
- `apps/server/package.json` ka `npm test` pehle `tsc` build chalata hai; TC-04 ke liye DB ke saath ye bhi verify hoga.

# 🛒 MyStore — Enterprise Full-Stack Grocery Supply Platform

![CI/CD Pipeline](https://github.com/heimdahl30/my_supplier_app/actions/workflows/ci-cd.yml/badge.svg)
[![Monorepo: Turborepo](https://img.shields.io/badge/Monorepo-Turborepo-EF4444?style=flat&logo=turborepo)](https://turbo.build)
[![Frontend: Next.js 15](https://img.shields.io/badge/Frontend-Next.js%2015-000000?style=flat&logo=next.js)](https://nextjs.org)
[![Backend: Node.js / Express](https://img.shields.io/badge/Backend-Node.js%20%2F%20Express-339933?style=flat&logo=node.js)](https://expressjs.com)
[![Database: PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-4169E1?style=flat&logo=postgresql)](https://postgresql.org)
[![Caching & Queues: Redis](https://img.shields.io/badge/Cache-Redis-DC382D?style=flat&logo=redis)](https://redis.io)
[![Real-Time: Socket.IO](https://img.shields.io/badge/Real--Time-Socket.IO-010101?style=flat&logo=socket.io)](https://socket.io)

An enterprise-grade, high-throughput full-stack grocery supply and real-time logistics platform. The system is engineered to handle highly concurrent order placements, mitigate race conditions via relational row locking, stream low-latency driver telemetry data, maintain strict cross-application session validation, and guarantee transactional database invariants across decoupled software boundaries.

---

## 🌐 Live Production Deployment

- **Live Storefront (Vercel):** [https://my-supplier-app.vercel.app](https://my-supplier-app.vercel.app)
- **Backend API & WebSocket Hub (Render):** [https://my-supplier-app.onrender.com](https://my-supplier-app.onrender.com)
- **Cloud Data Infrastructure:** Neon Serverless PostgreSQL + Upstash TLS Redis
- **Automated CI/CD:** GitHub Actions (Vitest + Supertest Integration + 8-Phase Playwright E2E) → Test-Gated Webhook CD

> _Note: The backend runs on Render's free tier—if the instance has spun down from inactivity, the initial API request may take ~30–50 seconds to cold-start._

---

## 🏗️ Roadmap & Deployed Status Tracking

The core logic, relational engines, transaction schemas, and integration testing suites of the system are fully operational. The final engineering milestones are mapped out as follows:

- **[🟢 DONE] Phase 1:** Decoupled Monorepo Architecture, Lazy Drivers, and State Isolation Maps.
- **[🟢 DONE] Phase 2:** Concurrency Matrix Row-Locking, Telemetry Handshakes, and Route Logic Testing.
- **[🟢 DONE] Phase 3: Comprehensive End-to-End (E2E) Test Coverage.** Full 8-phase browser simulation suite via Playwright alongside Vitest frontend unit tests and Supertest backend integration tests.
- **[🟢 DONE] Phase 4: CI/CD Pipeline Automation.** Multi-job GitHub Actions workflow provisioning ephemeral PostgreSQL & Redis containers, validating production builds, and gating deployments on green tests.
- **[🟢 DONE] Phase 5: Production Cloud Deployment.** Deployed live across Vercel (Next.js Edge), Render (Express + Socket.IO), Neon Serverless PostgreSQL, and Upstash TLS Redis with test-gated webhook CD.

---

## 🏛️ System Architecture & Scale-Out Strategy

The platform rejects monolithic limitations in favor of a hybrid, decoupled architecture model leveraging **Next.js** for client interaction interfaces and an independent **Express.js** core engine for heavy network processing.

```text
                                  ┌───────────────────────────┐
                                  │   Next.js Edge Cluster    │
                                  │ (Customer / Warehouse /   │
                                  │      Driver Portals)      │
                                  └─────────────┬─────────────┘
                                                │
                                    HTTP APIs   │   WebSockets
                                 (JSON Payloads) (Telemetry)
                                                ▼
┌───────────────────────────────────────────────┴───────────────────────────────────────────────┐
│                                    Node.js Express Backend                                    │
│                                                                                               │
│  ┌───────────────────────┐         ┌───────────────────────┐         ┌─────────────────────┐  │
│  │   App Configuration   │         │    Real-Time Server   │         │   Fintech Engine    │  │
│  │     (Express App)     │◄───────►│      (Socket.IO)      │◄───────►│  (Razorpay / HMAC)  │  │
│  └───────────────────────┘         └───────────────────────┘         └─────────────────────┘  │
└───────────────────────┬────────────────────────  ┬────────────────────────┬─────────────────────┘
                        │                          │                        │
                        ▼ (Lazy Pool/Transaction)  ▼ (TCP Socket Cluster)   ▼ (Webhook Broker)
           ┌────────────────────────┐┌────────────────────────┐┌────────────────────────┐
           │     PostgreSQL DB      ││   Redis Cache Engine   ││     Razorpay Cloud     │
           │ (ACID Invariant Store) ││ (Upstash TLS / Docker) ││   (Gateway Backend)    │
           └────────────────────────┘└────────────────────────┘└────────────────────────┘
```

### Why Next.js + Express.js?

- **Edge-Optimized Client Isolation:** Next.js acts as a dedicated presentation layer. By isolating the frontend client nodes, consumer-facing assets are rendered near the edge with optimized data fetching, completely separating the web UI traffic from core operational logistics processing.
- **Non-Blocking Backend Throughput:** Express.js acts as a dedicated, low-overhead transaction server. Because it is unburdened by server-side UI rendering workloads or asset serialization, the Express runtime dedicates 100% of its single-threaded event loop to high-frequency TCP socket tracking, database pooling routines, and payment webhooks. This provides strict boundary isolation and highly predictable linear scaling metrics.

---

## ⚡ Key Architectural Capabilities

### 1. Unified Frontend State Orchestration (React Context API)

To avoid the cognitive overhead of deeply nested prop-drilling or bulky external state engines, global reactive telemetry data is handled cleanly via the **React Context API**.

- **Real-Time Consumer Distribution:** High-frequency components (like live-tracking map containers, global cart counters, and authentication flags) read directly from isolated context providers.
- **Stream Coupling:** When real-time telemetry packets are captured via WebSockets, the context provider traps the incoming JSON payload and instantly propagates the downstream data matrix to all listening client panels simultaneously.

### 2. High-Security Cross-App Sessions (Signed Cookie Validation)

Authentication security completely avoids fragile, local-storage token storage vulnerable to Cross-Site Scripting (XSS) injections.

- **Cryptographic Cookie Interception:** The platform implements a rigid **HttpOnly, SameSite=None, Signed Cookie** authentication strategy.
- **State Verification:** Session payloads (JSON Web Tokens) are securely serialized and injected into response cookies by the Express backend using a robust `COOKIE_SECRET` hash signature.
- **Middleware Interceptors:** Every sub-route request intercepts the incoming cookie header, cryptographically verifies that the token was untampered with on the server, matches user roles (Customer, Warehouse staff, Driver), and allows secure access across isolated application boundaries.

### 3. Distributed Rate Limiting Mesh (Redis Token Buckets)

To protect vulnerable public authentication endpoints and order submission handlers from automated scripts, credential stuffing, and brute-force traffic loops, the platform implements a distributed **Rate Limiting Guardrail Mesh** utilizing Redis as a hyper-fast, atomic counter engine.

- **Brute-Force Interception:** Sensitive paths (such as `POST /api/v1/login` and `POST /api/v1/customers/signup`) are wrapped in custom rate-limiting middleware rules.
- **Atomic Redis Checkpoints:** Instead of using loose server memory allocations that disappear on app reboots, transaction counts are updated atomically inside Redis using unique user IP string keys.
- **The Security Boundary:** If an automated actor exceeds the maximum allowed request velocity threshold window, the backend instantly short-circuits the single-threaded Express event loop, completely bypassing expensive database lookups and returning a swift `429 Too Many Requests` API intercept message.

### 4. Fault-Tolerant Server-to-Server Payment Webhooks (Zero Frontend Dependency)

To ensure the system never drops an order status due to a consumer's unstable mobile network link, the core transactional infrastructure completely decouples payment confirmations from frontend event cues.

- **The Vulnerability:** Relying solely on client browser execution scripts to pass checkout success hashes down to a server is dangerous—a device battery crash, sudden cellular signal drop, or accidental browser closure mid-transaction results in unfulfilled paid orders.
- **The Webhook Insurance Solution:** The application maps out a robust, dedicated server-to-server gateway callback framework (`/api/v1/razorpay/webhook`). The exact microsecond the banking rails clear the capital transfer, Razorpay's main data centers bypass the client entirely and stream a heavy-duty HTTP `POST` event payload directly into our Express backend.
- **Cryptographic Invariant Security:** The endpoint utilizes Node's native `crypto` engine to compute server-side HMAC-SHA256 checksum verifications. This confirms the packet genuinely originated from Razorpay before triggering database status updates, guaranteeing complete execution protection.

### 5. Multi-Role Management Dashboards & Corporate Master Ledger

The platform features specialized workflows for distinct corporate roles, backed by highly complex relational data models.

- **Warehouse & Logistics Pipeline:** Warehouse operators consume a high-velocity packing grid queue fed on-demand by incoming transaction balances.
- **Driver Transit Matrix:** Features an optimized dispatch station enabling transit agents to lock available routes, claim active delivery operations, and process fulfillment paths.
- **The Executive Master Ledger:** For general store management operations, the system exposes a secure, high-level administrative insights hub. This module bypasses fragmented document streams to compile a master accounting ledger directly from database tables, generating real-time metrics on cumulative revenues, stock levels, active fulfillment statistics, and driver payout margins.

### 6. Reverse Logistics & Multi-Role Claims Management (The Refund Engine)

To support real-world marketplace operations, the platform features a complete, multi-step **Claims and Reverse Logistics Lifecycle** that securely bridges customer requests with executive oversight.

- **Image-Backed Customer Intake:** Customers can natively file dispute or refund tickets straight from their dashboards. The request intercepts textual problem reasons and processes image file array attachments (e.g., photo proofs of damaged goods) routed through an integrated storage bucket upload pipeline.
- **Manager Moderation Gateways:** Dispute requests enter a separate, highly secure administrative control board. Store managers can parse the reasons, evaluate the loaded image array artifacts, and execute an explicit `.patch()` command to globally **Approve** or **Reject** the claim.
- **Automated Financial Reversals:** Approving a refund instantly calls the Razorpay Payouts/Refunds API behind the scenes, using the order's original gateway transaction ID to safely trigger an automated bank account reversal without manual accounting friction.

### 7. Automated Direct Route Commissions (Driver Payout Splits)

Logistics economics are completely automated using an on-demand programmatic commission processor embedded directly inside the final fulfillment lifecycle.

- **The Split Invariant:** The moment a delivery partner records an order as safely dropped off at the customer's doorstep, the backend shields the database state using an atomic transaction context block.
- **Razorpay Route Integration:** Upon transitioning the row status to `"Delivered"`, the engine pulls the driver's unique `razorpaySubAccountId` from their profile column. It calculates the delivery partner's exact commission cut from the subtotal price parameters, and instantly executes a server-to-server transaction request to trigger a direct node-to-node fund transfer across the payment network rails.

### 8. All-or-Nothing Data Consistency (Relational Database Transactions)

Multi-step business procedures (such as completing an order checkout or logging a successful driver delivery drop) are strictly wrapped inside explicit **Database Transactions (`db.transaction()`)** to enforce strict ACID rules.

- **The Problem:** Processing an entry (like creating an invoice invoice record, decreasing warehouse inventory tables, and modifying an order status row) requires modifying multiple database tables in sequence. A failure midway would leave a corrupt, inconsistent database state.
- **The Architecture Fix:** By enforcing an all-or-nothing wrapper, Drizzle ensures that every independent query executes successfully in memory. If a single step fails or errors out—like a product catalog inventory count hitting zero—the database engine aborts execution instantly and triggers a complete **Rollback**. The entire sequence resets, ensuring either everything passes or nothing passes.

### 9. Concurrency Management: Relational Row Locking (`FOR UPDATE`)

To prevent dangerous multi-driver data races—where two delivery personnel simultaneously attempt to claim the exact same delivery route—the backend rejects soft application-level logic verification checks. Instead, it utilizes native database **Pessimistic Locking Mechanisms** at the ACID layer.

- **Atomic Interception:** When a driver targets an order via the delivery selection route, the backend opens an explicit database transaction and appends a **`FOR UPDATE`** clause to the SQL select string using Drizzle.
- **Race Condition Blockers:** This mechanism signals PostgreSQL to lock that specific row instantly at the kernel engine level. If a second driver fires a claim request milliseconds later, their transaction is forced to halt in queue until the first transaction completes.
- **State Verification Guardrails:** If the first transaction successfully writes the driver’s unique `deliveryPartnerId` and updates the state column from `"Packing"` to `"Out for Delivery"`, the second transaction wakes up, evaluates the modified row criteria, returns an empty payload array, and safe-halts via an active `400 Bad Request` guardrail interceptor.

### 10. High-Precision Geospatial Telemetry Layers (Leaflet Integration)

Real-time tracking features bind live coordinates directly across visual client interfaces and underlying networking protocols.

- **Leaflet GIS Integration:** The client portals integrate interactive, ultra-lightweight **Leaflet GIS Canvas Maps**. It handles dynamic client-side raster tile layouts, tracking vector polyline corridors, and plotting real-time marker pins using high-performance graphic overlays.
- **Socket.IO Telemetry Pipes:** Driver mobile devices push raw telemetry coordinate updates down to the Express server via low-overhead WebSocket streams. The server taps into named room matrices (`order_${orderId}`) to broadcast the incoming telemetry packages right into the customer's Leaflet dashboard instances, generating smooth real-time map updates without continuous HTTP polling.

### 11. Core Database Invariants: Why PostgreSQL?

The application intentionally selects **PostgreSQL** over NoSQL alternatives (like MongoDB) to function as the master relational ledger system for several critical engineering reasons:

- **True Multi-Row ACID Guarantees:** Storefront checkouts require absolute consistency across separate logical entities. PostgreSQL ensures these mutations execute atomically.
- **Complex Relational Joining Engines:** Operational dashboards frequently execute heavy relational query joins across customers, products, dispatch records, and driver sub-accounts. PostgreSQL's sophisticated query optimizer maps these requests using indexed scan arrays, outperforming the expensive aggregate pipelines required by document-based databases.
- **Strict Schema Type Integrity:** Relational schema enforcements guarantee that empty string parameters, unexpected datatypes, or malformed payloads are immediately blocked before writing to disk, establishing complete runtime reliability.

---

## 📂 Repository Structure

The monorepo organizes its code using clean, separate workspace paths:

```text
my-supply-app-monorepo/
├── .github/
│   └── workflows/
│       └── ci-cd.yml          # Automated CI/CD pipeline (Tests + Playwright E2E + Webhook CD)
├── apps/
│   ├── frontend/              # Next.js 15 App Router (Leaflet GIS Maps, React Context, Vitest)
│   └── backend/               # Express API Server & Socket.IO Real-Time Telemetry Hub
│       ├── src/
│       │   ├── app.ts         # Express & Socket.IO configuration, CORS, & middleware pipeline
│       │   ├── server.ts      # Production HTTP + WebSocket listener entrypoint
│       │   ├── db/            # Drizzle ORM schema definitions, drivers, & connection pool
│       │   ├── middlewares/   # JWT cookie auth guards, role checks, & Redis rate limiters
│       │   └── routes/        # Auth, Orders (FOR UPDATE locking), Razorpay webhooks, & Admin
│       └── tests/             # Supertest + node:test backend integration suites
├── e2e/                       # 8-phase full-stack Playwright E2E test suite
├── playwright.config.ts       # Playwright orchestration config
├── package.json               # Turborepo / pnpm workspace root configuration
└── pnpm-workspace.yaml        # Workspace package definitions
```

---

## 🔬 Testing Strategy & Automated CI/CD

The platform is verified across three automated testing layers executed on every push and pull request via **GitHub Actions**:

1. **Backend Integration Tests (`node --test` + Supertest):**
    - Spins up isolated PostgreSQL and Redis instances, pushes the Drizzle schema (`drizzle-kit push`), and verifies authentication, RBAC permissions, rate limiting, Razorpay webhooks, and `FOR UPDATE` concurrency locks.
2. **Frontend Component Unit Tests (`Vitest` + MSW):**
    - Validates React forms, interactive address/map modals, and mocked API boundaries.
3. **Full-Stack End-to-End Browser Verification (`Playwright`):**
    - Runs an automated 8-phase Chromium walkthrough covering customer signup/login, product catalog creation, checkout & webhook confirmation, warehouse packing, driver claim & live GPS telemetry, delivery split payout, and admin refund approval.

To run the test suites locally:

```bash
# Backend integration tests
pnpm test

# Frontend unit tests
pnpm --filter frontend test

# Full-stack Playwright E2E suite
npx playwright test
```

---

## 🚀 Local Development Setup

### 1. Start Local Redis Cache

Ensure Docker Desktop is running, then start your local Redis container:

```bash
docker start my-redis
```

### 2. Install Workspace Dependencies

From the root of the monorepo:

```bash
pnpm install
```

### 3. Push Database Schema

Push your Drizzle schema to your local PostgreSQL instance:

```bash
cd apps/backend && npx drizzle-kit push && cd ../..
```

### 4. Run Backend & Frontend Concurrently

Open two terminal windows from the repository root:

- **Start the Express.js + Socket.IO Backend (`http://localhost:5000`):**
    ```bash
    pnpm --filter my-supply-app-express-backend dev
    ```
- **Start the Next.js Frontend (`http://localhost:3000`):**
    ```bash
    pnpm --filter frontend dev
    ```

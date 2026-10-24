# 🛒 MyStore — Enterprise Full-Stack Grocery Supply Platform

[![Monorepo: Turborepo](https://img.shields.io/badge/Monorepo-Turborepo-EF4444?style=flat&logo=turborepo)](https://turbo.build)
[![Frontend: Next.js 15](https://img.shields.io/badge/Frontend-Next.js%2015-000000?style=flat&logo=next.js)](https://nextjs.org)
[![Backend: Node.js / Express](https://img.shields.io/badge/Backend-Node.js%20%2F%20Express-339933?style=flat&logo=node.js)](https://expressjs.com)
[![Database: PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-4169E1?style=flat&logo=postgresql)](https://postgresql.org)
[![Caching & Queues: Redis](https://img.shields.io/badge/Cache-Redis-DC382D?style=flat&logo=redis)](https://redis.io)
[![Real-Time: Socket.IO](https://img.shields.io/badge/Real--Time-Socket.IO-010101?style=flat&logo=socket.io)](https://socket.io)

An enterprise-grade, high-throughput full-stack grocery supply and real-time logistics platform. The system is engineered to handle highly concurrent order placements, mitigate race conditions via relational row locking, stream low-latency driver telemetry data, maintain strict cross-application session validation, and guarantee transactional database invariants across decoupled software boundaries.

---

## 🏗️ Roadmap & Deployed Status Tracking

The core logic, relational engines, transaction schemas, and integration testing suites of the system are fully operational. The final engineering milestones are mapped out as follows:

- **[🟢 DONE] Phase 1:** Decoupled Monorepo Architecture, Lazy Drivers, and State Isolation Maps.
- **[🟢 DONE] Phase 2:** Concurrency Matrix Row-Locking, Telemetry Handshakes, and Route Logic Testing.
- **[⏳ PENDING] Phase 3: Comprehensive End-to-End (E2E) Test Coverage.** Designing complete graphical user interface simulation automation scripts via Playwright/Cypress.
- **[⏳ PENDING] Phase 4: CI/CD Pipeline Automation.** Building out heavy GitHub Actions delivery workflows to test code layers on every commit pull request.
- **[🚀 UPCOMING] Phase 5: Production Cloud Deployment.** The platform will be deployed live to distributed edge networks (Vercel / Render / AWS) immediately upon the successful completion of E2E verification pipelines and green CI/CD configurations.

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
           │ (ACID Invariant Store) ││ (Docker Sandbox Mesh)  ││   (Gateway Backend)    │
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

- **Cryptographic Cookie Interception:** The platform implements a rigid **HttpOnly, SameSite=Strict, Signed Cookie** authentication strategy.
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
mystore/
├── apps/
│   ├── frontend/             # Next.js 15 Platform (Leaflet GIS Maps, React Context Providers)
│   └── backend/              # Express API Server Core & Socket.IO Telemetry Hubs
│       ├── src/
│       │   ├── app.ts        # Dormant, un-listening App & Socket.IO configurations
│       │   ├── server.ts     # Production port activation execution entrypoint
│       │   ├── index.ts      # Global routing entrypoint mount pipeline registry
│       │   ├── db/           # Drizzle Schema definitions, Drivers, & Pool clients
│       │   ├── middlewares/  # Authentication interceptors & validation guards
│       │   └── routes/       # Auth, Order Row Locking Transactions, & Logistics paths
│       └── tests/            # Automated Integration test suites (Auth, Admin, Delivery)
├── package.json              # Shared monorepo dependency workspace configuration
└── .gitignore                # Recursive root-level pattern ignore filter
```

---

## 🔬 Testing Strategy & Environmental Isolation

The platform contains a robust integration testing framework built using Node's native runner (`node --test`), Supertest, and a dedicated database testing container.

Tests follow a strict, isolated lifecycle flow to ensure results are always reliable and reproducible:

1. **`before()` Bootstrapping:** Explicitly connects the eager Redis client handles and prepares clean test sandbox schemas before any network routes fire.
2. **Deterministic Interception:** Intercepts database tables directly during intermediate checkout tests using Drizzle queries, simulating successful webhooks to update order statuses instantly without hitting real external payment processing networks.
3. **`after()` Teardown Hooks:** Implements an ordered cleanup sequence. It securely terminates Socket.IO ping timers (`io.close()`), flushes the active Redis test keyspaces (`redisClient.flushDb()`), and closes out the Postgres pool to ensure no active handles are left hanging.

To execute the automated integration test pipeline, run the following command from the root directory:

```bash
pnpm test
```

---

## 🚀 Execution & Local Development Setup

The monorepo architecture allows granular execution control. Applications and cache containers can be targeted individually across isolated terminal windows during active feature development phases.

### 1. Activating the Backend Infrastructure Sockets

Ensure Docker Desktop is active. Spin up your dedicated local cache container engine handle over your system port channels:

```bash
docker start my-redis
```

### 2. Bootstrapping Project Dependencies

From the absolute root directory of the monorepo workspace, download your collective application package maps recursively:

```bash
pnpm install
```

### 3. Running the Microservice Cluster via Target Filters

Open separate terminal tracking contexts to run the apps independently, allowing you to isolate log traces cleanly:

- **To initialize the Express.js Backend Telemetry Hub:**
    ```bash
    pnpm --filter my-supply-app-express-backend dev
    ```
- **To initialize the Next.js Frontend Presentation Layer:**
    ```bash
    pnpm --filter frontend dev
    ```

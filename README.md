# Blue Carbon Registry & MRV Platform

An end-to-end climate-tech MRV (Monitoring, Reporting & Verification) platform that combines
mobile field-data collection, computer-vision ecosystem analysis, geospatial data management
and a permissioned Hyperledger Fabric blockchain to create an auditable lineage from field
evidence to a verified digital carbon asset.

Built for **mangrove, seagrass and tidal salt-marsh** ecosystems as a Project-II capstone at
Dronacharya College of Engineering.

> **This is a prototype, not a production carbon registry.** Tokenized records represent a
> digital, tamper-evident representation of an internally-validated MRV submission — **not**
> a legally certified carbon credit. AI outputs are decision-support, not a replacement for
> expert ecological survey or independent verification. See [Limitations](#limitations--honesty-notes).

## Live demo

- **Web app:** [blockchain-carbon-based-mrv-system.vercel.app](https://blockchain-carbon-based-mrv-system.vercel.app/)
  — use the **Continue as Validator** / **Continue as Admin** buttons on the login page to explore
  those roles without creating an account, or register as a field operator to try the full
  observation → AI analysis → validation flow.
- **Backend API:** [blue-carbon-backend-tvtf.onrender.com](https://blue-carbon-backend-tvtf.onrender.com/api/system/health) (health check) ·
  [interactive API docs](https://blue-carbon-backend-tvtf.onrender.com/api/docs)
- **AI/ML service:** [blue-carbon-ai.onrender.com](https://blue-carbon-ai.onrender.com/health)

Hosted on free tiers (Vercel + Render + Supabase) - the backend and AI service spin down after
~15 minutes idle, so the first request after a while can take up to ~50 seconds to wake up; a
reload after that is fast. Hyperledger Fabric runs locally only, not in this hosted deployment -
see [Why Fabric stays local](docs/DEPLOYMENT.md#why-fabric-stays-local) for why, and
[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for how this deployment itself was put together.

## Blockchain in action (local demo)

The hosted deployment above runs with `FABRIC_ENABLED=false`, so it won't show any chaincode
activity on its own (see [Why Fabric stays local](docs/DEPLOYMENT.md#why-fabric-stays-local)).
This is what it looks like running for real, locally, against an actual permissioned Hyperledger
Fabric network - a validator approving a submitted record and issuing a carbon asset, each step
writing a real transaction to the ledger:

<video src="https://github.com/user-attachments/assets/c1e9fd30-a9f5-4f17-9364-fc2ce86fbaef" controls width="100%"></video>

A transaction from that same run (`MRV-000055` → asset `BC-000055`), exactly as the Blockchain
Explorer page displays it (hashes truncated for the UI, not fabricated for this readme):

```
CreateMRVRecord    caff2f52...287cdd
ValidateMRVRecord  b69e0c8a...4f7319
IssueCarbonToken   46904a0f...27e7aa   (ledger status: committed)
```

To run this yourself: [`network/README.md`](network/README.md) brings up the same two-org Fabric
test network (orderer, two peers, two CouchDB instances, `mrv-contract` chaincode) locally.

---

## Table of contents

- [Live demo](#live-demo)
- [Blockchain in action (local demo)](#blockchain-in-action-local-demo)
- [Why this exists](#why-this-exists)
- [Data lineage](#data-lineage)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Repository layout](#repository-layout)
- [Implementation status](#implementation-status)
- [Getting started](#getting-started)
- [Limitations & honesty notes](#limitations--honesty-notes)
- [License](#license)

## Why this exists

Blue-carbon ecosystems (mangroves, seagrass meadows, tidal salt marshes) sequester significant
carbon, but MRV for blue-carbon projects is often fragmented across spreadsheets, disconnected
photo archives and manual audit trails — making duplicate or inconsistent reporting hard to
catch and carbon-credit claims hard to trust. This project prototypes a single traceable
workflow: a field worker captures geo-tagged evidence on a mobile app, a computer-vision
pipeline assists with ecosystem classification and coverage estimation, a transparent
calculation converts that into a carbon estimate, and — once validated — the record is written
to a permissioned blockchain ledger and represented as a digital asset, with every step linked
by ID for full auditability.

## Data lineage

Every MRV record is traceable end-to-end:

```
Evidence (image + GPS + timestamp)
  → Evidence hash (SHA-256)
    → Field Observation record
      → AI Analysis (ecosystem classification + coverage estimate)
        → Carbon Calculation (coverage × area × configurable factor)
          → MRV Record (draft → submitted → validated)
            → Validation Event (human review, duplicate check)
              → Hyperledger Fabric transaction (chaincode-enforced state machine)
                → Tokenized Carbon Asset (prototype digital representation)
```

## Architecture

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full breakdown. High level:

```
Flutter mobile app  ──REST──▶  Node.js/Express API  ──▶  PostgreSQL + PostGIS
  (offline-first,                     │  │                 (spatial data)
   Hive queue)                        │  └──▶  S3-compatible object storage
                                      │         (evidence images, hashed)
                                      ├──▶  Python AI/ML service
                                      │     (ecosystem classification +
                                      │      vegetation coverage estimate)
                                      │
                                      └──▶  Hyperledger Fabric network
                                            (chaincode: validate → record →
                                             tokenize)
                                                  ▲
Next.js dashboard  ──REST──────────────────────────┘
  (map, MRV detail, blockchain explorer, audit center)
```

## Tech stack

| Layer | Technology |
|---|---|
| Mobile | Flutter, Hive (offline queue) |
| Backend API | Node.js, Express, TypeScript |
| Database | PostgreSQL + PostGIS |
| Object storage | S3-compatible (MinIO locally, AWS S3 in production) |
| AI/ML | Python, FastAPI, PyTorch + Transformers (CLIP zero-shot), NumPy/Pillow |
| Blockchain | Hyperledger Fabric (chaincode in Node.js) |
| Web dashboard | Next.js, TypeScript, Tailwind CSS |
| Infra | Docker Compose, GitHub Actions |

## Repository layout

```
apps/
  backend/     Node.js + Express + TypeScript REST API
  web/         Next.js dashboard
  mobile/      Flutter field-collection app
chaincode/
  mrv-contract/  Hyperledger Fabric chaincode (Node.js)
ml-service/    Python FastAPI AI/ML inference service
network/       Hyperledger Fabric network config (test network)
infra/         Docker Compose, Postgres init, MinIO config
docs/          Architecture, API, schema, setup documentation
```

## Implementation status

This repo is being built incrementally, phase by phase, with working/tested code committed at
each milestone (see commit history). Current status:

| Phase | Area | Status |
|---|---|---|
| 1 | Repo scaffold & architecture | ✅ done |
| 2 | Database schema + PostGIS migrations | ✅ done |
| 3 | Auth + RBAC | ✅ done |
| 4 | Backend API (observations, evidence, carbon reference data) | ✅ done |
| 5 | Object storage + evidence hashing | ✅ done |
| 6 | AI/ML pipeline (heuristic classification + coverage) | ✅ done |
| 7 | Carbon calculation engine | ✅ done |
| 8 | MRV validation workflow + duplicate detection | ✅ done |
| 9 | Hyperledger Fabric network | ✅ done |
| 10 | Chaincode | ✅ done |
| 11 | Backend ↔ Fabric integration | ✅ done |
| 12 | Next.js dashboard | ✅ done |
| 13 | Flutter mobile app | ✅ done |
| 14 | Offline sync | ✅ done |
| 15 | Testing | 🔄 ongoing per-phase |
| 16 | Docker + CI/CD | ✅ done |
| 17 | Documentation & polish | 🔄 ongoing |

## Getting started

### Quick start (Docker Compose)

Requires Docker Desktop and a `.env` file (`cp .env.example .env` works as-is — the defaults
are for local development, not production).

```bash
docker compose up -d --build
```

This builds and starts Postgres/PostGIS, MinIO, the AI/ML service, runs database migrations
once, then starts the backend API and web dashboard:

| Service | URL |
|---|---|
| Web dashboard | http://localhost:3000 |
| Backend API | http://localhost:4000 (health: `/api/system/health`, interactive docs: `/api/docs`) |
| MinIO console | http://localhost:9003 |

Create a field-operator account from the dashboard's register page. Validator/admin accounts
are never created through open sign-up (see `authService.registerUser`) — seed them by running
the seed script from your host (it targets Postgres' published port, `localhost:5434` by
default, so it works against the Dockerized database without needing anything inside the
container):

```bash
npm install                               # once, at the repo root
npm run seed --workspace=apps/backend
```

The Hyperledger Fabric network is **not** part of this compose file — it's a separate, heavier
process using the official `fabric-samples` tooling. Without it, blockchain-dependent actions
(tokenization) are honestly disabled rather than faked; the health check reports
`"blockchain": {"status": "disabled"}`. See [`network/README.md`](network/README.md) to stand
it up, then set `FABRIC_ENABLED=true` in `.env` and restart the backend.

### Local development (no Docker for the app itself)

Requires Node.js 20+, Python 3.11+, and Docker only for Postgres/MinIO.

```bash
cp .env.example .env          # edit if needed
docker compose up -d postgres minio minio-init ml-service
npm install
npm run migrate:up --workspace=apps/backend
npm run seed --workspace=apps/backend     # creates validator/admin dev accounts
npm run dev:backend                       # apps/backend, port 4000
npm run dev:web                           # apps/web, port 3000 (separate terminal)
```

### Mobile app (field observation capture)

Requires the [Flutter SDK](https://docs.flutter.dev/get-started/install) and the backend
running (see above - `apps/mobile/lib/config/api_config.dart` points at `localhost:4000`,
which the dev backend accepts requests from regardless of which local port you run on).

```bash
cd apps/mobile
flutter pub get
flutter run -d chrome    # or -d windows (needs Developer Mode enabled for plugin builds)
```

The app is intentionally scoped to what a field operator needs - capture, offline queue, submit
- not the full dashboard (that's the web app's job). Every observation is written to a local
Hive-backed queue first and uploaded automatically once the device is online, so capture never
blocks on connectivity.

### Running tests

```bash
npm test --workspace=apps/backend    # 31 tests; Fabric-dependent ones skip if FABRIC_ENABLED=false
npm test --workspace=apps/web
npm test --workspace=chaincode/mrv-contract
cd apps/mobile && flutter test       # includes integration tests that hit the real backend
```

### Deploying it publicly

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) - a free-tier deployment (Vercel + Render +
Supabase + Cloudflare R2) with Hyperledger Fabric deliberately left running locally rather than
hosted (that doc explains why).

## Limitations & honesty notes

- **Not a certified carbon registry.** Token/asset issuance is a prototype digital
  representation of a validated MRV record, not a legally recognized carbon credit.
- **AI is decision-support, not ground truth.** Ecosystem classification and coverage
  estimation are explicitly separated from area/carbon calculation, and every AI result is
  labeled with its confidence and model mode (see [`docs/AI_PIPELINE.md`](docs/AI_PIPELINE.md)
  once published). Where a trained, domain-specific model isn't available, the system uses a
  clearly-labeled pretrained/heuristic development model rather than pretending otherwise.
- **No satellite/remote-sensing validation, no live IoT sensor feeds, no external carbon
  registry integration** — explicitly out of scope for this prototype (see the project
  synopsis).
- **Permissioned blockchain, not a public chain.** The Hyperledger Fabric network runs
  locally for development/demo purposes.

## License

[MIT](LICENSE)

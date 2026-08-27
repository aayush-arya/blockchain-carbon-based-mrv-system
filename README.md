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

---

## Table of contents

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
   SQLite queue)                      │  └──▶  S3-compatible object storage
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
| Mobile | Flutter, SQLite/Hive (offline queue) |
| Backend API | Node.js, Express, TypeScript |
| Database | PostgreSQL + PostGIS |
| Object storage | S3-compatible (MinIO locally, AWS S3 in production) |
| AI/ML | Python, FastAPI, TensorFlow/scikit-image |
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
| 8 | MRV validation workflow + duplicate detection | 🔄 in progress |
| 9 | Hyperledger Fabric network | ⬜ planned |
| 10 | Chaincode | ⬜ planned |
| 11 | Backend ↔ Fabric integration | ⬜ planned |
| 12 | Next.js dashboard | ⬜ planned |
| 13 | Flutter mobile app | ⬜ planned |
| 14 | Offline sync | ⬜ planned |
| 15 | Testing | 🔄 ongoing per-phase |
| 16 | Docker + CI/CD | ⬜ planned |
| 17 | Documentation & polish | ⬜ planned |

## Getting started

Full setup instructions land in [`docs/SETUP.md`](docs/SETUP.md) as each service becomes
runnable. Requires Docker Desktop, Node.js 20+, Python 3.11+, and (for the mobile app) the
Flutter SDK.

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

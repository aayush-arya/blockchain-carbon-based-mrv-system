# Architecture

## Overview

The platform is a set of independently-runnable services that share one PostgreSQL/PostGIS
database and communicate over REST:

| Service | Role |
|---|---|
| `apps/backend` | Source of truth REST API. Owns auth, RBAC, the database, storage, carbon calculation, validation workflow, and the Fabric Gateway client. |
| `apps/web` | Next.js dashboard. Talks only to `apps/backend`'s REST API — never touches the database or Fabric directly. |
| `apps/mobile` | Flutter field app. Talks to `apps/backend`'s REST API; queues submissions locally (Hive) when offline and syncs automatically on reconnect. |
| `ml-service` | Stateless Python inference service. `apps/backend` calls it synchronously with an image; it returns classification + coverage + confidence. No direct database or blockchain access. |
| `chaincode/mrv-contract` | Hyperledger Fabric chaincode. The only thing that can write to the ledger. `apps/backend` submits transactions through the Fabric Gateway SDK; it never bypasses chaincode validation. |
| `network/` | Hyperledger Fabric test network config (orderer, 2 peer orgs, CAs, channel). Local/dev only. |

Keeping the web and mobile clients backend-only (no direct DB/Fabric access from the frontend)
is deliberate: it means every write goes through one place that enforces auth, validation and
audit logging, and it keeps the Fabric identity/wallet material off of user-facing clients.

## Data lineage

See the [README](../README.md#data-lineage) for the high-level chain. Concretely, each stage is
a row (or set of rows) linked by foreign key to the next:

```
evidence_files.sha256_hash          (evidence integrity)
        │  FK
field_observations                  (what/where/when/who)
        │  FK
ai_analysis                         (ecosystem class + coverage %, with model_mode label)
        │  FK
mrv_records                         (carbon calculation + status state machine)
        │  FK
validation_events                   (human review timeline)
        │  FK
blockchain_assets                   (Fabric tx id, evidence hash on-chain, asset id)
```

Nothing is deleted from this chain — corrections happen by adding new validation events or
superseding records, never by mutating history. `audit_logs` captures every state-changing
action independently of the domain tables, so the audit trail survives even if a specific
domain row is later reinterpreted.

## MRV status state machine

Enforced both in the backend service layer and in chaincode (chaincode is the final authority
once a record is submitted on-chain):

```
DRAFT → SUBMITTED → AI_ANALYZED → PENDING_VALIDATION → VERIFIED → TOKENIZED
                                          │
                                          └──▶ REJECTED
```

No other transitions are allowed. A record cannot be tokenized without first being `VERIFIED`,
and a `VERIFIED` record cannot receive a second token (enforced in chaincode — see
`chaincode/mrv-contract`).

## Why a permissioned blockchain here

A public chain would mean unrestricted write access and per-transaction gas costs for what is,
functionally, an internal audit log shared between known organizations (field teams, NGOs,
validators, government). Hyperledger Fabric's permissioned model fits: identities are
certificate-based, only authorized orgs can endorse transactions, and there's no token
economics to reason about. The blockchain's job here is narrow and specific — provide a
tamper-evident, independently-verifiable record of *validated* MRV events and their evidence
hashes, not to be a general-purpose ledger.

Large binary evidence (images) never goes on-chain. Only the SHA-256 hash does. Images live in
S3-compatible object storage, referenced by storage key from Postgres.

## AI pipeline honesty

The AI service explicitly separates three different claims that are easy to conflate:

1. **Classification** — "this image looks like a mangrove" (a label + confidence).
2. **Coverage estimation** — "vegetation covers ~X% of the visible frame" (a heuristic
   vegetation-index calculation over the image, not a trained segmentation model, unless
   `ML_MODEL_MODE=pretrained` and a real model is configured).
3. **Area / carbon calculation** — a separate, deterministic, auditable arithmetic step in the
   backend that multiplies coverage by a user-supplied or estimated area and a configurable,
   versioned carbon factor.

The system never presents (2) as if it were a physical area measurement, and every AI result
carries `model_mode` so the UI can show whether a result came from a heuristic or a trained
model. See `ml-service/README.md` for the current mode and its limitations.

## Security model summary

Full detail in [`SECURITY.md`](SECURITY.md).

- Passwords: bcrypt.
- Sessions: short-lived JWT access token + longer-lived refresh token.
- Authorization: role middleware on every route (`field_operator`, `validator`, `admin`),
  enforced server-side — the web/mobile UI hiding a button is not a security boundary.
- File uploads: MIME allowlist, size limit, re-encoded/validated before hashing and storage.
- Fabric identities: one enrolled identity per backend service instance via a Fabric wallet,
  never exposed to clients.
- Secrets: `.env` only, never committed; `.env.example` documents required variables.

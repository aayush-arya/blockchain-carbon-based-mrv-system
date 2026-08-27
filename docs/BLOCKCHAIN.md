# Blockchain integration

## Division of labor between Postgres and the ledger

The backend's off-chain state machine (`draft → submitted → ai_analyzed → pending_validation →
verified/rejected`, see `docs/ARCHITECTURE.md`) runs entirely in Postgres and is where AI
analysis, carbon calculation, and off-chain duplicate screening happen — none of that needs to
be, or should be, on-chain. It's mutable working state, not the audit record.

The chain gets involved once a record reaches **`pending_validation`** — that's the point where
"application-level validation" (per the project synopsis) is complete and the record becomes a
candidate for a permanent, tamper-evident audit trail. From there, the chaincode's own state
machine (`PENDING_VALIDATION → VERIFIED → TOKENIZED`, or `PENDING_VALIDATION → REJECTED`) takes
over as the authority: **the validator's approve/reject decision is itself an on-chain
transaction**, not just a Postgres row update mirrored to the chain afterward. That's a
deliberate choice — it means the human decision is part of the immutable history, queryable via
`GetTransactionHistory`, not just the final outcome.

| Backend transition | Chaincode call |
|---|---|
| `calculateMrvRecord` (ai_analyzed → pending_validation) | `CreateMRVRecord` |
| `approveMrvRecord` (pending_validation → verified) | `ValidateMRVRecord` |
| `rejectMrvRecord` (pending_validation → rejected) | `RejectMRVRecord` |
| tokenization (verified → tokenized) | `IssueCarbonToken` |

Each backend transition calls Fabric **before** committing its own Postgres update, so a
chain failure blocks the off-chain transition too rather than letting the two drift out of
sync. See `apps/backend/src/services/fabricService.ts`.

## Why CreateMRVRecord starts at PENDING_VALIDATION, not DRAFT/SUBMITTED/AI_ANALYZED

Those earlier statuses are working state — an operator iterating on a submission, an AI
re-analysis after a bad first pass — with no audit value on their own. Recording every
intermediate keystroke on an immutable ledger would bloat the chain with churn nobody will ever
want to query. The chain's job is to answer "what was validated, by whom, and was it ever
tokenized" — which is exactly `PENDING_VALIDATION` onward.

## Defense in depth on duplicates

The backend already screens for duplicates before submission (`duplicateDetectionService.ts` —
exact evidence hash + geospatial/time proximity). The chaincode does **not** re-run that
screening (it has no geospatial query capability, and re-implementing PostGIS logic in
chaincode would be redundant), but it does independently refuse to record the same evidence
hash twice (`CreateMRVRecord`, via a deterministic key lookup, not a rich query — see the
comment in `mrvContract.js` about why rich queries aren't used for anything endorsement-critical).
This means even a bug or bypass in the backend's own duplicate check can't produce two on-chain
records for the same evidence.

## Query functions require CouchDB

`QueryByEcosystem`, `QueryByContributor`, `QueryByStatus`, and `QueryMRVRecords` use Fabric's
rich-query API (`getQueryResult` with a CouchDB selector). The test network must be started
with `-s couchdb` (see `network/README.md`) or these calls fail. `CreateMRVRecord`'s duplicate
check and every status transition deliberately avoid rich queries — those still work on the
default LevelDB state database, since only the read-side convenience queries need CouchDB.

## Identity and connection

The backend holds one enrolled Fabric identity (`FABRIC_USER_ID`) in a local wallet
(`FABRIC_WALLET_PATH`), connecting via the `@hyperledger/fabric-gateway` SDK using the
connection profile `network.sh` generates. Clients (web, mobile) never touch Fabric directly —
see `docs/ARCHITECTURE.md` for why that boundary exists.

## Honesty note

`FABRIC_ENABLED=false` is the default. With it off, the backend's MRV workflow runs entirely
off-chain (useful for demoing/testing the AI + carbon + validation pipeline without standing up
the network) and the health check reports blockchain as `disabled`, not a fake green status.
Set it to `true` once `network.sh up createChannel -s couchdb` and the chaincode deploy have
both succeeded.

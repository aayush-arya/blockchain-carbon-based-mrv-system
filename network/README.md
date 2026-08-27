# Hyperledger Fabric network

Local permissioned Fabric network for development/demo, built on the official
[`fabric-samples`](https://github.com/hyperledger/fabric-samples) test-network tooling rather
than hand-rolled crypto material and docker-compose — that tooling is the standard, correct way
to stand up a Fabric dev network, and re-implementing it would just be reproducing (worse) what
already exists and is maintained upstream.

`fabric-samples/` is **not** committed to this repo (see `.gitignore`) — it's a large, official,
third-party toolkit fetched on demand, the same way you wouldn't vendor `node_modules`.

## ⚠️ Windows: clone it to a path with no spaces

Fabric's own shell scripts (`network.sh` and the helpers it sources) are not robust to spaces
in paths — they break `pushd`/`popd`, `jq`-based config patching, and file lookups whenever a
directory in the path contains a space (e.g. a username like `Aayush Projects`, or `OneDrive -
Company`). This is a known, longstanding Fabric-on-Windows pain point, not something this
project's tooling can fix by patching vendored third-party scripts. The fix used here: clone
`fabric-samples` **outside** this repo, into a space-free path such as
`C:\Users\<you>\fabric-dev\fabric-samples`, and point the backend's `FABRIC_*` env vars
(absolute paths) at it. macOS/Linux users without spaces in their path can instead clone it
directly into `network/fabric-samples` as usual.

## One-time setup (Windows path shown; adjust the destination if you're not on Windows)

```bash
mkdir -p /c/Users/<you>/fabric-dev
cd /c/Users/<you>/fabric-dev
git clone --depth 1 https://github.com/hyperledger/fabric-samples.git
cd fabric-samples
curl -sSL https://raw.githubusercontent.com/hyperledger/fabric/main/scripts/bootstrap.sh -o bootstrap.sh
chmod +x bootstrap.sh
./bootstrap.sh 2.5.16 1.5.17   # binaries + docker images (~1.5GB total download)
```

Requires Docker Desktop running. Update `apps/backend/.env`'s `FABRIC_*` paths (see
`.env.example`) to point at wherever you cloned it.

## Bring the network up

CouchDB (not the default LevelDB) is required — the chaincode's `QueryByEcosystem` /
`QueryByContributor` / `QueryByStatus` functions use CouchDB rich queries:

```bash
cd /c/Users/<you>/fabric-dev/fabric-samples/test-network
./network.sh up createChannel -c mrvchannel -s couchdb
```

This creates a two-org network (`Org1`, `Org2`), each with one peer, plus an ordering
service, and creates the `mrvchannel` channel both orgs join. Crypto material is generated
fresh under `organizations/` (gitignored — never committed, regenerated per environment).

## Deploy the chaincode

Use an absolute path to `-ccp` since `fabric-samples` no longer lives inside this repo:

```bash
./network.sh deployCC -ccn mrv-contract -ccl javascript \
  -ccp "/c/Users/<you>/Desktop/.../Blockchain MRV/chaincode/mrv-contract"
```

## Tear down

```bash
./network.sh down
```

This removes the containers, volumes, and generated crypto material — the network is fully
reproducible from the two commands above.

## What the backend needs

`apps/backend` connects via the Fabric Gateway SDK using the connection profile and wallet
identity `network.sh` generates under
`organizations/peerOrganizations/org1.example.com/`. See `.env.example` for the
`FABRIC_*` variables and `docs/BLOCKCHAIN.md` for how the backend maps its state machine onto
chaincode calls.

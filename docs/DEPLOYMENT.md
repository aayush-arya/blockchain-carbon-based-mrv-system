# Deployment

A free-tier public deployment of the web dashboard, backend API, database, storage, and AI
service — so the project is a clickable link, not just a repo. Hyperledger Fabric is
deliberately not part of this: see [Why Fabric stays local](#why-fabric-stays-local) below.
Everything here uses genuinely free tiers; no step asks for a credit card.

Order matters somewhat - database and storage first (the backend needs their credentials),
then the backend + AI service, then the web app (needs the backend's URL), then one loop back
to give the backend the web app's URL for CORS.

## 1. Database — Supabase

1. [supabase.com](https://supabase.com) → New project. Pick any name/region; save the database
   password it generates (or set your own) - you'll need it in a moment.
2. Once it's provisioned: **Settings → Database → Connection string → URI**. Copy it - this is
   your `DATABASE_URL`. It looks like
   `postgresql://postgres:[password]@db.xxxxx.supabase.co:5432/postgres`.
3. PostGIS: this project's first migration runs `CREATE EXTENSION IF NOT EXISTS postgis;`
   itself, which Supabase's default role is normally allowed to do. If `npm run migrate:up`
   (step 4 below) fails specifically on that line, enable it manually first:
   **Database → Extensions** → search "postgis" → enable, then re-run the migration.
4. From your own machine (not Render - simplest to run migrations once from here), with that
   connection string:
   ```bash
   DATABASE_URL="<paste-your-supabase-url>" npm run migrate:up --workspace=apps/backend
   ```
5. Optional but recommended - seed the validator/admin demo accounts the login page's quick-login
   buttons expect:
   ```bash
   DATABASE_URL="<paste-your-supabase-url>" npm run seed --workspace=apps/backend
   ```

## 2. Evidence storage — Cloudflare R2

1. [dash.cloudflare.com](https://dash.cloudflare.com) → **R2** → Create bucket. Name it
   something like `blue-carbon-evidence`.
2. **R2 → Manage API tokens** → Create API token → permissions: Object Read & Write, scoped to
   this bucket. Save the **Access Key ID** and **Secret Access Key** - the secret is shown once.
3. Your account-specific S3 endpoint is shown on the R2 overview page:
   `https://<account_id>.r2.cloudflarestorage.com`.
4. You now have everything for the backend's `S3_*` variables: endpoint, bucket name, access
   key, secret key. Region is the literal string `auto`.

## 3. Backend + AI service — Render

The repo's `render.yaml` (Blueprint) deploys both at once.

1. [dashboard.render.com](https://dashboard.render.com) → **New → Blueprint** → connect this
   GitHub repo. Render reads `render.yaml` and proposes `blue-carbon-backend` and
   `blue-carbon-ai`.
2. Before clicking Apply, fill in the fields marked `sync: false` for `blue-carbon-backend`:
   - `DATABASE_URL` - from Supabase step 1.2
   - `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` - from R2 step 2
   - `ML_SERVICE_URL` and `CORS_ORIGIN` - leave blank for now, come back after steps 3 and 4
3. Apply. Both services build from their Dockerfiles - the AI service's build is the slower one
   (installs PyTorch/Transformers even in heuristic mode, since the image is shared code; it
   just never loads the model at runtime in this mode - see `ml-service/app/services/inference.py`).

   Optional, worth doing: `blue-carbon-ai` → Settings → Build Arguments, add
   `BAKE_PRETRAINED_MODEL=false`. Verified locally this drops the image from 3.75GB to 1.74GB by
   skipping the CLIP checkpoint the Dockerfile normally bakes in - correct for this service
   specifically only because it's staying in `heuristic` mode, which never loads it anyway.
4. Once `blue-carbon-ai` is live, copy its URL (top of its Render page, `https://blue-carbon-ai-xxxx.onrender.com`)
   into `blue-carbon-backend`'s `ML_SERVICE_URL` env var and save (triggers a redeploy).
5. Free-tier services spin down after ~15 minutes idle and take a few seconds to wake on the
   next request - expected, not a bug. A cold health check confirms both are alive:
   ```bash
   curl https://blue-carbon-backend-xxxx.onrender.com/api/system/health
   ```
   `blockchain` should read `"disabled"` (honest, matching `FABRIC_ENABLED=false`) - everything
   else should read `"ok"`.

## 4. Web dashboard — Vercel

1. [vercel.com](https://vercel.com) → Add New → Project → import this repo.
2. This is an npm-workspaces monorepo - set **Root Directory** to `apps/web` in the import
   screen's project settings. Vercel auto-detects Next.js and still installs from the true repo
   root (it walks up to find `package-lock.json`), so the workspace dependencies resolve
   correctly without extra config.
3. Environment variables (same screen, or Settings → Environment Variables after):
   - `NEXT_PUBLIC_API_BASE_URL` = your Render backend URL from step 3.5
   - `NEXT_PUBLIC_MAP_TILE_URL` = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}`
     (optional - this is already the code's built-in default; only needed if you want a
     different tile provider)
4. Deploy. Vercel gives you a `https://<project>.vercel.app` URL immediately.
5. Loop back to Render: set `blue-carbon-backend`'s `CORS_ORIGIN` to this exact Vercel URL - no
   trailing slash (`https://your-project.vercel.app`, not `.../`) - and save. The `cors` package
   matches this as an exact string outside of development mode, so a mismatch here (trailing
   slash, http vs https, www vs not) silently blocks every request rather than erroring
   obviously; see `apps/backend/src/app.ts`.

## Verifying it's actually live

- Backend health: `curl https://<your-render-backend>.onrender.com/api/system/health`
- Open the Vercel URL, use the **Continue as Validator** / **Continue as Admin** buttons on the
  login page (see the commit that added them) to confirm the whole chain - web → backend →
  Supabase → R2 - actually works, not just that pages render.
- Try **New Observation** as a field operator: this exercises the backend, Supabase, R2 (the
  photo upload), and the AI service together in one action.

## Why Fabric stays local

Hyperledger Fabric isn't one container - it's an orderer, per-organization peers, and a
certificate authority, each a long-running process with its own persistent state, coordinating
over custom networking (see `network/README.md`). That's a different category of infrastructure
than "deploy my app," and it doesn't fit a single-container free-tier host. Real Fabric
deployments run on dedicated VMs or a managed blockchain service - out of scope for a free
capstone deployment.

The deployed backend runs with `FABRIC_ENABLED=false`, which is the app's honest, already-built
disabled state (`docs/AI_PIPELINE.md`-style honesty: it says "disabled" in the health check and
skips tokenization, rather than faking a blockchain write). To show the full tokenization flow -
real chaincode, a real ledger, a real transaction hash - run `network/README.md`'s setup locally
with `FABRIC_ENABLED=true` and either demo it live or record it once. That's genuinely a stronger
demonstration than a hosted instance would be anyway: you're showing the actual permissioned
network, not a black-box API response.

## Cost note

Every step above uses a free tier: Supabase's free project tier, Cloudflare R2's free monthly
allowance (10GB storage, no egress fees), and Render's free web service tier. Render's free
tier's main real constraint is the cold-start after idling - fine for a portfolio/recruiter
link, not something to build a paid product on without upgrading.

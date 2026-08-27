# Build context is the repo root - see docker-compose.yml and apps/backend/Dockerfile for why.
FROM node:20-slim AS builder
WORKDIR /repo

COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/web/package.json apps/web/package.json
COPY chaincode/mrv-contract/package.json chaincode/mrv-contract/package.json
RUN npm ci

COPY apps/web apps/web

# NEXT_PUBLIC_* vars are inlined into the client bundle at build time, not read at runtime -
# so this has to be a build ARG, not a docker-compose `environment:` entry on the web service.
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
RUN npm run build --workspace=apps/web

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# `output: standalone` traces a minimal server + node_modules subset, relative to the
# outermost workspace root (a monorepo quirk) - hence the apps/web/server.js path below.
COPY --from=builder /repo/apps/web/.next/standalone ./
COPY --from=builder /repo/apps/web/.next/static ./apps/web/.next/static

EXPOSE 3000
CMD ["node", "apps/web/server.js"]

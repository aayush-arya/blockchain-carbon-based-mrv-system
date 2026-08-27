# Build context is the repo root (npm workspaces need the root package.json + lockfile +
# every workspace member's package.json present to install correctly) - see docker-compose.yml.
FROM node:20-slim AS builder
WORKDIR /repo

COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/web/package.json apps/web/package.json
COPY chaincode/mrv-contract/package.json chaincode/mrv-contract/package.json
RUN npm ci

COPY apps/backend apps/backend
RUN npm run build --workspace=apps/backend

FROM node:20-slim
WORKDIR /repo
ENV NODE_ENV=production

COPY --from=builder /repo/node_modules node_modules
COPY --from=builder /repo/apps/backend/dist apps/backend/dist
COPY apps/backend/package.json apps/backend/package.json
COPY apps/backend/migrations apps/backend/migrations

WORKDIR /repo/apps/backend
EXPOSE 4000
CMD ["node", "dist/server.js"]

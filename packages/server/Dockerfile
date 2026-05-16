# =============================================================================
# Stage 1 — deps: install all dependencies (layer-cached until lock changes)
# =============================================================================
FROM node:22-alpine AS deps
WORKDIR /app

# Build tools required by native addons (isolated-vm uses node-gyp / V8)
RUN apk add --no-cache python3 make g++

RUN npm install -g pnpm@9.0.0 --no-package-lock

# Copy manifests + tsconfig files — changes here bust the install cache
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/tsconfig.json ./packages/shared/
COPY packages/server/package.json packages/server/tsconfig.json ./packages/server/

RUN pnpm install --frozen-lockfile

# =============================================================================
# Stage 2 — builder: compile TypeScript
# =============================================================================
FROM deps AS builder

# Copy source for each package
COPY packages/shared ./packages/shared
COPY packages/server ./packages/server

RUN pnpm --filter @automation-hub/shared build && \
    pnpm --filter @automation-hub/server build

# =============================================================================
# Stage 3 — production: lean runtime image
# =============================================================================
FROM node:22-alpine AS production
WORKDIR /app

# Build tools required for native addon install (isolated-vm)
RUN apk add --no-cache python3 make g++

# Non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

RUN npm install -g pnpm@9.0.0 --no-package-lock

# Copy manifests for production dep resolution
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/

# Install production deps only (no devDependencies)
RUN pnpm install --frozen-lockfile --prod

# Copy compiled output from builder
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/server/dist  ./packages/server/dist

# Fix ownership before switching user
RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 4000

# Lightweight health check — wget is available in alpine
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- http://localhost:4000/health || exit 1

CMD ["node", "packages/server/dist/server.js"]

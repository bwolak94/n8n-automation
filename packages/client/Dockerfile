# =============================================================================
# Stage 1 — builder: build Vue SPA with Vite
# =============================================================================
FROM node:20-alpine AS builder
WORKDIR /app

RUN corepack enable pnpm

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/client/package.json ./packages/client/

RUN pnpm install --frozen-lockfile

COPY packages/shared ./packages/shared
COPY packages/client ./packages/client

RUN pnpm --filter @automation-hub/shared build && \
    pnpm --filter @automation-hub/client build

# =============================================================================
# Stage 2 — production: static file server (nginx-alpine)
# =============================================================================
FROM nginx:1.27-alpine AS production

# Remove default nginx config and static content
RUN rm -rf /usr/share/nginx/html/*

# Copy built SPA
COPY --from=builder /app/packages/client/dist /usr/share/nginx/html

# Minimal nginx config — the reverse proxy (infra/nginx) handles routing;
# this container only serves static files on port 80
COPY packages/client/nginx.static.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost/index.html || exit 1

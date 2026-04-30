# ─── Development Stage ────────────────────────────────────────────────────────
FROM node:20-alpine AS development

RUN apk add --no-cache git openssh-client && npm install -g pnpm

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY packages/shared/package.json ./packages/shared/package.json
RUN pnpm install --frozen-lockfile --filter @paas/api...

COPY . .

EXPOSE 3000

CMD ["pnpm", "--filter", "@paas/api", "dev"]

# ─── Builder Stage ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN apk add --no-cache git openssh-client && npm install -g pnpm

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY packages/shared/package.json ./packages/shared/package.json
RUN pnpm install --frozen-lockfile --filter @paas/api...

COPY . .
RUN pnpm --filter @paas/api build

# ─── Production Stage ──────────────────────────────────────────────────────────
FROM node:20-alpine AS production

RUN apk add --no-cache dumb-init git openssh-client

ENV NODE_ENV=production

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

WORKDIR /app

COPY --from=builder --chown=nestjs:nodejs /app/apps/api/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --chown=nestjs:nodejs apps/api/package.json ./

USER nestjs

EXPOSE 3000

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main"]

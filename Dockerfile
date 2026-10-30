# Stage 1: Base image with pnpm pre-installed
FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN npm install -g pnpm@10.5.2

# Stage 2: Dependencies with BuildKit cache
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* .npmrc* ./
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm config set strict-dep-builds false && \
    (pnpm install --frozen-lockfile || pnpm install)

# Stage 3: Builder with Next.js build cache and memory cap
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=768"
RUN --mount=type=cache,target=/app/.next/cache pnpm build

# Stage 4: Web Runner (Next.js PWA & API)
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]

# Stage 5: Worker Runner (BullMQ WhatsApp Inbound Consumer)
FROM base AS worker
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 worker && \
    mkdir -p /pnpm && chown -R worker:nodejs /pnpm /app

COPY --from=deps --chown=worker:nodejs /app/node_modules ./node_modules
COPY --chown=worker:nodejs package.json pnpm-workspace.yaml* tsconfig.json drizzle.config.ts* ./
COPY --chown=worker:nodejs src ./src

USER worker

CMD ["pnpm", "worker"]

# syntax=docker/dockerfile:1
FROM node:20-alpine AS base
RUN npm install -g pnpm turbo

FROM base AS builder
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --frozen-lockfile --ignore-scripts

COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
RUN pnpm --filter @imposter/shared build
RUN pnpm --filter @imposter/api db:generate
RUN pnpm --filter @imposter/api build

# Create a self-contained deployment bundle (resolves pnpm symlinks)
RUN pnpm --filter @imposter/api deploy --prod /app/deploy
# Generate Prisma client inside the deploy bundle
COPY apps/api/prisma /app/deploy/prisma
RUN cd /app/deploy && npx --yes prisma@5 generate

FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl
ENV NODE_ENV=production
COPY --from=builder /app/deploy/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/prisma ./prisma
EXPOSE 3001
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node dist/index.js"]

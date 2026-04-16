# syntax=docker/dockerfile:1
FROM node:20-alpine AS base
RUN npm install -g pnpm turbo

FROM base AS builder
WORKDIR /app

# Build-time env vars for Vite (baked into the JS bundle at build time)
ARG VITE_GOOGLE_CLIENT_ID
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/
COPY packages/ui/package.json ./packages/ui/
RUN pnpm install --frozen-lockfile --ignore-scripts

COPY packages/shared ./packages/shared
COPY packages/ui ./packages/ui
COPY apps/web ./apps/web
RUN pnpm --filter @red-handed/shared build
RUN pnpm --filter @red-handed/ui build
RUN pnpm --filter @red-handed/web build

FROM nginx:alpine AS runner
RUN apk add --no-cache curl
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80

# Red Handed — Project Documentation

> This document is designed to be imported into Notion under **Projects > Guess Who**.
> Copy each section as a separate Notion page, or import the whole file.

---

# Page 1: Project Overview

## What is Red Handed?

A real-time multiplayer social deduction game where villagers get Word A and red-handed get Word B. Players give clues, detect red-handed, and vote them out. Available on:

- **Web** (React + Vite) — Desktop, tablet, and mobile browsers
- **iOS** (Expo/React Native) — iPhone and iPad
- **Android** (Expo/React Native) — Phones and tablets

## Key Metrics

| Metric | Value |
|--------|-------|
| Total Tests | 991 |
| API Coverage | 99.4% |
| Data Models | 25 |
| Languages | 8 |
| Pages (Web) | 20+ |
| Achievements | 75 |
| Word Categories | 10+ |

## Repository

- **URL**: github.com/shakayz/guess-who
- **Monorepo**: Turborepo + pnpm workspaces
- **Main branch**: `main`
- **Dev branch**: `develop`
- **Staging branch**: `staging`

## Tech Stack Summary

| Component | Technology |
|-----------|------------|
| Frontend (Web) | React 18, Vite 5, TypeScript, TailwindCSS, Zustand, React Query |
| Frontend (Mobile) | React Native 0.74, Expo 51, Expo Router, NativeWind |
| Backend | Fastify 4, TypeScript, Socket.IO 4, Pino structured logging |
| Database | PostgreSQL 16, Prisma 5 ORM |
| Cache / Queue | Redis 7, BullMQ |
| Authentication | JWT, Google OAuth, Apple Sign-In, bcrypt |
| Payments | Stripe (coin purchases, season pass) |
| Push Notifications | Expo Push API |
| CI/CD | GitHub Actions (4 workflows) |
| Infrastructure | AWS ECS Fargate, RDS, ElastiCache, ALB, S3, CloudWatch |
| Containers | Docker multi-stage builds, Docker Compose |

---

# Page 2: Architecture

## System Architecture Diagram

```
                        ┌─────────────────────┐
                        │     AWS ALB          │
                        │  (HTTPS + WebSocket) │
                        └──────┬──────┬────────┘
                               │      │
                    /api/*     │      │  /*
                    /socket.io │      │
                               ▼      ▼
                    ┌──────────┐  ┌──────────┐
                    │ API      │  │ Web      │
                    │ (Fargate)│  │ (Fargate)│
                    │ 2-10     │  │ 2-6      │
                    │ tasks    │  │ tasks    │
                    └────┬─────┘  └──────────┘
                         │
              ┌──────────┼──────────┐
              ▼                     ▼
    ┌──────────────┐     ┌──────────────┐
    │ PostgreSQL   │     │ Redis        │
    │ (RDS)        │     │ (ElastiCache)│
    │ Multi-AZ     │     │              │
    └──────────────┘     └──────────────┘
```

## Monorepo Structure

```
apps/
├── api/          → Fastify REST API + Socket.IO (port 3001)
├── web/          → React SPA with Vite (port 5173)
└── mobile/       → Expo app (iOS + Android + Tablet)

packages/
├── shared/       → Types, constants, game logic, i18n, utilities
└── ui/           → Shared React component library
```

## API Architecture

- **Framework**: Fastify with plugin system
- **Real-time**: Socket.IO for game events, chat, notifications
- **ORM**: Prisma with PostgreSQL
- **Auth**: JWT tokens (access), bcrypt password hashing
- **Rate Limiting**: 100 req/min global, 5 events/sec per socket event
- **Logging**: Pino structured JSON logging throughout
- **Email**: Resend (prod) / SMTP (staging) / Console (dev)

## Client Architecture

- **State Management**: Zustand with persist middleware
- **Data Fetching**: React Query for REST, Socket.IO for real-time
- **Routing**: React Router (web), Expo Router (mobile)
- **Styling**: TailwindCSS (web), NativeWind (mobile)
- **Sound**: Web Audio API programmatic tones (web), expo-av (mobile)
- **i18n**: i18next with 8 language files

---

# Page 3: Database Schema

## Models (25 total)

### Core Models

**User**
- `id` (cuid), `username`, `email`, `passwordHash`
- OAuth: `googleId`, `appleId`
- Profile: `avatarUrl`, `locale`, `pushToken`
- Economy: `starCoins`
- Rank: `rankTier`, `rankPoints`, `honorPoints`, `seasonXp`
- Flags: `emailVerified`, `createdAt`, `updatedAt`

**Room**
- `id`, `code` (6-char unique), `hostId` → User
- Config: `status` (waiting/playing/finished), `maxPlayers`, `redHandedCount`
- Timers: `speakingTimeSeconds`, `votingTimeSeconds`
- Options: `wordPackId`, `isPrivate`, `language`, `rounds`

**Game**
- `id`, `roomId` → Room
- Result: `winnerId`, `winnerTeam`
- Timing: `startedAt`, `endedAt`

**Round**
- `id`, `gameId` → Game, `roundNumber`
- Words: `villagerWord`, `redHandedWord`
- Elimination: `eliminatedId`, `eliminatedRole`

### Gameplay Models

**GameParticipation** — Links users to games with role assignment
- `role` (villager/red-handed/detective/mr_white), `survived`, `starCoinsEarned`

**RoundVote** — Vote records per round
- `voterId` → User, `targetId` → User

**RoundClue** — Player clues per round
- `playerId` → User, `text`, `flaggedForWord`

**GameChatMessage** — In-game chat messages

### Social Models

**Friendship** — Friend requests and connections
- `requesterId`, `addresseeId`, `status` (pending/accepted)

**DirectMessage** — Private messages between players

**Honor** — Post-game honors (Team Player, Sharp Mind, Good Sport)

**Block** — Player blocking (bidirectional check)

**Report** — Player reports with reason categories and status tracking

### Economy Models

**Purchase** — Stripe transactions for coin packs

**Gift** — Player-to-player gifting (star coins only — cosmetics were removed)

### Progression Models

**Achievement** — 75 achievements across categories
- `category` (gameplay/social/mastery/collection/special)
- `difficulty` (bronze/silver/gold/platinum)

**UserAchievement** — Unlock tracking

**SeasonPass** — Seasonal content with free and premium tiers

**SeasonTier** — Reward tiers within a season

**SeasonPassClaim** — Player claims on season rewards

### Content Models

**WordPack** — Collections of word pairs
- `isPremium`, `isPublic`, `isApproved`, `locale`, `authorId`

**WordPair** — Two semantically related words
- `wordA`, `wordB`, `difficulty`, `category`, `locale`

---

# Page 4: API Routes

## REST Endpoints

### Authentication (`/api/auth`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/register` | Create account (username, email, password) |
| POST | `/auth/login` | Login with email/password |
| POST | `/auth/forgot-password` | Send password reset email |
| POST | `/auth/reset-password` | Reset password with token |

### OAuth (`/api/oauth`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/oauth/google` | Sign in with Google |
| POST | `/oauth/apple` | Sign in with Apple |

### Users (`/api/users`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/users/me` | Get current user profile |
| PUT | `/users/me` | Update profile |
| PUT | `/users/me/password` | Change password |
| DELETE | `/users/me` | Delete account |
| POST | `/users/me/push-token` | Register push token |
| DELETE | `/users/me/push-token` | Unregister push token |
| GET | `/users/me/avatar` | Get avatar URL |
| POST | `/users/me/avatar` | Upload avatar |
| GET | `/users/leaderboard` | Top 100 leaderboard |
| POST | `/users/:id/block` | Block a user |
| DELETE | `/users/:id/block` | Unblock a user |
| GET | `/users/blocked` | List blocked users |
| POST | `/users/:id/report` | Report a user |

### Friends (`/api/friends`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/friends` | List friends |
| GET | `/friends/requests` | List pending requests |
| POST | `/friends/request` | Send friend request |
| PUT | `/friends/:id/accept` | Accept request |
| PUT | `/friends/:id/reject` | Reject request |
| DELETE | `/friends/:id` | Remove friend |

### Rooms (`/api/rooms`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/rooms` | Create room |
| GET | `/rooms/:code` | Get room info |

### History (`/api/history`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/history` | User's game history |
| GET | `/history/:gameId` | Game details |

### Shop & Economy
| Method | Path | Description |
|--------|------|-------------|
| GET | `/achievements` | List achievements |
| POST | `/gifts` | Send a star-coin gift |
| GET | `/season-pass` | Current season info |
| POST | `/season-pass/claim` | Claim tier reward |

### Word Packs (`/api/word-packs`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/word-packs` | List available packs |
| GET | `/word-packs/:id` | Pack details |

## Socket.IO Events

### Room Events
| Event | Direction | Description |
|-------|-----------|-------------|
| `room:join` | Client → Server | Join room by code |
| `room:leave` | Client → Server | Leave room |
| `room:ready` | Client → Server | Toggle ready status |
| `room:settings` | Client → Server | Update room settings (host only) |
| `room:start` | Client → Server | Start game (host only) |
| `room:updated` | Server → Client | Room state changed |
| `room:invite` | Client → Server | Invite friend to room |

### Game Events
| Event | Direction | Description |
|-------|-----------|-------------|
| `game:started` | Server → Client | Game begins, roles assigned |
| `game:sync` | Server → Client | Full game state sync (reconnection) |
| `game:clue` | Client → Server | Submit clue |
| `game:vote` | Client → Server | Cast vote |
| `game:forfeit` | Client → Server | Forfeit game |
| `game:round:start` | Server → Client | New round begins |
| `game:round:speaking` | Server → Client | Speaking phase starts |
| `game:round:voting` | Server → Client | Voting phase starts |
| `game:round:end` | Server → Client | Round results |
| `game:finished` | Server → Client | Game over with results |

### Matchmaking Events
| Event | Direction | Description |
|-------|-----------|-------------|
| `matchmaking:join` | Client → Server | Enter matchmaking queue |
| `matchmaking:leave` | Client → Server | Leave queue |
| `matchmaking:found` | Server → Client | Match found |
| `matchmaking:status` | Server → Client | Queue status update |

### Chat Events
| Event | Direction | Description |
|-------|-----------|-------------|
| `chat:message` | Client → Server | Send game chat message |
| `chat:new` | Server → Client | New message received |
| `dm:send` | Client → Server | Send direct message |
| `dm:received` | Server → Client | DM received |

---

# Page 5: Game Logic

## Game Flow

```
Room Created → Players Join → Host Starts Game
                                      ↓
                              Roles Assigned
                           (villager/red-handed/detective/mr_white)
                                      ↓
                              ┌── Round Start ──┐
                              │                  │
                              ▼                  │
                        Speaking Phase           │
                     (each player gives          │
                      a 1-sentence clue)         │
                              │                  │
                              ▼                  │
                        Voting Phase             │
                     (vote to eliminate)          │
                              │                  │
                              ▼                  │
                      Elimination                │
                     (most votes out)            │
                              │                  │
                      ┌───────┴───────┐          │
                      │               │          │
                 Check Win        No Winner ─────┘
                 Conditions
                      │
               ┌──────┴──────┐
               │              │
          Villagers Win   Red-Handed Win
         (all red-handed   (red-handed >=
          eliminated)     villagers)
```

## Roles

| Role | Word | Special Ability |
|------|------|-----------------|
| **Villager** | Word A (the real word) | None — must identify red-handed |
| **Red-Handed** | Word B (similar word) | Must blend in with clues |
| **Detective** | Word A | Can reveal one player's role per game |
| **Mr. White** | No word | Must bluff entirely — survives by guessing Word A if caught |

## Rank System

| Tier | LP Range | Icon |
|------|----------|------|
| Wooden | 0-99 | Wood plank |
| Bronze | 100-299 | Bronze shield |
| Silver | 300-599 | Silver shield |
| Gold | 600-999 | Gold shield |
| Platinum | 1000-1499 | Platinum shield |
| Diamond | 1500-1999 | Diamond |
| Master | 2000-2999 | Crown |
| Grandmaster | 3000+ | Dragon crown |

## Player Limits

| Mode | Min | Max |
|------|-----|-----|
| Unranked | 3 | 20 |
| Ranked | 10 | 10 |
| Offline | 3 | 20 |

---

# Page 6: Infrastructure & Deployment

## AWS Architecture

| Service | AWS Resource | Spec |
|---------|-------------|------|
| API | ECS Fargate | 2-10 tasks, 512 CPU / 1024 MB, auto-scale at 70% CPU |
| Web | ECS Fargate | 2-6 tasks, 256 CPU / 512 MB, auto-scale at 70% CPU |
| Database | RDS PostgreSQL 16 | db.t3.micro, Multi-AZ (prod), 7-day backups, encrypted |
| Cache | ElastiCache Redis 7 | cache.t3.micro, private subnet, auth token |
| Load Balancer | ALB | HTTPS (ACM cert), sticky sessions for Socket.IO |
| Storage | S3 | Static assets, user uploads |
| Networking | VPC | 2 public + 2 private subnets across 2 AZs |
| Logs | CloudWatch | 30-day retention for all ECS tasks |

## Environments

| Environment | Branch | Deploy | Approval |
|-------------|--------|--------|----------|
| Development | `develop` | Auto on push | GitHub env gate |
| Staging (PFV) | `staging` | Auto on push | GitHub env gate |
| Production | `main` | Auto on push | Manual approval required |

## CI/CD Pipeline

```
Code Push / PR
     ↓
┌─────────────────┐
│ 1. Lint &       │ ← pnpm lint + typecheck (shared, api, web)
│    Typecheck     │
└────────┬────────┘
         ↓
┌─────────────────┐
│ 2. Test         │ ← 991 tests (shared: 130, api: 402, web: 459)
│                 │
└────────┬────────┘
         ↓
┌─────────────────┐
│ 3. Build        │ ← turbo build (all packages)
│                 │
└────────┬────────┘
         ↓ (PRs only)
┌─────────────────┐
│ 4. Docker       │ ← Build API + Web images (no push)
│    Validate     │
└─────────────────┘

On merge to main/develop/staging:
     ↓
┌─────────────────┐
│ Build & Push    │ ← Docker images to GHCR
│ Images          │
└────────┬────────┘
         ↓
┌─────────────────┐
│ Deploy to ECS   │ ← Update task definitions, wait for stabilize
│ (with rollback) │
└─────────────────┘
```

## Docker Setup

| File | Purpose |
|------|---------|
| `docker-compose.dev.yml` | Local development with hot-reload |
| `docker-compose.dev.server.yml` | Deployed dev environment |
| `docker-compose.pfv.yml` | Staging/QA environment |
| `docker-compose.prod.yml` | Production with TLS and certbot |

## Deployment Commands

```bash
# Deploy to specific environment
./infra/aws/deploy.sh prod [api-tag] [web-tag]
./infra/aws/deploy.sh dev
./infra/aws/deploy.sh staging

# Create/update CloudFormation stack
aws cloudformation deploy \
  --template-file infra/aws/cloudformation.yml \
  --stack-name prod-red-handed-stack \
  --parameter-overrides Environment=prod DomainName=yourdomain.com ...
```

---

# Page 7: Mobile App

## Expo Configuration

| Property | Value |
|----------|-------|
| SDK | Expo 51 |
| Bundle ID (iOS) | com.redhanded.game |
| Package (Android) | com.redhanded.game |
| Scheme | `redhanded://` |
| UI Style | Dark mode |

## Deep Links

| URL | Screen |
|-----|--------|
| `redhanded://lobby/{code}` | Lobby with room code |
| `redhanded://game/{code}` | Active game |
| `redhanded://reset-password?token=xxx` | Password reset |

## EAS Build Profiles

| Profile | Distribution | Notes |
|---------|-------------|-------|
| Development | Internal (simulator) | Development client |
| Preview | Internal (device) | Physical device testing |
| Production | Store | Auto-increment version |

## Mobile-Specific Features

- **Haptic feedback** — Vibration on votes, eliminations, game events
- **Push notifications** — Game start, friend requests, invites
- **Sound effects** — Generated audio via expo-av
- **Deep linking** — Handle `redhanded://` URLs
- **Camera/Photo** — Avatar upload via image picker
- **Swipeable tutorial** — 6-slide How to Play walkthrough

## Supported Platforms

| Platform | Min Version | Status |
|----------|-------------|--------|
| iPhone | iOS 13+ | Supported |
| iPad | iPadOS 13+ | Supported (tablet-optimized) |
| Android Phone | API 21+ | Supported |
| Android Tablet | API 21+ | Supported (tablet-optimized) |

---

# Page 8: Testing Strategy

## Test Distribution

| Package | Test Files | Tests | Coverage |
|---------|-----------|-------|----------|
| @red-handed/shared | 5 | 130 | Logic, constants, utils |
| @red-handed/api | 29 | 402 | 99.4% |
| @red-handed/web | 26 | 459 | 97%+ |
| @red-handed/ui | 8 | ~50 | Components |
| **Total** | **68** | **991+** | |

## Test Categories (API)

| Category | Files | What's Tested |
|----------|-------|---------------|
| Unit | 20+ | Routes, handlers, services, socket events |
| Integration | 2 | Auth flow, room lifecycle |
| Functional | 1 | Full game flow |
| E2E | 1 | User journey (register → play → results) |
| Performance | 1 | Game logic benchmarks |

## Test Categories (Web)

| Category | Files | What's Tested |
|----------|-------|---------------|
| Page Tests | 15 | All major pages (Home, Game, Lobby, Auth, Profile, etc.) |
| Component Tests | 5 | NavBar, DmChat, UI components |
| Store Tests | 1 | Zustand auth/game stores |
| Integration | 4 | API client, Socket.IO, i18n, routing |

## Running Tests

```bash
# All tests
pnpm test

# Specific package
pnpm --filter @red-handed/api test
pnpm --filter @red-handed/web test

# Watch mode
pnpm --filter @red-handed/api test -- --watch

# With coverage
pnpm --filter @red-handed/api test -- --coverage
```

---

# Page 9: Environment Variables & Secrets

## API Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | No | development | Environment mode |
| `PORT` | No | 3001 | API port |
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `REDIS_URL` | Yes | — | Redis connection string |
| `JWT_SECRET` | Yes | — | Min 32 chars for token signing |
| `ALLOWED_ORIGINS` | Yes | — | CORS origins (comma-separated) |
| `APP_URL` | Yes | — | Base URL for emails/links |
| `GOOGLE_CLIENT_ID` | No | — | Google OAuth |
| `GOOGLE_CLIENT_SECRET` | No | — | Google OAuth |
| `APPLE_CLIENT_ID` | No | — | Apple Sign-In Services ID (JWT audience check) |
| `STRIPE_SECRET_KEY` | No | — | Stripe payments |
| `STRIPE_WEBHOOK_SECRET` | No | — | Stripe webhooks |

## GitHub Actions Secrets

### Per Environment (dev/pfv/prod)
- `{ENV}_SSH_HOST` — Server SSH host (legacy, now AWS)
- `{ENV}_SSH_USER` — Server SSH user (legacy)
- `{ENV}_SSH_KEY` — Server SSH key (legacy)
- `{ENV}_POSTGRES_PASSWORD`
- `{ENV}_REDIS_PASSWORD` (prod/pfv only)
- `{ENV}_JWT_SECRET`
- `{ENV}_ALLOWED_ORIGINS`
- `{ENV}_APP_URL`

### AWS Secrets
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`

### Shared
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `VITE_GOOGLE_CLIENT_ID`
- `APPLE_CLIENT_ID` (server-side) and `VITE_APPLE_CLIENT_ID` (build-time for web bundle) — both are the Services ID from Apple Developer
- `PROD_STRIPE_SECRET_KEY`, `PROD_STRIPE_WEBHOOK_SECRET`

---

# Page 10: Feature Checklist

## Implemented Features

### Core Game
- [x] Room creation with 6-char codes
- [x] Real-time game loop (speaking → voting → elimination)
- [x] 4 roles: Villager, Red-Handed, Detective, Mr. White
- [x] Configurable timers, player count, red-handed count
- [x] Tiebreaker system
- [x] Game reconnection with state sync
- [x] Offline Pass & Play mode (no internet)

### Authentication
- [x] Email/password registration
- [x] JWT token auth
- [x] Google OAuth
- [x] Apple Sign-In
- [x] Password reset via email
- [x] Account deletion

### Social
- [x] Friend system (send/accept/remove)
- [x] Direct messages
- [x] In-game chat
- [x] Block & Report
- [x] Honor system (post-game)
- [x] Leaderboard (top 100)

### Progression
- [x] Rank system (8 tiers)
- [x] 75 achievements
- [x] Season Pass (free + premium)
- [x] XP and level system

### Economy
- [x] Star Coins and Gold Coins
- [x] Stripe payment integration
- [x] Player gifting (star coins)

### Production
- [x] Sound effects (Web Audio API + expo-av)
- [x] Haptic feedback (mobile)
- [x] Error boundaries (web + mobile)
- [x] Connection status monitor
- [x] Push notifications (Expo Push API)
- [x] Deep linking
- [x] Structured logging (Pino)
- [x] Rate limiting (API + Socket)

### Platform
- [x] Responsive web (mobile, tablet, desktop breakpoints)
- [x] iOS app (iPhone + iPad)
- [x] Android app (phone + tablet)
- [x] 8 languages (EN, FR, AR, ES, DE, IT, PT, ZH)
- [x] Dark mode everywhere
- [x] Accessibility (ARIA, keyboard nav, skip-to-content)

### Infrastructure
- [x] AWS ECS Fargate (auto-scaling)
- [x] RDS PostgreSQL (Multi-AZ)
- [x] ElastiCache Redis
- [x] ALB with WebSocket support
- [x] Docker multi-stage builds
- [x] CI/CD with GitHub Actions
- [x] Automatic rollback on failed deploys
- [x] CloudFormation IaC

### Legal
- [x] Terms of Service page
- [x] Privacy Policy page
- [x] How to Play tutorial

## Future Enhancements
- [ ] Voice chat mode
- [ ] Custom word pack creator
- [ ] Sentry crash reporting
- [ ] PWA / Service Worker for web offline
- [ ] App store submission (Apple + Google)
- [ ] Admin dashboard for reports/moderation
- [ ] Email verification enforcement
- [ ] Analytics dashboard

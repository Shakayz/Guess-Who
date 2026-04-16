# Red Handed

A real-time multiplayer social deduction game built for **Web**, **iOS**, **Android**, and **Tablets**. Villagers get Word A, red-handed get Word B — give clues, detect the red-handed, and vote them out before they take over.

> **991 tests** | **99%+ API coverage** | **25 data models** | **8 languages** | **Offline mode**

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Web** | React 18 + Vite 5 + TypeScript + TailwindCSS + Zustand + React Query |
| **Mobile** | React Native 0.74 + Expo 51 + Expo Router + NativeWind |
| **API** | Fastify 4 + TypeScript + Socket.IO 4 + Pino logging |
| **Database** | PostgreSQL 16 + Prisma 5 ORM |
| **Cache/Queue** | Redis 7 + BullMQ |
| **Auth** | JWT + Google OAuth + Apple Sign-In + bcrypt |
| **Payments** | Stripe (coins, season pass, gifting) |
| **Monorepo** | Turborepo + pnpm 9 workspaces |
| **CI/CD** | GitHub Actions (lint → test → build → deploy) |
| **Infrastructure** | AWS ECS Fargate + RDS + ElastiCache + ALB |
| **Containers** | Docker multi-stage builds + Docker Compose |

## Project Structure

```
red-handed/
├── apps/
│   ├── api/               # Fastify REST + WebSocket API (port 3001)
│   │   ├── prisma/        # Schema, migrations, seed
│   │   └── src/
│   │       ├── routes/    # REST endpoints (auth, users, friends, rooms, shop, etc.)
│   │       ├── socket/    # Socket.IO handlers (room, game, chat, matchmaking)
│   │       ├── services/  # Email, push notifications
│   │       └── jobs/      # Background jobs (LP decay)
│   ├── web/               # React SPA (port 5173)
│   │   └── src/
│   │       ├── pages/     # 20+ pages (auth, game, lobby, profile, settings, etc.)
│   │       ├── components/# Reusable UI (NavBar, ErrorBoundary, ConnectionStatus)
│   │       ├── store/     # Zustand stores (auth, game)
│   │       ├── lib/       # API client, socket, sounds, logger
│   │       └── i18n/      # 8 language files
│   └── mobile/            # Expo app (iOS + Android + Tablet)
│       ├── app/           # File-based routing (expo-router)
│       ├── components/    # ErrorBoundary, ConnectionStatus
│       ├── lib/           # API, socket, sounds, haptics, logger
│       └── store/         # Zustand stores
├── packages/
│   ├── shared/            # Types, constants, game logic, i18n, offline words
│   └── ui/                # Shared React components (Avatar, Badge, Timer, etc.)
├── infra/
│   └── aws/               # CloudFormation, ECS task defs, deploy script
├── k8s/                   # Kubernetes manifests (HPA, ingress, deployments)
├── .github/workflows/     # CI + CD pipelines (dev, staging, prod)
└── docker-compose*.yml    # Dev, prod, PFV, dev-server configurations
```

## Features

### Core Gameplay
- **Real-time game loop** — Speaking → Voting → Elimination phases with configurable timers
- **4 roles** — Villager, Red-Handed, Detective (can investigate), Mr. White (no word)
- **3-20 players** per game (10 for ranked mode)
- **Room codes** — Create/join rooms with shareable 6-character codes
- **Matchmaking** — Automatic ranked matchmaking with skill-based pairing
- **Tiebreaker system** — Extra rounds when votes are tied
- **Game reconnection** — Rejoin active games after disconnect with full state sync

### Social Features
- **Friend system** — Send/accept requests, see online status
- **Direct messages** — Private chat between friends
- **In-game chat** — Team chat during games
- **Block & Report** — Player moderation with 6 report categories
- **Honors** — Give Team Player / Sharp Mind / Good Sport after games
- **Leaderboard** — Top 100 players ranked by LP with rank tiers

### Progression & Economy
- **Rank system** — Wooden → Bronze → Silver → Gold → Platinum → Diamond → Master → Grandmaster
- **75 achievements** — Bronze/Silver/Gold/Platinum tiers across gameplay categories
- **Season Pass** — Free + Premium tiers with exclusive rewards
- **Coin Shop** — Cosmetics (avatar frames, name colors, badges)
- **Gifting** — Send cosmetics and coins to friends
- **Word Packs** — Community and premium word packs

### Production Features
- **Sound effects** — Web Audio API (web) + expo-av (mobile), 13 sound types
- **Haptic feedback** — Touch feedback on mobile (vote, elimination, game events)
- **Error boundaries** — Graceful crash recovery on web and mobile
- **Connection monitor** — Real-time socket status indicator
- **Offline Pass & Play** — Local multiplayer without internet (3-20 players)
- **Password reset** — Email-based forgot password flow
- **Push notifications** — Expo push API for game events, friend requests, invites
- **Deep linking** — `redhanded://lobby/{code}`, `redhanded://game/{code}`

### Accessibility & Responsiveness
- **ARIA labels** — Screen reader support across all interactive elements
- **Keyboard navigation** — Skip-to-content link, focus management
- **Tablet responsive** — `md:` and `lg:` breakpoints for iPad/Android tablets
- **8 languages** — English, French, Arabic, Spanish, German, Italian, Portuguese, Chinese

---

## Quick Start

### Docker (recommended)

```bash
# Clone and enter the repo
git clone <repo-url> && cd red-handed

# One-time setup (creates .env from template)
bash setup.sh

# Start everything (API, Web, PostgreSQL, Redis)
docker compose -f docker-compose.dev.yml up
```

| Service | URL |
|---------|-----|
| Web | http://localhost:5173 |
| API | http://localhost:3001 |
| API Health | http://localhost:3001/health |

Migrations and seed data (word packs) run automatically on first start.

### Local Development (without Docker)

**Prerequisites:** Node.js >= 20, pnpm >= 9, Docker (for PostgreSQL + Redis only)

```bash
# Install dependencies
pnpm install

# Start infrastructure only
docker compose -f docker-compose.dev.yml up postgres redis -d

# Configure environment
cp apps/api/.env.example apps/api/.env

# Run migrations + seed
cd apps/api && pnpm db:migrate && pnpm db:seed && cd ../..

# Start all dev servers (API + Web + shared watchers)
pnpm dev
```

### Mobile Development

```bash
# Install Expo CLI
npx expo install

# Start Expo dev server
pnpm --filter @red-handed/mobile dev

# Or target a specific platform
pnpm --filter @red-handed/mobile android
pnpm --filter @red-handed/mobile ios
```

Set `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_SOCKET_URL` for production API URLs.

### Useful Commands

```bash
# Run all tests
pnpm test

# Run tests for a specific package
pnpm --filter @red-handed/api test
pnpm --filter @red-handed/web test
pnpm --filter @red-handed/shared test

# Build all packages
pnpm build

# Lint + typecheck
pnpm lint && pnpm typecheck

# Open Prisma Studio (DB browser)
pnpm --filter @red-handed/api db:studio

# Format code
pnpm format
```

---

## Database Schema

25 models powering the game:

| Category | Models |
|----------|--------|
| **Core** | User, Room, Game, Round |
| **Gameplay** | GameParticipation, RoundVote, RoundClue, GameChatMessage |
| **Content** | WordPack, WordPair |
| **Social** | Friendship, DirectMessage, Honor, Block, Report |
| **Progression** | Achievement, UserAchievement |
| **Economy** | Cosmetic, UserCosmetic, Purchase, Gift |
| **Season** | SeasonPass, SeasonTier, SeasonPassClaim |

---

## Testing

| Package | Tests | Coverage |
|---------|-------|----------|
| `@red-handed/api` | 402 | 99.4% |
| `@red-handed/web` | 459 | 97%+ |
| `@red-handed/shared` | 130 | Comprehensive |
| **Total** | **991** | |

Test types: Unit, Integration, Functional, E2E, Performance

---

## CI/CD Pipeline

```
Push/PR → Lint & Typecheck → Test (991 tests) → Build → Docker Validate (PRs only)
                                                              ↓
                                                    Push to main/develop/staging
                                                              ↓
                                                 Build & Push Docker Images (GHCR)
                                                              ↓
                                                    Deploy to AWS ECS Fargate
                                                    (with approval gate for prod)
```

**Environments:**
- `develop` branch → Dev environment (auto-deploy)
- `staging` branch → PFV/staging environment (auto-deploy)
- `main` branch → Production (manual approval required)

Production deployments include automatic rollback on health check failure.

---

## AWS Infrastructure

Deployed on AWS using CloudFormation (see `infra/aws/`):

| Service | AWS Resource | Config |
|---------|-------------|--------|
| API | ECS Fargate | 2-10 tasks, 512 CPU / 1GB RAM, auto-scaling at 70% CPU |
| Web | ECS Fargate | 2-6 tasks, 256 CPU / 512MB RAM |
| Database | RDS PostgreSQL 16 | Multi-AZ (prod), 20-100GB auto-scaling, 7-day backups |
| Cache | ElastiCache Redis 7 | Private subnet, auth token |
| Load Balancer | ALB | HTTPS, WebSocket sticky sessions for Socket.IO |
| Storage | S3 | Static assets and uploads |
| Networking | VPC | 2 public + 2 private subnets, NAT Gateway |
| Logs | CloudWatch | ECS task logs with 30-day retention |

See [infra/aws/README.md](infra/aws/README.md) for deployment instructions.

---

## Game Rules

1. **Host** creates a room (3-20 players, or 10 for ranked)
2. **Server** assigns roles: red-handed, villagers, optionally a detective and Mr. White
3. **Villagers** receive Word A, **Red-Handed** receive Word B (semantically similar)
4. Each round: players give **one-sentence clues** without saying their word
5. After clues, players **vote** to eliminate who they suspect
6. **Villagers win** when all red-handed are eliminated
7. **Red-Handed win** when they equal or outnumber remaining villagers
8. **Detective** can reveal one player's role per game
9. **Mr. White** has no word and must bluff to survive

---

## Environment Variables

### API (`apps/api/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | Yes | Redis connection string |
| `JWT_SECRET` | Yes | Min 32 characters |
| `ALLOWED_ORIGINS` | Yes | CORS origins (comma-separated) |
| `APP_URL` | Yes | Application base URL |
| `PORT` | No | API port (default: 3001) |
| `GOOGLE_CLIENT_ID` | No | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | No | Google OAuth client secret |
| `APPLE_CLIENT_ID` | No | Apple Sign-In client ID |
| `STRIPE_SECRET_KEY` | No | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | No | Stripe webhook secret |

### Web (build-time)

| Variable | Description |
|----------|-------------|
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth client ID |

### Mobile (runtime)

| Variable | Description |
|----------|-------------|
| `EXPO_PUBLIC_API_URL` | API base URL (default: `http://localhost:3001/api`) |
| `EXPO_PUBLIC_SOCKET_URL` | Socket.IO URL (default: `http://localhost:3001`) |

---

## Logs & Observability

The API uses a single **pino** instance with dual stdout + file output. Every
line is structured JSON (pretty-printed in dev) carrying `service`, `env`,
`pid`, and a `name` namespace such as `socket:room` or `lp-decay`.

### Quick access

| Where                     | How                                                       |
|---------------------------|-----------------------------------------------------------|
| API in dev (terminal)     | `pnpm --filter @red-handed/api dev` — pretty stdout         |
| API rolling log file      | `tail -f apps/api/logs/api.log` (pipe to `npx pino-pretty`) |
| Docker Compose            | `docker compose logs -f api`                              |
| AWS ECS (production)      | CloudWatch Logs → `/ecs/red-handed-api`, or `aws logs tail /ecs/red-handed-api --follow` |
| Web                       | Browser DevTools → Console (filter by `[module]` prefix)  |
| Mobile (Metro)            | `pnpm --filter @red-handed/mobile dev` terminal, or Expo DevTools Logs tab |

### Runtime toggles (API)

```bash
LOG_LEVEL=debug           # trace|debug|info|warn|error|silent  (default: info)
LOG_TO_FILE=1             # force file sink on in dev (prod: on by default)
LOG_FILE=/var/log/api.log # override the default apps/api/logs/api.log path
```

See [`docs/logs.md`](docs/logs.md) for the full guide, field reference,
`jq`/CloudWatch query recipes, and conventions when adding new logs.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `env_file not found` | Run `bash setup.sh` to create `apps/api/.env` |
| API crashes at startup | Check `JWT_SECRET` is at least 32 characters |
| Port already in use | Stop local Postgres/Redis, or change ports in compose file |
| Mobile can't connect to API | Set `EXPO_PUBLIC_API_URL` to your machine's IP |
| Build fails on DTS | Run `pnpm --filter @red-handed/shared build` first |
| Tests fail | Ensure shared package is built: `pnpm --filter @red-handed/shared build` |
| Need to see what went wrong | Check the logs — see [`docs/logs.md`](docs/logs.md) |

---

## License

Private — All rights reserved.

# 🎭 Imposter Game

A real-time multiplayer social deduction game — villagers get Word A, imposters get Word B. Give clues, vote out the imposters, and win!

## Tech Stack

| Layer | Tech |
|-------|------|
| Web | React + Vite + TypeScript + TailwindCSS |
| Mobile | React Native + Expo + NativeWind |
| API | Fastify + TypeScript + Socket.IO |
| Database | PostgreSQL + Redis |
| Monorepo | Turborepo + pnpm workspaces |
| DevOps | Docker + GitHub Actions + K3s |

## Project Structure

```
imposter-game/
├── apps/
│   ├── web/        # React + Vite web app (port 5173)
│   ├── api/        # Fastify API (port 3001)
│   └── mobile/     # React Native + Expo app
├── packages/
│   ├── shared/     # Types, game logic, i18n (en/fr/ar/es/de)
│   └── ui/         # Shared React components
├── k8s/            # Kubernetes manifests (K3s)
└── .github/        # GitHub Actions CI/CD
```

## Docker Quick Start (Fresh Machine)

The only prerequisite is **Docker Desktop**.

```bash
# 1. Clone and enter the repo
git clone <repo-url> && cd imposter-game

# 2. One-time setup (copies .env.example → .env)
bash setup.sh

# 3. Start everything
docker compose -f docker-compose.dev.yml up
```

- Web: http://localhost:5173
- API: http://localhost:3001

Migrations and seed data (word packs) run automatically on first start. No other setup needed.

### Troubleshooting

| Problem | Fix |
|---------|-----|
| `env_file not found` error | Run `bash setup.sh` to create `apps/api/.env` |
| API crashes at startup | Check `JWT_SECRET` in `apps/api/.env` is at least 32 characters |
| Port already in use | Stop any local Postgres/Redis, or change ports in `docker-compose.dev.yml` |
| `pnpm: not found` inside container | Rebuild: `docker compose -f docker-compose.dev.yml build` |

---

## Local Development (without Docker)

### Prerequisites
- Node.js ≥ 20
- pnpm ≥ 9
- Docker + Docker Compose (for PostgreSQL + Redis only)

### Setup

```bash
# Install dependencies
pnpm install

# Start infrastructure only (PostgreSQL + Redis)
docker compose -f docker-compose.dev.yml up postgres redis -d

# Copy and configure env
cp apps/api/.env.example apps/api/.env

# Run migrations + seed
cd apps/api && pnpm db:migrate && pnpm db:seed && cd ../..

# Start all dev servers
pnpm dev

# Or start individually:
pnpm --filter @imposter/api dev     # API on :3001
pnpm --filter @imposter/web dev     # Web on :5173
pnpm --filter @imposter/mobile dev  # Expo
```

## Game Rules

1. **Host** creates a room (4–20 players)
2. **Server** assigns roles: N imposters, rest are villagers
3. **Villagers** get Word A, **Imposters** get Word B (semantically close)
4. Players give **one-sentence clues** without saying their word
5. **Vote** to eliminate who you think is the imposter
6. **Villagers win** if all imposters are eliminated
7. **Imposters win** if their count ≥ remaining villagers

## Supported Languages

🇬🇧 English · 🇫🇷 French · 🇸🇦 Arabic · 🇪🇸 Spanish · 🇩🇪 German

## Development Phases

- **Phase 1** — Core Game MVP (auth, rooms, real-time loop) ← *current*
- **Phase 2** — Ranked, avatars, honors, achievements
- **Phase 3** — Coin shop, season pass, gifting
- **Phase 4** — Voice mode, custom word packs, cloud hybrid

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

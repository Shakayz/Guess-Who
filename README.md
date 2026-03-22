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

## Quick Start

### Prerequisites
- Node.js ≥ 20
- pnpm ≥ 9
- Docker + Docker Compose

### Development

```bash
# Install dependencies
pnpm install

# Start infrastructure (PostgreSQL + Redis)
docker compose -f docker-compose.dev.yml up -d

# Start all dev servers
pnpm dev

# Or start individually:
pnpm --filter @imposter/api dev     # API on :3001
pnpm --filter @imposter/web dev     # Web on :5173
pnpm --filter @imposter/mobile dev  # Expo
```

### Database Setup

```bash
cd apps/api
cp .env.example .env
# Edit .env with your values
pnpm db:generate
pnpm db:migrate
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

# Contributing to Imposter Game

## Branch Strategy

- `main` — production
- `develop` — staging / integration
- `feat/*` — new features
- `fix/*` — bug fixes

## Commit Convention

We follow [Conventional Commits](https://conventionalcommits.org/):

```
feat: add ranked matchmaking
fix: resolve voting tie logic
docs: update API reference
chore: bump dependencies
```

## Pull Request Process

1. Fork or branch from `develop`
2. Write your code + tests
3. Open a PR against `develop`
4. Wait for CI to pass
5. Request a review

## Code Style

- TypeScript strict mode everywhere
- Prettier for formatting (`pnpm format`)
- ESLint for linting (`pnpm lint`)

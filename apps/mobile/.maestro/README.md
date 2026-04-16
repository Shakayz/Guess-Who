# Mobile E2E (Maestro)

End-to-end UI tests for the Expo mobile app, written as Maestro flows.

## Why Maestro (and not Detox)

The app is Expo-based. Detox on Expo requires `expo prebuild` + a native dev
build + Android Studio/Gradle (and Xcode on macOS for iOS). That's a heavy
setup for modest payoff — especially on Windows where iOS is out of reach.

Maestro:
- drives the installed app through YAML flows,
- works with Expo Go *or* a dev/production build,
- is Windows-friendly (just needs an Android emulator or USB device),
- uses text-based selectors that stay readable over time.

## Prerequisites

1. **Install the Maestro CLI** — https://maestro.mobile.dev/getting-started/installing-maestro
2. **Run an Android emulator** (via Android Studio) or connect a device in
   USB debugging mode. Verify with `adb devices`.
3. **Install the app on the device/emulator**. Three options:
   - **Dev build** (recommended for CI-style runs):
     `cd apps/mobile && pnpm exec expo run:android`
     — this installs `com.redhanded.game` directly.
   - **Expo Go**: open the Expo dev server (`pnpm --filter @red-handed/mobile dev`)
     and scan the QR code. Then set `APP_ID=host.exp.exponent` when running
     flows (see below).
   - **Production APK**: install the output of `eas build --platform android`.

## Running

From the repo root:

```bash
# All flows (requires device + app installed):
cd apps/mobile && maestro test .maestro/

# A single flow:
maestro test .maestro/flows/01-smoke.yaml

# Against Expo Go instead of a native build:
maestro test --env APP_ID=host.exp.exponent .maestro/flows/01-smoke.yaml

# Interactive studio (record + inspect):
maestro studio
```

## Flow inventory

| File | Needs backend | What it checks |
|------|---------------|----------------|
| `01-smoke.yaml` | ❌ | App launches, auth screen renders core affordances |
| `02-auth-validation.yaml` | ❌ | Client-side validation (username/email/password) |
| `03-auth-toggle-modes.yaml` | ❌ | Sign-in ↔ Sign-up toggling shows/hides fields |
| `04-forgot-password.yaml` | ❌ | Forgot-password nav, form renders, back works |
| `05-language-picker.yaml` | ❌ | i18n: EN ↔ FR round-trip on the auth screen |
| `06-offline-mode.yaml` | ❌ | Enter Pass & Play, start a 3-player local game |
| `07-how-to-play.yaml` | ❌ | Deep link to role reference, back to auth |
| `08-deep-link-reset-password.yaml` | ❌ | `redhanded://reset-password?token=…` routes correctly |

All current flows are **backend-free**. They either exercise UI state local
to the app or call into `@red-handed/shared` game logic (offline mode).

## Why no authenticated flows yet

Flows past the auth wall (home tab, lobby creation, online game, profile,
achievements, shop) need:
1. a running API + Postgres + Redis (docker-compose up), and
2. a way to seed a test user and inject its token into `useAuthStore`.

That's a meaningful extension but deliberately out of scope for this first
pass. When you add them, the pattern is:

1. Add a test user to the seed (`apps/api/prisma/seed.ts` or a fixture).
2. Before each authed flow, use Maestro's `runScript` to `POST /auth/signin`
   and stash the `token` via AsyncStorage — then launch the app.
3. Put those flows in `flows/authed/` so the default `maestro test .maestro/`
   run stays offline-safe.

## Known i18n gaps surfaced by this suite

Several screens call `t('auth.sendResetLink', { defaultValue: '...' })` but
the English strings aren't in `packages/shared/src/i18n/en.ts`. The flows
work around this (they assert on text that does render), but the long-term
fix is to add the missing keys.

Affected at time of writing:

- `auth.forgotPasswordDesc`, `auth.resetLinkSent`, `auth.sendResetLink`,
  `auth.backToLogin` (used by `app/forgot-password.tsx`)
- all `offline.*` keys (handled via `defaultValue`, so they render fine)
- all `howToPlay.*` keys (same, `defaultValue` fallback)

## testIDs added by this suite

The following were added to `apps/mobile/app/auth.tsx` so flows 02, 03, and
05 can select inputs unambiguously:

- `username-input`, `email-input`, `password-input`
- `language-picker-trigger`

These are RN `testID` props. They're compiled away in prod builds' native
view hierarchy only as accessibility identifiers, so they cost nothing.

# Mobile Payments & Ads — App Store and Google Play

This document is the end-to-end runbook for publishing **Red Handed !** to the
App Store and Google Play with monetisation (in-app purchases + ads) enabled.

> **tl;dr** – Apple and Google require digital-goods purchases (star coins,
> Premium, season pass) to go through **StoreKit** and **Google Play
> Billing**, not Stripe. The web app keeps using Stripe Checkout; the mobile
> app is wired to native IAP in `apps/mobile/lib/iap.ts` and the backend
> verifies receipts in `apps/api/src/routes/iap.ts`. Ads use **Google
> AdMob** via `react-native-google-mobile-ads` (`apps/mobile/lib/ads.ts`).

---

## 1. Install native dependencies

After pulling this branch:

```bash
pnpm install
cd apps/mobile
npx expo prebuild --clean        # regenerate ios/ and android/ folders
```

The new deps are:

| Package                          | Purpose                                          |
|----------------------------------|--------------------------------------------------|
| `react-native-iap`               | StoreKit + Play Billing bridge                   |
| `react-native-google-mobile-ads` | AdMob banner / interstitial / rewarded           |
| `expo-tracking-transparency`     | iOS ATT prompt (required for personalised ads)   |

Both native deps ship config plugins that are already registered in
`app.json`, so `prebuild` will wire them into Info.plist / AndroidManifest
automatically.

---

## 2. Product IDs

All in-app product IDs live in `packages/shared/src/constants/index.ts` under
`IAP_PRODUCT_IDS`. The same IDs must be declared in **App Store Connect** and
the **Google Play Console**:

| Kind           | Product ID                                    | Type                  | Display     |
|----------------|-----------------------------------------------|-----------------------|-------------|
| Coins          | `com.redhanded.game.pack_500`                 | Consumable            | 500 ⭐       |
| Coins          | `com.redhanded.game.pack_1500`                | Consumable            | 1500 ⭐ +150 |
| Coins          | `com.redhanded.game.pack_5000`                | Consumable            | 5000 ⭐ +750 |
| Subscription   | `com.redhanded.game.premium.monthly`          | Auto-renewing sub     | €1 / month  |
| Subscription   | `com.redhanded.game.premium.yearly`           | Auto-renewing sub     | €10 / year  |
| Non-consumable | `com.redhanded.game.season_pass`              | Non-consumable        | Season pass |

If you rename any of these in the stores, update the constants file too — the
backend maps products back to coin packs via `coinPackFromIapProductId`.

---

## 3. Backend environment variables

Add these to the API `.env` (and the ECS task definition for prod):

```bash
# ── Apple ──────────────────────────────────────────────────
# App Store Connect → App Information → "App-Specific Shared Secret".
APPLE_IAP_SHARED_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# Set to true in staging if you verify sandbox-only receipts.
APPLE_IAP_USE_SANDBOX=false

# ── Google Play ────────────────────────────────────────────
GOOGLE_PLAY_PACKAGE_NAME=com.redhanded.game
# Paste the full service-account JSON (single line, escape newlines in \n).
# Service account must be linked to the Play Console and granted:
#   - View financial data
#   - Manage orders and subscriptions
GOOGLE_PLAY_SERVICE_ACCOUNT_JSON={"type":"service_account", ...}
```

The IAP verification routes are registered at:

- `POST /api/shop/iap/ios/verify`
- `POST /api/shop/iap/android/verify`

Both routes are authenticated with the same JWT used elsewhere, are idempotent
(unique index on `purchases.storeTransactionId`), and credit coins / flip the
`users.premium` flag in a single transaction.

---

## 4. AdMob setup

1. Create an AdMob account at <https://apps.admob.com>.
2. Register the iOS and Android apps; copy the two **App IDs**
   (`ca-app-pub-XXXXXX~YYYYYY`).
3. Replace the placeholder (test) App IDs in `apps/mobile/app.json` under
   `plugins` → `react-native-google-mobile-ads`:
   ```json
   "androidAppId": "ca-app-pub-XXXXXX~ANDROID_APP_ID",
   "iosAppId":     "ca-app-pub-XXXXXX~IOS_APP_ID"
   ```
4. Create the ad units (banner, interstitial, rewarded) for each platform and
   paste the unit IDs into `apps/mobile/eas.json` under the `production` and
   `preview` profiles:
   ```json
   "EXPO_PUBLIC_ADMOB_IOS_BANNER": "ca-app-pub-XXX/YYY",
   "EXPO_PUBLIC_ADMOB_IOS_INTERSTITIAL": "ca-app-pub-XXX/YYY",
   "EXPO_PUBLIC_ADMOB_IOS_REWARDED": "ca-app-pub-XXX/YYY",
   "EXPO_PUBLIC_ADMOB_ANDROID_BANNER": "ca-app-pub-XXX/YYY",
   "EXPO_PUBLIC_ADMOB_ANDROID_INTERSTITIAL": "ca-app-pub-XXX/YYY",
   "EXPO_PUBLIC_ADMOB_ANDROID_REWARDED": "ca-app-pub-XXX/YYY"
   ```
   When any of these are left empty, `apps/mobile/lib/ads.ts` falls back to
   Google's public test unit IDs so development still has fill.

5. **iOS ATT** — the NSUserTrackingUsageDescription string is already in
   `app.json`. On first launch, `initAds()` calls the AdMob SDK; if you also
   want the ATT prompt, call `requestTrackingPermissionsAsync` from
   `expo-tracking-transparency` at the end of the onboarding flow before
   loading the first ad.

---

## 5. Code integration map

| Area               | File                                                         |
|--------------------|--------------------------------------------------------------|
| IAP client module  | `apps/mobile/lib/iap.ts`                                     |
| Ads client module  | `apps/mobile/lib/ads.ts`                                     |
| Banner component   | `apps/mobile/components/AdBanner.tsx`                        |
| IAP init (session) | `apps/mobile/app/_layout.tsx`                                |
| Shop UI (coins + Premium) | `apps/mobile/app/shop.tsx`                            |
| Premium upsell UI  | `apps/mobile/app/premium.tsx`                                |
| Interstitial trigger (post-game) | `apps/mobile/app/results/[code].tsx`            |
| Backend verify     | `apps/api/src/routes/iap.ts`                                 |
| Shared product IDs | `packages/shared/src/constants/index.ts` (`IAP_PRODUCT_IDS`) |
| Prisma migration   | `apps/api/prisma/migrations/20260423000000_mobile_iap_and_subscriptions/` |

Run the new migration once after pulling:

```bash
pnpm --filter @red-handed/api db:migrate
```

---

## 6. Building with EAS

```bash
cd apps/mobile

# First-time EAS project creation (grabs the projectId into app.json)
eas init

# Internal builds for TestFlight / Play Internal Testing
eas build --profile preview --platform ios
eas build --profile preview --platform android

# Production builds
eas build --profile production --platform ios
eas build --profile production --platform android
```

EAS reads IAP / AdMob env vars from the `build.production.env` object in
`eas.json`, so fill those in **before** kicking a production build. They're
baked into the JS bundle (prefix `EXPO_PUBLIC_`), so a new build is required
to rotate them.

---

## 7. Submitting to the stores

### App Store

1. Create the app in App Store Connect (bundle id `com.redhanded.game`).
2. Under **In-App Purchases**, create the products listed in §2 using the
   exact IDs. For subscriptions, create the subscription group **Premium**
   first, then add the monthly + yearly tiers inside it.
3. Under **App Information**, generate an **App-Specific Shared Secret** and
   put it in the API `APPLE_IAP_SHARED_SECRET` env.
4. Fill in `apps/mobile/eas.json` → `submit.production.ios`:
   ```json
   "appleId":     "you@example.com",
   "ascAppId":    "1234567890",
   "appleTeamId": "ABCDE12345"
   ```
5. Submit:
   ```bash
   eas submit --profile production --platform ios
   ```

### Google Play

1. Create the app in the Play Console (package `com.redhanded.game`).
2. Under **Monetize → Products → In-app products** and **Subscriptions**,
   create the products listed in §2.
3. Create a **service account** in GCP (or reuse one), link it to the Play
   Console under **Users and permissions**, grant "View financial data" +
   "Manage orders and subscriptions" on the app. Download the JSON key.
4. Put the full JSON in the API env as `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`
   (single line) and in EAS as a secret file referenced by
   `submit.production.android.serviceAccountKeyPath` (local path, **do not
   commit**).
5. Submit:
   ```bash
   eas submit --profile production --platform android
   ```
   The `releaseStatus` is set to `draft` in `eas.json` so you have a chance to
   review the rollout in the Play Console before publishing.

---

## 8. Store review checklist

- [ ] App icon, splash, and screenshots present under `apps/mobile/assets/` +
      `screenshots/` for every supported device size.
- [ ] **Privacy policy URL** pointing at `apps/web` → `/privacy`. Apple + Google
      both require this for apps that sell IAP or show ads.
- [ ] **Terms of service URL** pointing at `apps/web` → `/terms`. Required by
      App Store Guideline 3.1.2 for any app with auto-renewing subs.
- [ ] Shop screen shows price, product title, "Subscription auto-renews…"
      disclosure, and **Restore purchases** link (all present in
      `apps/mobile/app/shop.tsx` and `premium.tsx`).
- [ ] Apple Data & Privacy ("App Privacy") form filled in with AdMob's
      disclosure (Device ID, Coarse location, Crash data, Product interaction).
- [ ] Google Play **Data safety** form filled in similarly.
- [ ] AdMob and Apple account linked (App Store Connect → Apps → [app] →
      Availability → Ad Network IDs if advanced attribution is needed).
- [ ] Test every IAP path at least once in Sandbox (iOS) and License Testing
      (Android) before production release.

---

## 9. Webhooks (optional but recommended)

Receipts are verified on purchase, but the subscription state should be kept
live via store-side webhooks:

- **Apple**: App Store Server Notifications v2 → point at a new
  `POST /api/shop/iap/ios/notifications` route that re-verifies the signed
  JWS and updates the `subscriptions` row.
- **Google**: Real-Time Developer Notifications → configure a Pub/Sub topic,
  forward to `POST /api/shop/iap/android/notifications`, and re-query the
  Android Publisher API to flip status.

These endpoints aren't included in this first pass — add them once basic IAP
is verified live. The data model (`subscriptions` table, `users.premium`
flag) is already wired to accept webhook-driven updates.

# Sentroh Merchant app (Expo)

Store app for the Sentroh marketplace. Read `D:\Sentroh\sentroh-platform\docs\PROJECT_STATE.md` first.

## Stack
- Expo SDK 57, React Native 0.86, expo-router (screens in `app/`), JavaScript (JSX), path alias `@/` = repo root.
- State: zustand (`lib/session.js`). Supabase JS only for phone sign-in (OTP) and photo uploads to signed URLs.
- All store data goes through marketplace-api: `/api/v1/me/*`, `/api/v1/merchant/sign-up`, `/api/v1/merchant/:merchantId/*` (`lib/api.js`, `storeApi`).
- Push: expo-notifications, token saved with app `MERCHANT`; Android channels `urgent` (new orders) and `default` must match the server's `channelId`.
- Env var names: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_MARKETPLACE_API_URL` (DEV only).

## Hard rules
- NEVER read, print or commit `.env*`, google-services.json, FCM keys or keystores.
- `EXPO_PUBLIC_*` values ship inside the app: never a service-role key or any secret.
- The server decides permissions (OWNER/MANAGER edit; STAFF on/off, stock, orders). The app only hides buttons.
- Prices, fees and totals are display only.
- Commit files by name, never `git add .`. Push only after the owner says yes.

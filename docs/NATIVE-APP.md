# BodyFuel Native App

BodyFuel uses the existing React/TanStack application as the shared UI and product code for web, PWA, iOS and Android.

## Architecture

- Web/PWA keeps the normal TanStack Start production build.
- iOS/Android use a separate TanStack SPA build produced with `BF_NATIVE_APP=1`.
- `scripts/build-native.mjs` copies the generated SPA shell into `native-dist/`.
- Capacitor packages `native-dist/` into the native projects.
- Native client-side server-function requests are rebased to `VITE_APP_SERVER_ORIGIN` (default: `https://bodyfuel-coaching.com`).
- Existing Supabase bearer-token middleware continues to authenticate server-function requests.
- `CapacitorHttp` is enabled so native HTTP can be used without turning the app into a remote website wrapper.

## App identity

- App name: `BodyFuel`
- Bundle/Application ID: `com.bodyfuel.app`

## Commands

```bash
npm run build:native
npm run cap:sync
npm run cap:android
npm run cap:ios
```

`native-dist/` is generated output and must not be committed.

## Current scope

The first native release is customer-first. Existing web coach/admin surfaces remain supported by the web application. Store billing, native push, camera/barcode integration and health-platform integrations are separate follow-up slices after the native shell is stable.

# TradePilot AI

An iPhone-first gemstone trading and inventory app. The first release is for Raka Gems; the architecture will later support multiple independent trading businesses.

## Current status

This branch contains an **initial UI scaffold only**. It is not yet connected to Supabase or Airtable. It does not save transactions, upload media, authenticate users, or calculate live balances. The UI deliberately labels this status to avoid mistaking a preview for a working ledger.

## Planned stack

- React Native + Expo for a native iOS app and cloud iOS builds.
- Supabase Auth, Postgres and private Storage for the application backend.
- Server-side AI extraction with explicit confirmation for ambiguous or financial transactions.
- RLS and organization membership for future multi-tenant separation.
- Idempotent transaction writes, audit trail and read-back verification.

## Run locally or in a cloud development environment

Use a Node.js version supported by the selected Expo SDK. Then:

```sh
npm install
npx expo install --fix
npm run typecheck
npx expo start
```

Before building for the App Store, confirm the final legal seller name and bundle identifier, connect a secure backend, add tests, and set up Expo Application Services (EAS) and Apple Developer organization credentials.

## Data safety

Do not put Supabase secret/service keys or AI API keys in app code or any `EXPO_PUBLIC_*` variable. Do not connect this scaffold to production records until authentication, row-level security, media authorization and the transaction model have been reviewed and tested.

See [TRADEPILOT_IMPLEMENTATION_PLAN.md](./TRADEPILOT_IMPLEMENTATION_PLAN.md) for the roadmap.

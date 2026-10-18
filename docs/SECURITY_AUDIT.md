# TradePilot pre-integration security findings

Date: 2026-10-18  
Scope: read-only inspection of Supabase project `husoqhevdwwirzbgjaex` and repository state, followed by one verified permissions-only hardening migration.

## Confirmed observations

1. `public.raka_transaction_queue` has RLS enabled and no RLS policies.
2. `public.raka_stone_media` has RLS enabled and no RLS policies.
3. Before hardening, `anon` and `authenticated` had broad table grants on the queue, including SELECT, INSERT, UPDATE and DELETE. RLS currently blocked row access because no policies existed, but a future permissive policy would have been unsafe.
4. `public.rls_auto_enable()` is a `SECURITY DEFINER` event-trigger function. The `ensure_rls` event trigger uses it on DDL command completion. It was also executable through the exposed PostgREST RPC API by `anon` and `authenticated`.
5. `raka-media-intake` is deployed with JWT verification disabled and relies on the `x-raka-secret` header. It uses server-side privileged credentials, uploads to the private `raka-gems-media` bucket, saves a metadata row and attempts to attach a signed URL to Airtable. Its current signed URL expires after one hour; this is not a durable media link.
6. `raka-intake` is JWT-protected but only accepts `action: "test"`; it is not production transaction intake.
7. The inspected queue contained two rows, both `verified`; `raka_stone_media` contained zero metadata rows. This does not prove there are no orphaned Storage objects; a separate Storage object listing is required.
8. The `raka-gems-media` bucket is private.

## Applied and verified change

Migration `lock_down_internal_raka_tables` was applied to Supabase on 2026-10-18. It only revokes client-role permissions; it does not alter or delete data:

- Revoked all table privileges on `raka_transaction_queue` and `raka_stone_media` from `PUBLIC`, `anon`, and `authenticated`.
- Revoked public, anon and authenticated EXECUTE on `public.rls_auto_enable()`.
- Preserved postgres/service_role privileges.
- Verified the `ensure_rls` event trigger remains enabled.
- Verified the queue still contains two rows, both verified, and media metadata still contains zero rows.

This blocks direct API-role access to internal queue/media tables while preserving the existing server-side service-role workflow. It does not fix all media-intake risks or complete app security.

## Draft core schema (not applied)

`supabase/migrations/20261018142000_tradepilot_core_schema.sql` is an additive draft for future multi-tenant app tables. It has **not** been applied to Supabase. Do not apply it until its SQL has been independently validated, a backup/export has been checked, and onboarding/write RPCs and integration tests are ready.

## Required before app integration

- Export/backup the existing data and inspect storage objects and current Airtable links.
- Validate the draft schema, constraints, RLS behaviour and migration order on a separate development project first.
- Design organization onboarding and server-side membership creation before allowing any writes.
- Expose only authenticated, organization-scoped operations; never use service-role credentials in the app.
- Replace shared-secret-only public app upload access with user/session authorization and server-side limits.
- Add durable upload jobs, idempotency, retry and cleanup/reconciliation for partial failures.
- Test with synthetic data first, including cross-tenant denial, duplicate requests, interrupted uploads and transaction read-back.
- Do not import or mutate existing Raka Gems records until mapping and reconciliation have been approved.

## Important limitation

This is a focused inspection, not a complete penetration test. It did not inspect every role, trigger, bucket object, database function, network setting, backup configuration or Airtable permission.

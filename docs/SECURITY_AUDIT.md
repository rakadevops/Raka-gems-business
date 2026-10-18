# TradePilot pre-integration security findings

Date: 2026-10-18  
Scope: read-only inspection of Supabase project `husoqhevdwwirzbgjaex` and repository state. No production schema, data, secrets or permissions were changed by this inspection.

## Confirmed observations

1. `public.raka_transaction_queue` has RLS enabled and no RLS policies.
2. `public.raka_stone_media` has RLS enabled and no RLS policies.
3. Supabase grants show `anon` and `authenticated` roles have broad table privileges on `raka_transaction_queue`, including SELECT, INSERT, UPDATE and DELETE. RLS currently blocks row access because there are no policies, but adding a permissive policy without first narrowing grants would be unsafe.
4. `public.rls_auto_enable()` is a `SECURITY DEFINER` event-trigger function and its ACL includes EXECUTE for `anon` and `authenticated`. Its definition enables RLS for newly created tables in `public`. It does not create policies. Review why it is callable as an RPC and revoke public execution if it is not intended as an API; preserve its event-trigger use if required.
5. `raka-media-intake` is deployed with JWT verification disabled and relies on the `x-raka-secret` header. It uses server-side privileged credentials, uploads to the private `raka-gems-media` bucket, saves a metadata row and attempts to attach a signed URL to Airtable. Its current signed URL expires after one hour; this is not a durable media link. The function needs rate limiting, careful secret rotation, authenticated app-user authorization, and retry/reconciliation coverage before public use.
6. `raka-intake` is JWT-protected but only accepts `action: "test"`; it is not production transaction intake.
7. Current table inspection showed two transaction queue rows, both `verified`, and zero rows in `raka_stone_media`. This does not prove there are no orphaned Storage objects; a separate Storage object listing is required.
8. The `raka-gems-media` bucket is private.

## Required before app integration

- Export/backup the existing data and inspect storage objects and current Airtable links.
- Review grants and the `rls_auto_enable()` ACL; make changes only after checking whether the event trigger depends on the function.
- Design tenant membership and ownership tables before adding app-facing policies.
- Narrow direct table grants; expose only the required operations.
- Require authenticated users and validate organization membership server-side for every record/media action.
- Keep Supabase secret keys and AI provider keys on the server.
- Replace shared-secret-only public app upload access with user/session authorization and server-side limits.
- Add durable upload jobs, idempotency, retry and cleanup/reconciliation for partial failures.
- Test with synthetic data first, including cross-tenant denial, duplicate requests, interrupted uploads and transaction read-back.
- Do not import or mutate existing Raka Gems records until mapping and reconciliation have been approved.

## Important limitation

This is a focused read-only inspection, not a complete penetration test. It did not inspect every role, trigger, bucket object, database function, network setting, backup configuration or Airtable permission.

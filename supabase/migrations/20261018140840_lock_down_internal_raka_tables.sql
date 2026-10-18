-- Security hardening for existing internal Raka Gems tables.
-- No rows, storage objects, triggers, or table definitions are modified.
-- The transaction/media Edge Functions use server-side service-role credentials.

revoke all on table public.raka_transaction_queue from public, anon, authenticated;
revoke all on table public.raka_stone_media from public, anon, authenticated;

-- Keep the ensure_rls event trigger installed, but prevent calling its SECURITY DEFINER
-- trigger function through the public PostgREST RPC API.
revoke all on function public.rls_auto_enable() from public, anon, authenticated;

-- TradePilot AI core schema (additive; NOT YET APPLIED to the live Supabase project).
-- Apply only after exporting/validating a backup and reviewing the rollout checklist.
-- Existing raka_transaction_queue, raka_stone_media, Airtable records, and Storage objects are untouched.

create extension if not exists pgcrypto;

create table if not exists public.tp_organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 160),
  legal_name text,
  country_code char(2) not null default 'LK',
  base_currency char(3) not null default 'LKR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tp_organization_members (
  organization_id uuid not null references public.tp_organizations(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  role text not null check (role in ('owner','admin','trader','accountant','viewer')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table if not exists public.tp_counterparties (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.tp_organizations(id) on delete restrict,
  name text not null check (length(trim(name)) between 1 and 200),
  kind text not null check (kind in ('supplier','customer','processor','broker','other')),
  phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);

create table if not exists public.tp_stones (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.tp_organizations(id) on delete restrict,
  stone_code text not null,
  parent_stone_id uuid,
  description text,
  gem_type text not null default 'sapphire',
  colour text,
  weight_ct numeric(12,4) check (weight_ct is null or weight_ct > 0),
  form text not null default 'rough' check (form in ('rough','preform','finished','parcel','other')),
  treatment_status text not null default 'unknown' check (treatment_status in ('unknown','untreated','heated','treated','disclosed_other')),
  stock_status text not null default 'in_hand' check (stock_status in ('in_hand','processing','reserved','sold','lost','archived')),
  acquired_at timestamptz,
  sold_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, stone_code),
  unique (organization_id, id),
  constraint tp_stones_parent_fk foreign key (organization_id, parent_stone_id)
    references public.tp_stones(organization_id, id) on delete restrict,
  constraint tp_stones_parent_not_self check (parent_stone_id is null or parent_stone_id <> id)
);

create table if not exists public.tp_transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.tp_organizations(id) on delete restrict,
  transaction_code text not null,
  transaction_type text not null check (transaction_type in ('purchase','sale','expense','processing','receipt','payment','adjustment','transfer')),
  status text not null default 'draft' check (status in ('draft','pending_confirmation','posted','reversed','failed')),
  counterparty_id uuid,
  occurred_at timestamptz not null default now(),
  currency char(3) not null default 'LKR',
  gross_amount numeric(16,2) not null default 0 check (gross_amount >= 0),
  notes text,
  idempotency_key text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, transaction_code),
  unique (organization_id, idempotency_key),
  unique (organization_id, id),
  foreign key (organization_id, counterparty_id)
    references public.tp_counterparties(organization_id, id) on delete restrict
);

create table if not exists public.tp_transaction_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.tp_organizations(id) on delete restrict,
  transaction_id uuid not null,
  stone_id uuid,
  line_type text not null check (line_type in ('stone','value_addition','fee','discount','other')),
  description text not null,
  quantity numeric(14,4) not null default 1 check (quantity > 0),
  unit_amount numeric(16,2) not null default 0 check (unit_amount >= 0),
  line_amount numeric(16,2) generated always as (round(quantity * unit_amount, 2)) stored,
  created_at timestamptz not null default now(),
  foreign key (organization_id, transaction_id)
    references public.tp_transactions(organization_id, id) on delete restrict,
  foreign key (organization_id, stone_id)
    references public.tp_stones(organization_id, id) on delete restrict
);

create table if not exists public.tp_value_additions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.tp_organizations(id) on delete restrict,
  stone_id uuid not null,
  transaction_id uuid,
  category text not null check (category in ('heating','preforming','faceting','polishing','transport','broker_fee','lab_fee','repair','other')),
  provider_id uuid,
  amount numeric(16,2) not null check (amount >= 0),
  currency char(3) not null default 'LKR',
  occurred_at timestamptz not null default now(),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','part_paid','paid','disputed','cancelled')),
  receipt_media_id uuid,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, stone_id)
    references public.tp_stones(organization_id, id) on delete restrict,
  foreign key (organization_id, transaction_id)
    references public.tp_transactions(organization_id, id) on delete restrict,
  foreign key (organization_id, provider_id)
    references public.tp_counterparties(organization_id, id) on delete restrict
);

create table if not exists public.tp_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.tp_organizations(id) on delete restrict,
  direction text not null check (direction in ('in','out')),
  status text not null default 'recorded' check (status in ('recorded','cleared','bounced','cancelled')),
  method text not null check (method in ('cash','bank_transfer','cheque','card','other')),
  amount numeric(16,2) not null check (amount > 0),
  currency char(3) not null default 'LKR',
  paid_at timestamptz,
  expected_at timestamptz,
  reference text,
  counterparty_id uuid,
  notes text,
  idempotency_key text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (organization_id, idempotency_key),
  unique (organization_id, id),
  foreign key (organization_id, counterparty_id)
    references public.tp_counterparties(organization_id, id) on delete restrict,
  constraint tp_payment_cleared_has_date check (status <> 'cleared' or paid_at is not null)
);

create table if not exists public.tp_payment_allocations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.tp_organizations(id) on delete restrict,
  payment_id uuid not null,
  transaction_id uuid not null,
  amount numeric(16,2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  foreign key (organization_id, payment_id)
    references public.tp_payments(organization_id, id) on delete restrict,
  foreign key (organization_id, transaction_id)
    references public.tp_transactions(organization_id, id) on delete restrict
);

create table if not exists public.tp_media_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.tp_organizations(id) on delete restrict,
  stone_id uuid,
  transaction_id uuid,
  bucket_id text not null default 'raka-gems-media',
  storage_path text not null,
  original_filename text,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  media_kind text not null check (media_kind in ('image','video','document','other')),
  caption text,
  upload_status text not null default 'pending' check (upload_status in ('pending','uploaded','verified','failed')),
  idempotency_key text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (bucket_id, storage_path),
  unique (organization_id, idempotency_key),
  foreign key (organization_id, stone_id)
    references public.tp_stones(organization_id, id) on delete restrict,
  foreign key (organization_id, transaction_id)
    references public.tp_transactions(organization_id, id) on delete restrict
);

create table if not exists public.tp_ai_ingestion_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.tp_organizations(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending','processing','needs_confirmation','committed','failed')),
  source_kind text not null check (source_kind in ('text','voice','image','video','document')),
  source_media_id uuid,
  proposed_payload jsonb not null default '{}'::jsonb,
  confidence jsonb not null default '{}'::jsonb,
  confirmed_by uuid references auth.users(id) on delete set null,
  committed_transaction_id uuid,
  idempotency_key text not null,
  error_message text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, idempotency_key),
  foreign key (organization_id, source_media_id)
    references public.tp_media_assets(organization_id, id) on delete restrict,
  foreign key (organization_id, committed_transaction_id)
    references public.tp_transactions(organization_id, id) on delete restrict
);

create table if not exists public.tp_audit_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.tp_organizations(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null check (action in ('created','updated','posted','reversed','verified','media_uploaded','media_failed','permission_changed')),
  before_data jsonb,
  after_data jsonb,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists tp_stones_org_status_idx on public.tp_stones(organization_id, stock_status);
create index if not exists tp_stones_parent_idx on public.tp_stones(organization_id, parent_stone_id);
create index if not exists tp_transactions_org_date_idx on public.tp_transactions(organization_id, occurred_at desc);
create index if not exists tp_transactions_org_type_idx on public.tp_transactions(organization_id, transaction_type, status);
create index if not exists tp_lines_transaction_idx on public.tp_transaction_lines(organization_id, transaction_id);
create index if not exists tp_value_additions_stone_idx on public.tp_value_additions(organization_id, stone_id, occurred_at desc);
create index if not exists tp_payments_org_date_idx on public.tp_payments(organization_id, created_at desc);
create index if not exists tp_allocations_transaction_idx on public.tp_payment_allocations(organization_id, transaction_id);
create index if not exists tp_media_stone_idx on public.tp_media_assets(organization_id, stone_id);
create index if not exists tp_ai_jobs_org_status_idx on public.tp_ai_ingestion_jobs(organization_id, status, created_at);

-- Tenant access helper: membership check only; no table writes.
create or replace function public.tp_user_can_access_org(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.tp_organization_members m
    where m.organization_id = p_organization_id
      and m.user_id = (select auth.uid())
  );
$$;

revoke all on function public.tp_user_can_access_org(uuid) from public, anon;
grant execute on function public.tp_user_can_access_org(uuid) to authenticated;

-- Enable RLS on every tenant-owned table. Policies only grant access to members.
do $$
declare t text;
begin
  foreach t in array array[
    'tp_organizations','tp_organization_members','tp_counterparties','tp_stones',
    'tp_transactions','tp_transaction_lines','tp_value_additions','tp_payments',
    'tp_payment_allocations','tp_media_assets','tp_ai_ingestion_jobs','tp_audit_events'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

create policy tp_org_select on public.tp_organizations
  for select to authenticated using (public.tp_user_can_access_org(id));
create policy tp_org_update on public.tp_organizations
  for update to authenticated using (
    exists (select 1 from public.tp_organization_members m where m.organization_id=id and m.user_id=(select auth.uid()) and m.role in ('owner','admin'))
  ) with check (public.tp_user_can_access_org(id));

create policy tp_members_select on public.tp_organization_members
  for select to authenticated using (public.tp_user_can_access_org(organization_id));

-- Organization creation is performed by a narrowly scoped server-side onboarding function later.
-- No client insert/delete policy is created for memberships, audit events or financial records yet.

do $$
declare t text;
begin
  foreach t in array array[
    'tp_counterparties','tp_stones','tp_transactions','tp_transaction_lines',
    'tp_value_additions','tp_payments','tp_payment_allocations','tp_media_assets',
    'tp_ai_ingestion_jobs','tp_audit_events'
  ] loop
    execute format('create policy %I on public.%I for select to authenticated using (public.tp_user_can_access_org(organization_id))', t || '_select', t);
  end loop;
end $$;

grant select on public.tp_organizations, public.tp_organization_members, public.tp_counterparties,
  public.tp_stones, public.tp_transactions, public.tp_transaction_lines, public.tp_value_additions,
  public.tp_payments, public.tp_payment_allocations, public.tp_media_assets, public.tp_ai_ingestion_jobs,
  public.tp_audit_events to authenticated;

-- Intentionally no INSERT/UPDATE/DELETE grants or policies for client roles yet.
-- Next migration should add authenticated RPCs / Edge Functions for validated writes, audit events,
-- balanced ledger postings, payment allocations and atomic AI-confirmed transaction commits.

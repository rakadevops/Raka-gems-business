# TradePilot AI — Implementation Plan

Date: 2026-10-18
Status: initial plan; no production database changes made.

## Goal
Build an iPhone-first, chat-first business assistant for Raka Gems first, then offer a paid App Store app to other traders. Text, voice, photos and videos should become structured records. Database records—not chat history or model guesses—are the source of truth.

## Core user flow
1. User sends a message or media attachment.
2. AI proposes typed transaction fields.
3. Backend validates required fields, permissions, item/supplier matches and duplicate/idempotency keys.
4. Ask for clarification or approval when details are ambiguous or high-risk.
5. Commit transaction and ledger effects atomically.
6. Verify the committed state and report Recorded, Pending or Failed accurately.
7. Derive stock and account reports from saved data.

## MVP features
- Chat capture for purchases and expenses.
- Stable item IDs, item history and private media uploads with retry/status.
- Value Addition for heating, cutting, labour, repairs, transport and other costs.
- Sales with buyer, sale price, fees and payment status.
- Separate payment receipts/disbursements from obligations; support partial payments and outstanding balances.
- Reports for stock on hand/cost, processing, realized profit, receivables, payables and actual cash/bank balances.
- Audit trail, idempotency, recovery queue, export and backups.

## Proposed data model
Organizations and members; items plus typed industry extensions; counterparties; transactions and lines; value-addition entries; payments and payment allocations; media assets; ledger entries; AI ingestion jobs; audit events. Business records must be tenant-scoped with row-level security and foreign keys. Do not use a single untyped universal table.

## Accounting rules
- Purchase price is not necessarily cash paid.
- Sale creates an obligation/receivable; it is not automatically money received.
- Receipts and disbursements are separate records and may settle obligations partially.
- Value-addition costs attach to the relevant item or trade and affect cost basis according to defined rules.
- Realized profit uses recorded sale proceeds less allocated item costs and applicable selling costs.
- Splitting a gemstone preserves parent/child lineage and allocates cost without duplication.
- Corrections use reversal/adjustment records; do not silently overwrite accounting facts.

## Phases
### 0. Inspect and secure
Inventory current Supabase schema, policies, functions, storage and GitHub sync. Back up/export before schema changes. Review RLS and access permissions.
### 1. Single-owner MVP
Auth, chat UI, purchase capture, items, media, Value Addition, sale and payments. Reconcile a test ledger against known answers.
### 2. Reliability
Native photo/video picker, voice input, durable uploads/retries, duplicate protection and visible pending/failure states.
### 3. Private beta
5–10 traders, tenant isolation, export, monitoring, onboarding and measured Sinhala/Tamil/English support.
### 4. App Store
Brand checks, privacy policy, terms, account deletion, support, subscriptions, App Store review, backup restore test and ongoing monitoring.

## Security requirements
Keep OpenAI and Supabase secret/service keys server-side. Use only a publishable key in the client. Every business record must be tenant-scoped; enforce RLS and authorization. Review current Supabase security findings before exposing new app access. Never log secrets. Ensure retries cannot duplicate financial effects. Do not claim success until the saved state is verified.

## Cost strategy
Reuse existing Supabase and GitHub assets initially. Keep Airtable as a temporary compatibility surface while the new ledger is proven. Do not buy extra hosting or launch billing before testing the end-to-end workflow. Use cloud iOS builds where practical, but validate current Apple/Expo requirements.

## First complete acceptance test
Purchase -> attach image -> add value-addition cost -> record sale -> record partial payment -> verify remaining stock, item cost, profit, receivable/payable and cash movement. Test duplicates, app restart, timeout after commit and interrupted media uploads. Preserve current Raka Gems records during development.

## Current starting point
Existing Supabase project: `husoqhevdwwirzbgjaex`. Existing repository: `rakadevops/Raka-gems-business`. Current media intake/sync work is not yet proven end-to-end; verify real Storage object, metadata and item attachment before treating uploads as reliable. Inspect and fix existing security policies before using the project for commercial multi-tenant data.

## Cost-free continuation (2026-10-18)
- Do not create a paid Supabase development branch. Keep the production core schema migration as a reviewed draft only; do not apply it to production.
- Continue using GitHub Actions for code checks and implement isolated UI behaviour locally without storing real business data.
- The Add Transaction screen now lets the user select Purchase / Expense / Sale / Payment, enter a counterparty, stone description/colour, weight, amount and notes, and review a validation summary. This is still local-only and intentionally does not save.
- Next no-cost steps: complete UI validation and automated tests; audit the public repository and secrets history; prepare an isolated schema test using a local PostgreSQL/Supabase CLI environment if one can be run without paid cloud resources; only then implement authenticated server-side write functions.

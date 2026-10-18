# Raka Gems AI assistant setup

## Current implementation
- The React app has an **AI Assistant** tab with read-only business chat, optional JPG/PNG/WebP photo input, and a local buying/profit calculator.
- The `raka-ai-assistant` Supabase Edge Function is deployed with JWT verification enabled. It independently validates the signed-in Supabase user against the authorised owner email.
- The function reads a limited recent snapshot (up to 12 rows per table) from the existing Airtable base and sends it to the OpenAI Responses API. It has no write code and cannot save or change records.
- Image observations are advisory only. A photo cannot establish natural status, treatment, origin or certified value.

## One required configuration step
The Edge Function intentionally does not contain an AI provider key. In Supabase Dashboard for project `husoqhevdwwirzbgjaex`:

1. Open **Edge Functions → Secrets** (project secrets).
2. Add `OPENAI_API_KEY` with an API key created in the OpenAI API platform. Do not paste the key into GitHub, the app, chat, or a frontend environment variable.
3. Confirm `AIRTABLE_TOKEN` is present as a server-side secret with read access to the existing base. The current finance intake function already uses this secret; do not replace it with a personal key in source code.
4. Optional: set `OPENAI_MODEL` to a supported vision-capable model if you want to override the default `gpt-4.1-mini`.

Until the AI key and Airtable token are configured, the assistant returns a configuration error and makes no business changes. API usage is billed separately from a ChatGPT subscription.

## Action approval policy
This version is strictly read-only. It does not save AI-proposed transactions or change Airtable/Supabase records. A future write workflow must show a typed preview, require a separate explicit approval, enforce validation and idempotency on the server, and verify saved records by read-back before reporting success.

## Validation checklist
- Sign in with the authorised owner account.
- Ask for a known Stone ID and check that the response names source records accurately.
- Upload a supported photo and confirm the response discusses only visible features and uncertainty.
- Enter numbers in the calculator and compare total cost, profit, return on cost and purchase ceiling using a separate calculator.
- Confirm no records are created or changed during AI usage.
- Test missing/invalid AI secret handling before treating the feature as ready for daily business use.

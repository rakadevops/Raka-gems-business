# Raka Gems Dropbox → Supabase media sync

The hourly GitHub Actions job syncs stone media from Dropbox into the private `raka-gems-media` Supabase bucket via `raka-media-intake`, which stores metadata and adds an expiring signed attachment URL to the matching Airtable `Stones` record.

## Dropbox inbox layout
Create `/Raka_Gems_Inbox/${STONE_ID}/${filename}` in Dropbox. Example: `/Raka_Gems_Inbox/RG-20261014-001/rough-front.jpeg`. The folder must use the exact Airtable Stone ID format `RG-YYYYMMDD-NNN`. Supported extensions: `.jpg`, `.jpeg`, `.png`, `.webp`, `.heic`, `.mp4`, `.m4v`, `.mov`, `.webm`. Maximum size is 100 MiB. Source files are not deleted or moved.

## Dropbox credentials
In the Dropbox App Console, create/select an app with read permissions `files.metadata.read` and `files.content.read`. Enable offline access and generate an OAuth refresh token for the account that owns the inbox. Keep the app key, app secret, and refresh token private; never commit them or paste them into chat.

## GitHub Actions secrets
In repository Settings → Secrets and variables → Actions, add these repository secrets:
- `DROPBOX_APP_KEY` — Dropbox app key
- `DROPBOX_APP_SECRET` — Dropbox app secret
- `DROPBOX_REFRESH_TOKEN` — Dropbox refresh token
- `RAKA_INTAKE_SECRET` — must match the secret configured on the Supabase `raka-media-intake` Edge Function

The workflow sets `RAKA_SUPABASE_FUNCTION_URL` to `https://husoqhevdwwirzbgjaex.supabase.co/functions/v1/raka-media-intake` and `DROPBOX_INBOX_PATH` to `/Raka_Gems_Inbox`.

## Run and verify
The workflow runs hourly and can be started manually from Actions → Raka Gems media sync → Run workflow. Check logs for `OK ${STONE_ID}: ${filename}` and the final successful/skipped counts. Do not consider automation operational until a real test file uploads and the Airtable attachment is verified. Idempotency is based on Dropbox file ID and revision, so unchanged files should not create duplicate metadata rows.

## Security and recovery
- Never store API keys or tokens in source files, issues, or logs.
- The Supabase bucket is private; attachment URLs expire.
- If a file upload fails, correct the configuration and rerun the workflow. Do not delete Supabase objects or Airtable records as a retry strategy.

#!/usr/bin/env python3
"""Sync Dropbox stone media to the private Raka Gems Supabase intake."""
import base64
import hashlib
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

DROPBOX_API = "https://api.dropboxapi.com/2"
DROPBOX_CONTENT = "https://content.dropboxapi.com/2"
MAX_BYTES = 100 * 1024 * 1024
STONE_ID_RE = re.compile(r"RG-\d{8}-\d{3}\Z")
MIME_TYPES = {
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "png": "image/png",
    "webp": "image/webp",
    "heic": "image/heic",
    "mp4": "video/mp4",
    "m4v": "video/mp4",
    "mov": "video/quicktime",
    "webm": "video/webm",
}


def request(url, data=None, headers=None, method=None):
    req = urllib.request.Request(url, data=data, headers=headers or {}, method=method)
    try:
        with urllib.request.urlopen(req, timeout=120) as response:
            return response.read()
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", "replace")[:800]
        raise RuntimeError(
            f"HTTP {exc.code} from {urllib.parse.urlparse(url).netloc}: {detail}"
        ) from None


def post_json(url, payload, headers):
    raw = request(
        url,
        json.dumps(payload).encode("utf-8"),
        {"Content-Type": "application/json", **headers},
        "POST",
    )
    return json.loads(raw)


def multipart_field(boundary, name, value):
    return (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="{name}"\r\n\r\n'
        f"{value}\r\n"
    ).encode("utf-8")


def main():
    app_key = os.environ["DROPBOX_APP_KEY"]
    app_secret = os.environ["DROPBOX_APP_SECRET"]
    refresh_token = os.environ["DROPBOX_REFRESH_TOKEN"]
    intake_url = os.environ["RAKA_SUPABASE_FUNCTION_URL"].rstrip("/")
    intake_secret = os.environ["RAKA_INTAKE_SECRET"]
    inbox = os.getenv("DROPBOX_INBOX_PATH", "/Raka_Gems_Inbox").rstrip("/")
    if not inbox:
        inbox = "/Raka_Gems_Inbox"

    token_form = urllib.parse.urlencode({
        "grant_type": "refresh_token",
        "refresh_token": refresh_token,
    }).encode("utf-8")
    basic = base64.b64encode(f"{app_key}:{app_secret}".encode("utf-8")).decode("ascii")
    token_data = request(
        "https://api.dropbox.com/oauth2/token",
        token_form,
        {
            "Authorization": "Basic " + basic,
            "Content-Type": "application/x-www-form-urlencoded",
        },
        "POST",
    )
    access_token = json.loads(token_data)["access_token"]
    db_headers = {
        "Authorization": "Bearer " + access_token,
        "Content-Type": "application/json",
    }

    page = post_json(
        DROPBOX_API + "/files/list_folder",
        {
            "path": inbox,
            "recursive": True,
            "include_deleted": False,
            "limit": 2000,
        },
        db_headers,
    )
    entries = list(page.get("entries", []))
    while page.get("has_more"):
        page = post_json(
            DROPBOX_API + "/files/list_folder/continue",
            {"cursor": page["cursor"]},
            db_headers,
        )
        entries.extend(page.get("entries", []))

    successful = skipped = 0
    for entry in entries:
        if entry.get(".tag") != "file" or not entry.get("path_display"):
            continue
        path = entry["path_display"]
        relative = path[len(inbox):].strip("/") if path.startswith(inbox + "/") else ""
        parts = relative.split("/", 1)
        if len(parts) != 2 or not STONE_ID_RE.fullmatch(parts[0]):
            skipped += 1
            continue

        stone_id, relative_file = parts
        filename = relative_file.rsplit("/", 1)[-1]
        size = int(entry.get("size", 0))
        if size < 1 or size > MAX_BYTES:
            print(f"SKIP size outside 1 byte–100 MiB: {path}")
            skipped += 1
            continue

        suffix = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
        mime_type = MIME_TYPES.get(suffix)
        if not mime_type:
            print(f"SKIP unsupported file type: {path}")
            skipped += 1
            continue

        file_data = request(
            DROPBOX_CONTENT + "/files/download",
            None,
            {
                "Authorization": "Bearer " + access_token,
                "Dropbox-API-Arg": json.dumps({"path": path}),
            },
            "POST",
        )
        revision = entry.get("rev", "")
        file_identity = entry.get("id", path) + ":" + revision
        idempotency_key = "dropbox-" + hashlib.sha256(file_identity.encode()).hexdigest()[:48]
        boundary = "RakaGems" + hashlib.sha256(
            (idempotency_key + filename).encode()
        ).hexdigest()[:24]

        body = multipart_field(boundary, "stone_id", stone_id)
        body += multipart_field(boundary, "idempotency_key", idempotency_key)
        body += multipart_field(boundary, "caption", f"Synced from Dropbox: {path}")
        safe_filename = filename.replace('"', "_").replace("\r", "_").replace("\n", "_")
        body += (
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="file"; filename="{safe_filename}"\r\n'
            f"Content-Type: {mime_type}\r\n\r\n"
        ).encode("utf-8")
        body += file_data
        body += f"\r\n--{boundary}--\r\n".encode("utf-8")

        response = request(
            intake_url,
            body,
            {
                "Content-Type": f"multipart/form-data; boundary={boundary}",
                "x-raka-secret": intake_secret,
            },
            "POST",
        )
        result = json.loads(response)
        if not result.get("success"):
            raise RuntimeError(
                f"Intake rejected {path}: {result.get('error', 'unknown error')}"
            )
        state = "duplicate" if result.get("duplicate") else "uploaded"
        print(f"OK {stone_id}: {filename} ({state})")
        successful += 1

    print(f"Finished: {successful} successful, {skipped} skipped. No secrets printed.")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(1)

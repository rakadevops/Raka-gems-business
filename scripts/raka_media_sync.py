#!/usr/bin/env python3
"""Copy Dropbox stone media into the private Raka Gems Supabase intake."""
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


def request(url, data=None, headers=None, method=None):
 req = urllib.request.Request(url, data=data, headers=headers or {}, method=method)
    try:
        with urllib.request.urlopen(req, timeout=120) as response:
            return response.read()
    except urllib.error.HTTPError as exc:
 detail = exc.read().decode("utf-8", "replace")[:1000]
        raise RuntimeError(f"HTTP {exc.code} from {urllib.parse.urlparse(url).netloc}: {detail}") from None


def post_json(url, payload, headers):
 raw = request(url, json.dumps(payload).encode(), {"Content-Type": "application/json", **headers}, "POST")
    return json.loads(raw)


def main():
 app_key = os.environ["DROPBOX_APP_KEY"]
 app_secret = os.environ["DROPBOX_APP_SECRET"]
 refresh_token = os.environ["DROPBOX_REFRESH_TOKEN"]
 intake_url = os.environ["RAKA_SUPABASE_FUNCTION_URL"].rstrip("/")
 intake_secret = os.environ["RAKA_INTAKE_SECRET"]
 inbox = os.getenv("DROPBOX_INBOX_PATH", "/Raka_Gems_Inbox").rstrip("/")

 form = urllib.parse.urlencode({"grant_type": "refresh_token", "refresh_token": refresh_token}).encode()
 basic = base64.b64encode(f"{app_key}:{app_secret}".encode()).decode()
 token_raw = request("https://api.dropbox.com/oauth2/token", form, {"Authorization": "Basic " + basic, "Content-Type": "application/x-www-form-urlencoded"}, "POST")
 access_token = json.loads(token_raw)["access_token"]
 headers = {"Authorization": "Bearer " + access_token, "Content-Type": "application/json"}

 page = post_json(DROPBOX_API + "/files/list_folder", {"path": inbox, "recursive": True, "include_deleted": False, "limit": 2000}, headers)
 entries = list(page.get("entries", []))
    while page.get("has_more"):
 page = post_json(DROPBOX_API + "/files/list_folder/continue", {"cursor": page["cursor"]}, headers)
 entries.extend(page.get("entries", []))

 uploaded = skipped = 0
    for entry in entries:
        if entry.get(".tag") != "file" or not entry.get("path_display"):
            continue
 path = entry["path_display"]
 relative = path[len(inbox):].strip("/") if path.startswith(inbox + "/") else ""
 parts = relative.split("/", 1)
        if len(parts) != 2 or not re.fullmatch(r"RG-\d{8}-\d{3}", parts[0]):
 skipped += 1
            continue
        stone_id, relative_file = parts
 filename = relative_file.rsplit("/", 1)[-1]
 size = int(entry.get("size", 0))
        if size &lt; 1 or size &gt; 100 * 1024 * 1024:
            print(f"SKIP size outside 1 byte–100 MiB: {path}")
 skipped += 1
            continue

 suffix = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
 mime = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "webp": "image/webp", "heic": "image/heic", "mp4": "video/mp4", "m4v": "video/mp4", "mov": "video/quicktime", "webm": "video/webm"}.get(suffix)
        if mime is None:
            print(f"SKIP unsupported media type: {path}")
 skipped += 1
            continue

 file_data = request(DROPBOX_CONTENT + "/files/download", None, {"Authorization": "Bearer " + access_token, "Dropbox-API-Arg": json.dumps({"path": path})}, "POST")
 revision_key = entry.get("id", path) + ":" + entry.get("rev", "")
 idempotency_key = "dropbox-" + hashlib.sha256(revision_key.encode()).hexdigest()[:48]
 boundary = "RakaGems" + hashlib.sha256((idempotency_key + filename).encode()).hexdigest()[:24]

        def field(key, value):
            return (f"--{boundary}\r\nContent-Disposition: form-data; name=\"{key}\"\r\n\r\n{value}\r\n").encode()

 safe_filename = filename.replace('"', "_").replace("\r", "_").replace("\n", "_")
 body = field("stone_id", stone_id) + field("idempotency_key", idempotency_key) + field("caption", f"Synced from Dropbox: {path}")
 body += (f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{safe_filename}\"\r\nContent-Type: {mime}\r\n\r\n").encode()
 body += file_data + f"\r\n--{boundary}--\r\n".encode()
 raw = request(intake_url, body, {"Content-Type": f"multipart/form-data; boundary={boundary}", "x-raka-secret": intake_secret}, "POST")
 result = json.loads(raw)
        if not result.get("success"):
            raise RuntimeError(f"Intake rejected {path}: {result.get('error', 'unknown error')}")
        print(f"OK {stone_id}: {filename} ({'duplicate' if result.get('duplicate') else 'uploaded'})")
 uploaded += 1

    print(f"Finished: {uploaded} successful, {skipped} skipped. No secrets printed.")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"ERROR: {error}", file=sys.stderr)
 sys.exit(1)

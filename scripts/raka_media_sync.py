#!/usr/bin/env python3
"""Sync stone media from Dropbox into the private Raka Gems Supabase bucket."""
import hashlib, json, os, re, sys, urllib.error, urllib.parse, urllib.request

DROPBOX_API = "https://api.dropboxapi.com/2"
DROPBOX_CONTENT = "https://content.dropboxapi.com/2"

def request(url, data=None, headers=None, method=None):
 req = urllib.request.Request(url, data=data, headers=headers or {}, method=method)
    try:
        with urllib.request.urlopen(req, timeout=120) as res:
            return res.read(), dict(res.headers)
    except urllib.error.HTTPError as exc:
 detail = exc.read().decode("utf-8", "replace")[:1200]
        raise RuntimeError(f"HTTP {exc.code} from {urllib.parse.urlparse(url).netloc}: {detail}") from None

def json_post(url, payload, headers=None):
 h = {"Content-Type": "application/json", **(headers or {})}
 body, _ = request(url, json.dumps(payload).encode(), h, "POST")
    return json.loads(body)

def main():
 app_key = os.environ["DROPBOX_APP_KEY"]
 app_secret = os.environ["DROPBOX_APP_SECRET"]
 refresh_token = os.environ["DROPBOX_REFRESH_TOKEN"]
 intake_url = os.environ["RAKA_SUPABASE_FUNCTION_URL"].rstrip("/")
 intake_secret = os.environ["RAKA_INTAKE_SECRET"]
 root = os.getenv("DROPBOX_INBOX_PATH", "/Raka_Gems_Inbox").rstrip("/")
 token_data = urllib.parse.urlencode({"grant_type":"refresh_token", "refresh_token":refresh_token}).encode()
 basic = __import__("base64").b64encode(f"{app_key}:{app_secret}".encode()).decode()
 raw, _ = request("https://api.dropbox.com/oauth2/token", token_data, {"Authorization":"Basic "+basic,"Content-Type":"application/x-www-form-urlencoded"}, "POST")
 access_token = json.loads(raw)["access_token"]
 auth = {"Authorization":"Bearer "+access_token, "Content-Type":"application/json"}
 result = json_post(DROPBOX_API+"/files/list_folder", {"path":root,"recursive":True,"include_deleted":False,"limit":2000}, auth)
 entries = list(result.get("entries", []))
    while result.get("has_more"):
 result = json_post(DROPBOX_API+"/files/list_folder/continue", {"cursor":result["cursor"]}, auth)
 entries.extend(result.get("entries", []))
 candidates = [e for e in entries if e.get(".tag")=="file" and e.get("path_display") and not e.get("is_downloadable")==False]
 sent = skipped = 0
    for entry in candidates:
 path = entry["path_display"]
 rel = path[len(root):].strip("/") if path.startswith(root+"/") else ""
 parts = rel.split("/", 1)
        if len(parts) != 2 or not re.fullmatch(r"RG-\d{8}-\d{3}", parts[0]):
 skipped += 1
            continue
 stone_id = parts[0]
 ame = parts[1].rsplit("/",1)[-1]
        if int(entry.get("size",0)) &lt; 1 or int(entry.get("size",0)) &gt; 100*1024*1024:
            print(f"SKIP size outside 1 byte–100 MiB: {path}")
 skipped += 1
            continue
 meta = json.dumps({"path":path}).replace("\\","\\\\").replace('"','\\"')
 binary, _ = request(DROPBOX_CONTENT+"/files/download", b"", {"Authorization":"Bearer "+access_token,"Dropbox-API-Arg":json.dumps({"path":path})}, "POST")
 rev = entry.get("rev", "")
 idem = "dropbox-" + hashlib.sha256((entry.get("id",path)+":"+rev).encode()).hexdigest()[:48]
 boundary = "----RakaGemsBoundary" + hashlib.sha256((idem+name).encode()).hexdigest()[:20]
 mime = ("image/jpeg" if ame.lower().endswith((".jpg",".jpeg")) else "image/png" if ame.lower().endswith(".png") else "image/webp" if ame.lower().endswith(".webp") else "image/heic" if ame.lower().endswith(".heic") else "video/mp4" if ame.lower().endswith(".mp4",".m4v") else "video/quicktime" if ame.lower().endswith(".mov") else "video/webm" if ame.lower().endswith(".webm") else "application/octet-stream")
        if mime == "application/octet-stream":
            print(f"SKIP unsupported media type: {path}"); skipped += 1; continue
        def field(k,v): return (f"--{boundary}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n").encode()
 body = field("stone_id",stone_id)+field("idempotency_key",idem)+field("caption",f"Synced from Dropbox: {path}")
 body += (f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{ ame.replace(chr(34),'_')}\"\r\nContent-Type: {mime}\r\n\r\n").encode()+binary+f"\r\n--{boundary}--\r\n".encode()
 response, _ = request(intake_url, body, {"Content-Type":f"multipart/form-data; boundary={boundary}","x-raka-secret":intake_secret}, "POST")
 data = json.loads(response)
        if not data.get("success"):
            raise RuntimeError(f"Intake rejected {path}: {data.get('error','unknown error')}")
        print(f"OK {stone_id}: { ame} ({'duplicate' if data.get('duplicate') else 'uploaded'})")
 sent += 1
    print(f"Finished: {sent} successful, {skipped} skipped. No file contents or secrets printed.")

if __name__ == "__main__":
    try: main()
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
 sys.exit(1)

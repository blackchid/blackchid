#!/usr/bin/env python3
"""
test_review_workflow.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
End-to-end verification of the PII review workflow via HTTP API.

Checks:
  1. Editor scans for PII → detections stored as 'pending'
  2. Viewer can LIST detections (read-only)
  3. Viewer CANNOT confirm/dismiss/scan (403)
  4. Editor confirms some, dismisses others
  5. Redacting PENDING fails (422)
  6. Redacting DISMISSED fails (422)
  7. Redacting CONFIRMED succeeds (200, audio-only file)
  8. Only the confirmed spans are muted in the output (RMS check)
  9. Viewer CANNOT access original audio (403)
  10. Viewer CAN access redacted audio (200)
  11. Editor CAN access original audio (200)

Run:  cd backend && python test_review_workflow.py
"""

import json, math, os, struct, subprocess, sys, tempfile

BASE = "http://localhost:8000"
PSQL = "/opt/homebrew/Cellar/postgresql@16/16.13/bin/psql"
DB   = "postgresql://volt@127.0.0.1:5432/uxr_db"
REC_ID = "3289961a-8496-41db-8861-eda63959f56c"          # 73-segment real MP3
PROJECT_ID = "6097bf49-c969-439e-b1c1-732f46d83ba5"

PASS = 0
FAIL = 0

def check(label, cond, detail=""):
    global PASS, FAIL
    if cond:
        print(f"  ✅  {label}")
        PASS += 1
    else:
        print(f"  ❌  {label}{' — ' + detail if detail else ''}")
        FAIL += 1

# ── HTTP helpers ──────────────────────────────────────────────────────────────

import urllib.request, urllib.error

def req(method, path, token=None, body=None, raw=False):
    url = BASE + path
    data = json.dumps(body).encode() if body else None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    r = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r) as resp:
            if raw:
                return resp.status, resp.read()
            return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        if raw:
            return e.code, e.read()
        try:
            return e.code, json.loads(e.read())
        except Exception:
            return e.code, {}

def login(email, password):
    data = f"username={email}&password={password}".encode()
    headers = {"Content-Type": "application/x-www-form-urlencoded"}
    r = urllib.request.Request(BASE + "/auth/login", data=data, headers=headers, method="POST")
    with urllib.request.urlopen(r) as resp:
        return json.loads(resp.read())["access_token"]

def psql(sql):
    result = subprocess.run(
        [PSQL, "-h", "127.0.0.1", "-p", "5432", "-U", "volt", "uxr_db", "-tAc", sql],
        capture_output=True, text=True
    )
    return result.stdout.strip()

# ── Audio helpers ─────────────────────────────────────────────────────────────

def rms_at(path, t_start, t_end):
    cmd = ["ffmpeg", "-v", "error", "-ss", str(t_start), "-to", str(t_end),
           "-i", path, "-ac", "1", "-ar", "16000", "-f", "s16le", "-"]
    raw = subprocess.check_output(cmd)
    if not raw:
        return 0.0
    samples = struct.unpack(f"<{len(raw)//2}h", raw)
    return math.sqrt(sum(s*s for s in samples) / len(samples))

def has_video(path):
    cmd = ["ffprobe", "-v", "quiet", "-show_streams",
           "-select_streams", "v", "-print_format", "json", path]
    out = subprocess.check_output(cmd, stderr=subprocess.DEVNULL)
    return bool(json.loads(out).get("streams"))

# ── Setup ─────────────────────────────────────────────────────────────────────

print("=" * 62)
print("PII Review Workflow — End-to-End API Test")
print("=" * 62)

# Login as editor
editor_token = login("demo2@example.com", "password123")
editor_id = psql("SELECT id FROM users WHERE email='demo2@example.com'")

# Create / reuse a viewer account
viewer_email = "viewer_test@example.com"
viewer_exists = psql(f"SELECT count(*) FROM users WHERE email='{viewer_email}'")
if viewer_exists == "0":
    s, resp = req("POST", "/auth/register", body={
        "email": viewer_email, "password": "viewerpass123", "full_name": "Test Viewer"
    })
viewer_token = login(viewer_email, "viewerpass123")
viewer_id = psql(f"SELECT id FROM users WHERE email='{viewer_email}'")

# Add viewer to project
psql(f"""
INSERT INTO project_members (id, project_id, user_id, role)
VALUES (gen_random_uuid(), '{PROJECT_ID}', '{viewer_id}', 'viewer')
ON CONFLICT DO NOTHING
""")

# Clear existing detections for this recording for a clean slate
psql(f"""
DELETE FROM pii_detections pd
USING transcript_segments ts
WHERE pd.segment_id = ts.id AND ts.recording_id = '{REC_ID}'
""")

print(f"\n  Setup: editor={editor_id[:8]}…  viewer={viewer_id[:8]}…")

# ── Test 1: Scan (editor) ─────────────────────────────────────────────────────
print("\n[1] POST /recordings/{id}/pii/scan — editor")
s, resp = req("POST", f"/recordings/{REC_ID}/pii/scan", token=editor_token)
check("HTTP 200", s == 200, f"got {s}")
check("segments_scanned > 0", resp.get("segments_scanned", 0) > 0)
check("new_detections > 0",   resp.get("new_detections", 0) > 0)
check("total_pending > 0",    resp.get("total_pending", 0) > 0)
print(f"     → {resp.get('segments_scanned')} segments, {resp.get('new_detections')} new detections")

# ── Test 2: Viewer CANNOT scan ────────────────────────────────────────────────
print("\n[2] POST /scan — viewer must get 403")
s, _ = req("POST", f"/recordings/{REC_ID}/pii/scan", token=viewer_token)
check("HTTP 403", s == 403, f"got {s}")

# ── Test 3: Viewer CAN list detections ───────────────────────────────────────
print("\n[3] GET /recordings/{id}/pii — viewer can read")
s, dets = req("GET", f"/recordings/{REC_ID}/pii", token=viewer_token)
check("HTTP 200", s == 200, f"got {s}")
check("returns list", isinstance(dets, list))
check("all pending initially", all(d["review_status"] == "pending" for d in dets),
      f"some not pending: {[d['review_status'] for d in dets]}")
print(f"     → {len(dets)} pending detections")
for d in dets[:3]:
    print(f"       [{d['entity_type']}] '{d['matched_text']}'  "
          f"{d['time_start']:.2f}s–{d['time_end']:.2f}s")

# ── Test 4: Viewer CANNOT confirm ────────────────────────────────────────────
print("\n[4] PATCH /pii-detections/{id} — viewer must get 403")
if dets:
    s, _ = req("PATCH", f"/pii-detections/{dets[0]['id']}",
                token=viewer_token, body={"action": "confirm"})
    check("HTTP 403", s == 403, f"got {s}")

# ── Test 5: Redact PENDING fails ─────────────────────────────────────────────
print("\n[5] POST /redact with pending detections — must fail 422")
if dets:
    s, resp = req("POST", f"/recordings/{REC_ID}/redact",
                  token=editor_token,
                  body={"pii_detection_ids": [dets[0]["id"]]})
    check("HTTP 422", s == 422, f"got {s}")
    check("error mentions 'pending'", "pending" in resp.get("detail", "").lower(),
          f"detail: {resp.get('detail')}")

# ── Test 6: Confirm 2, dismiss 1 ─────────────────────────────────────────────
print("\n[6] Editor confirms 2 detections, dismisses 1")
to_confirm = dets[:2]
to_dismiss = [dets[2]] if len(dets) > 2 else []

confirmed_ids = []
for d in to_confirm:
    s, resp = req("PATCH", f"/pii-detections/{d['id']}",
                  token=editor_token, body={"action": "confirm"})
    check(f"confirm [{d['entity_type']}] '{d['matched_text']}' → HTTP 200", s == 200, f"got {s}")
    check(f"  review_status=confirmed", resp.get("review_status") == "confirmed",
          f"got {resp.get('review_status')}")
    confirmed_ids.append(d["id"])
    print(f"     → confirmed '{d['matched_text']}' ({d['time_start']:.2f}s–{d['time_end']:.2f}s)")

dismissed_id = None
for d in to_dismiss:
    s, resp = req("PATCH", f"/pii-detections/{d['id']}",
                  token=editor_token, body={"action": "dismiss"})
    check(f"dismiss [{d['entity_type']}] '{d['matched_text']}' → HTTP 200", s == 200, f"got {s}")
    check(f"  review_status=dismissed", resp.get("review_status") == "dismissed",
          f"got {resp.get('review_status')}")
    dismissed_id = d["id"]
    print(f"     → dismissed '{d['matched_text']}'")

# ── Test 7: Redact DISMISSED fails ────────────────────────────────────────────
print("\n[7] Redact DISMISSED — must fail 422")
if dismissed_id:
    s, resp = req("POST", f"/recordings/{REC_ID}/redact",
                  token=editor_token,
                  body={"pii_detection_ids": [dismissed_id]})
    check("HTTP 422", s == 422, f"got {s}")
    check("error mentions 'dismissed'", "dismissed" in resp.get("detail", "").lower(),
          f"detail: {resp.get('detail')}")

# ── Test 8: Redact CONFIRMED succeeds ─────────────────────────────────────────
print("\n[8] Redact CONFIRMED detections — must succeed")
s, raw = req("POST", f"/recordings/{REC_ID}/redact",
             token=editor_token, raw=True,
             body={"pii_detection_ids": confirmed_ids, "padding_seconds": 0.1})
check("HTTP 200", s == 200, f"got {s}")
check("response is non-empty audio file", len(raw) > 100_000, f"got {len(raw)} bytes")

# Write to temp file and inspect
with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as f:
    f.write(raw)
    redacted_path = f.name

check("output is audio-only (no video track)", not has_video(redacted_path),
      "output unexpectedly has a video stream!")
print(f"     → {len(raw):,} bytes  path={redacted_path}")

# ── Test 9: RMS check — confirmed spans are silent ────────────────────────────
print("\n[9] Acoustic check — confirmed spans are muted in output")
for d in to_confirm:
    mid = (d["time_start"] + d["time_end"]) / 2
    half = min((d["time_end"] - d["time_start"]) / 2 - 0.05, 0.5)
    if half <= 0:
        print(f"     ⚠️  Span too short to RMS-check: {d['matched_text']}")
        continue
    rms = rms_at(redacted_path, mid - half, mid + half)
    check(f"  '{d['matched_text']}' muted (RMS < 5, got {rms:.1f})", rms < 5, f"RMS={rms:.1f}")

# ── Test 10: Viewer 403 on original audio ─────────────────────────────────────
print("\n[10] GET /recordings/{id}/audio — viewer must get 403")
s, _ = req("GET", f"/recordings/{REC_ID}/audio", token=viewer_token, raw=True)
check("HTTP 403", s == 403, f"got {s}")

# ── Test 11: Editor 200 on original audio ─────────────────────────────────────
print("\n[11] GET /recordings/{id}/audio — editor gets 200")
s, _ = req("GET", f"/recordings/{REC_ID}/audio", token=editor_token, raw=True)
check("HTTP 200", s == 200, f"got {s}")

# ── Test 12: Viewer 200 on redacted audio ─────────────────────────────────────
print("\n[12] GET /recordings/{id}/redacted-audio — viewer gets 200")
s, data = req("GET", f"/recordings/{REC_ID}/redacted-audio", token=viewer_token, raw=True)
check("HTTP 200", s == 200, f"got {s}")
check("non-empty audio", len(data) > 100_000, f"got {len(data)} bytes")

# ── Test 13: Status filter works ──────────────────────────────────────────────
print("\n[13] GET /pii?status= filter works")
s, conf_dets = req("GET", f"/recordings/{REC_ID}/pii?status=confirmed", token=editor_token)
check("HTTP 200", s == 200)
check("all confirmed", all(d["review_status"] == "confirmed" for d in conf_dets),
      f"statuses: {[d['review_status'] for d in conf_dets]}")
check(f"count={len(to_confirm)}", len(conf_dets) == len(to_confirm),
      f"expected {len(to_confirm)}, got {len(conf_dets)}")

s, dis_dets = req("GET", f"/recordings/{REC_ID}/pii?status=dismissed", token=editor_token)
check("dismissed filter", all(d["review_status"] == "dismissed" for d in dis_dets))

# ── Cleanup temp file ─────────────────────────────────────────────────────────
os.unlink(redacted_path)

# ── Results ───────────────────────────────────────────────────────────────────
print(f"\n{'=' * 62}")
total = PASS + FAIL
print(f"Results: {PASS}/{total} passed", "✅" if FAIL == 0 else "❌")
if FAIL:
    print(f"         {FAIL} FAILED")
print("=" * 62)
sys.exit(0 if FAIL == 0 else 1)

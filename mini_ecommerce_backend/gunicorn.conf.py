import os

# ── Workers ───────────────────────────────────────────────────────────────────
# Render free tier: 512 MB RAM.
# Each sync worker uses ~60-80 MB; master + OS ~150 MB → 4 workers use ~470 MB total.
# Formula for sizing: (2 × CPU cores) + 1, capped at RAM / ~80 MB.
workers = int(os.environ.get('WEB_CONCURRENCY', 4))

# ── Binding ───────────────────────────────────────────────────────────────────
# Render injects $PORT at runtime; fall back to 8000 for local runs.
bind = f"0.0.0.0:{os.environ.get('PORT', '8000')}"

# ── Timeouts ──────────────────────────────────────────────────────────────────
# 120 s worker timeout — gives slow DB queries (first Neon cold start) room
# to complete without killing the worker.
timeout = 120

# Keep the TCP connection alive for 5 s after a response so the client can
# reuse it for the next request (reduces TLS handshake overhead on Netlify→Render).
keepalive = 5

# ── Logging ───────────────────────────────────────────────────────────────────
accesslog = "-"   # stdout → Render log stream
errorlog  = "-"
loglevel  = "warning"

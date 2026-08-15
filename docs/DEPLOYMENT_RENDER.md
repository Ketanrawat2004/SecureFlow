# SecureFlow — Free Cloud Deployment Guide (Render)

## Architecture Overview

```
Internet
   │
   ├──► Render Static Site (Frontend: React + Vite)
   │         VITE_API_BASE_URL → https://secureflow-api.onrender.com/api/v1
   │
   └──► Render Web Service (Backend: FastAPI + Uvicorn)
             │
             ├── Render PostgreSQL (managed, free tier)
             ├── Render Redis (managed, free tier)
             └── Kafka: disabled (KAFKA_ENABLED=false)
                        Events fall back to in-memory pub/sub
                        Workers not deployed (no Kafka on free tier)
```

> **Local Docker Compose**: Full stack including Kafka, workers, Redis — unchanged.
> **Production (Render)**: Frontend + Backend + PostgreSQL + Redis. Kafka is disabled gracefully.

---

## Step 1 — PostgreSQL on Render

1. In Render dashboard → **New → PostgreSQL**
2. Name: `secureflow-db`, Plan: **Free**
3. After creation, copy the **Internal Database URL** (starts with `postgresql://...`)
4. Convert to asyncpg format by replacing `postgresql://` with `postgresql+asyncpg://`

---

## Step 2 — Redis on Render

1. **New → Redis**, Name: `secureflow-cache`, Plan: **Free**
2. After creation, copy the **Internal Redis URL** (starts with `redis://...` or `rediss://...`)

---

## Step 3 — Backend Web Service

1. **New → Web Service** → Connect your GitHub repo `Ketanrawat2004/SecureFlow`
2. Settings:
   - **Root Directory**: *(leave blank — Dockerfile.backend is in root)*
   - **Runtime**: **Docker**
   - **Dockerfile path**: `Dockerfile.backend`
   - **Plan**: Free

3. Set the following **Environment Variables** in Render:

```
# Core
ENVIRONMENT=production
DEBUG=false
APP_NAME=SecureFlow

# Security — CHANGE THESE
JWT_SECRET_KEY=<generate: python -c "import secrets; print(secrets.token_hex(32))">

# Database — paste Render PostgreSQL Internal URL (asyncpg)
DATABASE_URL=postgresql+asyncpg://user:pass@hostname/dbname

# Redis — paste Render Redis Internal URL
REDIS_URL=redis://hostname:port

# Kafka — DISABLED on free tier
KAFKA_ENABLED=false

# CORS — set to exact Render frontend URL
CORS_ORIGINS=https://secureflow.onrender.com
FRONTEND_URL=https://secureflow.onrender.com

# Google OAuth
GOOGLE_CLIENT_ID=228464498331-xxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxx
OAUTH_REDIRECT_URI=https://secureflow.onrender.com/auth/callback

# Seed data
AUTO_SEED_DATABASE=true
```

4. **Port**: Render sets `$PORT` automatically. The backend Dockerfile reads `${PORT:-8000}` — no action needed.

---

## Step 4 — Frontend Static Site

1. **New → Static Site** → Connect `Ketanrawat2004/SecureFlow`
2. Settings:
   - **Root Directory**: `frontend`
   - **Build Command**: `npm ci && npm run build`
   - **Publish Directory**: `dist`

3. Set the following **Environment Variables** in Render:

```
# Must point to your deployed backend
VITE_API_BASE_URL=https://secureflow-api.onrender.com/api/v1

VITE_APP_TITLE=SecureFlow
```

> ⚠️ **Never** add `GOOGLE_CLIENT_SECRET`, `JWT_SECRET_KEY`, `DATABASE_URL`, or `REDIS_URL`
> to the frontend environment. Only `VITE_` prefixed public variables belong here.

---

## Step 5 — Google Cloud Console

Add the **production redirect URI** to your OAuth client:

- **Authorized JavaScript origins**: `https://secureflow.onrender.com`
- **Authorized redirect URIs**: `https://secureflow.onrender.com/auth/callback`

Keep the existing local development URIs to avoid breaking local testing:

- `http://localhost:3000`
- `http://localhost:3000/auth/callback`
- `http://localhost:5173/auth/callback`

---

## Environment Variable Reference

### Frontend (Render Static Site — `VITE_` prefix required)

| Variable | Required | Example | Notes |
|---|---|---|---|
| `VITE_API_BASE_URL` | Yes | `https://api.onrender.com/api/v1` | Full backend URL |
| `VITE_APP_TITLE` | No | `SecureFlow` | Browser tab title |

### Backend (Render Web Service)

| Variable | Required | Secret? | Notes |
|---|---|---|---|
| `ENVIRONMENT` | Yes | No | Set to `production` |
| `JWT_SECRET_KEY` | Yes | **YES** | Min 32 chars, random |
| `DATABASE_URL` | Yes | **YES** | asyncpg connection string |
| `REDIS_URL` | Yes | **YES** | Redis connection string |
| `CORS_ORIGINS` | Yes | No | Comma-separated frontend URLs |
| `FRONTEND_URL` | No | No | Single frontend origin (merged into CORS) |
| `GOOGLE_CLIENT_ID` | Yes (for SSO) | No | From Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | Yes (for SSO) | **YES** | From Google Cloud Console |
| `OAUTH_REDIRECT_URI` | Yes (for SSO) | No | Must match Google Console |
| `KAFKA_ENABLED` | No | No | Set `false` on free tier |
| `AUTO_SEED_DATABASE` | No | No | `true` for first deploy |
| `DEBUG` | No | No | `false` in production |
| `PORT` | Auto | No | Set by Render automatically |

---

## SSE (Server-Sent Events) on Render

- SSE uses long-lived HTTP connections (up to 86400s configured in nginx.conf)
- Render **free tier** may close idle connections after ~55s
- The frontend implements **exponential backoff reconnection** (1s → 2s → 4s → max 10s)
- SSE heartbeat ping is sent every 15 seconds from the backend — sufficient to keep connections alive
- `X-Accel-Buffering: no` header is returned by the backend to prevent proxy buffering

---

## Production Start Command

The backend Dockerfile uses:
```sh
sh -c "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1"
```

- `${PORT:-8000}` reads Render's injected `$PORT`, falls back to `8000`
- Single worker avoids SSE subscriber list inconsistency across processes

---

## Local Docker vs Production Comparison

| Feature | Local Docker | Render Production |
|---|---|---|
| PostgreSQL | Docker container | Render managed |
| Redis | Docker container | Render managed |
| Kafka | Docker container | **Disabled** (KAFKA_ENABLED=false) |
| Workers | 3 Docker containers | **Not deployed** |
| Frontend | NGINX in Docker | Render Static Site CDN |
| Backend | Docker container | Render Web Service |
| SSE | Via NGINX proxy | Direct HTTPS connection |

---

## Secrets Audit

The following values must **never** appear in source code:

- `JWT_SECRET_KEY` ✅ — reads from env only, `Optional[str] = None`
- `GOOGLE_CLIENT_SECRET` ✅ — reads from env only, `Optional[str] = None`
- `DATABASE_URL` / passwords ✅ — env only, no defaults with real values
- `REDIS_URL` ✅ — default is localhost (safe)

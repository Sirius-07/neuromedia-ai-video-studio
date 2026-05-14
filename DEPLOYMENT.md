# NeuroMedia Deployment Guide

This project is best deployed as:

- `frontend/` on Vercel
- `backend/` on an Alibaba Cloud ECS instance or similar long-running server
- media uploads on a persistent disk first, then TOS/object storage when traffic grows

ComfyUI and TTS are disabled by default for cloud deployment.

## 1. Frontend on Vercel

Create a Vercel project from the GitHub repository and set:

| Setting | Value |
| --- | --- |
| Root Directory | `frontend` |
| Build Command | `npm run build` |
| Output Directory | `dist` |

Environment variable:

```env
VITE_API_BASE_URL=https://api.example.com
```

Replace `https://api.example.com` with the public backend API domain.

`frontend/vercel.json` contains a SPA rewrite so React routes work after refresh.

## 2. Backend on Alibaba Cloud ECS

Use Ubuntu 22.04/24.04 LTS. A 2C/4G instance is enough for API-only demos. Add more CPU/RAM if video export with FFmpeg is heavy.

Install runtime dependencies:

```bash
sudo apt update
sudo apt install -y git curl nginx ffmpeg
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
```

Clone and install:

```bash
git clone https://github.com/your-org/your-repo.git /opt/neuromedia
cd /opt/neuromedia/backend
npm ci
```

Create persistent directories. Several legacy services still write to `backend/uploads`, so keep that path stable and point it at a persistent disk location:

```bash
sudo mkdir -p /var/www/neuromedia/uploads
sudo mkdir -p /var/www/neuromedia/data
sudo chown -R $USER:$USER /var/www/neuromedia
if [ -d /opt/neuromedia/backend/uploads ] && [ ! -L /opt/neuromedia/backend/uploads ]; then
  cp -a /opt/neuromedia/backend/uploads/. /var/www/neuromedia/uploads/ 2>/dev/null || true
  mv /opt/neuromedia/backend/uploads "/opt/neuromedia/backend/uploads.$(date +%s).bak"
fi
ln -sfn /var/www/neuromedia/uploads /opt/neuromedia/backend/uploads
```

Create `backend/.env` from `backend/.env.example` and fill real values:

```env
NODE_ENV=production
PORT=4300
PUBLIC_URL=https://api.example.com
FRONTEND_URL=https://app.example.com
CORS_ORIGIN=https://app.example.com
UPLOADS_DIR=/opt/neuromedia/backend/uploads
DATABASE_URL=file:/var/www/neuromedia/data/production.db
ENABLE_COMFYUI=false
ENABLE_TTS=false
ARK_API_KEY=...
VOLCENGINE_ACCESS_KEY=...
VOLCENGINE_SECRET_KEY=...
TOS_ACCESS_KEY_ID=...
TOS_SECRET_ACCESS_KEY=...
TOS_REGION=cn-guangzhou
TOS_BUCKET=...
```

Initialize the database:

```bash
npx prisma generate
npx prisma migrate deploy
```

If you stay on SQLite and have no tracked migrations yet, create the initial production database once:

```bash
npx prisma db push
```

Start with PM2:

```bash
pm2 start src/index.js --name neuromedia-api
pm2 save
pm2 startup
```

Health check:

```bash
curl http://127.0.0.1:4300/health
```

Expected feature flags:

```json
{
  "features": {
    "tts": false,
    "comfyui": false
  }
}
```

## 3. Nginx Reverse Proxy

Create `/etc/nginx/sites-available/neuromedia-api`:

```nginx
server {
    listen 80;
    server_name api.example.com;

    client_max_body_size 100m;

    location / {
        proxy_pass http://127.0.0.1:4300;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable it:

```bash
sudo ln -s /etc/nginx/sites-available/neuromedia-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

Add HTTPS with Certbot or Alibaba Cloud SSL certificates before sharing the app publicly.

## 4. Production Notes

- For mainland China hosting, complete ICP filing before binding a public website domain to mainland ECS/CDN.
- Keep `.env`, SQLite databases, uploads, logs, and model weights out of Git.
- `backend/prisma/migrations/` should be committed for repeatable production database setup.
- For higher reliability, move from SQLite to Postgres and move generated media from local disk to TOS/CDN.
- ComfyUI/TTS can be re-enabled later with `ENABLE_COMFYUI=true` or `ENABLE_TTS=true`, but they should run as separate services with their paths and URLs explicitly configured.

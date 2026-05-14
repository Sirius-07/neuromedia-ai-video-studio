# NeuroMedia Single-Server Deployment

This is the quickest deployment path: run both frontend and backend on one Alibaba Cloud ECS instance.

```
https://your-domain.com/          -> frontend/dist static files
https://your-domain.com/api/...   -> backend on 127.0.0.1:4300
https://your-domain.com/uploads/  -> uploaded/generated media files
```

ComfyUI and TTS are disabled by default.

## 1. Buy / Prepare ECS

Use Ubuntu 22.04 or 24.04 LTS.

Suggested minimum:

- Demo: 2 vCPU / 4 GB RAM
- More video export usage: 4 vCPU / 8 GB RAM
- Open security group ports: `22`, `80`, `443`

## 2. Install Runtime

SSH into the ECS instance:

```bash
ssh root@YOUR_ECS_PUBLIC_IP
```

Install dependencies:

```bash
sudo apt update
sudo apt install -y git curl nginx ffmpeg
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
```

## 3. Clone And Install

```bash
git clone https://github.com/Sirius-07/neuromedia-ai-video-studio.git /opt/neuromedia
cd /opt/neuromedia
git checkout codex/new-user-video-flow-ux

cd backend
npm ci

cd ../frontend
npm ci
npm run build
```

## 4. Backend Environment

Create persistent directories:

```bash
sudo mkdir -p /var/www/neuromedia/uploads
sudo mkdir -p /var/www/neuromedia/data
sudo mkdir -p /var/www/neuromedia/frontend
sudo chown -R $USER:$USER /var/www/neuromedia
```

Keep legacy upload paths stable:

```bash
if [ -d /opt/neuromedia/backend/uploads ] && [ ! -L /opt/neuromedia/backend/uploads ]; then
  cp -a /opt/neuromedia/backend/uploads/. /var/www/neuromedia/uploads/ 2>/dev/null || true
  mv /opt/neuromedia/backend/uploads "/opt/neuromedia/backend/uploads.$(date +%s).bak"
fi
ln -sfn /var/www/neuromedia/uploads /opt/neuromedia/backend/uploads
```

Create `/opt/neuromedia/backend/.env`:

```env
NODE_ENV=production
PORT=4300
PUBLIC_URL=http://YOUR_ECS_PUBLIC_IP
FRONTEND_URL=
CORS_ORIGIN=
UPLOADS_DIR=/opt/neuromedia/backend/uploads
DATABASE_URL=file:/var/www/neuromedia/data/production.db

ENABLE_COMFYUI=false
ENABLE_TTS=false

ARK_API_KEY=your_ark_api_key
VOLCENGINE_ACCESS_KEY=your_volcengine_access_key
VOLCENGINE_SECRET_KEY=your_volcengine_secret_key

TOS_ACCESS_KEY_ID=your_tos_access_key_id
TOS_SECRET_ACCESS_KEY=your_tos_secret_access_key
TOS_REGION=cn-guangzhou
TOS_BUCKET=your_bucket_name
```

When you add a domain and HTTPS later, change `PUBLIC_URL` to `https://your-domain.com`.

Initialize the database:

```bash
cd /opt/neuromedia/backend
npx prisma generate
npx prisma migrate deploy
```

If migration deploy fails on a fresh SQLite file, run this once:

```bash
npx prisma db push
```

Start backend:

```bash
pm2 start src/index.js --name neuromedia-api
pm2 save
```

Check it:

```bash
curl http://127.0.0.1:4300/health
```

Expected:

```json
{"features":{"tts":false,"comfyui":false}}
```

## 5. Publish Frontend Files

```bash
rm -rf /var/www/neuromedia/frontend/*
cp -a /opt/neuromedia/frontend/dist/. /var/www/neuromedia/frontend/
```

No `VITE_API_BASE_URL` is needed for same-server deployment. The frontend will call same-origin `/api/...` paths in production.

## 6. Nginx

Copy the provided config:

```bash
sudo cp /opt/neuromedia/deploy/alicloud-single-server/nginx.conf /etc/nginx/sites-available/neuromedia
sudo ln -sfn /etc/nginx/sites-available/neuromedia /etc/nginx/sites-enabled/neuromedia
sudo nginx -t
sudo systemctl reload nginx
```

Open:

```text
http://YOUR_ECS_PUBLIC_IP
```

## 7. Optional Domain And HTTPS

For a domain:

1. Point an A record to the ECS public IP.
2. Replace `server_name _;` in the Nginx config with your domain.
3. Change backend `PUBLIC_URL` to `https://your-domain.com`.
4. Reload PM2: `pm2 restart neuromedia-api --update-env`.
5. Add HTTPS with Certbot or an Alibaba Cloud SSL certificate.

For mainland China ECS, complete ICP filing before binding a public mainland-hosted website domain.

## 8. Quick Update Later

After new code is pushed:

```bash
cd /opt/neuromedia
git pull

cd backend
npm ci
npx prisma migrate deploy
pm2 restart neuromedia-api --update-env

cd ../frontend
npm ci
npm run build
rm -rf /var/www/neuromedia/frontend/*
cp -a dist/. /var/www/neuromedia/frontend/

sudo nginx -t
sudo systemctl reload nginx
```

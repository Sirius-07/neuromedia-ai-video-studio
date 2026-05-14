#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/neuromedia}"
WEB_DIR="${WEB_DIR:-/var/www/neuromedia/frontend}"
UPLOADS_DIR="${UPLOADS_DIR:-/var/www/neuromedia/uploads}"
DATA_DIR="${DATA_DIR:-/var/www/neuromedia/data}"
BRANCH="${BRANCH:-codex/new-user-video-flow-ux}"

cd "$APP_DIR"
git fetch origin
git checkout "$BRANCH"
git pull --ff-only

sudo mkdir -p "$WEB_DIR" "$UPLOADS_DIR/assets" "$UPLOADS_DIR/videos" "$UPLOADS_DIR/processed" "$DATA_DIR"
sudo chown -R "$USER:$USER" /var/www/neuromedia

if [ -d "$APP_DIR/backend/uploads" ] && [ ! -L "$APP_DIR/backend/uploads" ]; then
  cp -a "$APP_DIR/backend/uploads/." "$UPLOADS_DIR/" 2>/dev/null || true
  mv "$APP_DIR/backend/uploads" "$APP_DIR/backend/uploads.$(date +%s).bak"
fi
ln -sfn "$UPLOADS_DIR" "$APP_DIR/backend/uploads"

cd "$APP_DIR/backend"
npm ci
npx prisma generate
npx prisma migrate deploy || npx prisma db push
pm2 describe neuromedia-api >/dev/null 2>&1 \
  && pm2 restart neuromedia-api --update-env \
  || pm2 start src/index.js --name neuromedia-api
pm2 save

cd "$APP_DIR/frontend"
npm ci
npm run build
rm -rf "$WEB_DIR"/*
cp -a dist/. "$WEB_DIR"/

sudo cp "$APP_DIR/deploy/alicloud-single-server/nginx.conf" /etc/nginx/sites-available/neuromedia
sudo ln -sfn /etc/nginx/sites-available/neuromedia /etc/nginx/sites-enabled/neuromedia
sudo nginx -t
sudo systemctl reload nginx

echo "Deployment complete. Open http://YOUR_ECS_PUBLIC_IP"

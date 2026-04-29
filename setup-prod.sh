#!/bin/bash
# ─── eSign Production Setup & Deploy Script ────────────────────
# Run this on the EC2 instance to set up or redeploy:
#   - Nginx reverse proxy (safe — only touches esign config)
#   - SSL via Let's Encrypt (auto-renewal)
#   - PostgreSQL database (uses existing Docker instance)
#   - Node.js application via PM2
#
# Usage: bash setup-prod.sh
# ────────────────────────────────────────────────────────────────

set -e

DOMAIN="esign.projexlight.com"
APP_DIR="/home/ec2-user/esign"
REPO_URL="https://github.com/srimanta1968/esign.git"
SERVER_PORT=3002
DB_PORT=5436
EMAIL="support@projexlight.com"
PM2_NAME="esign-server"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  eSign Production Setup${NC}"
echo -e "${BLUE}  Domain: ${DOMAIN}${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo ""

# ── Step 1: System packages ─────────────────────────────────────
echo -e "${BLUE}[1/8] Checking system packages...${NC}"
for pkg in nginx git jq; do
  if ! command -v $pkg >/dev/null 2>&1; then
    echo "  Installing $pkg..."
    sudo yum install -y $pkg
  fi
done

# Install certbot if missing
if ! command -v certbot >/dev/null 2>&1; then
  echo "  Installing certbot..."
  sudo yum install -y certbot python3-certbot-nginx 2>/dev/null || {
    sudo pip3 install certbot certbot-nginx
  }
fi

# Install PM2 if missing
if ! command -v pm2 >/dev/null 2>&1; then
  echo "  Installing PM2..."
  sudo npm install -g pm2
fi

echo -e "${GREEN}  System packages ready${NC}"

# ── Step 2: Node.js ─────────────────────────────────────────────
echo -e "\n${BLUE}[2/8] Checking Node.js...${NC}"
if ! command -v node >/dev/null 2>&1; then
  echo "  Installing Node.js..."
  curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
  sudo yum install -y nodejs
fi
echo -e "  Node: $(node --version)"
echo -e "  npm:  $(npm --version)"
echo -e "${GREEN}  Node.js ready${NC}"

# ── Step 3: Clone/Pull repository ───────────────────────────────
echo -e "\n${BLUE}[3/8] Setting up application code...${NC}"
if [ -d "$APP_DIR/.git" ]; then
  echo "  Repository exists, pulling latest..."
  cd "$APP_DIR" && git checkout -- . && git pull origin main
else
  echo "  Cloning repository..."
  git clone "$REPO_URL" "$APP_DIR"
fi
echo -e "${GREEN}  Application code ready${NC}"

# ── Step 4: Install dependencies + build ────────────────────────
echo -e "\n${BLUE}[4/8] Installing dependencies and building...${NC}"
cd "$APP_DIR/server" && npm install --production=false
echo -e "  Building server..."
npm run build 2>&1 | tail -3
cd "$APP_DIR/client" && npm install
echo -e "  Building client..."
npx vite build 2>&1 | tail -5
echo -e "${GREEN}  Dependencies installed and apps built${NC}"

# ── Step 5: Environment & Database ──────────────────────────────
echo -e "\n${BLUE}[5/8] Checking environment and database...${NC}"

# Create .env if it doesn't exist
if [ ! -f "$APP_DIR/server/.env" ]; then
  echo -e "  ${YELLOW}Creating server/.env from template...${NC}"
  JWT_SECRET=$(openssl rand -hex 32)
  cat > "$APP_DIR/server/.env" << ENVEOF
NODE_ENV=production
PORT=${SERVER_PORT}

# Database
DB_HOST=localhost
DB_PORT=${DB_PORT}
DB_NAME=edocs_db
DB_USER=edocs
DB_PASSWORD=eDocs123!
DB_SSL=false
DB_POOL_MIN=2
DB_POOL_MAX=10

# Security
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=7d
BCRYPT_ROUNDS=10

# CORS
CORS_ORIGIN=https://${DOMAIN}

# Logging
LOG_LEVEL=info
LOG_FORMAT=combined

# Frontend URL
FRONTEND_URL=https://${DOMAIN}

# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://${DOMAIN}/api/auth/sso/callback

# LinkedIn OAuth
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
LINKEDIN_REDIRECT_URI=https://${DOMAIN}/api/auth/sso/callback

# AWS S3
AWS_REGION=us-east-1
S3_REGION=us-east-1

# Email (SendGrid). Set EMAIL_FROM to a verified sender on your authenticated
# domain in SendGrid. EMAIL_FROM controls the visible "From" address on every
# transactional email (signing requests, reminders, completion notices).
SENDGRID_API_KEY=
EMAIL_FROM=edocsign@projexlight.com
ENVEOF
  echo -e "  ${YELLOW}IMPORTANT: Edit server/.env to add OAuth & DB credentials${NC}"
else
  echo -e "  ${GREEN}server/.env already exists${NC}"
fi

# Read DB config from .env
DB_NAME=$(grep "^DB_NAME=" "$APP_DIR/server/.env" | cut -d= -f2 | tr -d '"' | tr -d "'" | tr -d $'\r')
DB_USER=$(grep "^DB_USER=" "$APP_DIR/server/.env" | cut -d= -f2 | tr -d '"' | tr -d "'" | tr -d $'\r')
DB_PASSWORD=$(grep "^DB_PASSWORD=" "$APP_DIR/server/.env" | cut -d= -f2 | tr -d '"' | tr -d "'" | tr -d $'\r')
DB_PORT_ENV=$(grep "^DB_PORT=" "$APP_DIR/server/.env" | cut -d= -f2 | tr -d '"' | tr -d "'" | tr -d $'\r')
DB_PORT="${DB_PORT_ENV:-$DB_PORT}"

# Test database connection
echo "  Testing database connection on port ${DB_PORT}..."
if PGPASSWORD="${DB_PASSWORD}" psql -U "${DB_USER}" -d "${DB_NAME}" -h localhost -p "${DB_PORT}" -c "SELECT 1" >/dev/null 2>&1; then
  echo -e "  ${GREEN}Database connection OK${NC}"
else
  echo -e "  ${YELLOW}Database not reachable. Please ensure PostgreSQL is running on port ${DB_PORT}${NC}"
fi

# Run init schema if tables don't exist
if PGPASSWORD="${DB_PASSWORD}" psql -U "${DB_USER}" -d "${DB_NAME}" -h localhost -p "${DB_PORT}" -c "SELECT 1 FROM users LIMIT 1" >/dev/null 2>&1; then
  echo -e "  ${GREEN}Database tables already exist${NC}"
else
  echo "  Running init schema..."
  for sql_file in "$APP_DIR/init-scripts"/*.sql; do
    [ -f "$sql_file" ] || continue
    echo "    Applying: $(basename "$sql_file")"
    PGPASSWORD="${DB_PASSWORD}" psql -U "${DB_USER}" -d "${DB_NAME}" -h localhost -p "${DB_PORT}" -f "$sql_file" >/dev/null 2>&1 || true
  done
  # Create notifications table if missing (required by migrations)
  PGPASSWORD="${DB_PASSWORD}" psql -U "${DB_USER}" -d "${DB_NAME}" -h localhost -p "${DB_PORT}" -c "
    CREATE TABLE IF NOT EXISTS notifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type VARCHAR(50) NOT NULL,
      title VARCHAR(255) NOT NULL DEFAULT '',
      message TEXT NOT NULL DEFAULT '',
      read BOOLEAN DEFAULT false,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  " >/dev/null 2>&1 || true
  echo -e "  ${GREEN}Database initialized${NC}"
fi

echo -e "${GREEN}  Environment and database ready${NC}"

# ── Step 6: Nginx configuration ────────────────────────────────
echo -e "\n${BLUE}[6/8] Configuring Nginx...${NC}"

# Only create config if it doesn't exist (don't overwrite certbot changes)
NGINX_CONF="/etc/nginx/conf.d/esign.projexlight.com.conf"
if [ ! -f "$NGINX_CONF" ]; then
  sudo tee "$NGINX_CONF" > /dev/null << NGINXEOF
server {
    listen 80;
    server_name ${DOMAIN};

    root ${APP_DIR}/client/dist;
    index index.html;

    # API proxy to Node.js backend
    location /api/ {
        proxy_pass http://127.0.0.1:${SERVER_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 86400;
        client_max_body_size 20M;
    }

    # Health check proxy
    location /health {
        proxy_pass http://127.0.0.1:${SERVER_PORT};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }

    # SPA fallback
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript image/svg+xml;
    gzip_min_length 256;
}
NGINXEOF
  echo -e "  ${GREEN}Nginx config created${NC}"
else
  echo -e "  ${GREEN}Nginx config already exists (preserving certbot changes)${NC}"
fi

# Test and reload nginx
sudo nginx -t 2>&1 | grep -v "warning" || true
sudo systemctl reload nginx 2>/dev/null || sudo nginx -s reload
echo -e "${GREEN}  Nginx configured${NC}"

# ── Step 7: SSL with Let's Encrypt ──────────────────────────────
echo -e "\n${BLUE}[7/8] Checking SSL certificate...${NC}"

if [ -d "/etc/letsencrypt/live/${DOMAIN}" ]; then
  echo -e "  ${GREEN}SSL certificate already exists${NC}"
else
  echo -e "  ${YELLOW}Requesting SSL certificate for ${DOMAIN}...${NC}"
  sudo certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos --email "${EMAIL}" --redirect || {
    echo -e "  ${YELLOW}Certbot failed. Run manually: sudo certbot --nginx -d ${DOMAIN}${NC}"
  }
fi

# Ensure auto-renewal timer is enabled
sudo systemctl enable certbot.timer 2>/dev/null || true
sudo systemctl start certbot.timer 2>/dev/null || true
echo -e "${GREEN}  SSL and auto-renewal configured${NC}"

# ── Step 8: Start/Restart application ──────────────────────────
echo -e "\n${BLUE}[8/8] Starting eSign server...${NC}"

cd "$APP_DIR/server"

# Stop only the esign-server process (leave other PM2 apps alone)
pm2 describe "$PM2_NAME" >/dev/null 2>&1 && {
  echo "  Restarting existing $PM2_NAME..."
  pm2 restart "$PM2_NAME"
} || {
  echo "  Starting new $PM2_NAME..."
  pm2 start dist/app.js --name "$PM2_NAME" --env production
}

# Save PM2 state and setup startup
pm2 save
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ec2-user --hp /home/ec2-user >/dev/null 2>&1 || true

# Wait for server to start
sleep 3

# Verify
HEALTH=$(curl -s "https://${DOMAIN}/health" 2>/dev/null || curl -s "http://localhost:${SERVER_PORT}/health" 2>/dev/null || echo '{"status":"error"}')
echo -e "  Health check: ${HEALTH}"

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  eSign Production Setup Complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo ""
echo -e "  Domain:     https://${DOMAIN}"
echo -e "  API:        https://${DOMAIN}/api"
echo -e "  Health:     https://${DOMAIN}/health"
echo ""
echo -e "  ${BLUE}Quick commands:${NC}"
echo -e "    pm2 status                  - Check all running apps"
echo -e "    pm2 logs ${PM2_NAME}        - View eSign logs"
echo -e "    pm2 restart ${PM2_NAME}     - Restart eSign only"
echo -e "    bash setup-prod.sh          - Re-deploy latest code"
echo ""
echo -e "  ${BLUE}Other apps on this server are NOT affected.${NC}"
echo ""

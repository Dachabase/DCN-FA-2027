#!/bin/bash
# ==============================================================================
# UI Freshers Companion — 24/7 AWS EC2 Automated Deployment Script
# ==============================================================================
set -e

echo "🚀 Starting 24/7 Production Setup for UI Freshers Companion..."

# 1. Update OS packages
sudo apt update && sudo apt upgrade -y

# 2. Install Node.js (v22 LTS) & Git
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs git

# 3. Install PM2 process manager globally
sudo npm install -g pm2

# 4. Clone or update repository
if [ -d "DCN-FA-2027" ]; then
  cd DCN-FA-2027
  git pull origin main
else
  git clone https://github.com/Dachabase/DCN-FA-2027.git
  cd DCN-FA-2027
fi

# 5. Configure Production Environment Variables (.env)
cat << 'EOF' > .env
DATABASE_URL="postgresql://postgres:Wackywas1@fa27.ct2ua4mes3jl.eu-north-1.rds.amazonaws.com:5432/ui_freshers?sslmode=no-verify"
PORT=3000
TELEGRAM_COMPUTING_BOT_TOKEN="8954703429:AAG2b0hH0-OVNU3wu8Mx8TEscL9gtpNxSk8"
DEFAULT_TELEGRAM_BOT_USERNAME="UIDCNComputingFreshersBot"
EOF

# 6. Install dependencies, generate Prisma, and build
npm install
npx prisma generate
npm run build

# 7. Start or restart with PM2 (auto-restarts on crashes & server reboots)
pm2 delete ui-freshers || true
pm2 start dist/server.js --name "ui-freshers"
pm2 save
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u $USER --hp $HOME

echo "=============================================================================="
echo "🎉 DEPLOYMENT COMPLETE! UI Freshers Companion & Telegram Bot are LIVE 24/7!"
echo "Server status:"
pm2 status
echo "=============================================================================="

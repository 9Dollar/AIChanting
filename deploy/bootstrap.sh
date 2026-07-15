#!/usr/bin/env bash
# =====================================================================
# 赛博功德转换器 - 阿里云 ECS 一键部署脚本
# =====================================================================
#
# 用法：
#   1. 在阿里云控制台选 Ubuntu Server 22.04 LTS 镜像创建 ECS
#   2. 用 root SSH 登录 ECS
#   3. 安装 git 并克隆仓库到 /opt/aichanting：
#        apt update && apt install -y git
#        git clone <你的仓库地址> /opt/aichanting
#   4. 编辑本脚本顶部的 SERVER_NAME 变量（改成你的域名或 ECS 公网 IP）
#   5. 执行：
#        cd /opt/aichanting
#        bash deploy/bootstrap.sh
#
# 脚本会完成：
#   - 安装 Node.js 20 / Nginx / PM2 / build-essential / sqlite3
#   - 创建非 root 部署用户 deploy（并配置 SSH 密钥、免密 sudo）
#   - 配置 UFW 防火墙（仅放行 22/80/443）
#   - 安装 npm 依赖
#   - 用 PM2 启动应用（单实例 fork 模式）+ 开机自启
#   - 配置 Nginx 反向代理（静态分流 + /api/ 反代）
#   - 配置 SQLite 自动备份（每天凌晨 3 点，保留 14 天）
#   - 健康检查与状态验证
#
# 完成后访问 http://<SERVER_NAME>/ 即可。
# 如需启用 HTTPS，脚本结束后会有提示命令。
# =====================================================================

set -euo pipefail

# ====== 必填配置（请修改） ======
SERVER_NAME="YOUR_DOMAIN_OR_IP"   # 例如：chant.example.com 或 47.116.x.x
# =================================

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()  { echo -e "${GREEN}[$(date '+%H:%M:%S')]${NC} $*"; }
warn() { echo -e "${YELLOW}[$(date '+%H:%M:%S')] WARN:${NC} $*"; }
err()  { echo -e "${RED}[$(date '+%H:%M:%S')] ERROR:${NC} $*" >&2; }
step() { echo -e "\n${BLUE}========== $* ==========${NC}"; }

# 1. 前置检查
step "1/9 前置检查"

if [[ $EUID -ne 0 ]]; then
    err "请用 root 执行：sudo bash deploy/bootstrap.sh"
    exit 1
fi

if [[ "$SERVER_NAME" == "YOUR_DOMAIN_OR_IP" ]]; then
    err "请先编辑本脚本，把 SERVER_NAME 改成你的域名或 ECS 公网 IP"
    exit 1
fi

if [[ ! -d /opt/aichanting/.git ]]; then
    err "未找到 /opt/aichanting/.git，请先克隆代码："
    err "  apt update && apt install -y git"
    err "  git clone <你的仓库地址> /opt/aichanting"
    exit 1
fi

if [[ -f /etc/os-release ]]; then
    . /etc/os-release
    if [[ "$ID" == "ubuntu" && "$VERSION_ID" == 22.04* ]]; then
        log "系统：$PRETTY_NAME ✓"
    else
        warn "建议 Ubuntu 22.04 LTS，当前是 $PRETTY_NAME，继续执行但可能有兼容问题"
    fi
fi

log "SERVER_NAME = $SERVER_NAME"

# 2. 安装运行时
step "2/9 安装运行时（Node.js 20 / Nginx / PM2 / 工具链）"

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y
apt-get install -y build-essential python3 git curl wget sqlite3 nginx ufw ca-certificates

if ! command -v node >/dev/null 2>&1 || [[ "$(node -v 2>/dev/null | cut -d. -f1 | tr -d v)" -lt 20 ]]; then
    log "安装 Node.js 20 LTS..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
else
    log "Node.js 已安装：$(node -v) ✓"
fi

if ! command -v pm2 >/dev/null 2>&1; then
    log "安装 PM2..."
    npm install -g pm2
else
    log "PM2 已安装：$(pm2 --version) ✓"
fi

log "node $(node -v) / npm $(npm -v) / pm2 $(pm2 --version) / sqlite3 $(sqlite3 --version | head -1) / nginx $(nginx -v 2>&1)"

# 3. 创建部署用户
step "3/9 创建部署用户 deploy"

if id -u deploy >/dev/null 2>&1; then
    log "deploy 用户已存在 ✓"
else
    log "创建 deploy 用户..."
    adduser --disabled-password --gecos "" deploy
    usermod -aG sudo deploy
    # 免密 sudo（方便部署，生产环境可改为需要密码）
    echo "deploy ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/deploy
    chmod 440 /etc/sudoers.d/deploy

    # 复制 root 的 SSH 公钥给 deploy
    if [[ -f /root/.ssh/authorized_keys ]]; then
        mkdir -p /home/deploy/.ssh
        cp /root/.ssh/authorized_keys /home/deploy/.ssh/
        chown -R deploy:deploy /home/deploy/.ssh
        chmod 700 /home/deploy/.ssh
        chmod 600 /home/deploy/.ssh/authorized_keys
        log "已复制 root 的 SSH 公钥到 deploy 用户 ✓"
    else
        warn "未找到 /root/.ssh/authorized_keys，请后续手动为 deploy 用户配置 SSH 密钥"
    fi
fi

# 4. 防火墙
step "4/9 配置 UFW 防火墙"

ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
ufw status verbose | head -20

# 5. 安装项目依赖
step "5/9 安装项目依赖"

chown -R deploy:deploy /opt/aichanting
su deploy -c "cd /opt/aichanting/server && npm ci --omit=dev"
log "依赖安装完成 ✓"

# 6. 启动 PM2 + 开机自启
step "6/9 启动 PM2 + 配置开机自启"

# 切到 deploy 用户启动 PM2
su deploy -c "cd /opt/aichanting/server && pm2 startOrReload ecosystem.config.js"

# 配置 systemd 开机自启（用 root 跑）
log "配置 PM2 开机自启..."
env PATH=$PATH:/usr/bin pm2 startup systemd -u deploy --hp /home/deploy > /tmp/pm2-startup.log 2>&1 || true
# 上面命令会输出一条 sudo systemctl ... 命令，但 pm2 startup 在 root 下通常会自动启用
su deploy -c "pm2 save"

su deploy -c "pm2 status"
log "PM2 启动完成 ✓"

# 7. Nginx 反向代理
step "7/9 配置 Nginx"

cp /opt/aichanting/deploy/aichanting.conf /etc/nginx/sites-available/aichanting
sed -i "s|YOUR_DOMAIN_OR_IP|$SERVER_NAME|g" /etc/nginx/sites-available/aichanting
ln -sf /etc/nginx/sites-available/aichanting /etc/nginx/sites-enabled/aichanting
rm -f /etc/nginx/sites-enabled/default

# 确保权限（Nginx 默认 www-data 用户需要读取项目文件）
chmod -R o+rX /opt/aichanting

nginx -t
systemctl reload nginx
systemctl enable nginx
log "Nginx 配置完成 ✓"

# 8. SQLite 自动备份
step "8/9 配置 SQLite 自动备份"

chmod +x /opt/aichanting/deploy/backup-sqlite.sh
mkdir -p /var/backups/aichanting
chown deploy:deploy /var/backups/aichanting

# 添加 cron 任务（避免重复添加）
CRON_LINE="0 3 * * * /opt/aichanting/deploy/backup-sqlite.sh >> /var/log/aichanting-backup.log 2>&1"
if crontab -u deploy -l 2>/dev/null | grep -qF "$CRON_LINE"; then
    log "cron 任务已存在 ✓"
else
    (crontab -u deploy -l 2>/dev/null; echo "$CRON_LINE") | crontab -u deploy -
    log "已添加 cron 任务（每天 03:00 备份） ✓"
fi

# 立即手动跑一次备份验证
log "执行一次手动备份验证..."
su deploy -c "/opt/aichanting/deploy/backup-sqlite.sh" || warn "手动备份验证失败（可能 db.sqlite 还未生成，应用启动后会自动创建）"

# 9. 验证
step "9/9 验证部署"

log "等待应用启动..."
sleep 3

log "健康检查："
if curl -sf http://localhost/api/health; then
    echo ""
    log "API 健康检查通过 ✓"
else
    warn "健康检查未通过，可能应用还在启动中，稍后重试：curl http://localhost/api/health"
fi

echo ""
log "PM2 状态："
su deploy -c "pm2 status"

echo ""
echo -e "${GREEN}====================================================================${NC}"
echo -e "${GREEN}  部署完成！${NC}"
echo -e "${GREEN}====================================================================${NC}"
echo ""
echo "访问地址：http://$SERVER_NAME/"
echo ""
echo "常用命令（用 deploy 用户登录后执行）："
echo "  pm2 status              # 查看应用状态"
echo "  pm2 logs aichanting     # 实时日志"
echo "  pm2 reload aichanting   # 零停机重启"
echo ""
echo "更新代码："
echo "  cd /opt/aichanting && git pull && cd server && npm ci --omit=dev && pm2 reload aichanting"
echo ""
if [[ "$SERVER_NAME" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo -e "${YELLOW}当前 SERVER_NAME 是 IP，未启用 HTTPS。${NC}"
    echo "如有域名，解析后执行："
    echo "  sudo certbot --nginx -d your-domain.com"
else
    echo -e "${YELLOW}启用 HTTPS（需先确认域名 DNS 已生效）：${NC}"
    echo "  apt install -y certbot python3-certbot-nginx"
    echo "  certbot --nginx -d $SERVER_NAME"
    echo "  certbot renew --dry-run   # 验证自动续期"
fi
echo ""
echo "完整文档：cat /opt/aichanting/DEPLOY.md"

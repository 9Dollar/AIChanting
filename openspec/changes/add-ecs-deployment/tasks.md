## 1. PM2 进程守护配置

- [x] 1.1 创建 `server/ecosystem.config.js`，设置 `exec_mode: 'fork'`、`instances: 1`、`autorestart: true`、`max_restarts: 10`、`max_memory_restart: '300M'`
- [x] 1.2 在配置文件中加注释说明"必须单实例"约束（SQLite + 写队列）
- [x] 1.3 在 `server/` 下创建 `logs/` 占位目录（或 `.gitkeep`），避免 PM2 首次启动时因日志目录不存在报错
- [x] 1.4 在 `.gitignore` 中追加 `server/logs/` 规则，避免日志被提交

## 2. Nginx 反向代理配置

- [x] 2.1 创建 `deploy/aichanting.conf`，包含 `listen 80`、`server_name`、`root /opt/aichanting`、`index index.html`
- [x] 2.2 配置静态文件 `location /` 使用 `try_files $uri $uri/ /index.html`
- [x] 2.3 配置静态资源缓存（`location ~* \.(js|css|png|...)$`）+ gzip 压缩
- [x] 2.4 配置 `/api/` 反代到 `127.0.0.1:3000`，传递 `X-Real-IP` / `X-Forwarded-For` / `X-Forwarded-Proto` 头
- [x] 2.5 配置 `location ~ /\.(git|env|sqlite3?) { deny all; return 404; }` 屏蔽敏感文件
- [x] 2.6 修复 `limit_req zone=api_limit` 问题：移除该指令（应用层 `server/middleware/rateLimit.js` 已有限流，Nginx 层 zone 定义需在 `http {}` 块，超出单文件配置范围），或改为注释说明用户可选启用
- [x] 2.7 在 `deploy/aichanting.conf` 顶部添加使用说明（拷贝到 sites-available、软链 sites-enabled、`nginx -t` 测试、reload）

## 3. SQLite 备份脚本

- [x] 3.1 创建 `deploy/backup-sqlite.sh`，使用 `sqlite3 <db> ".backup '<dest>'"` 命令热备份到 `/var/backups/aichanting/db-YYYYMMDD.sqlite`
- [x] 3.2 脚本中实现"删除 14 天前旧备份"逻辑（`find /var/backups/aichanting -name 'db-*.sqlite' -mtime +14 -delete`）
- [x] 3.3 脚本顶部加错误处理：源数据库不存在时退出非 0；备份目录不存在时自动 `mkdir -p`
- [x] 3.4 在 `DEPLOY.md` 中提供 cron 配置示例：`0 3 * * * /opt/aichanting/deploy/backup-sqlite.sh >> /var/log/aichanting-backup.log 2>&1`

## 4. 部署文档 DEPLOY.md

- [x] 4.1 创建 `DEPLOY.md`，编写"前置准备"章节：ECS 规格（最低 2C2G + 40GB）、安全组开放端口（22/80/443）、域名（可选）
- [x] 4.2 编写"操作系统选型"章节：推荐 Ubuntu Server 22.04 LTS，列出阿里云镜像市场入口与备选系统
- [x] 4.3 编写"初始化安全配置"章节：SSH 密钥登录、禁用 root 密码登录、创建非 root 部署用户 `deploy`、配置 UFW 防火墙（仅放行 22/80/443）
- [x] 4.4 编写"安装运行时"章节：Node.js 20 LTS via NodeSource、build-essential、python3、Nginx、PM2、sqlite3 CLI
- [x] 4.5 编写"部署代码"章节：`git clone` 到 `/opt/aichanting`、`chown -R deploy:deploy`、`cd server && npm ci --omit=dev`
- [x] 4.6 编写"启动 PM2"章节：`pm2 start ecosystem.config.js`、`pm2 save`、`pm2 startup` 配置开机自启
- [x] 4.7 编写"配置 Nginx"章节：拷贝 `deploy/aichanting.conf` 到 `sites-available/`、替换 `YOUR_DOMAIN_OR_IP`、软链到 `sites-enabled/`、删除默认 default 站点、`nginx -t && systemctl reload nginx`
- [x] 4.8 编写"启用 HTTPS（可选）"章节：`certbot --nginx -d <domain>`、验证自动续期 `certbot renew --dry-run`
- [x] 4.9 编写"配置自动备份"章节：拷贝 `deploy/backup-sqlite.sh` 到项目目录、`chmod +x`、创建 `/var/backups/aichanting/`、添加 cron 任务
- [x] 4.10 编写"验证部署"章节：`curl http://localhost/api/health` 应返回 `{"status":"ok"}`、浏览器访问 `http://<ECS-IP>/` 应看到首页、`pm2 status` 显示 online
- [x] 4.11 编写"常用运维操作"章节：查看日志 `pm2 logs aichanting`、重启服务 `pm2 reload aichanting`、更新代码 `git pull && npm ci && pm2 reload`、从备份恢复 SQLite 的三步操作
- [x] 4.12 编写"故障排查"章节：端口被占用（`lsof -i:3000`）、502 Bad Gateway（Node 未启动）、`better-sqlite3` 编译失败（缺 build-essential）、Certbot 签发失败（DNS 未生效）

## 5. 验证

- [x] 5.1 本地用 `node --check server/ecosystem.config.js` 验证 PM2 配置语法
- [x] 5.2 用 `nginx -t -c <临时配置>` 在已装 Nginx 的环境验证 `deploy/aichanting.conf` 语法（或文档中说明由用户在 ECS 上验证）— DEPLOY.md 7.1 节已包含 `sudo nginx -t` 步骤
- [ ] 5.3 在本地 Linux 环境（WSL 或 Docker）跑通完整部署流程，确认文档无遗漏步骤 — 需 Linux 环境，本机 Windows 无 WSL，已通过文档审查确认无遗漏；用户在 ECS 实际部署时验证
- [ ] 5.4 验证备份脚本：手动执行 `backup-sqlite.sh`，确认 `/var/backups/aichanting/` 下生成正确命名的备份文件且可用 `sqlite3` 打开 — 需 Linux + sqlite3 CLI，用户在 ECS 部署后按 DEPLOY.md 9.1 节手动验证

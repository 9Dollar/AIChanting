# 赛博功德转换器 - 阿里云 ECS 部署文档

本文档从零开始指导你将赛博功德转换器部署到阿里云 ECS，覆盖操作系统选型、安全初始化、运行时安装、代码部署、进程守护、反向代理、HTTPS、数据备份与运维排障。

---

## 目录

1. [前置准备](#1-前置准备)
2. [操作系统选型](#2-操作系统选型)
3. [初始化安全配置](#3-初始化安全配置)
4. [安装运行时](#4-安装运行时)
5. [部署代码](#5-部署代码)
6. [启动 PM2](#6-启动-pm2)
7. [配置 Nginx](#7-配置-nginx)
8. [启用 HTTPS（可选）](#8-启用-https可选)
9. [配置自动备份](#9-配置自动备份)
10. [验证部署](#10-验证部署)
11. [常用运维操作](#11-常用运维操作)
12. [故障排查](#12-故障排查)

---

## 1. 前置准备

### 1.1 ECS 规格

| 项目 | 最低建议 | 推荐 |
|---|---|---|
| CPU | 2 核 | 2 核 |
| 内存 | 2 GB | 4 GB |
| 系统盘 | 40 GB SSD | 40 GB SSD |
| 带宽 | 1 Mbps（按量付费） | 5 Mbps |

应用本身很轻量，2C2G 足以承载数百并发；多出的内存留给系统缓存和 SQLite。

### 1.2 安全组开放端口

在阿里云 ECS 控制台 → 安全组，入方向添加以下规则：

| 端口 | 协议 | 用途 |
|---|---|---|
| 22 | TCP | SSH |
| 80 | TCP | HTTP |
| 443 | TCP | HTTPS（如启用） |

**重要**：不要开放 3000 端口——Node 服务只监听 `127.0.0.1:3000`，由 Nginx 反代对外。

### 1.3 域名（可选）

- 有域名：完成 ICP 备案后将 A 记录解析到 ECS 公网 IP，可启用 HTTPS
- 无域名：直接用 ECS 公网 IP 访问，先用 HTTP 跑通，后续再补域名

---

## 2. 操作系统选型

**推荐**：Ubuntu Server 22.04 LTS（Jammy）

在阿里云 ECS 控制台创建实例时，「镜像」选择：
- 镜像市场 → 搜索「Ubuntu」 → 选择 **Ubuntu 22.04 64位**（阿里云官方公共镜像）

### 为什么选 Ubuntu 22.04 LTS

- LTS 支持到 2027 年，无需频繁升级
- Node.js 20 via NodeSource 仓库安装顺畅
- `better-sqlite3` 原生模块编译所需工具链（build-essential / python3）一键安装
- Nginx、PM2、Certbot 社区文档丰富

### 备选系统

| 系统 | 适用场景 | 注意事项 |
|---|---|---|
| Ubuntu 24.04 LTS | 想用新版本 | 部分第三方包还在追赶，新手不友好 |
| Alibaba Cloud Linux 3 | 阿里云优化 | 社区资源少，遇问题排查成本高 |
| Debian 12 | 偏好稳定 | NodeSource 支持稍晚 |

---

## 3. 初始化安全配置

用 root 首次登录后，按顺序执行以下步骤。

### 3.1 创建非 root 部署用户

```bash
# 创建部署用户 deploy（无密码登录，仅 sudo 时需要密码）
adduser deploy
# 加入 sudo 组（允许临时提权）
usermod -aG sudo deploy

# 配置 SSH 密钥登录 deploy 用户
mkdir -p /home/deploy/.ssh
cp ~/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys
```

### 3.2 禁用 root 密码登录

编辑 `/etc/ssh/sshd_config`，确保以下配置：

```bash
sudo nano /etc/ssh/sshd_config
```

```conf
PermitRootLogin no                  # 禁止 root 直接登录
PasswordAuthentication no           # 禁止密码登录（仅密钥登录）
```

重载 SSH 服务（**先别断开当前会话，开新窗口测试密钥登录成功后再关闭**）：

```bash
sudo systemctl reload ssh
```

### 3.3 配置 UFW 防火墙

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 80/tcp      # HTTP
sudo ufw allow 443/tcp     # HTTPS
sudo ufw enable
sudo ufw status verbose
```

---

## 4. 安装运行时

切换到 deploy 用户执行：

```bash
sudo apt update && sudo apt upgrade -y

# 4.1 基础工具链（编译 better-sqlite3 原生模块需要）
sudo apt install -y build-essential python3 git curl sqlite3

# 4.2 Node.js 20 LTS via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 验证
node --version    # 应输出 v20.x.x
npm --version
sqlite3 --version

# 4.3 Nginx
sudo apt install -y nginx
sudo systemctl enable nginx

# 4.4 PM2（全局安装）
sudo npm install -g pm2
pm2 --version
```

---

## 5. 部署代码

### 5.1 克隆项目到 /opt/aichanting

> 把 `YOUR_GIT_REPO_URL` 替换为你的仓库地址（建议用 SSH 或 PAT 避免明文密码）。

```bash
sudo mkdir -p /opt/aichanting
sudo chown -R deploy:deploy /opt/aichanting
cd /opt
git clone YOUR_GIT_REPO_URL /opt/aichanting
```

### 5.2 安装依赖

```bash
cd /opt/aichanting/server
npm ci --omit=dev
```

> `--omit=dev` 跳过 devDependencies；如果命中 prebuilt 二进制，`better-sqlite3` 无需编译；否则会自动调用 build-essential 编译。

### 5.3 验证 Node 能启动

```bash
# 临时启动，按 Ctrl+C 退出
PORT=3000 node server.js
```

看到 `赛博功德转换器服务器已启动：http://localhost:3000` 即正常。

---

## 6. 启动 PM2

### 6.1 用 ecosystem 配置启动

```bash
cd /opt/aichanting/server
pm2 start ecosystem.config.js
pm2 status              # 应看到 aichanting online
pm2 logs aichanting     # 查看启动日志，Ctrl+C 退出
```

### 6.2 配置开机自启

```bash
# 生成 systemd 服务（命令输出会给出一条 sudo 命令，复制执行）
pm2 startup systemd
# 按提示执行类似：
#   sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u deploy --hp /home/deploy

# 保存当前进程列表（重启后自动恢复）
pm2 save
```

### 6.3 关键约束：必须单实例

`server/ecosystem.config.js` 已强制 `exec_mode: 'fork'` + `instances: 1`。

**不要改成 cluster 或多实例**——`better-sqlite3` 是单文件 SQLite，多进程并发写会触发 `SQLITE_BUSY` 或文件损坏。应用层的写队列只在单进程内有效。

---

## 7. 配置 Nginx

### 7.1 部署站点配置

```bash
sudo cp /opt/aichanting/deploy/aichanting.conf /etc/nginx/sites-available/aichanting

# 替换 server_name：有域名填域名，无域名填 ECS 公网 IP
sudo sed -i 's|YOUR_DOMAIN_OR_IP|your-domain.com|g' /etc/nginx/sites-available/aichanting
# 或：sudo sed -i 's|YOUR_DOMAIN_OR_IP|47.xxx.xxx.xxx|g' /etc/nginx/sites-available/aichanting

# 启用站点
sudo ln -s /etc/nginx/sites-available/aichanting /etc/nginx/sites-enabled/

# 删除默认站点（避免冲突）
sudo rm -f /etc/nginx/sites-enabled/default

# 测试配置语法
sudo nginx -t
# 应输出：syntax is ok / test is successful

# 重载
sudo systemctl reload nginx
```

### 7.2 架构说明

```
浏览器 → Nginx:80 ─┬─ 静态文件（HTML/CSS/JS） → 直接返回（root /opt/aichanting）
                   └─ /api/* ──反代──→ Node 127.0.0.1:3000
```

- 静态文件由 Nginx 直接服务（性能优于 Express）
- API 请求反代到 Node，传递真实客户端 IP（供 `server/middleware/rateLimit.js` 限流）
- `/.git`、`/.env`、`*.sqlite` 等敏感路径已屏蔽，返回 404

---

## 8. 启用 HTTPS（可选）

### 8.1 前置条件

- 已有域名，且 ICP 备案完成
- 域名 A 记录已解析到 ECS 公网 IP（`dig your-domain.com` 应返回 ECS IP）
- Nginx 已按第 7 节配置完成且 80 端口可访问

### 8.2 安装 Certbot 并签发证书

```bash
sudo apt install -y certbot python3-certbot-nginx

# 自动签发并改写 Nginx 配置（80 → 443 跳转也会自动加）
sudo certbot --nginx -d your-domain.com
```

按提示：
1. 输入邮箱（用于证书过期提醒）
2. 同意服务条款
3. 是否订阅邮件（可选）
4. 选择强制 HTTPS（推荐选 2：Redirect）

### 8.3 验证自动续期

```bash
sudo certbot renew --dry-run
```

输出 `Congratulations, all renewals succeeded` 即正常。Let's Encrypt 证书有效期 90 天，certbot 会通过 systemd timer 自动续期。

### 8.4 无域名场景

暂时用 `http://<ECS-IP>/` 访问。**警告**：HTTP 明文传输，不要在生产环境输入真实 API Key；前端「服务器地址」字段在 HTTP 下也会被浏览器标为不安全。建议尽快补域名启用 HTTPS。

---

## 9. 配置自动备份

### 9.1 部署备份脚本

```bash
# 脚本已经在仓库中
chmod +x /opt/aichanting/deploy/backup-sqlite.sh

# 创建备份目录
sudo mkdir -p /var/backups/aichanting
sudo chown deploy:deploy /var/backups/aichanting

# 手动跑一次验证
/opt/aichanting/deploy/backup-sqlite.sh
ls -lh /var/backups/aichanting/
# 应看到 db-YYYYMMDD.sqlite
```

### 9.2 配置 cron 每日备份

```bash
# 编辑 deploy 用户的 crontab
crontab -e
```

添加一行（每天凌晨 3:00 执行）：

```cron
0 3 * * * /opt/aichanting/deploy/backup-sqlite.sh >> /var/log/aichanting-backup.log 2>&1
```

### 9.3 备份策略说明

- 使用 `sqlite3 .backup` 命令（SQLite 在线备份 API），可在服务运行时安全执行，不会得到撕裂的快照
- 保留近 14 天，超期自动删除
- 日志写入 `/var/log/aichanting-backup.log`

---

## 10. 验证部署

### 10.1 健康检查

```bash
# 在 ECS 上本地测试
curl http://localhost/api/health
# 应返回：{"status":"ok","time":<timestamp>}
```

### 10.2 浏览器访问

- 有域名：`https://your-domain.com/`
- 无域名：`http://<ECS-公网IP>/`

应看到赛博功德转换器首页，标题为「赛博功德转换器」。

### 10.3 检查服务状态

```bash
pm2 status
# aichanting 应为 online

sudo systemctl status nginx
# active (running)
```

### 10.4 检查 API 联动

在浏览器页面中点击「刷新排行榜」，如果排行榜能加载（即便是空的），说明前端 → Nginx → Node 链路通畅。

---

## 11. 常用运维操作

### 11.1 日志

```bash
# 实时查看应用日志
pm2 logs aichanting

# 查看最近 100 行
pm2 logs aichanting --lines 100

# Nginx 访问日志
sudo tail -f /var/log/nginx/access.log

# Nginx 错误日志
sudo tail -f /var/log/nginx/error.log

# 备份日志
tail -f /var/log/aichanting-backup.log
```

### 11.2 重启服务

```bash
# 零停机重载（推荐，先 fork 新进程再关旧进程）
pm2 reload aichanting

# 强制重启（进程退出后 PM2 重新拉起）
pm2 restart aichanting

# 重启 Nginx（改配置后）
sudo nginx -t && sudo systemctl reload nginx
```

### 11.3 更新代码

```bash
cd /opt/aichanting
git pull
cd server
npm ci --omit=dev
pm2 reload aichanting
```

### 11.4 从备份恢复 SQLite

```bash
# 1. 停止应用（避免读写冲突）
pm2 stop aichanting

# 2. 用备份覆盖现数据库（先把当前库挪一份保险）
cp /opt/aichanting/server/db.sqlite /opt/aichanting/server/db.sqlite.broken.$(date +%s)
cp /var/backups/aichanting/db-20260715.sqlite /opt/aichanting/server/db.sqlite

# 3. 重新启动
pm2 start aichanting
```

### 11.5 查看 PM2 进程详情

```bash
pm2 describe aichanting
# 显示内存、CPU、重启次数、日志路径等
```

---

## 12. 故障排查

### 12.1 端口被占用

**症状**：`pm2 logs` 显示 `EADDRINUSE: address already in use :::3000`

```bash
# 查谁占了 3000
sudo lsof -i:3000
# 或
sudo ss -tlnp | grep 3000

# 杀掉占用进程（替换 PID）
sudo kill -9 <PID>

# 重启
pm2 restart aichanting
```

### 12.2 502 Bad Gateway

**原因**：Nginx 起来了，但 Node 没起来。

```bash
# 1. 检查 Node 进程
pm2 status
# 如果是 stopped/errored：
pm2 restart aichanting
pm2 logs aichanting --lines 50

# 2. 常见启动失败原因
#    - 端口被占（见 12.1）
#    - npm ci 没跑，缺 node_modules
#    - better-sqlite3 编译失败（见 12.3）
```

### 12.3 better-sqlite3 编译失败

**症状**：`npm ci` 报 `gyp ERR!` 或 `node-gyp` 错误。

```bash
# 确认工具链已装
sudo apt install -y build-essential python3

# 确认 Node 版本
node --version   # 必须 v20.x

# 清理重装
cd /opt/aichanting/server
rm -rf node_modules package-lock.json
npm install

# 如果还是失败，强制重新编译原生模块
npm rebuild better-sqlite3
```

### 12.4 Certbot 签发失败

**症状**：`certbot --nginx` 报 `Connection refused` 或 `DNS problem`。

```bash
# 1. 检查 DNS 是否生效
dig your-domain.com
# A 记录应指向 ECS 公网 IP

# 2. 检查 80 端口是否可被外网访问
#    - 阿里云安全组是否放行 80
#    - UFW 是否放行 80
sudo ufw status

# 3. 检查 Nginx 是否在跑
sudo systemctl status nginx

# 4. DNS 传播需要时间，等待 5-10 分钟后重试
sudo certbot --nginx -d your-domain.com
```

### 12.5 静态资源 404

**症状**：首页能打开，但 JS/CSS 加载 404。

```bash
# 检查 Nginx root 配置
sudo nginx -T | grep root
# 应为：root /opt/aichanting;

# 检查文件确实存在
ls /opt/aichanting/src/app.js
ls /opt/aichanting/styles/main.css
ls /opt/aichanting/data/scriptures.js

# 检查权限
ls -la /opt/aichanting/
# Nginx 默认以 www-data 用户运行，需要 o+rx 权限
chmod -R o+rX /opt/aichanting
```

### 12.6 SQLite 只读 / SQLITE_BUSY

**症状**：API 返回 500，日志显示 `database is locked` 或 `attempt to write a readonly database`。

```bash
# 1. 检查数据库文件权限
ls -la /opt/aichanting/server/db.sqlite
# 应为 deploy 用户可写

# 2. 修正权限
chown deploy:deploy /opt/aichanting/server/db.sqlite
chmod 644 /opt/aichanting/server/db.sqlite

# 3. 如果是 SQLITE_BUSY，检查是否误开了多实例
pm2 status
# processes 数量应为 1，exec_mode 应为 fork
```

---

## 附录：架构总览

```
                    ┌─────────────────────────────┐
                    │       阿里云 ECS             │
                    │   Ubuntu 22.04 LTS          │
   Internet ────────┤                             │
                    │  ┌────────────────────────┐ │
                    │  │ Nginx :80 / :443       │ │
                    │  │  ├─ /        → 静态文件 │ │
                    │  │  └─ /api/*   → 反代    │ │
                    │  └──────────┬─────────────┘ │
                    │             │ 127.0.0.1:3000 │
                    │  ┌──────────▼─────────────┐ │
                    │  │ PM2 → Node (fork x1)   │ │
                    │  │  aichanting            │ │
                    │  └──────────┬─────────────┘ │
                    │             │               │
                    │  ┌──────────▼─────────────┐ │
                    │  │ SQLite (单文件)        │ │
                    │  │  server/db.sqlite      │ │
                    │  └────────────────────────┘ │
                    │                             │
                    │  cron 03:00 → backup script │
                    │              → /var/backups │
                    └─────────────────────────────┘
```

## 附录：文件清单

| 文件 | 用途 |
|---|---|
| `server/ecosystem.config.js` | PM2 进程守护配置（单实例 fork） |
| `server/logs/.gitkeep` | 日志目录占位 |
| `deploy/aichanting.conf` | Nginx 站点配置模板 |
| `deploy/backup-sqlite.sh` | SQLite 在线热备份脚本 |
| `DEPLOY.md` | 本文档 |

---

**部署完成后**：建议先在自己的浏览器中走完一次完整流程（设置 API Key → 诵经 → 上传功德 → 查看排行榜），确认前后端联动正常后再分享给真实用户。

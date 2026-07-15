## Context

赛博功德转换器当前是一个本地运行的 Node.js Express 单体应用：
- 后端 `server/server.js` 监听 `process.env.PORT || 3000`，同时通过 `express.static(path.join(__dirname, '..'))` 托管前端静态文件
- 数据层使用 `better-sqlite3` 单文件 SQLite（`server/db.sqlite`），应用层通过 `enqueueWrite` 串行化所有写操作（见 `openspec/specs/concurrent-write-protection/spec.md`）
- 前端 `index.html` 通过相对路径引用 `src/`、`data/`、`styles/`，用户在浏览器中通过 `server-url` 输入框配置后端地址（默认 `http://localhost:3000`）

用户已购置阿里云 ECS 但尚未安装操作系统，需要一份从零开始的可落地部署方案，包含进程守护、反向代理、HTTPS 与数据备份。

## Goals / Non-Goals

**Goals:**
- 提供从操作系统选型到首次访问的端到端部署流程，无需额外查阅外部资料
- 进程崩溃后自动重启，ECS 重启后服务自动恢复
- Nginx 承担静态文件服务与 TLS 终止，Node 仅处理 API，降低 Node 负载
- SQLite 数据可备份、可恢复，避免单点丢失
- 保持现有代码零改动（`server.js` 已支持 `PORT` 环境变量与上级目录静态托管）

**Non-Goals:**
- 不引入 Docker / 容器化（用户希望流程尽量直接，ECS 单机足够）
- 不做多实例水平扩展（SQLite 单文件限制 + 写队列语义要求单实例）
- 不改造前端构建（无 webpack/vite，直接服务原始 HTML/JS）
- 不实现 CI/CD 自动部署（首次落地以手工部署为主）
- 不引入 PostgreSQL/MySQL 等外部数据库（保持 SQLite 简单性）

## Decisions

### 决策 1：操作系统选择 Ubuntu Server 22.04 LTS

**选择**：Ubuntu Server 22.04 LTS（Jammy）

**理由**：
- LTS 支持到 2027 年，避免频繁升级
- Node.js 20 via NodeSource 仓库安装顺畅，`better-sqlite3` 编译所需的 `build-essential` / `python3` 一键安装
- Nginx、PM2、Certbot 文档与社区案例最多
- 阿里云官方镜像直接提供，无需自定义

**备选方案与放弃原因**：
- Ubuntu 24.04 LTS：部分第三方包还在追赶，对新手不友好
- Alibaba Cloud Linux 3：阿里云优化但社区资源少，遇到问题排查成本高
- Debian 12：稳定但 NodeSource 支持稍晚，非阿里云推荐镜像
- CentOS / Rocky：生态转向 RHEL 系，npm 原生模块编译偶尔遇到 gcc 版本坑

### 决策 2：进程守护使用 PM2 fork 模式 + 单实例

**选择**：PM2 `exec_mode: 'fork'`，`instances: 1`，`max_memory_restart: 300M`

**理由**：
- `better-sqlite3` 是同步、文件锁的嵌入式数据库，多进程并发写会触发 `SQLITE_BUSY` 甚至文件损坏
- 应用层 `enqueueWrite` 写队列（见 [concurrent-write-protection spec](../../specs/concurrent-write-protection/spec.md)）只在一个进程内有效，跨进程不共享
- 因此**禁止** cluster 模式或多实例，必须单进程

**备选方案与放弃原因**：
- `systemd` 直接拉起：可省去 PM2 依赖，但日志切割、内存阈值重启、零停机重载不如 PM2 方便
- `nodemon`：仅开发用，不适合生产
- Docker Compose + restart:always：用户明确不引入 Docker

### 决策 3：Nginx 静态+API 分流，而非全量反代

**选择**：Nginx 直接服务项目根目录的静态文件（`root /opt/aichanting`），仅 `/api/*` 反代到 `127.0.0.1:3000`

**理由**：
- 静态文件由 Nginx 处理效率高于 Express `express.static`
- 前端所有资源都用相对路径（`src/`、`data/`、`styles/`），Nginx `try_files $uri $uri/ /index.html` 即可覆盖
- Node 仅处理 API，可专注业务逻辑，QPS 上限更高
- 同时保留 `express.static` 作为兜底（即便 Nginx 配置错误，Node 仍能完整服务）

**备选方案与放弃原因**：
- 全量反代到 Node：简单但浪费 Nginx 静态处理能力，Node 成为瓶颈
- 静态文件迁移到 CDN：项目规模小，引入 CDN 增加复杂度且需处理 CORS

### 决策 4：HTTPS 通过 Certbot + Let's Encrypt

**选择**：用户有域名时用 `certbot --nginx` 自动签发并配置证书；无域名则先用 HTTP，文档标注后续可补

**理由**：
- Let's Encrypt 免费、自动续期、`certbot --nginx` 插件自动改写 Nginx 配置
- 项目前端 `fetch` 调用 API 时，HTTPS 页面调用 HTTP API 会被浏览器拦截（mixed content），因此一旦对外提供，HTTPS 几乎是必需

**备选方案与放弃原因**：
- 阿里云 SSL 控制台免费证书：每年需手动续期，证书绑定 CDN/SLB 才方便，单机 ECS 不便
- 自签名证书：浏览器告警，无法用于真实用户

### 决策 5：SQLite 备份用 `sqlite3 .backup` + cron

**选择**：每日凌晨 3 点通过 `sqlite3 db.sqlite ".backup '/var/backups/aichanting/db-YYYYMMDD.sqlite'"` 在线热备份，保留近 14 天

**理由**：
- `better-sqlite3` 在线时直接 `cp` 文件可能得到撕裂的快照
- `sqlite3 .backup` 命令走 SQLite 在线备份 API，可安全在运行中执行
- cron + 脚本最轻量，无需引入额外备份系统

**备选方案与放弃原因**：
- 阿里云 ECS 快照：整个磁盘级别，恢复慢，且需在控制台操作
- Litestream 流式备份到 S3：强大但配置复杂，超出当前需求

## Risks / Trade-offs

- **[风险] 单实例成为可用性瓶颈** → 当前用户量小，单 Node 进程足以承载；若未来需要扩展，需先迁移到 PostgreSQL 或加分布式锁，本设计不解决
- **[风险] ECS 被入侵后 SQLite 文件可被直接读取** → Nginx 配置已加 `location ~ /\.(git|env|sqlite3?) { deny all; }` 屏蔽；部署文档强调使用非 root 用户、配置 UFW 防火墙、禁用密码登录
- **[风险] `better-sqlite3` 在新 Node 版本上无 prebuilt 二进制** → 部署文档强制安装 `build-essential python3`，确保可源码编译；锁死 Node.js 20 LTS 避免大版本漂移
- **[风险] 用户无域名时无法启用 HTTPS** → 文档允许先用 HTTP 跑通流程，预留 HTTPS 升级章节；明确提示 HTTP 下不要在生产环境输入真实 API Key
- **[权衡] 用 PM2 而非 systemd 增加一层依赖** → 换取日志切割、内存重启、`pm2 reload` 零停机重载等运维便利，对单人维护更友好

## Migration Plan

**部署步骤（首次）**：
1. 阿里云控制台选购 ECS，选择 Ubuntu Server 22.04 LTS 公共镜像
2. 完成 SSH 密钥登录、创建非 root 部署用户、配置 UFW 防火墙
3. 安装 Node.js 20 LTS（NodeSource 仓库）、Nginx、PM2、build-essential、python3
4. `git clone` 项目到 `/opt/aichanting`，`cd server && npm ci --omit=dev`
5. `pm2 start ecosystem.config.js` → `pm2 save` → `pm2 startup` 配置开机自启
6. 部署 Nginx 配置，启用站点，重载 Nginx
7. （可选）配置域名 DNS → `certbot --nginx` 启用 HTTPS
8. 配置 cron 备份脚本

**回滚策略**：
- 配置层回滚：`pm2 delete aichanting` + `sudo rm /etc/nginx/sites-enabled/aichanting && sudo nginx -t && sudo systemctl reload nginx`，服务恢复到反代前的直连 3000 端口状态
- 数据层回滚：`pm2 stop aichanting` → `cp /var/backups/aichanting/db-YYYYMMDD.sqlite server/db.sqlite` → `pm2 start aichanting`
- 代码层回滚：`git reset --hard <prev-commit> && npm ci && pm2 reload aichanting`

## Open Questions

- 是否需要绑定域名？（影响 HTTPS 章节，文档将给出两条路径）
- ECS 规格（CPU/内存/磁盘）？（文档给出最低建议 2C2G + 40GB，用户可按需调整）
- 是否需要后续接入 Cloudflare 等 CDN？（本次不做，预留接口说明）

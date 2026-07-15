## ADDED Requirements

### Requirement: 单实例进程运行

系统 SHALL 以单 Node.js 进程运行应用，禁止使用 cluster 模式或多实例水平扩展，以维持 `better-sqlite3` 单文件 SQLite 的写入安全与应用层写队列语义。

#### Scenario: PM2 配置强制单实例

- **WHEN** 部署人员查看 `server/ecosystem.config.js`
- **THEN** 文件中 `exec_mode` MUST 为 `'fork'`，`instances` MUST 为 `1`

#### Scenario: 多实例配置被拒绝

- **WHEN** 部署人员误将 `instances` 改为大于 1 的值并执行 `pm2 reload`
- **THEN** 系统 SHOULD 在文档中被明确警告此配置会导致 SQLite 写入冲突或文件损坏，且 PM2 配置文件中 SHOULD 含注释说明该约束

### Requirement: 进程崩溃自动恢复

系统 SHALL 在 Node 进程异常退出时由 PM2 自动重启，并在 ECS 重启后由 PM2 startup 机制自动恢复服务。

#### Scenario: 进程崩溃后自动重启

- **WHEN** Node 进程因未捕获异常退出（exit code 非 0）
- **THEN** PM2 MUST 在 1 秒内重新拉起进程，`autorestart` 为 `true`，`max_restarts` 设为 10 以防止崩溃循环

#### Scenario: ECS 重启后服务自恢复

- **WHEN** ECS 重启完成
- **THEN** 通过 `pm2 startup` + `pm2 save` 注册的系统服务 MUST 自动启动 `aichanting` 应用，无需人工干预

#### Scenario: 内存超限自动重启

- **WHEN** Node 进程内存占用超过 300MB
- **THEN** PM2 MUST 自动重启该进程（`max_memory_restart: '300M'`），避免内存泄漏拖垮整机

### Requirement: Nginx 反向代理与静态分流

系统 SHALL 由 Nginx 直接服务静态文件（HTML/CSS/JS/图片），仅将 `/api/*` 请求反代到本地 Node 服务，Node 监听 127.0.0.1:3000。

#### Scenario: 静态文件由 Nginx 直接返回

- **WHEN** 客户端请求 `/`、`/index.html`、`/src/app.js`、`/styles/main.css`、`/data/scriptures.js` 等静态资源
- **THEN** Nginx MUST 直接从项目根目录读取并返回，不转发到 Node；找不到文件时回退到 `/index.html`

#### Scenario: API 请求转发到 Node

- **WHEN** 客户端请求 `/api/health`、`/api/user/merit`、`/api/model/ranking` 等以 `/api/` 开头的路径
- **THEN** Nginx MUST 将请求反代到 `http://127.0.0.1:3000`，并设置 `X-Real-IP`、`X-Forwarded-For`、`X-Forwarded-Proto` 头，使 Node 能获取真实客户端 IP（供速率限制使用）

#### Scenario: 健康检查端点可访问

- **WHEN** 部署人员或监控探针请求 `/api/health`
- **THEN** 系统 MUST 返回 200 与 `{ "status": "ok", "time": <timestamp> }`，且 Nginx 配置 SHOULD 关闭该路径的 access_log 以减少日志噪声

### Requirement: 敏感文件屏蔽

系统 SHALL 通过 Nginx 配置拒绝访问 `.git/`、`.env`、`.sqlite`、`.sqlite3` 等敏感文件，防止源码与数据库泄露。

#### Scenario: 访问 .git 目录被拒

- **WHEN** 客户端请求 `/.git/config` 或 `/.gitignore`
- **THEN** Nginx MUST 返回 404，且不暴露文件存在性

#### Scenario: 访问数据库文件被拒

- **WHEN** 客户端请求 `/server/db.sqlite` 或任何 `*.sqlite3` 路径
- **THEN** Nginx MUST 返回 404

### Requirement: HTTPS 支持

系统 SHALL 支持通过 Let's Encrypt + Certbot 启用 HTTPS，并在文档中提供有域名与无域名两条路径。

#### Scenario: 有域名时启用 HTTPS

- **WHEN** 部署人员已将域名 A 记录解析到 ECS 公网 IP，并执行 `sudo certbot --nginx -d <domain>`
- **THEN** Certbot MUST 自动签发证书、改写 Nginx 配置启用 443 端口、配置 80 → 443 跳转，并设置自动续期 cron

#### Scenario: 无域名时降级为 HTTP

- **WHEN** 部署人员暂无域名
- **THEN** 系统 MUST 能以纯 HTTP 模式运行，文档 MUST 明确提示 HTTP 下不应在生产环境输入真实 API Key，且预留 HTTPS 升级步骤

### Requirement: SQLite 数据备份与恢复

系统 SHALL 提供基于 `sqlite3 .backup` 的在线热备份脚本与 cron 任务，每日备份一次，保留近 14 天。

#### Scenario: 每日自动备份

- **WHEN** 系统时间到达每日凌晨 3:00
- **THEN** cron 任务 MUST 执行 `sqlite3 /opt/aichanting/server/db.sqlite ".backup '/var/backups/aichanting/db-YYYYMMDD.sqlite'"`，且备份文件存在且可打开

#### Scenario: 备份保留周期

- **WHEN** 备份文件超过 14 天
- **THEN** 备份脚本 MUST 自动删除过期文件，避免磁盘占满

#### Scenario: 从备份恢复数据

- **WHEN** 部署人员需要恢复数据
- **THEN** 文档 MUST 提供恢复步骤：`pm2 stop aichanting` → `cp <backup> /opt/aichanting/server/db.sqlite` → `pm2 start aichanting`

### Requirement: 完整部署文档

系统 SHALL 提供一份端到端部署文档 `DEPLOY.md`，覆盖从操作系统选型到首次访问的全部步骤，使具备基础 Linux 经验的用户无需查阅外部资料即可完成部署。

#### Scenario: 文档覆盖完整流程

- **WHEN** 部署人员阅读 `DEPLOY.md`
- **THEN** 文档 MUST 包含以下章节：操作系统选型、ECS 初始化安全配置（SSH 密钥、非 root 用户、UFW）、Node.js 20 安装、Nginx 安装、PM2 安装、代码部署、PM2 配置、Nginx 配置、HTTPS 配置、SQLite 备份配置、常用运维操作、故障排查

#### Scenario: 文档提供验证步骤

- **WHEN** 部署人员完成所有步骤后
- **THEN** 文档 MUST 提供验证命令（如 `curl http://localhost/api/health` 应返回 ok、浏览器访问 `http://<ECS-IP>/` 应看到首页），让用户确认部署成功

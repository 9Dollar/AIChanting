## Why

项目当前只能在本地通过 `node server.js` 运行，缺乏生产环境部署方案。需要一份可落地的阿里云 ECS 部署能力，让应用能稳定对外提供服务（含进程守护、反向代理、HTTPS、数据备份），解决"代码写完了无法让真实用户访问"的问题。

## What Changes

- 新增 PM2 进程守护配置（`server/ecosystem.config.js`），保证 Node 服务崩溃后自动重启、开机自启
- 新增 Nginx 反向代理配置模板（`deploy/aichanting.conf`），由 Nginx 直接服务静态文件、将 `/api/` 反代到 Node，并配置 gzip、缓存、限速、敏感文件屏蔽
- 新增完整部署文档（`DEPLOY.md`），覆盖操作系统选型、初始化安全配置、Node.js/Nginx/PM2 安装、代码部署、HTTPS 配置、SQLite 备份策略、常用运维操作
- 明确运行约束：由于使用 `better-sqlite3` 单文件 SQLite + 应用内写队列，PM2 必须以 **单实例 fork 模式** 运行，禁止 cluster 模式，否则会引发数据库写入冲突或文件损坏

## Capabilities

### New Capabilities

- `ecs-deployment`: 阿里云 ECS 上的生产部署能力，包含进程守护（PM2 单实例）、反向代理（Nginx 静态+API 分流）、HTTPS 支持、SQLite 数据备份与恢复、运维操作规范

### Modified Capabilities

无。本次变更不修改 `concurrent-write-protection` 或 `merit-sync` 的任何 spec 级别需求；仅在部署层面约束运行时必须保持单实例以维持既有并发写入保护语义。

## Impact

- **新增文件**：`server/ecosystem.config.js`、`deploy/aichanting.conf`、`DEPLOY.md`
- **运行环境**：要求 Linux ECS（推荐 Ubuntu Server 22.04 LTS）、Node.js ≥ 20、Nginx、PM2
- **依赖**：`better-sqlite3` 为原生模块，部署时需要 build-essential / python3 完成编译（或命中 prebuilt 二进制）
- **数据持久化**：SQLite 文件位于 `server/db.sqlite`，需纳入备份策略
- **现有代码**：无需改动 `server/server.js` 或前端代码——`process.env.PORT` 与 `express.static(path.join(__dirname, '..'))` 已满足反代部署需求

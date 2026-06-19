## 1. 后端：并发保护层

- [x] 1.1 在 `server/db.js` 顶部新增全局 `writeQueue` Promise 变量（初始 `Promise.resolve()`）
- [x] 1.2 新增 `enqueueWrite(fn)` 函数：将 `writeQueue = writeQueue.then(fn, fn)`，返回新 Promise；fn 内异常传播给调用方，但队列链不断
- [x] 1.3 改造 `upsertUser`：实际写逻辑包进 `enqueueWrite`，返回 Promise
- [x] 1.4 改造 `upsertModel`：实际写逻辑包进 `enqueueWrite`，返回 Promise
- [x] 1.5 确认 `getUserRanking` / `getModelRanking` 不经过队列，直接同步读

## 2. 后端：用户功德改覆盖语义

- [x] 2.1 修改 `upsertUser`：存在记录时用传入的 `merit` / `chantCount` / `userName` 直接覆盖（不再 `addMeritStrings`）
- [x] 2.2 新建用户分支保持不变（插入传入值）
- [x] 2.3 在 `server/routes/merit.js` 顶部添加注释，明确标注 `POST /api/user/merit` 的 `merit` = 用户当前总功德（全量，覆盖式）
- [x] 2.4 在 `server/routes/merit.js` 顶部添加注释，明确标注 `POST /api/model/merit` 的 `merit` = 本次新增功德（增量，累加式）

## 3. 后端：路由适配异步

- [x] 3.1 `routes/merit.js` 的 user 分支改为 `async (req, res)`，`await db.upsertUser(...)`
- [x] 3.2 `routes/merit.js` 的 model 分支改为 `async (req, res)`，`await db.upsertModel(...)`
- [x] 3.3 错误处理保持 try/catch，捕获异步异常返回 500

## 4. 前端：localStorage 用户数据结构

- [x] 4.1 检查 `src/storage.js` 当前用户数据结构，确认是否已含 `byModel` 字段
- [x] 4.2 若无 `byModel`，新增该字段为 `{}`，结构为 `{ [modelKey]: { provider, model, merit, chantCount } }`
- [x] 4.3 在诵经完成时更新 `byModel`：对当前 (provider, model) 累加 `merit` 和 `chantCount`
- [x] 4.4 在导出/导入存档时包含 `byModel`

## 5. 前端：模型功德增量上传（诵经循环内）

- [x] 5.1 在 `src/app.js` 新增 `uploadModelMeritIncrement(provider, model, meritDelta, chantDelta)` 函数，POST `/api/model/merit`
- [x] 5.2 在诵经循环每次成功完成后，调用该函数上传本次新增的模型功德
- [x] 5.3 失败时将增量存入 localStorage 的 `pendingModelIncrements` 队列
- [x] 5.4 下次诵经完成时，合并 `pendingModelIncrements` 中同一 (provider, model) 的增量一起发送
- [x] 5.5 页面加载时检查 `pendingModelIncrements`，尝试重试发送，成功则移除

## 6. 前端：用户功德全量上传按钮

- [x] 6.1 在 `src/ui.js` 将"同步服务器"按钮文案改为"上传用户数据"
- [x] 6.2 在 `src/app.js` 重构 `syncToServer` 为 `uploadUserData`：只 POST `/api/user/merit`，body 含 `userId`、`userName`、`merit`（当前总功德字符串）、`chantCount`
- [x] 6.3 移除原 `syncToServer` 中对 `/api/model/merit` 的调用（模型功德已由增量路径处理）
- [x] 6.4 上传成功后调用 `fetchRankings` 刷新排行榜
- [x] 6.5 更新 `app.js` 中的事件绑定：`btn-sync` → `uploadUserData`

## 7. 数据清理（可选）

- [x] 7.1 在 `server/` 新增 `reset-db.js` 脚本：删除 `db.sqlite` 并重新建表，供用户手动清理历史脏数据
- [x] 7.2 在 `server/package.json` 添加 `reset` 脚本入口

## 8. 验证

- [x] 8.1 启动后端，POST `/api/user/merit` 两次相同 `merit`，确认第二次不累加（覆盖语义）
- [x] 8.2 POST `/api/model/merit` 两次，确认累加正确（增量语义）
- [x] 8.3 并发发送多个 `/api/user/merit` 请求，确认队列串行化无丢失
- [x] 8.4 前端诵经循环完成一次，确认自动发增量请求到 `/api/model/merit`
- [x] 8.5 前端点击"上传用户数据"按钮，确认只更新 users 表，不动 models 表
- [x] 8.6 模拟网络失败，确认增量进入 `pendingModelIncrements` 并在下次重试
- [x] 8.7 运行 `npm test`（后端语法检查）通过

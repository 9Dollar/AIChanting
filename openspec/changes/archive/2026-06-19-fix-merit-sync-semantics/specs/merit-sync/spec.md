## ADDED Requirements

### Requirement: 模型功德增量同步

系统 SHALL 在每次诵经完成时，由前端自动向后端发送增量请求，上传本次诵经为该模型新增的功德。后端 SHALL 对该模型的 `total_merit` 执行累加操作。

请求体 `merit` 字段含义为**本次新增功德**（非累计总值）。

#### Scenario: 单次诵经完成触发增量上传

- **WHEN** 前端完成一次诵经循环迭代，本次为模型 `gpt-4o-mini`（provider `openai`）新增功德 `260`
- **THEN** 前端向 `POST /api/model/merit` 发送请求，body 为 `{ provider: "openai", model: "gpt-4o-mini", merit: "260", chantCount: 1 }`
- **AND** 后端将该模型的 `total_merit` 累加 `260`，`chant_count` 累加 `1`
- **AND** 后端返回 `{ success: true, data: { name, provider, total_merit, chant_count } }`，其中 `total_merit` 为累加后的新值

#### Scenario: 增量请求失败时保留待重试

- **WHEN** 前端发送模型功德增量请求，但网络失败或服务器返回非 2xx
- **THEN** 前端 SHALL 将该次增量（provider, model, merit, chantCount）存入 localStorage 的"未同步增量队列"
- **AND** 不阻塞当前诵经循环继续
- **AND** 在下次诵经完成时，将队列中同一 (provider, model) 的增量合并后一起重试发送

#### Scenario: 页面加载时重试未同步增量

- **WHEN** 页面加载且 localStorage 中存在未同步的模型功德增量队列
- **THEN** 前端 SHALL 在启动时尝试合并并发送这些增量
- **AND** 发送成功的增量从队列中移除，失败的保留

### Requirement: 用户功德全量上传

系统 SHALL 提供独立的"上传用户数据"按钮，由用户主动点击后，将前端 localStorage 中的用户当前总功德全量上传至后端。后端 SHALL 对该用户的 `total_merit` 执行覆盖操作（用传入值替换，不累加）。

请求体 `merit` 字段含义为**用户当前总功德**（非增量）。

#### Scenario: 用户点击上传按钮

- **WHEN** 用户点击"上传用户数据"按钮
- **THEN** 前端向 `POST /api/user/merit` 发送请求，body 为 `{ userId, userName, merit: <当前总功德字符串>, chantCount: <当前总次数> }`
- **AND** 后端用传入的 `merit` 覆盖该用户的 `total_merit`，用 `chantCount` 覆盖 `chant_count`，用 `userName` 更新 `user_name`
- **AND** 后端返回 `{ success: true, data: { user_id, total_merit, chant_count } }`，其中 `total_merit` 等于传入值

#### Scenario: 重复上传不导致数值膨胀

- **WHEN** 用户连续点击"上传用户数据"按钮两次，两次请求 `merit` 均为 `"1500"`
- **THEN** 后端最终该用户的 `total_merit` 为 `"1500"`（而非 `3000`）

#### Scenario: 用户功德上传不影响模型功德

- **WHEN** 用户点击"上传用户数据"按钮
- **THEN** 后端 SHALL 只更新 `users` 表
- **AND** SHALL NOT 修改 `models` 表的任何记录

### Requirement: 前端 localStorage 用户数据结构

前端 SHALL 在 localStorage 中保存用户完整数据，至少包含用户总功德和各模型功德明细。

#### Scenario: 用户数据结构

- **WHEN** 前端保存用户数据到 localStorage
- **THEN** 数据结构 SHALL 包含字段：`id`（GUID）、`name`（法名）、`createdAt`、`totalMerit`（BigInt 字符串）、`chantCount`、`byScripture`（各经文功德映射）、`byModel`（各模型功德明细映射）、`records`（记录列表）
- **AND** `byModel` 的每个条目 SHALL 包含 `provider`、`model`、`merit`、`chantCount`

### Requirement: 移除旧的同步服务器按钮语义

系统 SHALL 移除原"同步服务器"按钮的旧语义（一次性上传用户功德 + 最近一条模型功德），替换为"上传用户数据"按钮（仅全量上传用户功德）。

#### Scenario: 旧按钮文案与行为替换

- **WHEN** 用户查看界面
- **THEN** 原"同步服务器"按钮 SHALL 被替换为"上传用户数据"按钮
- **AND** 点击该按钮只触发用户功德全量上传，不触发模型功德上传（模型功德已在诵经循环中增量上传）

### Requirement: API 请求体语义文档化

后端 SHALL 在路由代码注释和 API 文档中明确区分两个端点的 `merit` 字段语义。

#### Scenario: 端点语义标注

- **WHEN** 开发者阅读 `server/routes/merit.js` 或相关文档
- **THEN** SHALL 能看到 `POST /api/user/merit` 的 `merit` 标注为"用户当前总功德（全量，覆盖式）"
- **AND** SHALL 能看到 `POST /api/model/merit` 的 `merit` 标注为"本次新增功德（增量，累加式）"

## Why

当前 API 配置是单一扁平配置（`aichanting_api_config_v1`），用户只能保存一组 API 凭证，无法管理多个模型配置（如同时使用 OpenAI、DeepSeek、智谱等多个模型）。需要将单一配置升级为"预设列表"管理，支持新增、编辑、删除、置顶、排序，并选择某个预设作为当前生效的模型 API 配置。

## What Changes

- **新增模型配置预设列表**：在 localStorage 新增 `aichanting_api_presets_v1` 存储预设数组，每个预设包含 id、name、apiType、provider、apiKey、endpoint、model、pinned、order、createdAt、updatedAt。
- **现有 API 配置表单转换为 modal 弹出框**：作为预设列表的下级功能，点击"新增"或"编辑"时弹出，不默认显示。复用现有 devotion-modal 的统一样式。
- **新增预设选择机制**：列表项支持 radio 选中，选中的预设 id 存入 `user.activePresetId`，随用户数据导出/导入。
- **新增预设排序能力**：支持置顶（pinned）和组内手动排序（order），每项提供 [置顶/取消置顶] [上移] [下移] 按钮。
- **诵经前校验**：必须选中有效预设才能启动诵经；诵经进行中，当前 active 预设的 radio/编辑/删除禁用，但可新增或编辑其他预设。
- **serverUrl 存储拆分**：将 `serverUrl` 从 `aichanting_api_config_v1` 拆出，独立存到 `aichanting_server_url_v1`，UI 输入框和行为不变。
- **BREAKING**：移除 `aichanting_api_config_v1` 中的 apiType/provider/apiKey/endpoint/model 字段（应用未发布，不写迁移）。
- **类型化开发**：用 JSDoc 定义 `ApiPreset` 类型，`createApiClient` 改为接收 preset 对象（为未来 TS 迁移铺路）。

## Capabilities

### New Capabilities
- `api-presets`: 模型配置预设管理能力，定义预设的存储结构、CRUD 操作、选择机制、排序规则、诵经前置校验，以及与用户数据导出/导入的集成。

### Modified Capabilities
<!-- 现有 specs (concurrent-write-protection, merit-sync) 与本次变更无关，无修改项 -->

## Impact

- **前端 `src/storage.js`**：新增 presets 的 CRUD 函数（loadPresets/savePresets/getPreset/addPreset/updatePreset/deletePreset）；新增 loadServerUrl/saveServerUrl；移除 loadApiConfig/saveApiConfig。
- **前端 `src/api.js`**：`createApiClient` 入参从散字段改为接收 preset 对象；新增 JSDoc 定义的 `ApiPreset` 类型。
- **前端 `src/ui.js`**：新增预设列表渲染（含排序状态）、modal 开关、排序操作按钮、radio 选中、表单读取/填充；移除旧 getApiConfig 中散字段逻辑。
- **前端 `src/app.js`**：重写 API 配置区逻辑（列表 + modal）；诵经前校验 activePresetId 有效；诵经中禁用当前 active 预设的操作；切换/编辑/删除预设时更新 user.activePresetId 并立即持久化。
- **前端 `src/user.js`**：user 结构新增 `activePresetId` 字段（默认 null）；createUser/migrateUser 适配。
- **前端 `index.html`**：API 配置区 DOM 重构为"列表 + modal 表单"；新增预设 modal（复用 devotion-modal 样式）。
- **导出/导入**：导出时 user 含 activePresetId（自动包含），预设列表（含 apiKey）写入存档 `presets` 字段并提示用户含敏感信息请勿分享；导入时恢复预设列表到 localStorage，activePresetId 原样接受不校验。

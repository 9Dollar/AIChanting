## Context

当前 API 配置是单一扁平结构，存储在 `aichanting_api_config_v1`，包含 apiType、provider、apiKey、endpoint、model、serverUrl 六个字段混在一起。UI 是一个常驻表单（[index.html#L51-L91](file:///d:/GameMaking/AIChanting/index.html#L51-L91)），每次字段变更即覆盖保存。用户只能保存一组 API 凭证，无法管理多个模型配置。

前端采用纯 JS + IIFE/window 全局模式，无构建工具，9 个文件通过 `<script>` 标签直接加载。本次变更保持该架构，但引入 JSDoc 类型定义，为未来 TS 迁移铺路。

应用未发布，无外部用户，不需要数据迁移。

## Goals / Non-Goals

**Goals:**
- 将单一 API 配置升级为预设列表管理，支持多个模型配置。
- 预设支持新增、编辑、删除、置顶、手动排序。
- 支持选择某个预设作为当前生效配置（activePresetId），随用户数据导出/导入。
- 现有 API 配置表单转换为 modal 弹出框，作为预设列表的下级功能。
- serverUrl 从 `aichanting_api_config_v1` 拆出独立存储，与模型配置解耦。
- 用 JSDoc 定义 `ApiPreset` 类型，`createApiClient` 接收类型化对象。
- 诵经前校验有效预设，诵经中保护当前 active 预设不被修改/删除/切换。

**Non-Goals:**
- 不引入构建工具或迁移到 TypeScript（后续独立提案）。
- 不调整 serverUrl 的 UI 和功能行为（仅拆分存储位置）。
- 不写数据迁移逻辑（应用未发布）。
- 不对导出的预设列表做加密处理（由用户自行负责存档安全，导出时提示敏感信息）。
- 不引入预设搜索/分页（数量预期较小）。

## Decisions

### 决策 1：数据模型 — 三个独立存储键

**选择**：
- `aichanting_api_presets_v1`: `Array<ApiPreset>`，预设列表（随存档导出，含 apiKey）。
- `aichanting_server_url_v1`: `string`，同步服务器地址（独立于预设）。
- `user.activePresetId`: `string | null`，当前选中预设 id（随 user 导出/导入）。

**理由**：
- 预设列表独立存储，便于在导出/导入时整体搬运。
- 预设列表含 apiKey，导出时提示用户"含敏感信息，请勿分享"，由用户自行决定是否分享存档。
- serverUrl 语义上与模型配置无关，拆分后模型配置存储完全干净。
- activePresetId 放在 user 对象里，自动随现有 [exportData](file:///d:/GameMaking/AIChanting/src/storage.js#L57-L65)/[importData](file:///d:/GameMaking/AIChanting/src/storage.js#L67-L76) 流程走，无需改导出/导入逻辑。

**备选方案**：
- A. 单一键存 `{ presets, activePresetId, serverUrl }`：耦合度高，serverUrl 与预设混在一起，不符合"模型配置是模型配置的事情"。
- B. activePresetId 独立 key：需改 exportData/importData，增加复杂度。
- C. 预设列表不导出（含 apiKey 敏感信息）：用户换设备时需重新配置所有预设，体验差；改为导出含 apiKey 并提示用户不可分享。

### 决策 2：ApiPreset 类型定义（JSDoc）

**选择**：在 `src/api.js` 顶部用 JSDoc 定义 `ApiPreset` 类型，字段如下：

```js
/**
 * @typedef {Object} ApiPreset
 * @property {string} id               // GUID，User.generateGUID() 生成
 * @property {string} name             // 显示名称，默认 = model
 * @property {'openai'|'anthropic'} apiType
 * @property {string} provider         // provider key
 * @property {string} apiKey
 * @property {string} endpoint         // 可选，覆盖 provider 默认端点
 * @property {string} model
 * @property {boolean} pinned          // 是否置顶
 * @property {number} order            // 组内顺序
 * @property {number} createdAt
 * @property {number} updatedAt
 */
```

**理由**：
- VS Code 原生支持 JSDoc 类型提示，无需构建工具即可获得类型检查收益。
- 类型定义集中在 api.js，未来 TS 迁移时可直接抽取为 `.d.ts` 或 `.ts`。
- `createApiClient(preset)` 接收类型化对象，调用方无需挑字段，preset 结构变化时自然适配。

**备选方案**：
- 散字段传入 `{ apiType, provider, apiKey, endpoint, model }`：调用方与被调方各自维护字段映射，preset 增字段时需两边同步。

### 决策 3：UI 结构 — 列表常驻 + Modal 表单

**选择**：
- API 配置折叠面板内默认显示预设列表（radio + 操作按钮 + 新增按钮）。
- 点击"新增"或"编辑"时弹出 modal 表单，复用现有 [devotion-modal](file:///d:/GameMaking/AIChanting/index.html#L197-L212) 的统一样式（`fixed inset-0 bg-black/50` + `card max-w-md` + 右上角 ×）。
- Modal 关闭方式：点遮罩 / × 按钮 / 取消按钮，三种都支持。

**理由**：
- 表单是次级功能（新增/编辑），不应常驻界面占用空间。
- Modal 聚焦用户注意力，避免列表与表单同时操作的状态混乱。
- 复用 devotion-modal 样式保持视觉一致，后续统一修改方便。

**备选方案**：
- 表单在列表下方展开/折叠：列表与表单同时可见，操作时易混淆，且占用纵向空间。

### 决策 4：排序规则 — pinned + order，手动上移/下移

**选择**：
- 每个预设含 `pinned: boolean` 和 `order: number` 两个字段。
- 排序规则：`pinned=true` 在前，`pinned=false` 在后；同组内按 `order` 升序。
- 新增预设：`pinned=false`，`order = 非置顶组最大 order + 1`（首项为 0）。
- 置顶操作：`pinned=true`，`order = 置顶组最大 order + 1`。
- 取消置顶：`pinned=false`，`order = 非置顶组最大 order + 1`。
- 上移/下移：交换相邻同组项的 `order` 值。
- UI 每项操作按钮：`[置顶/取消置顶] [上移] [下移] [编辑] [删除]`。

**理由**：
- 置顶满足"常用模型快速访问"需求；手动上移/下移满足精细排序需求。
- 两组 order 独立维护，避免置顶/取消置顶时全量重排。
- 相比拖拽排序，按钮操作实现简单且移动端友好。

**备选方案**：
- A. 拖拽排序：实现复杂，移动端体验需额外处理。
- B. 仅置顶不支持手动微调：灵活性不足，用户无法控制同组内顺序。

### 决策 5：诵经中操作保护

**选择**：
- 诵经进行中（`isChanting === true`），所有预设的 radio 切换禁用（防止切换 active 预设影响进行中的会话语义）。
- 当前 active 预设的全部操作按钮（置顶/取消置顶、上移、下移、编辑、删除）禁用。
- 允许新增预设、编辑/删除/排序其他非 active 预设。
- 进行中的会话不受影响（apiClient 已在启动时创建，持有配置快照）。

**理由**：
- 禁止切换 active 预设：进行中的会话已绑定启动时的预设，中途切换会让"当前生效配置"与"实际使用配置"不一致，造成用户困惑。
- 防止用户误删/误改当前正在使用的配置导致会话异常。
- active 预设的排序/置顶在诵经中无实际意义（其位置变动不影响进行中的会话），统一禁用所有操作按钮简化实现并避免误操作。
- 允许操作其他预设置免用户被锁死，提升体验。
- apiClient 持有快照，预设变更不影响进行中的请求。

### 决策 6：删除 active 预设后的行为

**选择**：
- 删除当前 active 预设时，`activePresetId` 置为 `null`。
- UI 提示用户"请选择一个模型配置"，不静默自动选择其他预设。

**理由**：
- 静默切换可能导致用户在不知情下用了意料之外的模型。
- 显式提示让用户保持对当前生效配置的控制权。

### 决策 7：导入存档不校验 activePresetId

**选择**：
- 导入存档时，`user.activePresetId` 原样接受，不校验是否指向本地存在的预设。
- 若无效，在启动诵经时由前置校验拦截并提示用户选择。

**理由**：
- 导入逻辑保持简单，职责单一（只做数据搬运）。
- 校验延迟到使用时，符合"无效数据视为不存在"的自然语义。
- 避免导入时遍历本地预设列表增加复杂度。

### 决策 8：serverUrl 拆分独立存储

**选择**：
- 新增 `aichanting_server_url_v1` 存储 serverUrl 字符串。
- 移除 `aichanting_api_config_v1`（应用未发布，直接删）。
- `loadApiConfig` / `saveApiConfig` 移除，新增 `loadServerUrl` / `saveServerUrl`。
- serverUrl 的 UI 输入框和"change 即保存"行为不变。

**理由**：
- serverUrl 语义上与模型配置无关，拆分后模型配置存储完全独立。
- 符合用户明确表述的"serverUrl 另行储存，和模型配置无关"。

## Risks / Trade-offs

- **[预设列表含 apiKey 随存档导出]** 存档文件包含 API 密钥，分享存档会泄露密钥。
  → 缓解：导出时明确提示用户"含 API 密钥等敏感信息，请勿分享"；用户对自有存档负责。

- **[导入存档 activePresetId 可能无效]** 导入他人存档后，activePresetId 指向本地不存在的预设。
  → 缓解：诵经前校验拦截，提示用户选择；UI 上 radio 无选中项，用户自然知道需重新选。

- **[诵经中保护可能让用户困惑]** 用户想修改当前配置却发现按钮禁用。
  → 缓解：禁用按钮可加 tooltip 提示"诵经中不可修改当前配置"；本次实现可选 tooltip，至少保证禁用状态视觉清晰。

- **[order 字段维护成本]** 置顶/取消置顶/删除后 order 可能出现空洞。
  → 缓解：order 空洞不影响排序正确性（只比较相对大小）；无需压缩重排，降低复杂度。

- **[JSDoc 类型不强制]** 纯 JS 无编译期类型检查，类型错误运行时才暴露。
  → 缓解：VS Code 提供 JSDoc 智能提示；未来 TS 迁移后获得编译期检查。

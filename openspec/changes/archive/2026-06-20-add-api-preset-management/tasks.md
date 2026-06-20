## 1. 类型定义与存储层

- [x] 1.1 在 `src/api.js` 顶部用 JSDoc 定义 `ApiPreset` 类型（含 id、name、apiType、provider、apiKey、endpoint、model、pinned、order、createdAt、updatedAt 字段）
- [x] 1.2 在 `src/storage.js` 新增 `PRESETS_KEY = 'aichanting_api_presets_v1'` 和 `SERVER_URL_KEY = 'aichanting_server_url_v1'` 常量
- [x] 1.3 在 `src/storage.js` 新增 `loadPresets()` 函数：从 localStorage 读取预设数组，无值返回 `[]`
- [x] 1.4 在 `src/storage.js` 新增 `savePresets(list)` 函数：将预设数组写入 localStorage
- [x] 1.5 在 `src/storage.js` 新增 `getPreset(id)` 函数：根据 id 查找单个预设
- [x] 1.6 在 `src/storage.js` 新增 `addPreset(preset)` 函数：追加预设并持久化
- [x] 1.7 在 `src/storage.js` 新增 `updatePreset(preset)` 函数：更新对应 id 的预设并持久化
- [x] 1.8 在 `src/storage.js` 新增 `deletePreset(id)` 函数：删除对应 id 的预设并持久化
- [x] 1.9 在 `src/storage.js` 新增 `loadServerUrl()` 函数：从 `aichanting_server_url_v1` 读取，无值返回默认 `http://localhost:3000`
- [x] 1.10 在 `src/storage.js` 新增 `saveServerUrl(url)` 函数：写入 `aichanting_server_url_v1`
- [x] 1.11 从 `src/storage.js` 移除 `loadApiConfig` / `saveApiConfig` 函数及其在 `global.StorageManager` 的导出
- [x] 1.12 在 `src/storage.js` 的 `clearAll()` 中移除旧 `API_CONFIG_KEY` 清理，新增 `PRESETS_KEY` 和 `SERVER_URL_KEY` 的清理
- [x] 1.13 在 `src/storage.js` 的 `global.StorageManager` 导出新增的 presets 和 serverUrl 相关函数

## 2. api.js 改造

- [x] 2.1 将 `createApiClient(options)` 的参数名改为 `createApiClient(preset)`，内部从 `preset.apiType` / `preset.provider` / `preset.apiKey` / `preset.endpoint` / `preset.model` 读取字段
- [x] 2.2 确认 `createApiClient` 内部逻辑（getProviderConfig、buildHeaders、buildBody、chat、abort）无需其他改动
- [x] 2.3 在 `global.ApiModule` 导出新增 `ApiPreset` 类型定义（通过 JSDoc 暴露）

## 3. user.js 适配

- [x] 3.1 在 `src/user.js` 的 `createUser()` 函数中，user 对象新增 `activePresetId: null` 字段
- [x] 3.2 在 `src/user.js` 的 `migrateUser()` 函数中，若 user 对象无 `activePresetId` 字段则补 `null`
- [x] 3.3 确认 `isValidUser()` 是否需要校验 `activePresetId`（推荐：不校验，允许 null）

## 4. index.html DOM 重构

- [x] 4.1 将 API 配置区（原 `#api-config-panel` 内的表单字段）替换为预设列表容器：`#preset-list`（`max-h-64 overflow-y-auto`）+ `#btn-add-preset` 按钮
- [x] 4.2 保留 server-url 输入框 `#server-url` 在 API 配置区内，位置不变
- [x] 4.3 新增预设表单 modal：`#preset-modal`，复用 devotion-modal 样式（`fixed inset-0 bg-black/50` + `card max-w-md` + 右上角 × 按钮）
- [x] 4.4 在 `#preset-modal` 内新增表单字段：`#preset-name`（显示名称）、`#api-type`（API 格式）、`#api-provider`（服务商）、`#api-key`（密钥）、`#api-endpoint`（端点）、`#api-model`（模型）
- [x] 4.5 在 `#preset-modal` 内新增"取消"和"保存"按钮，以及 modal 标题元素（用于切换"新增/编辑"文案）
- [x] 4.6 移除原 API 配置区的 `#api-type`、`#api-provider`、`#api-key`、`#api-endpoint`、`#api-model` 元素（已移入 modal）

## 5. ui.js 渲染与交互

- [x] 5.1 新增 `renderPresetList(presets, activePresetId, isChanting)` 函数：按 pinned+order 排序渲染列表项，每项含 radio、name、provider·model、操作按钮（置顶/取消置顶、上移、下移、编辑、删除）
- [x] 5.2 在 `renderPresetList` 中处理空列表：显示"暂无模型配置，请新增"
- [x] 5.3 在 `renderPresetList` 中处理 name === model 的情况：只显示一次，避免重复
- [x] 5.4 在 `renderPresetList` 中处理诵经中状态：当前 active 预设的编辑/删除按钮禁用，其他预设正常
- [x] 5.5 新增 `openPresetModal(mode, preset)` 函数：mode 为 `'add'` 或 `'edit'`；add 时清空表单、apiType 默认 openai、渲染 provider；edit 时填充 preset 数据
- [x] 5.6 新增 `closePresetModal()` 函数：隐藏 modal
- [x] 5.7 新增 `getPresetFormData()` 函数：从 modal 表单读取 { name, apiType, provider, apiKey, endpoint, model }
- [x] 5.8 修改 `renderProviderOptions(apiType, selectedKey)` 适配 modal 内的 `#api-provider` 元素（元素 id 不变，但位置移到 modal 内）
- [x] 5.9 移除旧 `getApiConfig()` 函数（散字段读取逻辑不再需要）
- [x] 5.10 修改 `getServerUrl()` 改为从 `Storage.loadServerUrl()` 读取（或保持从 `#server-url` 输入框读取，但初始化时用 loadServerUrl 填充）
- [x] 5.11 在 `global.UiModule` 导出新增的 preset 相关函数

## 6. app.js 逻辑层

- [x] 6.1 移除 `loadApiConfigToUI()` 函数，新增 `loadServerUrlToUI()`：从 `Storage.loadServerUrl()` 读取并填充 `#server-url` 输入框
- [x] 6.2 移除 `saveCurrentApiConfig()` 函数，新增 `saveServerUrlFromUI()`：从 `#server-url` 读取并调用 `Storage.saveServerUrl()`
- [x] 6.3 新增 `getActivePreset()` 函数：从 `user.activePresetId` 查找对应预设，找不到返回 null
- [x] 6.4 新增 `setActivePreset(id)` 函数：设置 `user.activePresetId`，保存 user，刷新列表渲染
- [x] 6.5 新增 `handleAddPreset()` 函数：打开 modal（add 模式）
- [x] 6.6 新增 `handleEditPreset(id)` 函数：打开 modal（edit 模式，填充预设数据）
- [x] 6.7 新增 `handleSavePreset()` 函数：读取表单数据，校验必填字段（apiKey、model），name 为空时默认填 model；add 模式生成新预设（id 用 User.generateGUID()，pinned=false，order=非置顶组最大+1，createdAt/updatedAt=Date.now()）；edit 模式更新对应预设（updatedAt=Date.now()）；保存后关闭 modal 并刷新列表
- [x] 6.8 新增 `handleDeletePreset(id)` 函数：删除预设；若删的是 active，置 `user.activePresetId=null` 并提示用户重新选择；刷新列表
- [x] 6.9 新增 `handleTogglePin(id)` 函数：切换 pinned 状态，调整 order（置顶时 order=置顶组最大+1，取消置顶时 order=非置顶组最大+1）；刷新列表
- [x] 6.10 新增 `handleMoveUp(id)` / `handleMoveDown(id)` 函数：交换相邻同组项的 order；刷新列表
- [x] 6.11 新增 `handleSelectPreset(id)` 函数：radio 选中事件，调用 `setActivePreset(id)`
- [x] 6.12 修改 `startChanting()`：移除从 UI 读取 apiConfig 的逻辑，改为 `getActivePreset()`；校验 activePresetId 有效（非 null 且预设存在），无效时提示"请先选择模型配置"并 return；有效时 `Api.createApiClient(preset)` 创建客户端
- [x] 6.13 修改 `setupEvents()`：移除旧 api 字段的 change 事件绑定；新增 `#btn-add-preset` 点击绑定 `handleAddPreset`；新增 `#server-url` change 绑定 `saveServerUrlFromUI`；新增 modal 内"保存"按钮绑定 `handleSavePreset`、"取消"按钮和 × 按钮和遮罩绑定 `closePresetModal`；新增 `#api-type` change 事件重新渲染 provider
- [x] 6.14 新增 `setupPresetListEvents()` 函数：使用事件委托绑定 `#preset-list` 内的 radio/编辑/删除/置顶/上移/下移按钮点击（通过 data 属性传递 preset id）
- [x] 6.15 修改 `setupUI()`：调用 `loadServerUrlToUI()` 替代 `loadApiConfigToUI()`；调用 `renderPresetList()` 渲染初始列表
- [x] 6.16 修改 `stopChanting()` / `chantingLoop()` 结束时：刷新预设列表渲染（解除 active 预设的按钮禁用状态）

## 7. 验证

- [x] 7.1 启动应用，确认 API 配置区显示空预设列表 + "新增模型配置"按钮 + server-url 输入框
- [x] 7.2 点击"新增模型配置"，确认 modal 弹出空表单，apiType 默认 openai，provider 下拉正确
- [x] 7.3 填写表单保存，确认预设出现在列表中，name 默认为 model 值
- [x] 7.4 点击"编辑"，确认 modal 填充该预设数据，修改后保存确认更新生效
- [x] 7.5 点击 radio 选中某预设，确认 `user.activePresetId` 写入 localStorage
- [x] 7.6 未选中预设时点击"开始诵经"，确认提示"请先选择模型配置"且不启动
- [x] 7.7 选中有效预设后点击"开始诵经"，确认正常启动诵经循环
- [x] 7.8 诵经中确认当前 active 预设的编辑/删除按钮禁用，其他预设可操作
- [x] 7.9 诵经中确认所有预设的 radio 均禁用，无法切换 active 预设
- [x] 7.10 点击"置顶"，确认预设移到列表顶部；点击"取消置顶"，确认移回非置顶组
- [x] 7.11 点击"上移/下移"，确认同组内顺序变化正确
- [x] 7.12 删除当前 active 预设，确认 activePresetId 置 null，提示用户重新选择
- [x] 7.13 修改 server-url 输入框，确认写入 `aichanting_server_url_v1`（而非旧 api_config key）
- [x] 7.14 导出存档，确认 user 含 activePresetId，存档含 presets 字段（含 apiKey），导出提示含敏感信息请勿分享
- [x] 7.15 导入存档后刷新页面，确认预设列表恢复，activePresetId 原样恢复（即使指向不存在的预设）
- [x] 7.16 切换 apiType（openai ↔ anthropic），确认 provider 下拉重新渲染
- [x] 7.17 表单必填字段（apiKey、model）缺失时保存，确认被阻止并提示
- [x] 7.18 运行后端 `npm test`（若存在）确认无回归

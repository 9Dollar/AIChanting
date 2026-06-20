## ADDED Requirements

### Requirement: 模型配置预设存储

系统 SHALL 在 localStorage 中以 `aichanting_api_presets_v1` 键存储模型配置预设列表，数据结构为 `ApiPreset` 对象数组。每个预设 SHALL 包含字段：`id`（GUID）、`name`（显示名称）、`apiType`（`'openai'` 或 `'anthropic'`）、`provider`、`apiKey`、`endpoint`、`model`、`pinned`（布尔）、`order`（数字）、`createdAt`、`updatedAt`。

预设列表 SHALL 随用户存档导出（含 apiKey）。导出时系统 SHALL 提示用户存档包含 API 密钥等敏感信息，请勿分享。

#### Scenario: 新增预设写入 localStorage

- **WHEN** 用户在 modal 表单中填写完预设信息并点击"保存"
- **THEN** 系统 SHALL 生成 GUID 作为 `id`，设置 `pinned=false`、`order=非置顶组最大order+1`（首项为0）、`createdAt` 和 `updatedAt` 为当前时间戳
- **AND** 将新预设追加到 `aichanting_api_presets_v1` 数组并立即写入 localStorage

#### Scenario: 预设列表为空时的存储

- **WHEN** localStorage 中无 `aichanting_api_presets_v1` 键或值为空数组
- **THEN** 系统 SHALL 将预设列表视为空数组 `[]`

#### Scenario: 导出存档包含预设列表

- **WHEN** 用户点击"导出存档"，且存在含 apiKey 的预设
- **THEN** 系统 SHALL 弹出确认对话框，提示"导出的存档包含 API 密钥等敏感信息，请勿分享"
- **AND** 用户确认后 SHALL 将预设列表（含 apiKey）写入存档文件的 `presets` 字段并完成下载
- **AND** 用户取消则中止导出

#### Scenario: 导入存档恢复预设列表

- **WHEN** 用户导入存档，且存档中 `presets` 字段非空
- **THEN** 系统 SHALL 将存档中的预设列表写入 localStorage 的 `aichanting_api_presets_v1` 键
- **AND** 刷新预设列表渲染

#### Scenario: 导入存档无预设列表

- **WHEN** 用户导入存档，且存档中无 `presets` 字段或为空数组
- **THEN** 系统 SHALL 保持本地现有预设列表不变

### Requirement: 预设 CRUD 操作

系统 SHALL 提供预设的新增、读取、更新、删除操作，所有操作 SHALL 立即持久化到 localStorage。

#### Scenario: 新增预设

- **WHEN** 用户点击"新增模型配置"按钮，填写表单并保存
- **THEN** 系统 SHALL 创建新预设并追加到列表末尾（按 order）

#### Scenario: 编辑预设

- **WHEN** 用户点击某预设的"编辑"按钮，修改表单并保存
- **THEN** 系统 SHALL 更新该预设的 `name`、`apiType`、`provider`、`apiKey`、`endpoint`、`model` 字段，并更新 `updatedAt` 为当前时间戳
- **AND** SHALL NOT 改变 `id`、`pinned`、`order`、`createdAt`

#### Scenario: 删除预设

- **WHEN** 用户点击某预设的"删除"按钮
- **THEN** 系统 SHALL 从列表中移除该预设并立即持久化
- **AND** 若该预设是当前 active 预设，SHALL 将 `user.activePresetId` 置为 `null`

#### Scenario: 读取预设列表

- **WHEN** 系统需要渲染列表或查询预设
- **THEN** 系统 SHALL 从 localStorage 读取 `aichanting_api_presets_v1` 并返回数组

### Requirement: 预设显示名称默认值

系统 SHALL 允许用户为预设设置自定义显示名称。当用户未填写显示名称时，系统 SHALL 使用 `model` 字段值作为显示名称。

#### Scenario: 保存时未填写显示名称

- **WHEN** 用户在表单中未填写"显示名称"字段，但填写了"模型"字段，点击保存
- **THEN** 系统 SHALL 将 `name` 字段设置为 `model` 字段的值

#### Scenario: 保存时填写了显示名称

- **WHEN** 用户在表单中填写了"显示名称"字段
- **THEN** 系统 SHALL 使用用户填写的值作为 `name` 字段

### Requirement: 当前生效预设选择

系统 SHALL 通过 `user.activePresetId` 字段记录当前选中的预设 id。用户 SHALL 能通过列表项的 radio 选择某个预设为当前生效配置。选择操作 SHALL 立即持久化到 localStorage。

`user.activePresetId` SHALL 随用户数据导出/导入。

#### Scenario: 选择预设为当前生效配置

- **WHEN** 用户点击某预设项的 radio
- **THEN** 系统 SHALL 将 `user.activePresetId` 设置为该预设的 `id`
- **AND** 立即保存 user 数据到 localStorage

#### Scenario: 页面加载恢复选中状态

- **WHEN** 页面加载时读取 user 数据
- **THEN** 系统 SHALL 从 `user.activePresetId` 恢复列表的 radio 选中状态

#### Scenario: 导入存档后 activePresetId 原样接受

- **WHEN** 用户导入存档，存档中的 `user.activePresetId` 指向本地不存在的预设
- **THEN** 系统 SHALL 原样保留该 `activePresetId` 值，不校验有效性
- **AND** 在启动诵经时由前置校验拦截

### Requirement: 预设排序

系统 SHALL 支持预设的置顶和手动排序。排序规则：`pinned=true` 的预设排在 `pinned=false` 之前；同组内按 `order` 字段升序排列。

#### Scenario: 新增预设的默认排序值

- **WHEN** 用户新增一个预设
- **THEN** 系统 SHALL 设置 `pinned=false`，`order=非置顶组中最大 order + 1`（首项为 0）

#### Scenario: 置顶预设

- **WHEN** 用户点击某非置顶预设的"置顶"按钮
- **THEN** 系统 SHALL 将该预设 `pinned` 设为 `true`，`order` 设为置顶组最大 order + 1（首项为 0）
- **AND** 立即持久化并刷新列表渲染

#### Scenario: 取消置顶

- **WHEN** 用户点击某置顶预设的"取消置顶"按钮
- **THEN** 系统 SHALL 将该预设 `pinned` 设为 `false`，`order` 设为非置顶组最大 order + 1
- **AND** 立即持久化并刷新列表渲染

#### Scenario: 上移预设

- **WHEN** 用户点击某预设的"上移"按钮，且该预设不是同组的第一项
- **THEN** 系统 SHALL 交换该预设与前一项的 `order` 值
- **AND** 立即持久化并刷新列表渲染

#### Scenario: 下移预设

- **WHEN** 用户点击某预设的"下移"按钮，且该预设不是同组的最后一项
- **THEN** 系统 SHALL 交换该预设与后一项的 `order` 值
- **AND** 立即持久化并刷新列表渲染

### Requirement: 预设列表 UI 渲染

系统 SHALL 在 API 配置折叠面板内默认显示预设列表。列表项 SHALL 显示：radio 选中控件、预设显示名称与 model（第一行）、provider 名称（第二行）、操作按钮（置顶/取消置顶、上移、下移、编辑、删除）。

列表区 SHALL 支持 `max-h-64 overflow-y-auto` 滚动。列表为空时 SHALL 显示"暂无模型配置，请新增"提示和"新增模型配置"按钮。

#### Scenario: 渲染非空列表

- **WHEN** 预设列表非空
- **THEN** 系统 SHALL 按 pinned+order 排序渲染所有预设项
- **AND** 每项第一行显示 `name · model`，第二行显示 provider 名称，以及 radio（选中态反映 `user.activePresetId`）和操作按钮

#### Scenario: 渲染空列表

- **WHEN** 预设列表为空
- **THEN** 系统 SHALL 显示"暂无模型配置，请新增"提示
- **AND** 显示"新增模型配置"按钮

#### Scenario: 列表项显示名称与 model 相同时

- **WHEN** 某预设的 `name` 等于 `model`
- **THEN** 第一行 SHALL 只显示一次该值（不重复拼接），避免重复

### Requirement: 预设表单 Modal

系统 SHALL 提供预设表单的 modal 弹出框，复用现有 devotion-modal 的统一样式（`fixed inset-0 bg-black/50` + `card max-w-md` + 右上角 × 按钮）。Modal 在点击"新增"或"编辑"时弹出，保存或取消时关闭。

Modal 关闭方式 SHALL 支持三种：点击遮罩、点击 × 按钮、点击"取消"按钮。

#### Scenario: 点击新增弹出空表单

- **WHEN** 用户点击"新增模型配置"按钮
- **THEN** 系统 SHALL 弹出 modal，标题为"新增模型配置"
- **AND** 表单字段为空，apiType 默认 `openai`，provider 下拉渲染 openai 格式的 provider 列表

#### Scenario: 点击编辑弹出填充表单

- **WHEN** 用户点击某预设的"编辑"按钮
- **THEN** 系统 SHALL 弹出 modal，标题为"编辑模型配置"
- **AND** 表单字段 SHALL 填充该预设的 name、apiType、provider、apiKey、endpoint、model 值

#### Scenario: 切换 API 格式时重新渲染 provider

- **WHEN** 用户在 modal 表单中切换 apiType（openai ↔ anthropic）
- **THEN** 系统 SHALL 重新渲染 provider 下拉选项为对应格式的 provider 列表

#### Scenario: 点击遮罩关闭 modal

- **WHEN** 用户点击 modal 外部遮罩区域
- **THEN** 系统 SHALL 关闭 modal，不保存表单数据

### Requirement: 表单必填校验

系统 SHALL 对预设表单进行必填校验。必填字段：API 格式、服务商、API 密钥、模型。可选字段：显示名称（空则默认填 model）、端点（空则使用 provider 默认端点）。

#### Scenario: 必填字段缺失时保存

- **WHEN** 用户未填写 API 密钥或模型字段，点击"保存"
- **THEN** 系统 SHALL 阻止保存并提示用户填写必填字段

#### Scenario: 必填字段齐全时保存

- **WHEN** 用户填写了所有必填字段，点击"保存"
- **THEN** 系统 SHALL 保存预设并关闭 modal

### Requirement: 诵经前置校验

系统 SHALL 在启动诵经前校验 `user.activePresetId` 有效（非 null 且对应预设存在于 localStorage）。校验失败时 SHALL 阻止启动诵经并提示用户。

#### Scenario: 未选择预设时启动诵经

- **WHEN** 用户点击"开始诵经"，且 `user.activePresetId` 为 `null`
- **THEN** 系统 SHALL 阻止启动并提示"请先选择模型配置"

#### Scenario: activePresetId 指向不存在的预设

- **WHEN** 用户点击"开始诵经"，`user.activePresetId` 非 null 但对应预设已被删除
- **THEN** 系统 SHALL 阻止启动并提示"请先选择模型配置"

#### Scenario: 有效预设时启动诵经

- **WHEN** 用户点击"开始诵经"，`user.activePresetId` 指向一个存在的预设
- **THEN** 系统 SHALL 使用该预设创建 apiClient 并启动诵经循环

### Requirement: 诵经中操作保护

系统 SHALL 在诵经进行中（`isChanting === true`）禁用所有预设的 radio 切换操作，并禁用当前 active 预设的全部操作按钮（置顶/取消置顶、上移、下移、编辑、删除）。非 active 预设的所有操作 SHALL 保持可用。新增预设 SHALL 保持可用。

#### Scenario: 诵经中尝试切换预设

- **WHEN** 诵经进行中，用户点击任意预设的 radio
- **THEN** 该 radio SHALL 处于禁用状态，点击无响应（防止切换影响进行中的会话语义）

#### Scenario: 诵经中尝试操作当前 active 预设

- **WHEN** 诵经进行中，用户点击当前 active 预设的任意操作按钮（置顶/取消置顶、上移、下移、编辑、删除）
- **THEN** 该按钮 SHALL 处于禁用状态，点击无响应

#### Scenario: 诵经中编辑其他预设

- **WHEN** 诵经进行中，用户点击非 active 预设的"编辑"按钮
- **THEN** 系统 SHALL 允许编辑该预设

### Requirement: serverUrl 独立存储

系统 SHALL 将同步服务器地址存储在独立的 localStorage 键 `aichanting_server_url_v1`，与模型配置预设存储解耦。serverUrl 的 UI 输入框和"change 即保存"行为 SHALL 保持不变。

#### Scenario: 读取 serverUrl

- **WHEN** 系统需要获取同步服务器地址
- **THEN** 系统 SHALL 从 `aichanting_server_url_v1` 读取，无值时返回默认值 `http://localhost:3000`

#### Scenario: 保存 serverUrl

- **WHEN** 用户修改 serverUrl 输入框
- **THEN** 系统 SHALL 将新值立即写入 `aichanting_server_url_v1`

### Requirement: createApiClient 接收 preset 对象

系统 SHALL 将 `createApiClient` 的入参从散字段改为接收 `ApiPreset` 类型对象。函数内部 SHALL 从 preset 对象读取 `apiType`、`provider`、`apiKey`、`endpoint`、`model` 字段。

#### Scenario: 用 active 预设创建 apiClient

- **WHEN** 用户启动诵经，系统已校验 active 预设有效
- **THEN** 系统 SHALL 将该 preset 对象直接传入 `createApiClient(preset)`
- **AND** `createApiClient` 内部从 preset 读取字段创建 API 客户端

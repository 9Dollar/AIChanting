## Requirements

### Requirement: 全局操作队列串行化写操作

后端 SHALL 通过一个进程内全局操作队列，串行化所有对数据库的写操作（`upsertUser` / `upsertModel`），确保同一记录的并发更新不会丢失或脏读。

#### Scenario: 并发写同一用户记录

- **WHEN** 两个请求几乎同时到达，均调用 `POST /api/user/merit` 更新同一 `userId`
- **THEN** 后端 SHALL 通过全局队列将两次写操作串行执行
- **AND** 第二次写操作在第一次完成后才开始
- **AND** 最终该用户的 `total_merit` 反映最后一次（覆盖式）写入的值

#### Scenario: 并发写同一模型记录

- **WHEN** 两个请求几乎同时到达，均调用 `POST /api/model/merit` 更新同一 (provider, model)，分别传入增量 `260` 和 `500`
- **THEN** 后端 SHALL 通过全局队列串行执行两次累加
- **AND** 最终该模型的 `total_merit` 为原值 + 260 + 500（两次增量都被保留，无丢失）

#### Scenario: 写操作不阻塞读操作

- **WHEN** 队列中有一个写操作正在执行，同时到达一个 `GET /api/user/ranking` 读请求
- **THEN** 读请求 SHALL 不被队列阻塞（读操作不入队）
- **AND** 读请求返回当前数据库快照（`better-sqlite3` 同步读，天然一致）

### Requirement: 操作队列实现为 Promise 链

并发保护 SHALL 通过单条 Promise 链实现：每个写操作以 `queue = queue.then(() => doWrite())` 方式追加，保证写操作按入队顺序串行执行。

#### Scenario: 队列实现方式

- **WHEN** 开发者查看后端 db 层实现
- **THEN** SHALL 看到一个全局 `writeQueue` Promise 变量
- **AND** `upsertUser` 和 `upsertModel` 的实际写操作通过 `enqueueWrite(fn)` 包装入队
- **AND** 入队函数返回 Promise，resolve 时携带写操作结果，reject 时携带错误

#### Scenario: 写操作失败不影响后续写

- **WHEN** 队列中某个写操作抛出异常
- **THEN** 该异常 SHALL 传播给该操作的调用方（HTTP 500）
- **AND** 队列 SHALL 继续处理后续写操作（不被前一个失败阻塞）

### Requirement: 读操作不经过队列

`getUserRanking` / `getModelRanking` 等读操作 SHALL NOT 经过全局写队列，直接读取数据库。

#### Scenario: 读操作直接执行

- **WHEN** 调用 `getUserRanking` 或 `getModelRanking`
- **THEN** SHALL 直接调用 `db.prepare(...).all()`，不经过 `writeQueue`
- **AND** 读操作立即返回，无排队延迟

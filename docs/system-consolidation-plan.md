# 整套系统统一与精简方案

日期：2026-09-09。状态：**第 1 阶段、2A、字段归属检查点 2B、continuation/连接归属检查点 2C、旧 project-graph query-index 产品退出及 task-lineage add-on 隔离检查点均已完成自检；前五项已通过独立验收，add-on 隔离等待独立验收；未生成或发布生产图，整套统一仍未完成**。

本文是唯一的整套收敛方案和盘点清单。第 1 阶段只读取源码、查询当前已发布的 data-graph 并更新本文；2A 仅迁移调度证据缓存模块及 import；2B 仅迁移字段解释共享内核与 task-local 投影 helper 的归属；2C 仅迁移 continuation/index 与 Neo4j 连接实现的归属。三个检查点都没有改变图语义，也没有生成或发布生产投影；2B、2C 只在仓库外临时目录生成了验证样例。

## 1. 本阶段结论

最终正式主线建议固定为：

```text
平台取证 / 本地缓存
  -> Task/Table Input Pack
  -> SQLLens + Plan Facts
  -> Machine Facts
  -> TASK_LOCAL_PROJECTION
  -> read occurrence × write observation continuation index
  -> data-graph asset-graph 编译 / 发布
  -> 同一查询能力供 JSON CLI、HTTP 和 React Flow 前端消费
```

其中正式 data-graph 是 `packages/data-graph/src/asset-graph/`，不是通用 Query Knowledge Graph，也不是 `packages/data-graph/src/project-graph/` 下旧的 topology / field-evidence / target-causal-overlay / query-index 产品组合。

本次推荐不是把全部旧能力搬进新目录：

- 保留并强化真正的事实主链、任务局部投影、读次/写次接续和 data-graph 发布查询。
- one-hop、multi-hop、per-root field-lineage、field-evidence 查询、自动补包/闭包、`lineage:all` 和专属查看器已明确为早期 target-oriented 实验链，整体归入 `scripts/addons/task-lineage/`，不再属于正式 data-graph 生产路径。其现有能力和产物合同暂保留为显式 opt-in add-on；是否继续精简其中低价值分支须按使用证据单独裁决，不因搬入 add-on 自动永久保留。
- 旧 project-graph 产品链先迁走 asset-graph 正在复用的 continuation 内核和 Neo4j 连接边界；旧投影、旧 file/query-index 产品及九项旧查询须按算法、Facts、索引/发布生命周期和仓库外消费者分别裁决，不能仅以“有 standalone CLI”认定重复。
- target-field causal slice、target-table causal closure / overlay 与 Inventory Map 有独有能力，但当前缺少真实用户旅程和收益证据，暂不裁决，更不默认纳入高成本迁移。
- 业务知识正文可以保留为内容资产，但不因此保留第二套图、第二套索引和第二套前端。

## 2. 第 1 阶段基线

### 2.1 Git 与工作树

基线采集时间为 `2026-09-09T09:40:48+08:00`：

- 分支：`main`，跟踪 `origin/main`。
- HEAD：`00f961c436e46db8c71832531a173ebedec81359`（`fix: clarify partition-scoped lineage gaps`）。
- 暂存区无改动。
- 已跟踪但未提交：50 个文件；分布在采集、Machine Facts、task-local、asset-graph、文档、配置和测试，约 `+2197/-379`（盘点时统计，未含未跟踪文件）。
- 未跟踪状态项：71 个；`git ls-files --others --exclude-standard` 返回 8,054 个文件。大头包含 `field-facts/`、`docs/data-graph-derived-2.0/`、整个 `packages/data-graph-ui/`、若干当前 asset-graph 源码/测试、配置、临时目录和编译旁路文件。
- `docs/system-consolidation-plan.md` 在本阶段开始前已经是未跟踪文件，原始 SHA-256 为 `b56acedfcfd91e3e768e3ed3d98d7d8777d5bd2fa52b0cceadb72c7e6c7d5c6c`。本阶段只修改这一份既有文件。
- 复核期间出现并发漂移：`scripts/experiments/conditioned-value-path-spike/` 于 `2026-09-09 09:58:35` 新增，不属于 09:40:48 初始基线，也不是本阶段创建或修改的内容；复核时未跟踪状态项变为 72 个、文件变为 8,063 个。该目录保持原样，不能并入本阶段结论或清理范围。

这些数量不是删除依据。尤其 `packages/data-graph-ui/` 和多个 asset-graph 文件虽未跟踪，却属于当前产品实现；`scripts/survey/` 虽无 npm 入口且未纳入 tracked 清单，仍被多个 `scripts/input/mainline/run-*.ts` 直接调用。第 2 阶段不要求提交、整理或清除这 50 个修改及其他人的未跟踪文件；只需在开工时重新记录全局 `git status --short`、HEAD、2A 文件范围的 `git diff --name-only`，并用范围内文件 hash/补丁快照做前后比对。不能从 HEAD 新建干净工作树后假装当前实现已被包含，也不能把无关脏改动纳入 2A。

### 2.2 当前 data-graph 发布与有界能力查询

正式入口为根仓库 `npm run graph:query -- <command>`，配置选中 `titans-otc` profile / graph。2026-09-09 现场只读结果：

- 状态 `READY`，发布版本 `fd7070e0a37c10e99ec235fdd0db10f355c581d0a2e5679410d95d9cc984489a`，compiler `1.0.9`，发布时间 `2026-09-08T09:41:23.549Z`。
- 7,039 个任务：5,600 `PROJECTED`、1,324 `SCHEDULE_ONLY`、115 `COLLECTION_FAILED`。其中 977 是预期 schedule reference，462 是 material gap。
- 当前有 16,873 个读次；6,408 个至少存在一条 L1 接续，6,052 个全部为 L1。确认字段接续 56,445 条、候选接续 60,785 条；这些是静态投影统计，不代表运行成功、数据到达或业务正确。
- `86840` 的 schedule 上游一跳：27 节点、26 条 `SCHEDULE` 边，均为 `SCHEDULE_REFERENCE_ONLY`；未截断，因深度 1 停止。这证明有界调度导航可用，不证明 26 个父任务都是数据生产者。
- `86842.init_nom_prin` 的 confirmed-only 上游字段查询：11 节点、10 边，其中 6 `VALUE`、4 `CONTINUES`；未截断。向下深度 4：43 节点、43 边，其中 28 `VALUE`、15 `CONTINUES`，因深度上限停止。因此“向下影响”接口可遍历，但该结果不是完整闭包。
- `93338` 对 `dyna_nom_prin` 的 processing 查询返回 15 个匹配表达式并正常分页；抽查表达式同时保留公式、关系 ID、两个物理输入字段和 source span。查询响应的 `projectionGenerations=0`，说明查询没有触发投影生成。
- 本地 HTTP `/api/status` 本轮不可达；React UI 真实消费链未现场验收。当前后端 CLI 支持 table、field、schedule 有界查询，但 React UI 的 `GraphLayer` 和界面选项只实现 table、field。CLI 直连图成功不能替代 HTTP/浏览器验收，也不能证明 schedule 人工旅程已有前端承接。

因此，版本、READY、节点数和接口成功只构成运行证据。能力验收必须检查锚点、边种类、候选/确认边界、分页/截断、证据引用和不生成投影。

## 3. 正式入口、实际调用链与测试映射

下表中的测试是源码对应关系，不表示本阶段重新运行过。

| 环节          | 正式入口与实际调用链                                                                                                                                         | 独有能力 / 共享依赖                                                                                           | 主要对应测试                                                                                                                     |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 在线采集      | `input-pack:tasks` → `collect-task-input-pack.ts` → `collect-one-task-input-pack.ts` → `task-table-materialization.ts`                                       | 平台适配、任务分类、SQL/表证据采集；共享 Input Pack 校验、终点和分区证据                                      | `collect-one-task-input-pack-*`、`input-pack.test.ts`、`sql-table-references.test.ts`                                            |
| 缓存采集      | `input-pack:from-cache` → `collect-input-pack-from-cache.ts` → `cache-task-evidence.ts` / `offline-table-resolver.ts` → 同一 `task-table-materialization.ts` | 离线可重放、hash 校验；与在线入口共享 Pack 组装，但直接依赖 one-hop 目录内 schedule cache                     | `test:input-pack:from-cache`、`offline-table-resolver.test.ts`、`cache-task-evidence.test.ts`                                    |
| SQL / Plan    | Machine Facts → `SqlSession` / SQLLens → `plans/plan-adapter.ts` → `plan-contract.ts`                                                                        | 单 SQL 的关系、表达式、scope、物理来源、span；不负责跨 Task 接续                                              | `plan-adapter-regression.test.ts`、`plan-scope-plan.test.ts`、`read-occurrence-resolver.test.ts`                                 |
| Machine Facts | `input-pack:machine-facts` → `input-pack-machine-facts.ts` → `machine-facts.ts` / output bindings / JSONL store                                              | 发生次、写观察、关系/表达式、字段绑定和 immutable bundle；`current-task-bundle.ts` 是正式读取边界             | `test:machine-facts`、`input-pack-machine-facts.test.ts`、`pack-declared-write-observation.test.ts`                              |
| 任务局部投影  | `project-task-local` / `graph:prepare` → `projectTaskLocalBatch()` → `projectTaskLocal()`                                                                    | 单任务值、条件、行集控制、读次/写次和覆盖状态；依赖 Machine Facts、Input Pack、field helper、schedule context | `test:task-local-projection`、`tests/project-graph/task-local/*`                                                                 |
| 接续          | `graph:publish` → `taskWriters()` → `buildUnionContinuationIndex()` → `traceUnionTaskContinuationV2()`                                                       | 读次 × 写观察、分区四态、L1/候选、增量 affected tasks；复用 task-local partition canonical                    | `task-local-union-continuation-v2.test.ts`、`union-continuation-index.test.ts`、asset-graph output qualification / metrics tests |
| 图编译/发布   | `graph:prepare` → 固定 task projection/evidence；`graph:publish` → `compileTask()` / continuation / `AssetGraphStore`                                        | 当前唯一 Neo4j asset graph、owner 增量替换、版本和 publication snapshots                                      | `packages/data-graph/tests/asset-graph*.test.ts`、`publication-snapshots.test.ts`、`atomic-file-replace*.test.ts`                |
| Agent 查询    | `graph:query` → `asset-graph/cli.ts` → `AssetGraphStore` / `agent-api.ts` / published continuation metrics                                                   | JSON、分页、有界 trace、processing、候选查询；查询不生成                                                      | asset graph CLI/API/processing/table-hop/terminal traversal tests                                                                |
| HTTP          | `graph:serve` → `service.ts` → 与 CLI 共用 store、detail、overview                                                                                           | 本机 API；当前还自行提供旧 `viewer.html`                                                                      | asset graph API contract / overview / store tests                                                                                |
| React 前端    | `graph:ui` → `packages/data-graph-ui/src/api.ts` → `/api/*` → service/store                                                                                  | 当前唯一建议保留的交互前端；React Flow、表/字段 trace 和 SQL detail；**当前没有 schedule 层 UI**              | UI contract、graph-adapter、multi-field-trace、FieldSelector tests；schedule 旅程尚缺                                            |
| 人工知识      | `knowledge:query` → `task-knowledge.mjs` → authored JSON/Markdown + 可选证据 hash/span 校验                                                                  | 人工业务解释，不重算图；尚未并入正式 graph CLI                                                                | 当前无独立自动测试入口，Inventory Map 间接消费                                                                                   |

工程门禁目前不统一：根 `npm test` 只列出一部分根测试；`test:asset-graph` 仅跑 3 个上游共享测试，并不代表 `packages/data-graph/tests`；UI 是独立 package。收敛后必须给正式主线一个明确的分层测试集合，不能把“默认 npm test 通过”写成全系统通过。

## 4. 共享内核依赖：禁止按目录误删

### 4.1 one-hop 目录被采集和投影反向依赖

迁移前，`scripts/reconcile/consumer/one-hop/schedule-evidence-cache.ts` 被 **41 个非测试源码文件**直接引用，包括采集 shared/mainline、task-local 的 batch selection/schedule context、field-evidence schedule preference、`lineage-all`、one/multi-hop 和旧可视化。统计口径固定为 `scripts packages` 下 `.ts/.mjs/.mts`，排除 `*.test.*`、`*.d.ts`、`node_modules`、`dist`：

```powershell
$files = @(rg -l -g '*.ts' -g '*.mjs' -g '*.mts' -g '!*.test.*' -g '!*.d.ts' -g '!node_modules/**' -g '!dist/**' 'from .*schedule-evidence-cache\.(ts|js)' scripts packages | Sort-Object)
$files.Count
$files
```

精确调用者如下；测试 import 不计入 41，作为迁移验证集合单独处理：

```text
scripts/input/mainline/collect-horae-manual-task-ids.ts
scripts/input/mainline/collect-horae-task-catalog.ts
scripts/input/mainline/collect-horae-topic-task-ids.ts
scripts/input/mainline/collect-input-pack-from-cache.ts
scripts/input/mainline/collect-one-task-input-pack-sparkindex.ts
scripts/input/mainline/diff-input-pack-from-cache.ts
scripts/input/mainline/expand-horae-relation-closure.ts
scripts/input/mainline/export-horae-non-manual-task-ids.ts
scripts/input/mainline/fill-hive-ddl-from-log-cache.ts
scripts/input/mainline/fill-hive-task-sql-cache.ts
scripts/input/mainline/fill-horae-relation-cache.ts
scripts/input/mainline/fill-horae-relation-sqlite.ts
scripts/input/mainline/fill-horae-task-detail-cache.ts
scripts/input/mainline/fill-run-script-sql-cache.ts
scripts/input/mainline/fill-sparkindex-schedule-detail-cache.ts
scripts/input/mainline/fill-szdata-schedule-detail-cache.ts
scripts/input/mainline/fill-upstream-task-type-evidence-loop.ts
scripts/input/mainline/heal-hive-target-ddl-from-log.ts
scripts/input/mainline/hive-ddl-from-log-cache.ts
scripts/input/mainline/hive-task-sql-cache.ts
scripts/input/mainline/import-schedule-evidence-sqlite.ts
scripts/input/mainline/inventory-input-pack-partials.ts
scripts/input/mainline/list-missing-evidence-sqlite.ts
scripts/input/mainline/patch-priority-evidence-cache.ts
scripts/input/mainline/run-schedule-evidence-pack-gap-fill.ts
scripts/input/mainline/run-script-sql-cache.ts
scripts/input/mainline/supervise-horae-relation-sqlite.ts
scripts/input/mainline/szdata-schedule-detail-cache.ts
scripts/input/shared/cache-task-evidence.ts
scripts/input/shared/horae-datasource-cache.ts
scripts/input/shared/manual-task-exclusion.ts
scripts/input/shared/offline-table-resolver.ts
scripts/pipeline/lineage-all.ts
scripts/project-graph/field-evidence-v1/schedule-preference.ts
scripts/project-graph/task-local/batch-selection.ts
scripts/project-graph/task-local/schedule-context.ts
scripts/reconcile/consumer/multi-hop/audit-multi-hop-closure.ts
scripts/reconcile/consumer/multi-hop/reconcile-multi-hop-autofill.ts
scripts/reconcile/consumer/multi-hop/reconcile-multi-hop.ts
scripts/reconcile/consumer/one-hop/reconcile-one-hop.ts
scripts/visualize/horae-relation-tree-explorer.ts
```

2A 已将该模块移到中立证据归属并清除上述反向 import；这只解除了一项共享依赖，不构成 one-hop 产品可删除的充分证据。

### 4.2 task-local 仍直接复用 field-lineage / field-evidence-v1 内核

`project-task-local.ts` 直接使用：

- `field-lineage.ts` 的 `sourceFieldsForExpression()` 与 `fieldConditionalsForExpression()`；
- `field-lineage-contract.ts` 的 `PhysicalFieldIdentity`；
- `field-evidence-v1/field-evidence-emission.ts`、`relation-tree.ts`、`source-read-occurrence.ts`、`subtype-classifier.ts` 的字段发生次归属、集合分支路由、物化展开和 subtype 解释。

这部分已经是 task-local 的实际实现，不是旧 field-lineage 产品的可选附件。还存在一条间接依赖：`project-task-local.ts` → `scripts/reconcile/shared/dataset-controls.ts` → `field-lineage/physical-field-resolver.ts` 与 `field-lineage-contract.ts`。后续必须迁入 task-local/共享字段解释归属，旧 per-root field-lineage 再反向消费该内核；第 2 阶段 2A 不处理这条链。

### 4.3 asset-graph 仍复用旧 project-graph 内核

`asset-graph/publish.ts` 直接依赖旧 `project-graph/topology/task-local-union/` 中的 contract、merge 类型、producer writer、continuation-v2 和 continuation-index；metrics、terminal policy、boundary query 也依赖同一 index contract。`asset-graph/config.ts` 还从旧 `project-graph/query-index/neo4j-query-index-connection.ts` 打开驱动。除此之外，`asset-graph/compile.ts`、`terminal-policy.ts`、`source-endpoint-boundary.ts`、`publication-snapshots.ts` 仍直接引用 multi-hop 的 terminal/source 配置，task-local 的 `anchor-upstream-expansion.ts` 也直接引用 multi-hop terminal 配置。

因此旧 project-graph 产品链只能在共享能力迁移、剩余直接/间接依赖列清并完成各产品能力裁决后退出。现阶段不能删除整个 `project-graph/`，也不能把“某一组 import 已归零”写成全部反向依赖已归零。

## 5. 主要候选项的价值、成本与处置

成本为熟悉仓库工程师的等效工作量；“退出”表示未来阶段的建议，本阶段没有实际删除。

| 候选项                                                        | 当前场景与必要性                                                                                                         | 保留 / 迁移 / 退出成本与影响                                                                               | 可消除的重复职责、模块与验证范围                                                                      | 推荐处置                                                           |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 在线与缓存 Input Pack 主入口                                  | 正式事实入口；在线补证和离线重放都需要                                                                                   | 保留约 0.5–1 日整理入口；退出会使事实主链不可重建；平台差异不强行合成一个取数器                            | 消除重复 Pack 组装与校验；覆盖 `scripts/input/shared`、mainline 两入口及 Input Pack tests             | **保留并明确归属，P0**                                             |
| 批次 repair / survey / fill 脚本                              | 历史缺口修复和批量补证；部分 mainline run 脚本会直接执行 `scripts/survey`                                                | 全保留维护面高；直接删可能失去可恢复批次；逐个迁移价值低。需 0.5–1 日查最近使用                            | 可退出硬编码 cohort、固定路径和一次性验收；验证其调用者和运维记录                                     | **证据不足，P2**。第 2 阶段不碰                                    |
| SQLLens + Plan adapter                                        | Machine Facts 的唯一 SQL 关系事实生产者                                                                                  | 保留成本低；替换/重写 5–8 日以上且会改变语义                                                               | 避免消费器再写 SQL 语义；覆盖 Plan/MF/causal tests                                                    | **保留并明确归属，P0**                                             |
| Machine Facts + current bundle                                | task-local、processing、因果研究的正式发生次/写次证据                                                                    | 保留并收紧读写合同约 0.5 日；退出不可行                                                                    | 清掉消费者私自扫 JSONL/拼 identity；覆盖 MF、bundle、publication evidence                             | **保留并明确归属，P0**                                             |
| task-local 投影                                               | 当前 asset graph 的直接输入，承接值/条件/控制及覆盖状态                                                                  | 保留；迁入共享字段内核 1–1.5 日；退出会迫使发布期重算 Facts                                                | 去掉对旧 field 产品目录的反向依赖；验证 task-local 全套和 goldens                                     | **保留并明确归属，P0**                                             |
| continuation-v2 / index 内核                                  | asset publish 的真实跨任务接续                                                                                           | 移到正式 continuation 约 0.5–1 日；重写风险高                                                              | 结束正式发布依赖旧 topology 子产品；验证 union/index、metrics、terminal/boundary                      | **迁移后保留内核，P0**                                             |
| asset-graph compile/publish/store/CLI/HTTP                    | 当前唯一正式图和 Agent 查询，已现场验证                                                                                  | 保留；统一命令/测试约 1–2 日；退出无替代                                                                   | 取代旧三投影、file query、第二 query-index 和查询期生成                                               | **保留并明确归属，P0**                                             |
| React Flow UI                                                 | 当前交互主线，支持 overview、搜索、字段选择、table/field trace 和 SQL detail；未实现 schedule 层                         | 保留并纳入版本控制/正式测试 0.5–1 日；当前 HTTP 未启动。若要承接调度树旅程还需实现与人工验收               | 可退出已被实际旅程覆盖的 raw HTML；schedule 查看器不能按后端能力替代                                  | **保留，P0**。HTTP/table/field 先验收；schedule 单独决策           |
| `viewer.html`                                                 | `graph:serve` 根路由当前仍会返回它                                                                                       | 继续维护会形成第二前端；service 改为 API-only 或服务 React build 后删除约 0.5 日                           | 消除一套 HTML/JS 交互与契约重复；验证 service root、UI browser journey                                | **迁移后删除，P1**                                                 |
| one-hop 产品与 `input-pack-closure`                           | per-root 调度×表生产者裁决、自动补包；data-graph 主链不读取其产物，但自动补包/对账可能仍有独立运维价值                   | 2A 只迁 schedule cache；若退出，会失去 `finalUpstreamTaskIds.primary`、per-root JSON 和旧自动闭包采集/对账 | 解耦可减少采集依赖 consumer；删除前须确认自动补包是否由正式 collect/prepare 完整承接或明确接受退出    | **2A 迁 cache；产品删除证据不足，P1 决策门**                       |
| legacy producer-index / writer queries                        | one/multi-hop 使用；writer catalog 借其类型/guard。asset publish 已从 task-local/Facts 自建 writers                      | 迁走 writer identity/guard 约 0.5 日；不迁旧全量 index 生产                                                | 消除第二套 `table -> producer` 建库和 fingerprint 生命周期                                            | **迁移必要能力后删除，P1**                                         |
| multi-hop 产品                                                | per-root Task BFS、旧 primary 递归、autofill/audit 和 HTML；data-graph 后端有 table/schedule trace，但 UI 无 schedule 层 | 退出会失去 per-root JSON、自动回填/审计及现有人工调度查看；仅迁配置不能承接这些旅程                        | 可减少一套 BFS/产物/查看器；先区分算法、自动回填、文件合同和 UI 旅程，再分别验收或接受退出            | **配置待迁；产品删除证据不足，P1 决策门**                          |
| field-lineage 产品                                            | per-root 字段路径、physical expansion、legacy HTML；task-local 只依赖少量核心                                            | 迁字段解释/identity；不迁 per-root artifact。退出会失去旧兼容 JSON/renderer                                | 消除第二套字段路径生成；验证 task-local VALUE/CONDITION/CONTROL 与 graph field trace                  | **迁移必要能力后删除，P1**                                         |
| `lineage:all`                                                 | 编排 closure、MF、one-hop、multi-hop、field-lineage 和两套 HTML                                                          | 保留会固化第二条生产链；退出会失去一键闭包、自动补包与 per-root bundle 生命周期                            | 可能消除跨 5 阶段的重复编排、缓存和 manifest；须先证明 collect/Facts/prepare/publish 可承接必要自动化 | **证据不足，P1 决策门**。不默认迁移，也不直接删                    |
| old project-topology / field-evidence projection / file query | 读取 one/multi-hop/field-lineage，发布三套文件投影并提供九项查询                                                         | 完整迁移 3–5 日且大量职责与 asset graph 重叠；退出会失去旧 snapshot/file-query 合同及可能的外部消费者      | 迁出共享内核可减少重复投影/索引；九项查询逐项以消费者、输入 Facts、索引和发布生命周期验收             | **迁共享内核；产品删除证据不足，P1 决策门**                        |
| old query-index                                               | 为旧三投影建另一套 Neo4j namespace/parity；asset graph 只借连接器                                                        | 连接器已在 2C 迁出；保留约 4,465 行和 build/status/query/parity 会继续维护第二生命周期                     | 消除第二个 store、schema、activation 和 parity 产品；九项直接文件查询不退出                           | **已退出并通过独立验收，P1**。仓库外消费者仍未知，退出影响明确记录 |
| standalone union CLIs                                         | 在发布外单独生成 continuation evidence/index；正式 publish 也生成 index，但二者可能服务预发布文件检查或外部脚本          | 若无消费者，退出约 0.25 日；若仍承担独立 evidence/index 生命周期，删除会失去预发布检查与文件合同           | 可能消除第二个 index 入口；须按算法复用、输入 Facts、文件/索引产物和外部调用核对                      | **证据不足，P1**。不能仅凭 standalone 判重                         |
| `scripts/tmp/run-project-task-local-batch.mts`                | 仅用环境变量包装正式 CLI并写 summary；无 npm/源码/文档调用                                                               | 无需迁能力；正式 `project-task-local` 已覆盖                                                               | 消除未校验 env wrapper 和额外写入                                                                     | **有充分依据直接退出，P1**                                         |
| `visualize-horae-relation-tree`                               | 固定路径的调度树离线查看；后端 schedule trace 覆盖数据查询，但 React UI 尚无该层                                         | 退出会失去现有单页人工调度树；承接到 UI 约 0.5–1 日，或由 owner 明确接受退出                               | 可消除硬编码批次路径和第五个查看器；验证必须是浏览器人工旅程                                          | **证据不足，P2**。前端承接或明确退出后再删                         |
| task-local / field-lineage / multi-hop visualizers            | 历史产物的多个离线 HTML；仍有测试和文档入口                                                                              | React UI 对对应 table/field 旅程验收后可退出；multi-hop schedule 旅程尚未承接                              | 可消除多套图布局与语义展示；按 table、field、schedule 分别验收                                        | **条件性迁移后删除，P1**；schedule 不是已完成项                    |
| target-field causal slice                                     | occurrence/write-scoped Plan 与严格 physical expansion                                                                   | 完整产品化 2–4 日；直接删会丢失严格因果语义和 gold tests                                                   | 可能与 task-local 合并，但需要真实 consumer                                                           | **证据不足，P2**。不纳入最小收敛                                   |
| target-table causal closure + overlay                         | 多通道状态、witness、UNKNOWN 原因、目标表闭包                                                                            | 迁入主图 4–6 日；直接退会失去完整目标表因果评估                                                            | 可消除约 6,709 行 closure + 2,149 行 overlay，但收益未验证                                            | **证据不足，P2**。单列决策门                                       |
| Inventory Map                                                 | 最近验证过的 SQLite 调度库存、Hive 元数据、知识与独立网页；与 asset graph 大量重叠                                       | 全迁 2–4 日；直接退会失去 catalog-only、主题规则和 knowledge 阅读；全保留则继续第二套索引/服务/前端        | 旅程对照后只迁已证明缺失的能力                                                                        | **证据不足，P2**。第 2 阶段不碰                                    |
| processing-map / OData / PData builders                       | 固定批次人工导读与离线 HTML，内容价值高但不是实时正式图                                                                  | 保留正文成本低；继续维护 builders 会形成更多前端；退出 builders 不等于删知识                               | 冻结正文/证据索引，停止当产品入口                                                                     | **内容保留、产品入口待退出，P2**                                   |
| standalone `knowledge:query`                                  | authored knowledge + hash/span 校验，尚未融入 graph CLI                                                                  | 迁到 graph detail/CLI 约 0.5–1 日；原样保留会有第二 CLI                                                    | 只迁 loader/验证，不迁 Inventory Map 产品                                                             | **迁移后删除独立入口，P2**                                         |
| 文档、OpenSpec、测试                                          | 大量历史阶段说明与 active change；当前描述多条正式主线                                                                   | 全面改写成本高且风险大；只更新正式索引/运行文档 1–2 日                                                     | 历史计划移出正式入口，行为断言迁到保留实现                                                            | **选择性收敛，P1**。不批量删 `docs/`                               |
| 未跟踪 `.js/.d.ts`、临时目录、生成物                          | 可能是编译旁路、跨包 import 或当前验证材料                                                                               | 没有 import/构建/owner 证据前直接删风险高                                                                  | 最终可减少旁路与噪声，但需逐项核验                                                                    | **证据不足，P3**                                                   |

## 6. 四类处置清单

### 6.1 保留并明确归属

- `scripts/input/shared/` 与两个正式采集入口；Pack 组装只归 `task-table-materialization.ts` / Input Pack contract。
- SQLLens、`scripts/plans/`、`scripts/machine-facts/`、`scripts/query/current-task-bundle.ts`。
- `scripts/project-graph/task-local/`，并接收迁入的字段解释内核。
- `packages/data-graph/src/continuation/`（由旧 task-local-union 内核迁成正式归属）。
- `packages/data-graph/src/asset-graph/` 的 compile、publish、store、CLI、HTTP、metrics、boundary 和 publication snapshot。
- `packages/data-graph-ui/` 作为唯一交互前端。
- 经证据绑定的业务知识内容；是否进入 graph CLI 由后续最小迁移完成。

### 6.2 迁移必要能力后删除

- one-hop schedule cache：**2A 已完成**。已迁到 `scripts/evidence/`，更新 41 个非测试源码调用者和 18 个受影响测试，原文件已删除且没有转发壳。
- field-lineage 字段来源/条件函数与 identity、field-evidence-v1 的任务投影内核：迁到 task-local 归属；旧 field-lineage 产品随后删除。
- task-local-union continuation/index 与旧 query-index 连接器：迁到正式 continuation/asset-graph；旧 topology/field-evidence/query/query-index/view 随后删除。
- writer catalog 使用的 producer identity/output guard：迁到中立 writer/continuation contract；legacy producer-index 随后删除。
- terminal/source endpoint 配置加载：归 asset-graph boundary；legacy multi-hop 随后删除。
- HTTP 根页面和人工知识 loader：分别由 React UI 和正式 graph query 承接后删除旧入口。

### 6.3 有充分依据可直接退出

- `scripts/tmp/run-project-task-local-batch.mts`。

本阶段只有该无入口、无独有能力的环境变量 wrapper 达到直接退出证据。其他候选即使高度疑似重复，也必须先过能力/消费者决策门。

### 6.4 证据不足，暂不能裁决

- `scripts/survey/` 和所有批次 repair/fill run 脚本。
- target-field causal slice、target-table causal closure、target-causal overlay 的完整因果评估。
- Inventory Map 的 catalog-only、主题规则、知识阅读等独有能力。
- one-hop 自动闭包/补包、multi-hop autofill/audit、`lineage:all` 一键编排是否仍有运维消费者，以及接受退出后的恢复方式。
- standalone union CLI 的独立 evidence/index 文件生命周期与仓库外调用者。
- 旧 project-graph 九项 file/query-index 查询的仓库外消费者及与 data-graph 查询的逐项语义差异。
- Horae 调度树和 multi-hop schedule 人工查看旅程；React UI 当前无 schedule 层，后端查询成功不能代替前端验收。
- processing-map/OData/PData builders 是否仍有持续使用者；知识正文不删。
- 未跟踪 `.js/.d.ts`、配置、临时目录和 8,054 个未跟踪文件的 owner/可重建性。
- 旧 query-index 是否有仓库外实例或调用者；当前 asset-graph 状态不能证明外部不存在。

## 7. 第 2 阶段可执行范围

第 2 阶段首先执行 **2A：调度证据缓存归属迁移**，现已完成并通过独立验收。它解决采集、task-local 和多个消费者反向依赖 one-hop 目录的问题，但不改缓存合同、不生成或发布 data-graph。随后单独执行的 2B 与 2C 分别完成字段归属、continuation/连接归属；旧 query-index 第二生命周期已经退出。用户随后明确把 one-hop / multi-hop / field-lineage 整条早期实验链移出正式路径，实施记录见 §7.11。生产发布尚未开始。

### 7.1 范围内基线，不要求整理全仓

开工前执行并保存以下只读结果：

1. `git rev-parse HEAD`、`git status --short`，以及对 §4.1 的 41 个调用者、原缓存文件和受影响测试执行 `git status --short -- <scope>`、`git diff --name-only -- <scope>`。
2. 对上述范围逐文件记录 SHA-256，并保存范围内的原始 patch 快照；这可以放在仓库外临时审查目录，不进入产品产物。结束时用同一清单验证非预期文件未变。
3. 实际开工时 2A 范围内已有 6 个他人/既有修改：`collect-input-pack-from-cache.ts`、`fill-hive-task-sql-cache.ts`、`cache-task-evidence.ts`、`offline-table-resolver.ts`、`fill-hive-task-sql-cache.test.ts`、`project-graph/task-local/coverage.test.ts`。实施只叠加 import 修改，没有覆盖或回退其余内容。
4. 固定当前缓存 fixture 和 §2.2 的 data-graph 查询结果；不重建生产材料。不要以提交全部 50 个 modified 文件或清理未跟踪文件作为开工条件。

### 7.2 精确文件范围与步骤

产品源码范围只有三类：

- 原文件：`scripts/reconcile/consumer/one-hop/schedule-evidence-cache.ts`。
- 新归属：`scripts/evidence/schedule-evidence-cache.ts`。
- §4.1 列出的 41 个非测试源码调用者，只允许修改 import specifier；若某调用者必须改行为，停止并另立变更。

受影响测试 import 清单为 18 个：

```text
tests/audit-multi-hop-closure.test.ts
tests/cache-task-evidence.test.ts
tests/collect-input-pack-from-cache.test.ts
tests/collect-one-task-input-pack-sparkindex.test.ts
tests/fill-hive-task-sql-cache.test.ts
tests/fill-horae-relation-cache.test.ts
tests/fill-run-script-sql-cache.test.ts
tests/fill-upstream-task-type-evidence-loop.test.ts
tests/hive-ddl-from-log-cache.test.ts
tests/horae-task-type-cache.test.ts
tests/lineage-all.test.ts
tests/project-graph/task-local/coverage.test.ts
tests/project-graph/task-local/project-task-local-cli.test.ts
tests/reconcile-multi-hop-autofill.test.ts
tests/reconcile-multi-hop.test.ts
tests/reconcile-one-hop.test.ts
tests/repair-input-pack-partials.test.ts
tests/schedule-detail-cache.test.ts
```

执行步骤：

1. 原样移动模块到新归属，保持 export 名称、schema/artifact type、默认根、文件名和返回联合类型不变。
2. 更新 41 个源码调用者与 18 个测试的 import 路径；不做格式化扫仓或相邻重构。
3. 用临时 cache root 做迁移前后对照，覆盖 relation up/down、task type、partition bindings 三类文件。
4. 删除原文件，不留永久 re-export 壳；以固定 `rg` 口径确认旧路径引用为零。

必须保持的缓存合同：`<root>/schedule-evidence/tasks/<taskId>/` 下的 `horae-relation-up-depth-1.json`、`horae-relation-down-depth-1.json`、`horae-task-type.json`、`task-partition-bindings.json`；`content_sha256 = sha256(canonicalJson(payload))`；临时文件写入后 rename 的原子替换；`HIT/MISS/INVALID`（及调用层的 `DISABLED`）和 INVALID reason 不变。

### 7.3 明确不属于第 2 阶段的后续依赖

- 字段解释后续项：`project-task-local.ts` 对 `field-lineage.ts`、`field-lineage-contract.ts` 和 `field-evidence-v1/*` 的直接引用，以及经 `reconcile/shared/dataset-controls.ts` 对 `physical-field-resolver.ts`/contract 的间接引用。2A 不迁、不复制合同。
- continuation/连接后续项：asset publish/metrics/boundary 对 `project-graph/topology/task-local-union/*`，config 对旧 query-index 连接器的引用。
- multi-hop 配置后续项：`asset-graph/{compile,terminal-policy,source-endpoint-boundary,publication-snapshots}.ts` 与 task-local `anchor-upstream-expansion.ts` 对 terminal/source 配置的引用。

这些条目只用于防止把 2A 验收误报成“主线反向依赖全部归零”；本阶段不要求给它们补完整迁移方案，也不扩大 2A 文件范围。

### 7.4 第 2 阶段禁止项

- 不删 one-hop/multi-hop/field-lineage/project-graph 产品链，也不裁决自动补包、自动回填、旧查询或 schedule UI 的去留。
- 不改 `UNKNOWN/CANDIDATE/DISJOINT`、L1、分区、write observation、cache hash/path/status 语义。
- 不迁 target causal closure/overlay 或 Inventory Map。
- 不重命名全仓、不新增通用框架、不重建/发布生产图、不修改当前数据根。
- 不顺手清理、提交或回退他人的 tracked/untracked 改动、survey、docs 或 OpenSpec。

### 7.5 风险与验收

主要风险是 41 个调用点分布广、源码 import 使用 `.js` 扩展而源文件是 `.ts`、一个模块同时承载三类缓存合同，以及 4 个范围内调用者已有修改。路径搬迁本身不应夹带语义修复。

验收必须同时满足：

1. 固定统计命令返回 0：`scripts`、`packages` 和测试不再 import `reconcile/consumer/one-hop/schedule-evidence-cache.(ts|js)`；新模块的 41 个非测试调用者数量与审查清单一致。
2. 临时根的迁移前后路径字符串、序列化文本/content hash、HIT/MISS/INVALID 状态和 INVALID reason 等价；原子写入测试通过。
3. 执行 `npm run test:input-pack:from-cache`、`npm run test:input-pack:cache-fill`、`npm run test:input-pack:sparkindex`、`npm run test:horae-task-type-cache`、`npm run test:upstream-task-type-loop`、`npm run test:expand-horae-relation-closure`、`npm run test:szdata-schedule-detail-cache`、`npm run test:reconcile-one-hop`、`npm run test:reconcile-multi-hop`、`npm run test:reconcile-multi-hop-autofill`、`npm run test:reconcile-multi-hop-closure-audit`、`npm run test:lineage-all`、`npm run test:task-local-projection`、`npm run test:workspace-paths` 和 `npm run typecheck`；失败须保留精确错误并区分既有失败。
4. 验收结论只能写“2A 指定依赖已移除”；§7.3 的其余直接/间接依赖仍须列明，不能宣称全部反向依赖为零。
5. 当前 data-graph 发布版本不变；§2.2 的有界查询仍成功且 `projectionGenerations=0`。这只证明迁移未破坏既有 CLI 查询，不补足 HTTP/React schedule 旅程。
6. 与开工基线相比，diff 只新增新模块、删除原模块、修改清单内 import/测试；范围外文件 hash 不变，范围内 6 个既有 patch 的非 import 内容保持不变。

### 7.6 2A 实施与自检记录（2026-09-09）

- 开工 HEAD 为 `00f961c436e46db8c71832531a173ebedec81359`；实际调用清单与盘点一致，为 41 个非测试源码文件、18 个测试文件，共 60 处 import（`collect-input-pack-from-cache.ts` 有两处）。
- 执行期间发生范围外并发漂移：HEAD 前进到 `6515e8f28ce034baece6a7fda9280f7392f7833e`（React Flow data-graph explorer 提交）。该提交涉及 UI、asset-graph overview/service/store 和 `package.json`，与 2A 的缓存模块及 41/18 调用清单无交集；本任务没有回退或整理它。
- 模块已迁到 `scripts/evidence/schedule-evidence-cache.ts`；其 Machine Facts 合同相对 import 已改为 `../machine-facts/machine-facts-contract.ts`。原位置已删除，无转发壳。固定扫描口径下旧路径引用为 0，新路径仍是 41 个源码文件和 18 个测试文件。
- 临时目录前后对照覆盖 relation up/down、task type、partition bindings。三类 MISS 与四类 HIT 一致；篡改 relation 后均返回 `INVALID / CONTENT_HASH_MISMATCH`；相对文件清单一致；序列化聚合 SHA-256 均为 `c03af29047882d7839de15aeb85a0180b2148f4b120f9ce9441e69dd36fdf603`；没有残留 `.tmp` 文件。
- 通过的方案命令：`test:input-pack:from-cache`、`test:input-pack:sparkindex`、`test:horae-task-type-cache`、`test:upstream-task-type-loop`、`test:expand-horae-relation-closure`、`test:szdata-schedule-detail-cache`、`test:reconcile-multi-hop-autofill`、`test:reconcile-multi-hop-closure-audit`、`test:lineage-all`、`test:workspace-paths`。one-hop 固定缓存读取和 multi-hop 离线缓存选父的定向用例也分别通过。
- `test:input-pack:cache-fill` 在排除快照副本后为 35 passed / 2 failed；失败是 `fill-hive-task-sql-cache.ts` 与同名测试开工前已有的 structural-template 行为改动导致旧 `skipped/mcpCached/errors` 断言不符，本次仅改其 import。
- one-hop/multi-hop 全文件运行分别在已显示 21/26 个断言通过后发生 Vitest worker 异常退出；定向缓存用例均可稳定以 exit 0 完成。`test:task-local-projection` 为 518 passed / 18 failed / 46 skipped，既包含当前 task-local/field-evidence 既有断言与数据库路径失败，也因 Vitest exclude 未覆盖 `.evidence-cache/**` 和 `tmp/asset-graph-publication-*/**` 而执行了快照副本；两个直接依赖调度 cache 的 task-local 定向用例通过。
- `npm run typecheck` 仍有两个非 2A 错误：`scripts/plans/source-semantics.ts:50` 的 dialect 类型不匹配，以及开工前已存在的未跟踪 `run-src-table-template-rebuild.mjs` 缺声明。没有 schedule-evidence import 解析错误。
- data-graph 只读复核仍为 `titans-otc` / `READY` / 版本 `fd7070e0a37c10e99ec235fdd0db10f355c581d0a2e5679410d95d9cc984489a` / compiler `1.0.9`。`86840` schedule 上游一跳仍为 27 节点、26 条 `SCHEDULE` 边；`86842.init_nom_prin` confirmed-only 字段上游仍为 11 节点、10 条 `VALUE/CONTINUES` 边；查询均为 `projectionGenerations=0`。
- 自检结论仅为“2A 指定依赖已移除且缓存行为等价”。上述既有门禁问题需由其当前改动 owner 处理；未进入字段解释、continuation、终点配置迁移或任何产品删除。
- 成本判断：路径迁移本身低于原 0.5–1.5 日区间的下半段，主要时间消耗在脏工作树保护和被快照目录污染的测试诊断。整体 8–13 工程日粗估暂不调整；后续应先修正测试隔离或使用明确排除参数，否则验证成本会持续偏高。

### 7.7 字段归属检查点 2B 实施与自检记录（2026-09-09）

- 本检查点是 §8.1 第 3 阶段的字段部分，不包含 continuation。开工和结束 HEAD 均为 `fd9a21c8cd6ed1bc76ca01d53534e005fe3ca04b`；没有提交或推送。仓库外审查目录为 `C:\Users\13246\AppData\Local\Temp\sql-static-lineage-phase2b-baseline-20260909-113657`，保存了 23 个初始范围文件的原文副本、SHA-256、HEAD、Git 状态、42,675 字节工作树 patch、空 index patch及前后测试/投影日志。
- 初始范围内已有 6 个他人改动：`field-evidence-emission.ts`、`relation-tree.ts`、`source-read-occurrence.ts`、`project-task-local.ts`、`field-evidence-emission.test.ts` 和 `source-read-occurrence.test.ts`，共约 `+658/-39`。迁移后的逐文件归一化比较确认，这 6 个文件除必要 import/路径和换行外均与开工快照一致；没有从 HEAD 重建或覆盖其语义改动。
- 通用 `PhysicalFieldIdentity` / `physicalFieldKey` 归入 `scripts/reconcile/shared/physical-field.ts`；控制注解合同归入 `scripts/reconcile/shared/field-control-contract.ts`；`physical-field-resolver.ts` 从 field-lineage consumer 移到 `scripts/reconcile/shared/`。`dataset-controls.ts` 保持共享归属并改用上述共享合同，避免把通用证据基础挂到单个投影消费者。
- `valueContributionInputFields()`、`sourceFieldsForExpression()`、`fieldConditionalsForExpression()` 及必要索引/helper 归入 `scripts/project-graph/task-local/field-expression-dependencies.ts`。旧 `field-lineage.ts` 保持公开 re-export，并反向消费同一实现；`sourceFieldsForExpression()` 的返回对象和 unresolved 元素保持迁移前的可变类型，没有额外收窄调用者。`field-lineage-contract.ts` 保留产品独有 artifact 合同，同时从共享层 re-export identity/key 和控制注解类型以兼容现有消费者。因此这些实现只有一份，没有通过新内核绕回待退出 consumer。
- `field-evidence-emission.ts`、`relation-tree.ts`、`source-read-occurrence.ts`、`subtype-classifier.ts` 原样迁到 `scripts/project-graph/task-local/field-evidence/`，原位置删除且没有转发壳。task-local、`dataset-controls.ts`、legacy `field-edge-index.ts` / `control-scope.ts` 和对应测试已更新到新路径。固定扫描下，task-local/shared 对旧 field-lineage consumer 的运行时或类型 import 为 0，四个旧 helper 路径和旧 resolver 路径引用也为 0。
- 精确基线使用仓库外临时 Vitest config 固定 `include`、单 worker，不使用目录过滤器冒充隔离。字段内核 5 文件基线与迁移后均为 4 passed / 1 failed、46 passed / 1 failed；唯一失败始终是 `source-read-occurrence > routes a qualified output by its exact scope and setop output-column ordinal`，断言期望 `[]`、现有实现返回两个 context。task-local 的 `materialization` + `project-task-local` 前后均为 2 files / 6 tests passed；legacy `field-lineage.test.ts` 前后均为 1 file / 31 tests passed。没有修改该既有失败或削弱断言。
- 额外路径与边界验证 `physical-field-expander.test.ts`、target causal `module-boundary.test.ts`、`no-literal-anchors.test.ts` 为 3 files / 15 tests passed。`npm run typecheck` 前后都只剩既有 `tests/run-src-table-template-rebuild.test.ts:3` 的 TS7016（未跟踪 `.mjs` 缺声明），没有新增 import、类型或循环错误。独立运行时依赖扫描从 `project-task-local`、`field-expression-dependencies`、`dataset-controls` 出发覆盖 55 个模块，未发现旧 consumer/helper 可达路径、缺失引用或循环。
- 行为等价使用同一冻结 105387 zipper + 71698 producer 合成 Input Pack，在两个仓库外临时镜像分别运行迁移前快照与迁移后源码，并强制断言 `coverageStatus=PROJECTED`。规范化只删除 `generatedAt` / `contentHash` 并把临时绝对根替换为 `<FIXTURE_ROOT>`；没有忽略节点、边、properties、gap 或 subtype。两份 25,124 字节 JSON 的 SHA-256 均为 `6ff081b372fb66af388db2e31bae44dbedf9b5791918b98bf179262e9442396e`：包含 1 TASK、1 TARGET_WRITE、5 READ_OCCURRENCE、6 PHYSICAL_DATASET、8 PHYSICAL_FIELD，10 READS、2 WRITES、3 FIELD_DIRECT、8 DATASET_CONTROL，1 IDENTITY、2 TRANSFORMATION、8 JOIN，以及 8 个 `CONTROL_SIDE_UNRESOLVED` gap。
- 本检查点实际解除的是 task-local 对旧 field-lineage consumer/contract/resolver 和旧 field-evidence-v1 helper 位置的直接/间接依赖。剩余依赖是有意保留的兼容消费：旧 field-lineage 仍拥有 per-root artifact/遍历产品合同并消费新字段表达式内核；legacy `field-edge-index.ts` / `control-scope.ts` 仍消费新 relation-tree；target causal 与 physical expander 消费共享 resolver。它们不构成本检查点内删除这些产品链的授权。
- 成本判断：实现量仍落在原字段部分 1–1.5 工程日预估内，主要成本来自脏工作树保护和构造有效非空等价对照，而不是搬文件本身。continuation、旧产品能力裁决和删除成本不因本检查点自动下降；整体 8–13 工程日粗估暂不调整。
- 独立验收结论：**2B 仅就字段归属迁移通过**。独立复跑合计 98 passed / 1 个同基线既有失败：字段内核 46 passed / 1 failed、task-local 6 passed、legacy field-lineage 31 passed、额外边界 15 passed；typecheck 仍仅有既有 TS7016，不能据此宣称全仓门禁全绿。验收同时核对了四个 helper 与 resolver 正文等价、55 模块运行时依赖无旧 field consumer 可达/缺失/循环、开工源码与 baseline 镜像一致，以及 25,124 字节非空投影的前后 hash 一致。
- 验收中完成三项边界修正：通用 identity/key、控制注解合同和 resolver 最终归 `scripts/reconcile/shared/`，没有挂到单个 task-local 消费者；最初 `COLLECTION_FAILED / FACTS_UNAVAILABLE` 的空样例被判为无效证据并替换为强制 `PROJECTED` 的非空 105387/71698 对照；`sourceFieldsForExpression()` 一度新增的 `readonly` 返回类型已恢复迁移前可变性。最终 post 镜像与源码差异仅为格式及该类型修正，没有逻辑漂移。

### 7.8 continuation/连接归属检查点 2C 实施与独立验收记录（2026-09-09）

- 本检查点只迁正式 asset-graph 实际复用的 continuation/index 与 Neo4j 连接边界，不迁 multi-hop terminal/source boundary 配置，不删除旧 topology/query-index/standalone CLI 产品。开工 HEAD 为 `94769ab3338695e3263acc0510934bd254cd8fb9`；没有提交、推送、重建或发布生产图。仓库外审查目录为 `C:\Users\13246\AppData\Local\Temp\sql-static-lineage-phase2c-baseline-20260909-133428`，初始实现清单 39 个路径、32 个已存在文件、9 个范围内脏项，保存了逐文件原文、SHA-256、Git 状态、21,108 字节工作树 patch 和空 index patch。最终完整引用检查另发现 `docs/knowledge-graph-comparison.md` 两处链接仍指向已删除的 continuation-v2 旧位置；该文件开工时无修改（以 HEAD blob 为基线），仅把两处链接改到新内核，因此最终涉及 40 个物理路径。
- `task-local-union-continuation-v2.ts` 与 `union-continuation-index.ts` 的唯一实现分别迁到 `packages/data-graph/src/continuation/continuation-v2.ts`、`continuation-index.ts`，原算法位置删除且不留转发壳。为避免连带搬入整个 topology/merge/CLI 产品，只抽取 `task-local-projection.ts`、`continuation-input.ts`、`producer-writer.ts` 和 `contracts/ordering.ts` 四个最小共享边界；旧 snapshot contract、merge/source/producer loader、evidence envelope 和两个 standalone CLI 保持产品归属并反向消费新内核。
- `neo4j-query-index-connection.ts` 原样迁到 `packages/data-graph/src/neo4j/connection.ts`；保留既有导出名、环境变量/文件密码解析、URI/database/alias 校验、bounded error、动态 driver import 和 driver 关闭责任。asset-graph config 与旧 query-index store/CLI 共同改用该模块，旧 query-index 的 store、schema、build/status/query/parity 和 CLI 均未删除。
- 固定源码依赖扫描中，asset-graph 对旧 topology/query-index 产品的 12 条直接依赖降为 0；新 continuation/neo4j 内核不存在回指旧产品、缺失相对 import 或新增源码依赖环。包含类型 import 的源码扫描前后都存在同一条既有 `source-endpoint-boundary.ts ↔ continuation-metrics.ts` 环，本检查点没有扩大或处理它；这不等于运行时环。独立验收使用 esbuild 擦除类型 import 后，从 asset-graph/continuation/neo4j 递归跟踪 49 个运行时模块，旧 topology/query-index 产品可达路径、缺失引用和运行时循环均为 0。旧 `union-continuation-index-cli.ts` 及测试仍保留是有意的 standalone 文件产品入口，不代表算法存在第二份实现。
- 非空行为对照在迁移前临时镜像和迁移后源码上运行同一固定输入：一个读次对应同表四个独立 write observation，分别得到 `CONFIRMED / ASSUMED / DISJOINT / UNKNOWN`，只有 CONFIRMED 进入 L1；另一个读次只关联 `SCHEDULE_ONLY` 任务，即使 producer 输入含该任务也保持 0 candidate 和 `NO_KNOWN_WRITE_OBSERVATION`。前后包含完整 index 与 summary 的对照文件均为 7,004 字节，SHA-256 均为 `b63db69be5448a01a7758544054b3d6d1a80a89af05b7c66f8700078e86ced1a`，其中 index content hash 均为 `71c44fd85ea8c3c1db00d88735cd4ec460757051b058653e37bed2bf89436bf4`；未忽略节点、候选、写次、状态、gap、身份或分区证据。
- 自检时，迁移前镜像与迁移后相同 12 个 package 测试均为 88 passed / 2 skipped；另补跑 query-index connection/CLI/Neo4j store/availability 4 files / 14 passed，以及根级 3 files / 22 passed。独立验收合并去重后复跑 package 15 files 得到 97 passed / 2 skipped，根级 3 files 得到 22 passed，即独立合计 119 passed / 2 skipped；不能把自检中存在重复的 88 与 14 简单相加作为唯一测试数。直接使用根 `npm test -- <files>` 会先追加固定 39 文件并误收集快照副本，产生 fill-cache/task-inspection 等无关既有失败，因此不作为本检查点目标结果。
- `npm run typecheck` 仍只报开工前已有的 `tests/run-src-table-template-rebuild.test.ts:3` TS7016。data-graph package typecheck 前后均报相同 3 个既有错误：`asset-graph-catalog.test.ts:216` 缺 `taskCategory/coverageDisposition`，`asset-graph-overview.test.ts:116/119` 对空 tuple 取第 0 项。package build 前后均因当前 `tsconfig.build.json` 的 `rootDir=src` 与既有跨包 `scripts/**` import 冲突而报 TS6059；本检查点没有削弱断言或修复这些范围外门禁。
- 当前剩余依赖是明确排除项：asset-graph compile/terminal/source boundary/publication snapshots 仍消费 multi-hop terminal/source 配置，continuation 仍复用 task-local partition canonical；旧 standalone CLI 仍消费旧 source/merge/producer loader，但算法和投影合同只消费新正式内核。2C 只证明指定归属迁移完成，不能据此删除旧 topology、query-index 或 multi-hop 产品。
- 实施期间 HEAD 保持 `94769ab3338695e3263acc0510934bd254cd8fb9`、暂存区始终为空。范围外出现 3 项并发漂移：`book-consumption-pilot/README.md` 修改、同目录新增中文说明文件、以及新增 `analysis/swap-comp-pilot/`；均未回退或纳入 2C。一次 package build 在失败前生成的 12 个开工时不存在的 `.js/.d.ts` 已按精确路径清除，开工前已有的其他旁路文件未动。
- 独立验收结论：**2C 仅就 continuation/index 与 Neo4j 连接归属迁移通过**，未发现需要返工的产品代码缺陷。32 个基线文件 hash、源码镜像和 9 个既有改动文件的反向路径归一化均吻合；独立产物为同一证据目录下的 `review-protected.json`、`review-before.json`、`review-after.json`。验收没有启动服务、重跑有副作用的 package build 或发布生产图，因此不构成在线旅程、完整门禁或整套图统一验收。
- 成本判断：实现仍落在 continuation 0.5–1 日加连接器约 0.25 日的原估算内；主要额外成本来自 9 个范围内既有/并发修改、前后镜像和测试目录污染。整体 8–13 工程日估算暂不下调；旧产品退出、外部 query-index owner、standalone 文件生命周期和 multi-hop 配置迁移仍需后续独立决策门。

### 7.9 旧 query-index 产品退出检查点实施与独立验收记录（2026-09-09）

- 本检查点基线 HEAD 为 `15b602bdb240b9a5f3d567dadbb73d2bdadf5416`，即已推送并通过独立验收的 2C 提交；暂存区为空。仓库外证据目录为 `C:\Users\13246\AppData\Local\Temp\sql-static-lineage-query-index-retirement-20260909-145517`。32 个范围文件开工时全部干净，其 canonical Git blob 与 HEAD 对应文件完全一致；同时保存了全局 Git 状态、范围清单和逐文件原始 SHA-256，但部分工作树文件混合换行，不能把 raw SHA 与 Git LF blob 直接作字节等同。全局其余 167 项脏状态不属于本检查点，未整理或回退。实施期间范围外新增未跟踪 `scripts/topic-snapshot/`，已作为并发漂移记录并保持原样。
- 删除 `packages/data-graph/src/project-graph/query-index/` 下 15 个实现文件，以及只验证该退役产品的 store/source/builder/validation/parity/availability/CLI/Neo4j store 八个测试和 `tests/fixtures/query-cli-parity.ts`。同时从 package scripts 删除 `query-index`、`query-index:build`、`query-index:status`、`query-index:query`、`query-index:parity` 五个入口；不保留转发壳、空目录、第二 store 或第二 namespace 生命周期。
- 仓库调用核对发现：query-index 目录外没有产品运行时代码导入该产品，目录外源码引用只有专属测试。九项 topology/field-evidence/target-causal 查询由保留的 `project-graph/query/file-query-cli.ts`、`run-projection-query.ts` 和三类直接查询模块实现；旧 index CLI 只是从第二 store 还原投影后调用同一 dispatcher。因此退出的是 source descriptor、record schema、staged build、activation、status、parity audit 与 Neo4j query-index store，不退出九项文件查询或其直接投影算法。
- `project-graph-query-index-connection.test.ts` 迁为 `neo4j-connection.test.ts`，继续覆盖 2C 已归共享的 `src/neo4j/connection.ts`；该连接器仍由正式 `asset-graph/config.ts` 使用。`target-causal-overlay.test.ts` 只删除两个 query-index 集成 case，原直接投影、发布和文件查询断言保留。`real-artifact-closed-loop.test.ts` 改为验证真实 topology → field evidence → causal overlay 的 loader、引用一致性、直接查询与 file CLI，不再构建内存 index。
- 退役前 11 个相关测试文件为 10 passed / 1 skipped，50 passed / 1 skipped。退役后首次定向验证在未设置验收根时为 6 passed / 1 skipped，45 passed / 1 skipped；随后确认既有三类验收产物都存在，设置只读 `DATA_GRAPH_ACCEPTANCE_ROOT` 后单独运行 `test:real-artifact` 为 1 passed，真实 topology → field evidence → causal overlay 的引用、直接查询和 file CLI 闭环通过。退役后 data-graph 全套测试为 33 passed / 2 skipped，193 passed / 3 skipped；其中默认环境的三个 optional-artifact case 仍按合同跳过。保留的 file-query `--help` 仍列出九项查询；正式根级 `graph:query --help` 可加载并明确查询期不生成投影。
- 独立复核中发现初版 real-artifact 改写只比较三个 list query 的 direct 与 CLI，同错、同空或共享路由覆盖丢失都可能被放过；已恢复冻结 topology snapshot ID、三类查询 `ok/partial` 状态、limit=1 结果数量、三类实际 projection 的 nodes/edges 非空断言，以及原 helper 的九项 file-only query case。九项仍使用原 `UNKNOWN relation-status`、`max-hops`、`max-assessments`、`max-attachments` 参数，并对选取的 edge/root field/record/assessment/task 标识先作非空断言；`UNKNOWN` CLI case 的 expected 也显式使用同一过滤参数，不复用无过滤的非空 list 结果。cross-snapshot 引用一致性和 direct-vs-CLI 全对象比较均保留。同一只读验收根非 skip 复跑仍为 1 passed；没有为通过而弱化原本与 query-index 无关的有效质量断言。
- 根级 typecheck 仍只有开工前已有的 `tests/run-src-table-template-rebuild.test.ts:3` TS7016。data-graph package typecheck 仍只有 2C 已记录的三个既有 fixture/tuple 错误：`asset-graph-catalog.test.ts:216` 与 `asset-graph-overview.test.ts:116/119`。没有重跑会向源码目录生成旁路文件的已知失败 build，没有启动服务、生成或发布图、连接或删除任何 Neo4j 数据/namespace/database。
- 全引用检查要求交付时满足：旧 query-index 源目录、测试名、package script 和现役运行说明引用为 0；共享连接器与正式 asset-graph 依赖保持一份。OpenSpec 和架构历史材料仅作历史证据保留，不作为现役命令；其中出现的 query-index 不代表产品仍可运行。
- 退出影响：仓库外消费者是否存在仍无证据，不能写成“已证明无人使用”。任何仓库外调用旧五个 npm 命令、旧 TypeScript API、query-index audit 文件或 Neo4j namespace 的工具都会在升级后失败，必须改用九项 direct file-query，或按正式 data-graph 旅程改用 `graph:query`；两者语义并未在本检查点被宣称逐项等价。本检查点只退出一套已确认重复的索引/发布生命周期，不等于 file-query、旧三投影和正式 asset-graph 已经全部统一。
- 独立验收结论：**本检查点仅就旧 query-index 第二生命周期退出通过**，未发现需要修复的正式链路实现缺陷。独立 data-graph 全套为 33 files passed / 2 skipped、193 tests passed / 3 skipped；此后修改只涉及 real-artifact 测试，最终使用同一只读验收根独立复跑为 1 file / 1 test passed，不能把多次重复运行相加。验收确认共享 Neo4j connection 测试相对 HEAD 仅改 describe 名称、全部断言保留；target-causal-overlay 删除的两段只依赖退役 index，其余投影/发布/直接查询断言仍在。正式图 49 个擦除类型后的运行时模块缺失引用与退役产品可达路径均为 0，`graph:query --help` 成功加载。
- 验收返回的缺口仅在测试承接：初版 real-artifact 改写丢失 snapshot/status/非空/limit 断言，第二版仍只覆盖三个 list query，随后 `UNKNOWN` case 的 direct expected 参数未显式匹配。三次均按最小范围修正，最终恢复原有效断言、九项 file CLI/direct API 的参数及完整结果对照，且 `UNKNOWN` 明确使用 `relationStatuses: ["UNKNOWN"]`；没有恢复旧 index 或新增框架。
- 成本判断：实际实现低于原“能力迁移”估算，因为九项算法无需迁移，只需删除第二生命周期并保留直接查询覆盖；减少 15 个产品源码、五个命令、八个专属测试和一套 audit/parity/activation 合同的维护。仓库外迁移成本未知，整体 8–13 工程日区间暂不下调；file-query 与正式 `graph:query` 的最终去留仍需后续基于真实用户旅程裁决。

### 7.10 topology / field viewer 退出决策门核对（2026-09-09）

- 本轮定位基线为已推送的 `14498125e3679ed8447f27508d5b3d6f4a024619`，开工时 `HEAD` 与 `origin/main` 一致、暂存区为空，全局另有 174 项既有或并发状态。仓库外证据目录为 `C:\Users\13246\AppData\Local\Temp\sql-static-lineage-project-topology-view-retirement-20260909-1545`，保存了 9 个候选范围文件的原文、SHA-256、Git 状态与开工补丁；这些范围文件开工时均无修改。
- 正式 data-graph 的只读状态仍为 `titans-otc` / `READY` / 版本 `fd7070e0a37c10e99ec235fdd0db10f355c581d0a2e5679410d95d9cc984489a`。有界核对不是用 READY 或数量代替验收：`86840` 表级上游 `depth=1, limit=40` 返回 28 节点、31 边和 3 个策略终点；`86842.init_nom_prin` confirmed-only 字段上游 `depth=6, limit=80` 返回 11 节点、10 边，其中 4 条为确认接续；`93338` 的 `dyna_nom_prin` processing 以 `limit=5` 返回 5/15 项，首项含 2 个输入字段。三次查询均为非空且 `projectionGenerations=0`，证明正式后端具备当前样例的表、字段和加工证据消费能力，但不证明旧文件合同、target causal 或人工页面已等价承接。
- 依赖核对确认：旧 `project-topology` 仍为 `field-evidence-graph` 和 `target-causal-overlay` 的输入；旧 field publication/contract 仍由 target overlay 和九项 file-query 消费；三项 target causal 查询的 relation status、channel、assessment/rollup/witness 也没有正式普通 trace 的等价承接。standalone union 继续依赖 task-local source/merge、共享 continuation 内核及 topology contract 的稳定 ID/排序常量。因此这些生成、查询、overlay 和 union 模块本轮均保留，不能只因正式图有同名层级能力而删除。
- 旧 `project-topology-view` 也未满足整项删除条件。`project-topology-acceptance-view.ts` 的 `SCHEDULE` 层会按 `edge.layer` 精确筛选选中节点的一跳 `SCHEDULE_DEPENDS_ON`，展示方向、根作用域观察和 Horae evidence refs；当前 React 只开放 table/field 层，没有承接这条人工调度旅程。内嵌 field drilldown 还保留从 `rootStateIds` 到 `FIELD_BINDING_STATE` 的精确根绑定、write observation、确认值流、候选/UNKNOWN、控制注释、分区属性和 evidence refs；正式 React 虽可字段选择、trace、表达式、输入字段、write id 和控制条件，但当前没有明确的 edge detail、partition/UNKNOWN 与 evidence locator 展示。本轮未进行浏览器实际交互或 E2E，不能把代码路径和后端查询写成前端验收。
- 曾形成的 viewer/field-drilldown 删除补丁已按本轮外部基线完整恢复，没有保留产品行为变更或文件删除。恢复后 `project-topology-view-cli.ts`、`project-topology-acceptance-view.ts`、`project-field-drilldown.ts`、`field-drilldown-client.mjs` 和 `field-drilldown-client.d.mts` 的原始 SHA-256 均与开工基线相同；既有字段 viewer 测试覆盖也全部恢复。最终只在 `project-topology-view.test.ts` 增加对实际 `SCHEDULE_DEPENDS_ON` 层、consumer→producer 方向、Horae locator、HTML 选项和 `edge.layer` 筛选表达式的防回归断言，不修改调度算法。
- 最终自检和独立复跑同一 viewer 测试均为 1 file / 7 tests passed，其中既有 full-field catalog、局部上游图、控制注释和重复 snapshot fail-closed 用例均继续执行；这只证明模型和生成 HTML 保留结构，不是浏览器交互验收。本轮没有提交、推送、发布、重建图或删除历史页面/产物。
- 本轮结论是 **未实施 topology / field viewer 产品退出**，而不是“viewer 退役通过”。最小下一步应先在正式 React 承接并人工验收两条必要旅程：调度一跳及其证据；字段精确绑定中的 write observation、partition/UNKNOWN 和 evidence locator。验收成立后再删除重复静态呈现；target causal 与离线九项查询仍需各自决策门。由于本轮没有消除维护职责，整体 8–13 工程日粗估不下调，且正式前端承接成本仍落在第 5 阶段范围内。

### 7.11 task-lineage add-on 隔离检查点实施与自检记录（2026-09-09）

- 用户明确裁决 one-hop、multi-hop、per-root field-lineage 和其 target-oriented 配套链为早期实验，不删除但退出正式路径。开工 HEAD 为 `651d4cc3439ed5f1ba9d1119385b0f0a30dde765`，暂存区为空；全局已有 193 项 tracked/untracked 状态。仓库外基线目录为 `C:\Users\13246\AppData\Local\Temp\sql-static-lineage-task-lineage-addon-20260909-162521`，保存了 92 个范围文件的原文、SHA-256、全局状态、工作区 patch 和空 index patch。提交前本检查点精确暂存 94 个文件；其余工作区状态继续留在工作区，未被整理或带入。实施未重建、发布或修改生产 data-graph。
- 41 个既有 add-on 文件整体迁入 `scripts/addons/task-lineage/`：three reconcile products、field-evidence-v1、Input Pack closure、`lineage:all`、anchor upstream expansion、gold-case preflight 和 two HTML visualizers。另新增 add-on 边界 README 与 `project-task-local` upstream-expansion wrapper；旧目录不留转发壳。产物名称、默认输出路径、schema、canonical hash、终点和证据状态语义没有改动。
- 正式路径仍需的最小合同没有塞进 add-on：terminal table config、source endpoint boundary config 和 producer table identity 分别归入 `scripts/reconcile/shared/`；原实现除必要相对 import 外保持正文一致。调度证据缓存、2B 字段内核、2C continuation/Neo4j 内核维持既有正式归属。
- `project-task-local` 的普通执行不再静态加载上游闭包实验。`--expand-upstream` 只有通过 `addon:task-lineage:project-task-local` 注入 add-on expander 才可执行；缺少注入时 fail closed 为 `TASK_LINEAGE_ADDON_REQUIRED`。所有产品入口改为 `addon:task-lineage:*`，所有专属测试入口改为 `test:addon:task-lineage:*`；根默认 `npm test` 和 `test:task-local-projection` 不再把 add-on 套件作为正式主线门禁。
- 固定扫描确认 `packages/data-graph/src`、`scripts/input`、`scripts/machine-facts`、`scripts/plans`、正式 task-local/asset-graph、`scripts/reconcile/shared` 和 `scripts/query` 对 `scripts/addons/task-lineage` 的源码 import 为 0。target-field causal slice 与 target-table causal closure 仍会显式消费 add-on 的 legacy artifact/expander；它们本身不属于正式 data-graph 主线，本检查点不把高成本 target-causal 产品一并搬迁或删除。
- 通过：共享 boundary 2 files / 5 tests，正式 workspace/task-local CLI 2 files / 13 tests，field-lineage 8 files / 125 passed / 1 todo，multi-hop autofill 6 tests，Input Pack closure 4 tests，`lineage:all` 16 tests，one-hop 定向 3 tests，multi-hop 定向 4 tests，两个 visualizer 共 9 tests，data-graph terminal/source/publication snapshots 12 tests，根 terminal traversal 3 tests。terminal 配置迁移前后字节一致；source-boundary 与 producer identity 仅相对 import 变化。
- 既有门禁未掩盖：完整 one-hop / multi-hop 文件仍在 Windows Vitest worker 中异常退出，两者均为 `-1073740791`；定向核心用例均通过。field-evidence 为 81 passed / 3 failed，并有 1 个 suite 因现有 writer-catalog 路径无法打开失败；其中 source-read-occurrence 的 setop 路由断言是 2B 已记录同基线失败。正式 task-local 为 105 passed / 5 failed，仍是现有 contract 构造顺序与 real-Facts golden 差异。根 typecheck 仍只有既有 `tests/run-src-table-template-rebuild.test.ts:3` TS7016。
- 退出影响是旧的 unprefixed npm 产品命令不再存在，仓库外调用者必须改用 `addon:task-lineage:*`。本次消除了正式主线对这条实验实现的运行时/类型依赖和根命令归属混淆，但没有减少 add-on 内部 41 个文件的维护成本；下一步只有在真实使用证据不足且退出影响可接受时，才继续删除 autofill、throughput 别名或旧 per-root 产物。

## 8. 最小有效收敛方案

### 8.1 先做什么

1. **第 2 阶段：只做 schedule evidence cache 归属迁移（0.5–1.5 日）**。这是调用面已列全、合同可冻结、价值明确的最小解耦；完成后先用实际 diff 和测试成本校准后续估算。
2. **第 3 阶段：字段解释与 continuation/连接归属（2–3 日，待 2A 校准）**。按 §7.3 逐条处理直接和间接依赖；每个检查点只验收指定依赖，不提前宣称全部归零。
3. **第 4 阶段：能力决策与有条件退出（1–3 日，不含高成本迁移）**。旧 query-index 的第二生命周期已退出；task-lineage 实验链也已整体隔离为 add-on。后续只对 add-on 内的自动补包、multi-hop autofill/audit、throughput 别名、`lineage:all`、standalone union 文件合同和九项旧文件查询分别作“继续保留/明确退出”决策，不再把它们迁回正式主线。只有消费者、替代路径和退出影响闭合的项才能删除。
4. **第 5 阶段：统一发布和消费（1.5–2.5 日）**。正式命令目标只保留 collect、Facts、prepare、publish、query、serve、UI；HTTP 与 React UI 的 table/field 旅程闭环。schedule 旅程要么在 UI 承接并人工验收，要么由 owner 明确接受退出，之后才能删对应旧查看器。
5. **第 6 阶段：选择性知识/文档/测试收敛（1–2 日）**。只迁被验证需要的 task knowledge 或 catalog 能力；更新正式运行文档和分层测试入口。
6. **第 7 阶段：隔离重建与整体验收（1–2 日）**。小批生成、增量发布、CLI/HTTP/UI 真实旅程、无悬空 imports/commands、无第二正式链，最后一次受控完整发布验收。

### 8.2 暂不做什么

- 不把 target causal closure/overlay 默认迁入主图，也不因暂不迁移就默认删除。先用 2–3 个真实问题比较普通向下影响与多通道状态/witness/UNKNOWN 解释，再决定保留、迁移最小能力或明确接受退出影响。
- 不把 Inventory Map 的主题分类、SQLite 索引、页面和全部知识功能整体搬进 React UI，也不先删。先对照“库存发现、字段加工、人工知识”三条旅程，只迁持续使用的最小能力，其余逐项记录退出影响。
- 不因 task-lineage 已进入 add-on 就宣称其中所有能力都值得长期保留，也不立即删除自动补包/自动回填、standalone union 文件能力或九项文件查询；这些能力仍需分别核对仓库内外消费者、替代路径和退出影响。
- 不整理全部 survey/fill 脚本和 8,054 个未跟踪文件。先有 owner、最后使用、调用者和可重建性证据。
- 不批量重写或删除 docs、OpenSpec 与历史 HTML；只修改正式入口索引和已退出产品运行说明。

优先消除的是真实重复职责：两套 producer/index 生命周期、两套跨任务接续、两套图发布、两套 Neo4j query store、多个正式 CLI/前端，而不是目录整齐或删除行数。

## 9. 高成本、收益不明确的工作

| 工作                                                       | 额外成本 | 不默认纳入的原因                                                       | 决策证据                                      |
| ---------------------------------------------------------- | -------: | ---------------------------------------------------------------------- | --------------------------------------------- |
| target-table causal closure / overlay 完整并入 asset graph |   4–6 日 | 多通道状态、witness、关系语义与下游 trace 不等价；会扩大主产品复杂度   | 真实用户问题、现有 trace 的明确失败、响应预算 |
| Inventory Map 全量迁入 React UI/graph CLI                  |   2–4 日 | 大量能力是主题阅读、catalog-only 和自有 SQLite 索引，不是 lineage 必需 | 三条用户旅程与差距清单                        |
| 统一所有历史 repair/survey 脚本                            |   2–3 日 | 多数批次专用但仍有直接调用；收益主要是整洁                             | owner、最近运行、替代命令和恢复需求           |
| 清理全部历史文档/OpenSpec/旁路文件                         |   1–3 日 | 容易误删证据与未跟踪实现，不直接减少运行职责                           | 正式文档索引和 owner 分类                     |

这些项目只有决策证据成立后才加入实施，不用“最终统一”自动授权。

## 10. 工作量调整

原估算 6–10 工程日需要上调。原因不是文件多，而是确认了三条真实反向依赖（41 个非测试 schedule-cache 调用者、task-local 对旧字段产品的直接/间接复用、asset-graph 对旧 project-graph continuation/连接器及 multi-hop 配置的复用），且关键 UI/asset-graph 源码仍未跟踪或未提交。

- **推荐的最小有效收敛**：第 1 阶段、2A/2B/2C、旧 query-index 退出和 task-lineage add-on 隔离已完成；剩余正式 UI/HTTP 旅程、运行文档与分层门禁、隔离重建和总体验收约 **4–7 工程日**。这是剩余量粗估，不含下表高成本可选工作。
- owner 核对和脏工作树基线能快速固定时接近下界。
- 高成本可选工作不计入上述数字；若 target causal 与 Inventory Map 都完整迁移，另加 **6–10 工程日**。

完成标准不是删除固定行数，而是正式职责只有一处、主链无反向依赖、必要能力有明确承接或明确退出影响、CLI/HTTP/UI 使用同一发布版本和查询语义。

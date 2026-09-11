# 数据加工地图与存量查询

主界面沿 schema、表、任务和字段连续展开，具体表达式、定义与 SQL 在画布下方阅读。全量调度库存提供搜索底座；加工关系来自当前共享投影，目录来自本机“原信息”。构建与查询分开，CLI 和网页复用只读查询。原 `processing-map.html` 保留为对照，不需要 Neo4j 或 G6。

## 使用

要求 Node.js 24（使用内置 `node:sqlite`），无需新增运行时依赖。在仓库根目录运行：

```powershell
npm run inventory-map:build
npm run inventory-map:analysis-build
npm run inventory-map:serve
```

浏览器打开 `http://127.0.0.1:8768/`。服务只监听本机；页面资源来自本地，不使用 CDN。

主界面默认从销售基础表开始。点击节点保留原场景继续展开，点击字段比较各写入分支的表达式；“以此为中心”开启新场景。`/inventory` 保留上一版库存汇总，`/baseline` 为原加工地图。

`analysis-build` 读取 `analysis-config.json` 指向的两份 Hive 元数据及 `dataRoot/task-projections/tasks` 下已存在的当前投影。按文件逐个建立索引，不触发投影生成；配置路径可调整。默认分析产物位于 `artifacts/inventory-map/analysis`。服务绑定启动时打开的索引，重建成功后重启服务切换。

```powershell
npm run --silent inventory-map:query -- analysis-search --kind schema --q pdata_n
npm run --silent inventory-map:query -- analysis-search --kind table --schema pdata_n --q sale --limit 12
npm run --silent inventory-map:query -- analysis-view --id task:107491
npm run --silent inventory-map:query -- analysis-fields --id task:86840 --limit 40
npm run --silent inventory-map:query -- analysis-sql --id task:86840 --line-start 100 --line-count 40
```

`analysis-view` 的 `id` 为场景起点，`focus` 为当前阅读对象，`expanded` 是最多 12 个对象 ID 的 JSON 数组；字段 ID 从 `analysis-fields` 取得，不手拼物理身份。`analysis-search` 未限定 kind 时交错返回任务与表，支持分页；schema 是真实对象的技术位置，独立于调度主题。元数据定义使用返回的 `definition:<hash>` ID，通过 `analysis-sql` 分页读原文。

分析模块分工：`analysis-index.mjs` 构建固定索引；`analysis-evidence.mjs` 核对版本并读取字段/SQL/DDL；`analysis-query.mjs` 计算场景与证据；`analysis.html/js/css` 展开节点与阅读。源文件中的同名元数据只作为候选；字段表达式按各写入绑定组织，读取发生次与 UNKNOWN 保留。具体阅读路径和边界见 [交付说明](../../docs/inventory-map.md)。

构建默认读取 `config/workspace-paths.json` 的 `evidenceRoot`，其下的 `schedule-evidence/tasks-sqlite/schedule-evidence.sqlite`。不修改源库，不补采、不解析 SQL、不生成 Facts 或任务投影。

```powershell
# 可显式指定另一份已存在的快照或视图规则
node scripts/inventory-map/build.mjs --source <SQLite文件> --output <输出目录> --rules <规则JSON>
node scripts/inventory-map/server.mjs --output <输出目录> --port 8768
```

## Agent 查询

每次 stdout 返回一份 JSON。`ok` 表示查询成功，`version` 固定到打开的地图快照；查询不触发生成。Node 的 SQLite 实验性提示只出现在 stderr。

```powershell
npm run --silent inventory-map:query -- summary
npm run --silent inventory-map:query -- regions --q PDATA --limit 20
npm run --silent inventory-map:query -- tasks --region topic:EDW_SUM --limit 20
npm run --silent inventory-map:query -- tasks --schema PDATA_N --limit 20
npm run --silent inventory-map:query -- task --id 107491
npm run --silent inventory-map:query -- flows --source-region topic:ODATA_N_TIT --target-region topic:EDW_SUM --limit 20
npm run --silent inventory-map:query -- neighbors --id 209119 --direction up --depth 2 --limit 60
npm run --silent inventory-map:query -- sql --id 107491 --line-start 1 --line-count 80
npm run --silent inventory-map:query -- knowledge --id 107491
```

`regions/tasks/flows` 返回 `items/total/limit/offset/nextOffset`。查询任务列表默认只含原清单成员；外部引用仍可按 ID 查询和在邻域中出现。`neighbors` 返回节点、边、布局和 `truncated/stoppedBy`。节点身份不因展开重复；结果包含已选任务间的依赖，边数预算同样适用。

硬上限：分页 100 项、邻域深度 4、节点 150、边 400。可通过规则降低上限；查询和前端都遵守已发布快照的实际限制。

## 文件分工

| 文件                            | 职责                                                   |
| ------------------------------- | ------------------------------------------------------ |
| `source.mjs`                    | 配置定位、只读 SQLite 快照和逐条证据读取               |
| `model.mjs`                     | 规则校验、主题分类、哈希和聚合统计                     |
| `rules.json`                    | 阶段顺序、颜色、主题到阶段的规则、资源上限             |
| `build.mjs`                     | 编排全量构建、建立索引、检查成员口径并发布快照         |
| `query.mjs`                     | 全量索引上的只读检索、分页、聚合与有界遍历             |
| `layout.mjs`                    | 阶段分列、局部拓扑布局；高扇出自动换列，无任务专用坐标 |
| `evidence.mjs`                  | 按固定哈希读取 SQL；按任务身份复用公共 knowledge       |
| `cli.mjs`                       | 命令行参数和 JSON 输出                                 |
| `server.mjs`                    | 本机 HTTP 和固定静态资源路由，复用 CLI 查询分派        |
| `index.html/view.js/view.css`   | 地图、主题目录、成员、SQL 与知识阅读面板               |
| `build.test.mjs/query.test.mjs` | 数据合同、重跑、统计、预算和局部遍历回归               |
| `browser-check.mjs`             | 真实本地网页阅读路径与截图验证                         |

## 产物与重跑

默认输出 `artifacts/inventory-map/`，属于可重建的本地产物，不提交到 Git：

```text
CURRENT.json                         当前成功快照指针
summary.json / manifest.json          最新结果的便利副本
snapshots/<version>.sqlite            不可变查询索引
snapshots/<version>.summary.json       对应版本的统计
snapshots/<version>.manifest.json      来源、规则和构建器版本
browser/                              本地浏览器验收结果
validation/                           改标签后全量重跑的验证结果
```

更改 `rules.json` 中一个主题的 `stageId`，重新构建，阶段计数、流向和布局输入随之变化，无需修改网页。规则优先匹配：有专用 `exact` 规则时放在更宽的正则规则之前。

源库在一个只读事务内读取。构建先写临时索引，完成后发布内容版本并最后替换 `CURRENT.json`；失败不会切换当前成功版本。版本包含消费输入、规则及构建代码哈希。服务在启动时绑定一个版本；构建成功后重新启动服务以切换，旧服务继续读取原快照。

## 证据与展示口径

- 清单范围由 `task_inventory` 决定。依赖引用但不在清单的任务另列 `externalTasks`；卡片 `taskCount` 与默认成员列表都只计清单成员。
- 名称和主题优先来自 `szdata-schedule-detail.detail`。缺详情时只用关系行的名称/主题补充并记录来源；不把不可靠的 Horae `name` 当任务标题。
- 主题 `topicName` 与配置库 `database` 是两个维度。例如 `PDATA_N` 可以是配置库，任务却属于 `EDW_SUM` 主题。目录按主题组织；精确配置库筛选用 CLI `tasks --schema`。
- `up` 证据转为邻居 → 当前任务；`down` 转为当前任务 → 邻居。同一任务对仅计一次，记录单方向/双方向观察。空邻居记录与缺缓存分开。
- 所有关系均为**调度依赖**。它们不证明 SQL 字段因果、运行成功或数据实际到达。配置状态保留原码，不冒充运行状态。
- 阶段是阅读规则。未命中阶段规则的主题保留在“其他未分类”；不把 schema 或 topic 的解释自动传给每个任务。
- 总览显示按依赖对数量排序的前 8 条跨阶段流向；完整流向可从列表逐条追查。主题周边最多显示 18 条主要流向，其余可查成员。限制与遗漏均在页面说明。
- SQL 覆盖只计 `hive-task` 和 `run-script` 正文，不把 DDL 计为 SQL。依赖索引不复制全部 SQL；读取时检查原库内容哈希与快照引用匹配，再按行返回并隐藏环境地址/敏感配置。
- 公共知识可选，复用既有 `dataRoot/knowledge/tasks`；它有独立的适用范围与证据，不冒充本次调度快照已经重新验证的业务结论。

## 验证

```powershell
npm run test:inventory-map
node scripts/inventory-map/analysis-browser-check.mjs --base-url http://127.0.0.1:8768/ --playwright-root "C:\Users\13246\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules"
```

浏览器测试使用已安装的 Playwright 与本机 Edge；先启动服务，再按本机实际路径指定 Playwright 所在的 `node_modules`。也可设置 `PLAYWRIGHT_NODE_MODULES`。结果位于 `artifacts/inventory-map/browser/report.html`。测试应针对本次改变，不反复扫描源库或运行整个血缘生产测试套件。

2026-09-07 已完成一次真实全量规则变更验收：将 `EDW_SUM` 从 `model` 改到 `application`，隔离重建耗时 19.362 秒，峰值 RSS 150.79 MiB；706 个库存任务与 2 个外部引用自动换组，14 组阶段流向计数变化。源输入哈希、任务成员集合、全量任务数及总边数保持一致，原规则与当前快照未改。报告见 `artifacts/inventory-map/validation/remap-result.json`。

# Titans → OTC 图谱共享与消费方案

更新：2026-09-05。配套执行清单：[titans-otc-graph-reuse-execution.md](titans-otc-graph-reuse-execution.md)。

## 落地状态（2026-09-05）

主要交付为 [Agent CLI](agent-graph-cli.md)，[全量验收](titans-otc-graph-acceptance.md)已落盘：3,615 任务，2,258 字段投影，任务投影共享不可变版本，Neo4j 原生局部查询及增量发布。下面的“当前情况”和问题清单记录方案起点；最新覆盖和限制以验收文档为准。

## 目标与当前情况

复用已有 Machine Facts、调度证据和任务局部投影，让 agent 从全局发现、局部加工进入字段解释与差异比较。不同图是同一份证据的查询视图；换图、换起点、换布局不重新生成任务投影。

本轮重新核对的 Titans/OTC 调度交集为 3,615 个任务，其中 1,674 个有 SUCCESS Facts manifest，其余 1,941 个没有 manifest。后者不能全部记为字段解析失败。正式 OTC 终点按 `dm_otc_n` 识别，其他集市作为相关分支；`odata_n_tit` 主题不自动等于 Titans 实际源库。

现有材料见 `studies/titans-otc-agent-comparison/input-snapshot.json`、`comparison-results.md`、`processing-logic-map.md`。六任务样例已产生投影与 85 个读取点的接续记录，但实验没有接用共享调度缓存。通用查询接收的发布目录与任务并集目录不同，是本批接入缺口。

## 版本分工

| 对象                                   | 当前版本 | 含义                                |
| -------------------------------------- | -------- | ----------------------------------- |
| `MACHINE_FACTS_CONTRACT_VERSION`       | `1.3.0`  | Facts manifest/记录合同             |
| `MACHINE_FACTS_ADAPTER_VERSION`        | `1.3.9`  | 发布器实现版本，参与生成 provenance |
| `MACHINE_FACTS_STATUS_VERSION`         | `1.0.0`  | analysis-status 文件结构            |
| `TASK_LOCAL_PROJECTION_SCHEMA_VERSION` | `1.3.0`  | 任务投影结构，是另一份合同          |

这四项不是同一条版本序列。本次不以目录、配置或缓存改动为由升级 Facts 合同、重跑解析器或改变既有证据强度。当前 Reader 中的 L1/legacy 标签与版本兼容策略单独处理，不能把 `SUCCESS` 说成运行或业务验收。

## 已确认的实现问题

1. 任务投影缓存写到调用方的 `outputRoot/tasks`，换图目录容易重复生成。并集 loader 已支持清单引用绝对路径，可复用而无需重写投影。
2. `impact-query-harness.ts` 会现场调用 `projectTaskLocal`，并将旧案例接续索引写为默认值。路径、材料准备与查询混在一起。
3. 当前缓存检查调用完整 Facts Reader，首次 Pack 定位还会扫描目录。已有进程内目录缓存，不能说每个任务都重复全目录扫描。
4. 单个读取点的接续反复检索并集中的读取和写入，适合一次建立 Map 后复用。
5. 字段结果包含 expression/relation ID，但具体公式与过滤字面量仍需 agent 自行拼接 SQL 证据。
6. 多个直接调度父任务目前会影响字段接续资格；必须区分共同供数与竞争来源。

小测：106204 已有投影读取约 7 ms，缓存命中检查约 33.3 s，重新生成调用（含准备）约 39.5 s，内容哈希不变。仅为一次串行单样本，各操作承担的工作不同，不报告加速倍数或整批时间外推。

## 统一路径配置

新增 `config/workspace-paths.json`，通过一个 resolver 提供下面的角色。配置只定位材料，不写密码、Cookie、连接凭据。

| 配置项              | 职责                             | 初始位置                        |
| ------------------- | -------------------------------- | ------------------------------- |
| `dataRoot`          | 数据资产根                       | 现有 `sql-static-lineage-data`  |
| `evidenceRoot`      | 原始平台证据/调度缓存            | 现有 `sql-static-lineage-cache` |
| `inputPackRoot`     | Task/Table Input Packs           | data 根下的 `tasks/`、`tables/` |
| `factsRoot`         | Machine Facts                    | data 下 `field-facts/`          |
| `projectionRoot`    | 共享任务投影                     | data 下 `task-projections/`     |
| `graphRoot`         | 图的批次清单、接续索引和发布产物 | data 下 `artifacts/graphs/`     |
| `writerCatalogPath` | 已有写者目录                     | 继续使用已有 SQLite 文件        |

`dataRoot/evidenceRoot` 相对配置文件解析；其余数据路径相对最终 dataRoot 解析，也允许绝对路径。命令行显式路径按当前工作目录解析。优先级为命令行覆盖 > 兼容环境变量 > 配置文件；`--config` > `LINEAGE_CONFIG` > 仓库默认配置。未知字段、空字符串、非法 JSON 必须给出明确配置错误。

默认图批次由 `activeProfile` 对应的 `profiles.<name>.batch` 选择，批次清单与接续索引从 graphRoot 推导。既有 golden 案例索引作为有名字的兼容 profile 放入配置，不再散落在源代码。旧 Greek 验收显式选择 `greek-legacy`；普通查询不静默把旧案例当成本批。

配置是路径唯一入口；第一阶段接入 Facts CLI、任务投影 CLI、字段查询根路径和图批次配置。旧程序 API 的显式参数继续有效。其他采集/历史脚本按调用链逐步迁移，不能把首阶段说成全仓路径已经清零。

## 共享投影与校验位置

```text
sql-static-lineage-data/
  tasks/ + tables/                  Input Packs，保留现状
  field-facts/                      已有 Machine Facts，保留原位
  task-projections/tasks/<taskId>/   共享任务缓存
  artifacts/graphs/<batch>/          图的清单与接续产物
```

图清单引用共享任务投影，改变输出目录只改变清单位置。缓存按任务及输入版本选择，不能因为另一个图已使用相同任务就再生成。

实施分两层完成：先统一共享存储与调用入口；再以不可变版本文件和已校验批次封装查询输入。旧缓存不能在没有校验当前 Facts/Pack 指纹时直接晋升为当前版本。

- 生成阶段读取生成所需材料，记录对应版本。
- 归并/发布阶段集中核对输入版本、投影和接续引用，完整校验结果绑定到批次。
- 查询阶段读取这个批次及需要的关系/表达式材料，不重新遍历 Pack 目录，不隐式重建投影，不每问一题重做源文件全量校验。
- 只更新一个任务时，更新其投影及受影响的接续；旧批次仍引用旧版本。
- 调度更新最终独立于 SQL 投影。过渡期仍嵌入 scheduleReference 时，缓存键必须包含调度内容指纹，避免共享后复用陈旧调度信息。

## 接续与消费

调度关系优先发现相关任务，表与读写分区说明数据连接。字段追踪仍复用已有读次、写观察和关系控制，不把调度边变成字段值流。

一个任务可以读多张表、读不同日期、写多张表，只需多条读写记录。当前销售 T98 的四个任务分别写 `grp_id=01/02/03/04`，是产品分工；下游读多个产品时应展示多个贡献分支，而不是强行选一个 writer。同一分区的竞争写者才保留备选判断。

模板日期尚未精确对应时，加工调查可以沿有依据的调度关联展开；来源依据放在连接详情中。缺口按任务/连接聚合，避免大量内部状态码盖住已可用路径。

| 消费层次 | 预期结果                                       |
| -------- | ---------------------------------------------- |
| 全局     | 分层、读写者、公共依赖、分叉汇聚、相关字段族   |
| 局部     | 输入输出与分区、加工步骤、上下游路径           |
| 字段     | 来源、公式、过滤、Join、分配、分组、窗口       |
| 比较     | 共同来源以及币种、日期、行集、粒度、表达式差异 |

重用现有 Facts/SQL 的 expressionId、relationId、span 返回具体加工片段。语义层不另建一套解析器。全量标准口径计数、允许业务归并与机器发现重复结构分别处理。

## 范围、预期与停止条件

首个高把握实施包为路径配置、共享投影位置、跨图缓存复用及必要调度缓存失效；它不修改字段接续政策。接着处理批次固定版本/校验与纯读取查询，再以真实本金链验证接续与加工解释。

验收使用 T98 四产品分支、客户每日本金分配、TRS 合约/腿视图同源异名、销售日报窗口差异。性能分开记录首次准备、首次查询、连续查询、单任务更新。核心可检验目标是同一输入跨图只生成一次，查询期生成调用为零，批次版本不混用。

全量 1,674 任务生产放在小批验证之后，先测规模和预计成本，不直接开启未经估算的长跑。窗口帧 IR、子查询星号、L1 升级及 AML 多写失败修复继续单列。若真实问题必须修改接续语义或扩大材料范围，记录具体案例和影响再调整方案。

## 当前配置的使用方式

默认配置为仓库内 `config/workspace-paths.json`。现在 Facts CLI 与任务投影 CLI 可只传任务选择条件，路径由配置取得，例如：

```powershell
npm run input-pack:machine-facts -- --task-id 106204
npm run project-task-local -- --task-ids 106204
```

第一条命令会生成/发布 Facts；已有 Facts 时直接使用第二条。默认投影写入 `task-projections/tasks/106204/task-local-projection.json`，清单写入 `artifacts/graphs/titans-otc/batch-manifest.json`。`--output-root` 只更换图清单目录，`--projection-root` 才更换共享投影目录。这些是可用命令示例，本轮没有对真实任务执行生成。

三个入口支持 `--config <json>` 和 `--profile <name>`；也可通过 `LINEAGE_CONFIG`、`LINEAGE_PROFILE` 选择。旧 `--data-root` 在 Facts/投影 CLI 中仍指 Input Pack 根，与 `--input-pack-root` 等价；要切换整套资产根，修改配置 `dataRoot` 或设置 `LINEAGE_DATA_ROOT`。`LINEAGE_INPUT_PACK_ROOT`、`LINEAGE_FACTS_ROOT`、`LINEAGE_PROJECTION_ROOT`、`LINEAGE_EVIDENCE_ROOT`、`LINEAGE_GRAPH_ROOT` 可分别覆盖对应路径。

字段查询的 Titans/OTC 默认接续索引尚待 B 阶段发布，缺失会报告材料未就绪。旧 Greek 查询可显式传 `--profile greek-legacy`。旧 golden 环境变量与 `FIELD_EVIDENCE_INDEX_PATH`、`WRITER_CATALOG_PATH` 继续兼容，不再要求将这些机器路径写进查询代码。

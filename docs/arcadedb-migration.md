# data-graph 切换 ArcadeDB：验收记录

2026-09-10，当前工作区的默认图库已切换为 **ArcadeDB 26.9.1 Windows native**。
Agent CLI 与当前 API/React Flow 前端代理读取同一已发布版本，实时状态为 `READY`。
本记录是技术兼容性验收，不能代替公司的软件准入结论。

## 部署与边界

- 固定版本：[官方 26.9.1 release](https://github.com/ArcadeData/arcadedb/releases/tag/26.9.1)。
- Windows 压缩包 SHA-256：`49acb93a19fcb0bbe6fcf27360d0bb9abcbbdac1ebd927eafd468fb7f30eaf10`，与 release API 摘要核对一致。
- 本机运行目录 `artifacts/arcadedb/runtime`；可执行文件及哈希记录见 `artifacts/arcadedb/runtime-manifest.json`。
- `config/workspace-paths.json` 使用 `graphDatabase.provider: arcadedb`。数据库保留验收时创建的名称 `lineage_arcade_trial`，现已作为默认查询库。
- 密码文件 `artifacts/arcadedb/password.txt` 不提交 Git；环境变量 `ARCADEDB_PASSWORD_FILE` 可覆盖路径。配置中的相对路径基于配置文件所在目录解析。
- 沿用 Apache-2.0 的 `neo4j-driver` 6.2.0 作为 Bolt 客户端；该 npm 包不是 Neo4j 服务端。ArcadeDB 项目采用 Apache-2.0，许可证见[官方源码](https://github.com/ArcadeData/arcadedb/blob/26.9.1/LICENSE)。
- 原 Facts、投影和正式 publication 保持原路径；新库由现有材料重建，不成为事实来源。旧 Neo4j 实例未卸载或删除。

启停命令及 API/前端启动方式见 [本机操作手册](data-graph-local-runbook.md)。
新的 checkout 不含本机二进制、数据库和密钥；迁移机器时需恢复这组部署文件，
或从固定官方 release 重新部署后用既有 `prepare → publish` 流程重建图。
不能仅复制配置文件就宣称新机器已部署。

## 真实数据验收

| 检查                                | 结果                                                               |
| ----------------------------------- | ------------------------------------------------------------------ |
| 发布版本                            | `fd7070e0a37c10e99ec235fdd0db10f355c581d0a2e5679410d95d9cc984489a` |
| 任务                                | 7,039，其中 5,600 PROJECTED                                        |
| 业务节点                            | 414,492，逐 kind 与原库相等                                        |
| 业务关系                            | 727,329，逐 kind 与原库相等                                        |
| 已确认字段接续                      | 56,445                                                             |
| 候选字段接续                        | 60,785                                                             |
| 调度引用边                          | 11,733，继续保持 schedule reference 语义                           |
| INDEX、终止规则、源端点边界快照哈希 | 与原 publication 一致                                              |
| 重复发布                            | 隔离配置及正式默认配置均返回 UNCHANGED，updatedTasks=0             |
| 正常关闭后重启                      | 数据保留，CLI 17 项对照再次通过                                    |

使用真实发布器导入全部任务和接续 owner；试验发布输出置于隔离目录，
writer catalog 使用一致性备份。没有重算原始 SQL/Facts，也没有改变字段证据、
候选确认、分页、有界遍历或终止规则合同。

17 项 CLI 对照涵盖状态、搜索、字段分页、表写入方、双向字段追溯、仅确认接续、
截断、四产品字段对照、表达式与 SQL、发布指标及参数错误。除耗时及运行报告字段外，
消费数据与旧库一致。另用相同当前服务代码对照 6 类 HTTP 接口：overview、search、
fields、table-hop trace、task/SQL、regions，业务响应一致。

当前 API 和前端代理均实测 `READY`，元数据目录也为 `READY`。
首次验收时 Codex 自带浏览器控制返回 `nodeRepl.fetch request failed`。
后续已通过本机 OpenCLI 连接现有 Chrome，实际完成搜索 86842、打开任务、
切换字段血缘、加载 90 个带注释字段、筛选并选择 `init_nom_prin`、展开两层上游。
页面显示 7 个节点、12 条连线，以及字段公式、来源和加工条件；截图保存在
`artifacts/arcadedb/acceptance/browser-field-expanded.png`。
原保存的“当事人 T01 调查”等探索入口仍可见。Codex 自带通道的错误未消失，
当前使用已验证的 OpenCLI/Chrome 通道。前端源码未因迁移修改。

## 必要适配与性能

1. owner 保存其关系起点键，增量替换从这些节点删除该 owner 的旧边。ArcadeDB 未采用原关系属性索引，原写法随数据增长反复扫关系。发布入口在内容哈希判定之前检查缺失的起点元数据，并在同一事务内通过一次关系扫描批量补齐，包含无边及仅贡献边的 owner；内容未变化或中断续跑也不会漏掉升级。该步骤不修改 owner 内容哈希、节点或血缘边。独立调用单个 owner 替换时仍保留兼容兜底。
2. 搜索按 TASK、PHYSICAL_DATASET 两支查询，避免扫描全部字段节点。
3. 任务/节点定位先使用唯一键，再检查 graphId，避免查询规划器选择宽泛 graphId 索引。
4. 增加 `(graphId,kind,taskId)` 索引覆盖任务字段列表，字段列表/字段起点查询以
   单行 `UNWIND` 绑定查询值，避免 26.9.1 的成本规划器误选另一条 task/table 复合索引。
   保留排序、分页、writeId、graphId 和证据边界过滤，没有改为按 owner 猜测字段归属。

写入仍在同一 `executeWrite` 事务内，缺失端点失败时关系、owner hash 和起点键一起回滚。
增量发布的确认/候选接续总数及 `continuationEdgeMetrics` 使用清理后的实时全图计数，
不能用本轮受影响任务的计数代替全图总数。
真实数据库测试覆盖重复 MERGE、参数化 Unicode、约束重复创建、edge-only owner、
并行边、共享节点保留、移除、旧 owner 元数据升级及失败回滚。

本机抽样（不是通用性能保证）：搜索 CLI 由最初约 4.9 秒改善到约 0.7 秒；
表级两跳 API 最后一次对照为旧库 111 ms / ArcadeDB 16 ms，修复前 ArcadeDB 约 4.3 秒。
后续字段优化：复用连接时，86842 的 90 字段列表三次为 18/14/21 ms，
字段追溯三次为 7/6/5 ms；此前相关查询约 300–600 ms。
CLI 含进程启动/连接等开销，优化后字段列表和追溯 wall clock 仍约 0.53–0.54 秒，
不能把 5 ms 写成整条 CLI 或页面端到端耗时。17 项 CLI、6 类正式前端代理接口再次对照通过。
全量导入曾中断并续跑，不能把某一段耗时标为一次全新全量导入耗时。

## 检查结果与证据

- `data-graph` 完整测试（启用独立 `_probe` 库）：38 个文件通过，215 项通过，4 项既有可选测试跳过。
- 仅提取本次改动、基于主线的隔离提交验收：32 个文件通过，184 项通过，3 项可选测试跳过；不包含其他任务尚未提交的代码和新增测试。
- 类型检查：仍有迁移前已存在的 3 个测试类型错误（catalog 缺字段、overview 空元组），没有新增类型错误。
- 独立包 build：失败于现有源码跨越 `rootDir: src` 的 TS6059。正式运行入口直接通过 tsx 执行，不依赖该独立包 dist；本次未扩展为构建结构重构。
- 仓库有其他未提交工作，本次未提交或清理这些改动。
- 本机完整报告在 `artifacts/arcadedb/acceptance/`；探针及逐条 CLI/HTTP 响应另保留于 `.tmp-arcadedb/`。

可复跑真实驱动集成测试：先单独创建数据库名以 `_probe` 结尾的测试库，并提供对应配置；
禁止把默认查询库传给测试。测试自身只清理随机 graphId 的夹具。

```powershell
$env:ASSET_GRAPH_BOLT_TEST_CONFIG = '<probe-config 的绝对路径>'
npm --prefix packages/data-graph test -- tests/asset-graph-bolt.integration.test.ts
```

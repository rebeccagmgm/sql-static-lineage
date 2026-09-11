# Titans → OTC 全量图谱验收

2026-09-06 更新。主要交付是 **Agent CLI**，使用方式见 [agent-graph-cli.md](agent-graph-cli.md)。

## 1.0.5 补充：码值参数表

当前正式版本为 `0201095db57db357efe6daab8d1bd55f45e5d092463ffe19dd720c0dab653c75`。按用户确认，将 `pdata_n.ref_dw_cd_val` 精确加入 REFERENCE_CONFIG，新增 121 个政策终止读次；总计 1,221 个读次、44 张表。可行动缺口读次由 1,197 降至 1,109；这是终止范围调整，原始 INDEX 哈希未变，未新增 L1。复用同一份材料发布。[补充验收](../studies/reference-config-boundary/ref-dw-cd-val-acceptance.json)。

## 1.0.5 定义/参数表按规则停止展开

首次政策发布版本为 `1fc9dd200607c1e33549148bb5285435218fcd1bf7c84826813f63feb2f4766f`，compiler `1.0.5`。复用同一份 3,615 任务 prepared 材料，PROJECTED 2,256、SCHEDULE_ONLY 1,190、COLLECTION_FAILED 169。没有重采 Pack、修改 Facts 或手改 INDEX 结果。

既有 REFERENCE_CONFIG 规则现已进入图发布、追溯、指标和页面：1,100 个身份已确认的读次、43 张表标为 `POLICY_TERMINAL`，显示“定义/参数表 · 已按规则停止”。保留表、读取依赖、读取条件及 SQL；向上追溯合法停止，不继续生成这些读次的跨任务接续。配置与 INDEX 绑定为冻结政策快照，哈希参与发布版本。身份不明的读次不会靠表名升格；政策终止与源端点证明分别统计。

| 指标                              |                     1.0.4 |                     1.0.5 |
| --------------------------------- | ------------------------: | ------------------------: |
| 总读次                            |                     9,934 |                     9,934 |
| 按规则终止读次                    |                         0 |                     1,100 |
| 全部候选满足 L1 的读次 / 口径分母 |   2,213 / 9,934（22.28%） |   2,149 / 8,834（24.33%） |
| 可行动缺口涉及读次                |                     1,826 |                     1,197 |
| PARTITION_NO_MATCH 缺口数         |                       701 |                        84 |
| 待分类无 writer 读次              |                     4,177 |                     3,777 |
| 材料缺口涉及读次                  |                       275 |                       275 |
| 已确认字段接续 / 全部字段接续     | 25,793 / 56,436（45.70%） | 24,113 / 54,583（44.18%） |

**这是范围政策和解释质量改善，不是新增确认血缘。** 分子与分母同时排除终止读次；字段边占比因移除定义/参数表接续而下降。617 个分区不匹配缺口不再要求修复，但原始 INDEX 中的 DISJOINT 证据仍保留。此前提到的 1,253 个 DISJOINT 是候选观察，不能与此处去重后的读次/缺口数量直接相减。

正式图核对：1,100 个预期读次全部存在并标记，43 张表全部保留。162610 四产品链的 8 条确认接续、86842 到 79952/106102 的 4 条确认接续均保留，无截断。页面实测可读过滤条件和 SQL；同批次重复发布返回 UNCHANGED，更新任务 0。目标测试 32 项通过，独立代码复核通过；全仓 typecheck 仍仅有原有 `tests/knowledge/task-knowledge.test.ts` TS7016，未宣称全仓通过。验收证据：[发布指标](../studies/reference-config-boundary/published-metrics.json)、[节点完整性](../studies/reference-config-boundary/graph-policy-integrity.json)、[终止读次分页](../studies/reference-config-boundary/terminal-page.json)、[页面截图](../studies/reference-config-boundary/terminal-field-view.png)。

## 1.0.4 动态写分区字面量消费（历史）

该轮正式版本为 `494fa480a2cfd0ede6d87cff0bb755e9c96beb3da2e22567cef5c7cdaa62e90e`，compiler `1.0.4`。本次复用 1.0.3 的同一份 3,615 任务发布材料，未重采 Pack、未重建任务投影。

已修复下文 1.0.3 记录的 DYNAMIC 分区提值缺口：消费者从精确写次的 CONFIRMED 分区映射，找到 RESOLVED 输出绑定，再沿 Facts 表达式及 UNION 分支的对应输出序号取字面量。所有分支都解析为同一个值时才落成静态分区；缺分支、非字面量、不同分支值冲突仍保留 UNKNOWN。没有恢复任务级 Pack 跨写次回填，也没有手改 INDEX 或图边。

| 指标                                    |                     1.0.3 |                     1.0.4 |
| --------------------------------------- | ------------------------: | ------------------------: |
| 已确认字段接续 / 全部字段接续           | 25,787 / 56,756（45.43%） | 25,793 / 56,436（45.70%） |
| 全部 retained 候选满足 L1 的读次 / 分母 |   2,194 / 9,934（22.09%） |   2,213 / 9,934（22.28%） |
| WRITER_PARTITION_UNKNOWN 候选缺口       |                     2,819 |                     1,547 |
| 待分类无 writer 读次                    |                     4,177 |                     4,177 |

200369、237301 的 `grp_type_code` 已分别恢复为 `OTC_DERI_CONTR_TYPE`、`OTC_DERI_CONTR`。原先 1,288 个 UNKNOWN 候选观察现在分为：19 个 CONFIRMED、1,253 个 DISJOINT、16 个 UNKNOWN。多数候选恢复值后证实分区不匹配，不能把这 1,288 个候选等同于可升格读次或字段边；本次实测也没有达到 50%+。

目标单测 32 项通过，独立代码复核通过。正式 confirmed-only 查询确认：162610 两个 UNION 分支仍有 8 条确认接续，86842 仍连到 79952、106102，均无截断、无投影生成。全仓 typecheck 仅剩原有 `tests/knowledge/task-knowledge.test.ts` 的 TS7016，未改动该范围外模块。

证据：[1.0.4 验收快照](../studies/dynamic-partition-literal/acceptance.json)、[真实写分区重放](../studies/dynamic-partition-literal/real-writer-replay.json)、[正式发布指标](../studies/dynamic-partition-literal/published-metrics.json)。以下保留为历史基线，不代表上述提值缺口仍未修复。

## 1.0.3 接续治理历史基线与口径

2026-09-06 本轮正式发布已完成：compiler `1.0.3`，版本 `63ab86983a420cc9e48d11dc66f14fc5a51e182352e26831ebeef9e9e23fb613`。固定 3,615 个任务，其中 PROJECTED 2,256、SCHEDULE_ONLY 1,190、COLLECTION_FAILED 169。以下基线保留用于比较。

| 指标                                    |                    发布前 |                  本轮发布 |
| --------------------------------------- | ------------------------: | ------------------------: |
| 已确认字段接续 / 全部字段接续           | 30,417 / 54,479（55.83%） | 25,787 / 56,756（45.43%） |
| 全部 retained 候选满足 L1 的读次 / 分母 |   2,971 / 9,995（29.72%） |   2,194 / 9,934（22.09%） |
| 已证实可排除的源端点边界读次            |                         0 |                         0 |
| 待分类的无 writer 读次                  |                     4,229 |                     4,177 |

**确认率提升目标尚未达成**，不能把本轮发布描述为 65–70% 的确认率改善。写次精确绑定后的分区缺口和当前材料变化均纳入新结果；日期模板政策未收紧。任务 136594、160518 因当前 Facts `MANIFEST_HASH_MISMATCH` 从 PROJECTED 转为 SCHEDULE_ONLY，交由材料治理处理。

发布后只读归因：2,819 个 `WRITER_PARTITION_UNKNOWN` 候选缺口中，2,084 个来自 Facts `partition_mode=DYNAMIC`。其中 200369、237301 写入 `dm_index_n.grp_def` 各涉及 644 个候选，Facts 已确认分区列的输出序号，SQL 又分别提供固定值 `'OTC_DERI_CONTR_TYPE' AS grp_type_code`、`'OTC_DERI_CONTR' AS grp_type_code`。当前消费者尚未把这条序号映射收敛成静态分区值，导致 1,288 个候选保守地保持 UNKNOWN。这是已定位的消费侧精度缺口，不能全部归为材料缺失；后续应消费精确写次的表达式证据，不恢复任务级 Pack 跨写次回填。这 1,288 个候选不等于 1,288 个可直接升格的读次。

正式 Neo4j 查询实测：162610 `index_val` 的两个 UNION 分支各有四条确认接续，分别到 220650、86840、86841、86842；86842 `init_nom_prin` 仍连到 79952、106102。两次查询均无截断、无投影生成。目标单测 83 项通过、2 项跳过，既有 Agent CLI 回归 16 项通过。同批次重复发布返回 `UNCHANGED`，更新任务 0，耗时 111 毫秒。全仓 typecheck/build 仍有范围外错误，不能声称全仓检查通过，详见本轮日志。

可复核结果：[本轮验收快照](../studies/continuation-governance/acceptance.json)、[发布指标](../studies/continuation-governance/published-metrics.json)、[162610 正式字段链](../studies/continuation-governance/trace-162610-confirmed.json)、[86842 正式字段链](../studies/continuation-governance/trace-86842-confirmed.json)。本轮完成消费侧指标/缺口 CLI、FE 与 INDEX 资格对齐、精确写分区挂载和统一发布；C1 读侧 scope 恢复、新静态列剪枝、Machine Facts jsonl 合同修改、processing-map/kg-view 缺口 UI 尚未实施。

本轮固定的已发布基线是 compiler `1.0.2`、3,615 个任务，发布版本 `d356b1c14874d2654b17d06ae8b6afba6c3473ecad5cecb31ee9416c291b651f`。历史图状态与当前代码版本分别记录，不把规则修复后的预期写成已发布结果。

| 指标                                    |                  固定基线 |
| --------------------------------------- | ------------------------: |
| 已确认字段接续 / 全部字段接续           | 30,417 / 54,479（55.83%） |
| INDEX 读次                              |                     9,995 |
| 全部 retained 候选满足 L1 的读次        |                     2,971 |
| 至少一条 retained 候选满足 L1 的读次    |                     3,207 |
| 无已知写入观察的读次                    |                     4,229 |
| 全部 retained 候选为 ASSUMED 的读次     |                     1,528 |
| WRITER_PARTITION_UNKNOWN gap / 涉及读次 |                 593 / 271 |
| 多 retained writer 读次                 |                     3,417 |

55.83% 是字段接续边占比。读次指标 `withinUnionConfirmationRate` 使用全部候选满足 L1 的读次作为分子，只排除有独立证据的源端点边界。固定基线尚无可直接消费的独立边界分类证据，因此暂不排除上述 4,229 个无 writer 读次，读次口径为 2,971 / 9,995（29.72%）。这两个指标衡量不同单位，不能互相替代。

并行核验对同一基线的 4,229 个无 writer 读次完成了 catalog/最终写范围盘点：2,995 个在 catalog 未找到 writer，仍待补证据；1,064 个有批次外 writer；160 个对应集内非最终写，被当前接续范围排除；10 个对应集内 writer 投影缺失或失败。详见 `tmp/pm-lineage-closeout/orphans/no-known-write-summary.json`。其中“catalog 未找到”不等于已证实源端点，非最终写也不能直接广播成跨任务 writer。该诊断依据独立保留，不用它改写旧 INDEX 的确认状态。

按用户明确取舍，本轮保留原日期模板归一化和确认口径，不把日期严格化作为发布阻塞项。因此现有 L1 表示既定静态策略下的确认，不证明实际运行日期相等或数据已经到达。FE 默认保留调度提示，但不据此选择 writer，也不重新授予 INDEX 未确认的 L1。写分区优先使用绑定到具体写次的 Facts/SQL，Pack fallback 需要精确目标与唯一写次证据。并行任务的 162610 UNION 分支绑定修复一起纳入；投影生成器 `1.3.4`、compiler `1.0.3` 和 evidence-v3 使旧消费缓存失效。

`metrics` 命令提供固定发布快照的指标与分页缺口。没有重采 Pack，没有把无材料任务或未知边界虚构成确认接续。原有发布验收保留如下，作为 `4f61cee…` 版本的历史结果。

## 2026-09-05 历史发布结果

3,615 个任务已进入 Neo4j 的 Titans OTC 图，发布版本为 `4f61cee7134b1cba7686191bc0e8606ab28cc4d673935a50298e7ba792babf9a`。

| 项目                      | 实际数量 |
| ------------------------- | -------: |
| 任务                      |    3,615 |
| 已有字段投影的任务        |    2,258 |
| 调度层任务                |    1,177 |
| 材料/目标 Schema 缺口节点 |      180 |
| 图节点                    |  165,207 |
| 图关系                    |  328,799 |
| 物理表身份                |    2,740 |
| 写入字段观察              |   64,752 |
| 读取字段观察              |   51,128 |
| 任务内字段值依赖          |   70,983 |
| 字段条件依赖              |    1,574 |
| 行集加工控制              |   44,706 |
| 已确认字段接续            |    4,416 |
| 候选字段接续              |   47,129 |
| 调度依赖                  |    6,035 |

180 个缺口中，165 个没有可用 Pack/Facts，15 个下游搬运任务的目标 Schema 尚未被现有投影器定位。它们保留任务节点和已有调度关系，不虚构字段边。逐任务清单位于 `studies/titans-otc-graph-acceptance/full-graph-acceptance.json` 的 `failures`。

早期研究快照是 1,674 份 SUCCESS Facts；执行期间磁盘材料继续变化，本报告采用最终固定批次。最终生成器版本 `1.3.1` 补齐了 SEMI/ANTI Join 类型识别，两项实际投影失败转为 PROJECTED。没有修改 Machine Facts 合同版本。

## 构建和增量验收

| 检查             | 实测结果                                                 |
| ---------------- | -------------------------------------------------------- |
| 修复后全量准备   | 151.57 秒，3,615 任务；进程 RSS 峰值约 920 MiB           |
| 稳定输入复查     | 106.97 秒，3,615 HIT，0 MISS；无投影重建                 |
| 首次 Neo4j 发布  | 175.82 秒，当时 2,256 个字段投影任务                     |
| 修复后版本发布   | 128.00 秒；更新投影版本，只有 7 个任务的接续关系发生变化 |
| 同一批次重复发布 | 146 毫秒，`UNCHANGED`，0 个任务更新                      |
| 不可变版本       | 当前缓存更新后，旧版本文件仍可读取，旧内容保持不变       |
| 全图一致性       | 每任务值/条件/控制数量和编译结果一致，Neo4j 总数亦一致   |
| 增量替换         | 删除旧任务关系和无主节点，其他任务与共享节点保留         |
| 事务失败         | 缺失边端点会回滚，原有任务版本与关系不变                 |
| 删除任务         | 清理该任务贡献，不删除其他任务使用的共享实体             |
| 查询计划         | 字段锚点为 `NodeIndexSeek`，未使用 `AllNodesScan`        |

这里的“稳定输入复查”包含读取并校验 Facts，不是查询延迟。查询直接读取已发布 Neo4j 的局部邻接关系。图保存直接关系及写次/读次，不保存每个根任务的完整传递闭包。

增量发布按任务拥有的节点和关系替换；写入表变化时重算受影响的消费者接续。查询期间不调用投影生成器。更新开始后图状态为 UPDATING，完成后为 READY；中途失败可重跑，不能把半次更新当作新版本查询。

## Agent CLI 验收

`graph:verify` 从系统临时目录调用仓库内的 PowerShell 入口，16 项真实端到端检查全部通过：帮助、状态、搜索、表写者、字段分页、字段追溯及复查、只看确认接续、四产品公式比较、销售分配公式、日报过滤、SQL 按行读取，以及错误参数/缺参数/深度超限。

- T98 表级查询返回 86840、86841、86842、220650 四个写者；写入证据分别为 `grp_id=01/02/03/04`。多个调度父任务没有统一阻断共同供数。
- 86842 的 `init_nom_prin` 能追溯 `dynamic_notional` 与 `notional`；返回完整条件公式。
- 四产品公式比较保留各自写入身份，公式不因输出列同名而合并。
- 93338 的加工查询能找到 `dyna_nom_prin × allo_prop_*` 和按年内天数折算的聚合公式。
- 162610 的 `index_val` 加工详情包含 `SKIP_REPORT` 过滤。
- 默认字段值遍历排除 CONDITION，条件与 Join/过滤在加工详情中读取。

最终一轮独立 CLI 进程的实测墙钟时间约 1.4–1.9 秒，包含 PowerShell、Node、驱动启动。数据库局部查询：T98 写者查询约 28 毫秒；两次字段追溯分别约 28、80 毫秒；只看确认接续约 14 毫秒。它们是本机本批实测，不是并发性能承诺。

`index_val` 等复杂嵌套字段可能已有绑定与完整内部公式，但现有任务投影未给出完整跨任务值路径；Agent 可通过 `processing`、条件与 SQL 继续解释加工。没有将这部分写成字段因果闭包已全部解决。

## 验证文件与范围

- `studies/titans-otc-graph-acceptance/cli-acceptance.json`：16 项 CLI 检查及耗时。
- `studies/titans-otc-graph-acceptance/full-graph-acceptance.json`：全批投影一致性、图数量、类别和逐任务缺口。
- `studies/titans-otc-graph-acceptance/incremental-acceptance.json`：8 项增量/事务/查询计划检查。
- `docs/agent-graph-cli.md`：Agent 调用合同、分页与按范围查询。
- `config/workspace-paths.json`：统一路径及 Neo4j 连接配置，密码留在环境变量指定的文件中。

最终目标检查为根仓库 21 项通过，data-graph 19 项通过、2 个未挂载的真实材料 golden 跳过；根仓库和 data-graph 的 typecheck、根 build 均通过。较早跑过的历史综合测试有旧 Greek SQLite 访问错误、真实材料 golden 差异和超时，不能称全仓测试已经全部通过。本次验收使用上述真实 3,615 任务结果和目标检查，不修改旧 golden 的预期来凑通过。

HTML 调查页已完成一次浏览器检查，无页面脚本错误；它只作为辅助入口，Agent 不依赖该页面或它的 HTTP 服务。另一个并行任务新增的资产字段目录预览保持独立，未悄悄导入本批 Neo4j 图。

代码审查已修复三项实际问题：缺失关系端点不能静默丢边，字段值遍历排除条件通道，跨目录启动使用 Windows 可识别的 ESM 文件 URL。所有查询参数通过驱动参数传递，查询入口没有写入或投影生成调用。

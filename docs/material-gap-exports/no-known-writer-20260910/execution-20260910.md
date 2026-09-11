> **后续复核更正：** 本文“日常候选仅为 PLATFORM_CONFIG_ONLY、需要先新建框架写入模型”的结论已被实际 Facts 与补图验证推翻。439 个候选已有写入记录；冻结范围 1,088 个读取全部获得候选，578 个完整确认，尚未发布。请以 [补图修复复核](repair-20260910.md) 为准。

# 执行记录：缺少生产写入证据

执行时间：2026-09-10。仅覆盖本目录冻结的 1,088 个读取位置（163 个消费任务、362 张表）；未发布图，未改身份或分区解析代码。

## 当前口径复核

- 当前发布版本为 `14a013719c656861d98dc8734f8ab242cbb349de770931cf14aaf1c4a6af1f61`。
- 当前 `source-endpoint-boundary` 快照的 `expectedWriterMissingReadOccurrenceIds` 包含本包全部 1,088 个读取位置；另有 77 个后来新增的位置，不在本次交接范围。
- 索引底层 gap 记为 `NO_KNOWN_WRITE_OBSERVATION`，由该快照的独立证据分类为 `NO_KNOWN_WRITER`。两者不能混为“已经修复”。

## 全包已有材料盘点

以 `scope.json` 的 362 张物理表精确反查已有 Input Pack：

| 项目 | 结果 |
| --- | ---: |
| 命中至少一个 `task.target` 的表 | 362 / 362 |
| 命中的候选任务 | 562 |
| 候选任务已有 SUCCESS Facts | 440 |
| 候选任务已在当前 7,039-task 图批次中 | 0 |
| 候选 Facts 含 task-local materialization | 17 |

这说明本批并非“完全找不到任务材料”，而是当前图批次没有纳入这些候选任务；更重要的是，`task.target` 只是调度配置元数据，不能单独升级为生产写入边。

## 平台首批核验（146 个读取位置）

对读取次数最高的六张表做了当前 SZData 表元数据和候选任务 SQL 核验。六个日常候选任务均返回了配置目标和 `overwrite` 模式，但当前返回 SQL 没有对该目标表的显式 `INSERT`/`MERGE` 写入。它们应归为 `PLATFORM_CONFIG_ONLY`，不是可直接补图的 writer。

| 表 | 覆盖读取 | 日常候选任务 | 结论 |
| --- | ---: | --- | --- |
| `dm_index_n.index_grp1_cust_incm_allcali_mth_all` | 32 | 152879 | 配置目标；SQL 无显式目标写入 |
| `dm_index_n.index_grp1_ast` | 29 | 157103、178124 | 配置目标；SQL 无显式目标写入 |
| `dm_index_n.grp_tag_client_aum_perf_exam` | 26 | 190620 | 配置目标；SQL 无显式目标写入 |
| `pdata_nds.aum_org_base_info` | 21 | 186430 | 配置目标；SQL 无显式目标写入 |
| `dm_index_n.index_grp_total_asset_avg_mon` | 20 | 95516 | 配置目标；SQL 无显式目标写入 |
| `pdata_nds.aum_asset_ast_style_cd` | 18 | 164766 | 配置目标；SQL 无显式目标写入 |

同一首批中，任务 164971 的平台 SQL 确有 `INSERT OVERWRITE` 写入 `dm_index_n.index_grp1_ast`，但只覆盖 2025-12-12 和 2025-12-15 两个历史分区，且该任务没有本地 Input Pack。它是 `HISTORICAL_SQL_WRITER_UNINGESTED`：可作为带分区范围的待采集证据，不能被扩写成当前日常生产 writer。

额外交叉核验了 Hive 类候选 105920：本地 Input Pack 将其 `task.target` 记为 `pdata_n.t01_pty_inr_list_det`，但当前平台详情的目标表和写入模式均为 `-`，SQL 也没有显式写入。这证明本地配置目标本身还可能是历史或不完整材料，不能批量当作生产事实。

## 可修复动作

1. 为以框架输出为主的任务建立可复核的“配置目标到真实写入”的执行模型证据；在该契约明确前，保持 `task.target` 为配置元数据，不建写入边。
2. 对有显式 SQL 写入的历史任务，先采集 Input Pack / Facts，再将写分区限定到 SQL 证据范围；不与未限定的日常读取直接接续。
3. 只有上述两类证据完成后，才把相应生产任务纳入图批次并重算；本次不发布。

## 证据边界

SZData 返回的是任务配置与平台 SQL 元数据，不证明调度实例成功、数据实际到达或业务正确。

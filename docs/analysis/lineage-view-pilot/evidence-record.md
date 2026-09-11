# 字段血缘图谱表达方式：关系核验记录

## 核验边界

- 当前只读发布图：`titans-otc`，版本 `fd7070e0a37c10e99ec235fdd0db10f355c581d0a2e5679410d95d9cc984489a`，`READY`，发布时间 `2026-09-08T09:41:23.549Z`。
- 选样：9 组案例、12 个根任务。没有全域重建，也没有递归扫描缓存凑样本。
- 来源：当前 `graph:query` CLI、指定任务的 Input Pack、Machine Facts bundle、task-local projection 与 SQL。
- 本记录只证明静态证据和当前发布图的表达状态，不证明任务实际运行、分区实例存在或业务数据正确。

## 起始案例：105386 与 105526

已核实：

- `packages/data-graph-ui/src/graph-adapter.ts:70-85` 的字段卡分组键包含 `depth + taskId + writeId + table`。同一任务、同一表、不同 `writeId` 会先形成不同显示组。
- 105386 的 `localClosure.finalWrites` 为 `write-observation:105386:3` 与 `write-observation:105386:6`，都指向 `pdata_n.t03_agt_prd_rela_h`。
- 105526 的 `localClosure.finalWrites` 为 `write-observation:105526:17` 与 `write-observation:105526:33`，都指向同一物理表。
- 两个任务的 `query.sql` 都有两次 `INSERT OVERWRITE TABLE T03_AGT_PRD_RELA_H PARTITION(SRC_TBL)`：105386 在第 1、40 行；105526 在第 1、55 行。
- 两个 Pack 的配置分区都是 `src_tbl=ODATA_N_TIT.D_TRD_OTC_TRADE`。SQL 还包含对目标表的历史自读，并以 `SRC_TBL` 限定。
- 用户进一步确认：这两次写属于动态分区并应指向同一对象；问题是当前主图无法区分其显示意义，而不是必须创建两个数据范围节点。

设计含义：两次写发生关系保留在边或证据层；A、B 都不应仅凭 `writeId` 拆成两张物理表卡。这个案例不能用来证明两个不同分区。

证据位置：

- `packages/data-graph-ui/src/graph-adapter.ts`
- `task-projections/tasks/105386/task-local-projection.json`
- `task-projections/tasks/105526/task-local-projection.json`
- `tasks/hiveTask/105386/task.json` 与 `sql/query.sql`
- `tasks/hiveTask/105526/task.json` 与 `sql/query.sql`
- `field-facts/registry/tasks/105386/bundle/`
- `field-facts/registry/tasks/105526/bundle/`

## 其他样本的关系核验

### 119640：简单单来源、单写入

- 目标为 `pdata_nds.pos_trs_leg_his_pos`，分区模板为 `busi_date=${YYYY-MM-DD}`。
- 当前 projection 有 1 个最终写、1 个外部读取、101 条 `FIELD_DIRECT`，没有 gap。
- `key_leg_id` 的字段 trace 深度 1 为 2 节点、1 条 `VALUE/OBSERVED`。
- 结论：A/B 均无需因为一个动态日期模板拆卡。

### 86840、86841、86842、220650：同表不同明确成员

- 四个 Pack 均写 `pdata_n.t98_otc_deri_comp_sale_info`。
- `grp_id` 分别为 `01`、`02`、`03`、`04`；`busi_date` 均为动态模板 `${YYYY-MM-DD}`。
- `graph:query compare --task-ids 86840,86841,86842,220650 --column init_nom_prin` 返回四个不同表达式及其字段来源。
- 结论：这是 B 拆范围卡有真实信息增益的正例；A 必须在四条关系上完整显示成员。

### 103457：部分分区键读取，四个来源共同参与

- SQL 第 147–148 行读取 `pdata_n.t98_otc_deri_comp_sale_info`，限定动态 `busi_date`，未限定 `grp_id`。
- 当前发布字段 trace 对 `dyna_nom_prin` 返回生产任务 `86840,86841,86842,220650`，四条跨任务边均为 `CONTINUES/CONFIRMED`。
- 结论：多来源不是歧义，也不应强迫单选。B 必须把四个范围成员同时连入消费任务。

### 223867 与 123781：同为 grp_id=03，但证据状态不同

- 223867 SQL 第 148–150 行限定 `busi_date` 与 `grp_id='03'`。当前发布图从 86842 到该读发生点为 `CONTINUES/CONFIRMED`。
- 123781 SQL 第 231–233 行也限定 `grp_id='03'` 与动态日期。当前发布图从 86842 到该读发生点仅为 `CANDIDATE/ASSUMED`。
- 结论：单一来源不自动等于确认；范围卡不能替代线型和状态标签。

### 93338：多字段、多分支、控制关系分离

- `index_val` 的字段值输入为 `t98_otc_deri_comp_sale_adtnl_det.dyna_nom_prin` 与 `t98_otc_comp_mng_rela_info.allo_prop_1/2/3`。
- `grp_id` 来自 `dm_index_n.grp_def.grp_id`；`status` 是常量。
- 该任务还包含多层 `UNION ALL`、过滤、聚合。它们保留在 `controls`/证据层，不画成字段值来源。
- projection 保留 `FIELD_SOURCE_READ_OCCURRENCE_UNRESOLVED`，所以不能把所有字段分支描述为完整确认。

### 155157：两三跳追溯与证据缺口

- `actl_idx_val` 同时使用 `t98_sb_otc_opt_sub_trd_prcg_indx.pv/delta` 与 `t98_otc_deri_undrl_trd_lmt_idx.actl_idx_val`。
- 深度 4 的当前 trace 经过 106216/107480，并继续触达 43854/71733；边为 `VALUE/OBSERVED` 与 `CONTINUES/CONFIRMED`。
- projection 同时保留 `FIELD_SOURCE_READ_OCCURRENCE_UNRESOLVED` 和 `CONTROL_SIDE_UNRESOLVED`。
- 结论：可见的确认路径与任务级 gap 应并列展示；普通可达性不等于所有字段都有精确多跳证明。

## 有界查找的覆盖缺口

为寻找“无谓词整表读取、多个来源共同参与”，检查了 `pdata_n.t98_otc_deri_comp_sale_info.init_nom_prin` 的 8 个直接下游读任务：103457、113993、118141、118143、123781、162618、220981、223867。

这 8 个读发生点均存在 `busi_date` 或其他谓词，因此没有找到完全无谓词的真实样本。本次用 103457 的“只限定动态日期、未限定 grp_id，四个来源共同参与”作为最近的真实结构，但明确不冒充整表读取，也不据此判断全域不存在整表读取。

## 复核命令

以下命令均为只读、有界查询：

```powershell
npm --silent run graph:query -- status
npm --silent run graph:query -- compare --task-ids 86840,86841,86842,220650 --column init_nom_prin
npm --silent run graph:query -- trace --task-id 103457 --column dyna_nom_prin --layer field --direction up --depth 2 --limit 150
npm --silent run graph:query -- trace --table pdata_n.t98_otc_deri_comp_sale_info --column init_nom_prin --layer field --direction down --depth 1 --limit 150
npm --silent run graph:query -- detail --task-id 93338 --limit 100
npm --silent run graph:query -- trace --task-id 155157 --column actl_idx_val --layer field --direction up --depth 4 --limit 150
```

## 关系忠实度与展示问题的分离

- 展示问题：同一表因 `writeId` 不同出现重复卡；任务标签遮挡；多线难追踪；范围集合不直接可见。
- 证据问题：读发生点未解析、控制侧未解析、动态日期模板、候选接续、运行顺序未知。
- A/B 只能解决第一类；第二类必须保留 `CONFIRMED`、`ASSUMED/CANDIDATE`、`UNKNOWN/gap`，不能靠视觉模型“修好”。

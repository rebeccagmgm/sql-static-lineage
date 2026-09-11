# 19｜最长的链，应该在哪里停下来细讲

**这两条链的学习价值不同：L001 主要讲清报送字段怎样被搬运和按日期取出；L002 应重点解释成交回报怎样标准化，以及再次导出时保留、改写和丢失了什么。**链长不能直接决定讲解篇幅。

本文沿用[结构分析](06-graph-findings.md)中 199 条完整线性链的口径，仅复核最长两条涉及的 9 个任务。这是应用工作区既有排除规则、再临时剔除四张基础表后的全图。这里的“完整”指图中单入单出路径延伸至边界，不指业务全流程完整，也不证明数据已经端到端到达。既有规则还排除了公共转码等对象，因此图中单输入不等于 SQL 只读一张表：L002 的标准化实际另外读取了市场代码映射表。

## L001：报送字段的运输，与日期分区的约定

```text
titans_dm.v_otcm_se_report
  → odata_n_tit.d_v_otcm_se_report_p
  → odata_n_tit.d_v_otcm_se_report_pb
  → pdata_nds.otcm_se_report_pb
  → dm_otc_n.otcm_se_report
  → gf_otc.ref_otc_option_deal
```

源头已经提供合约编号、期权方向、名义本金、交易对手、报备状态和报备截止等字段。这 5 跳没有展示这些业务值的生成公式，也没有展示源视图的定义；因此不能用链条长度代替对报送口径的解释。

| 任务 / 跳                  | SQL 实际动作                                                                                                              | 讲解取舍与证据边界                                                                                                                                       |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 151775 / 视图 → `_p`       | 直接选择 34 个业务字段，另以 `SYSDATE` 生成 `data_time`。                                                                 | 可简讲为抽取加采集时间。35 个最终绑定中 34 个 `PHYSICAL`，采集时间为 `SQL_CANDIDATE`；SQL 明确是时钟表达式，不能解释成业务发生时间。                     |
| 151780 / `_p` → `_pb`      | 业务字段直传；原 `busi_date` 转成 `grp_id`，目标 `busi_date` 写字面量 `2026-05-21`；仅选原分区 `exchange_titans_to_sps`。 | 值计算很少，但分区含义改变，应讲清“来源批次”和“业务日期”不能按同名字段想当然。37 个绑定为 36 个 `PHYSICAL`、1 个 `NO_PHYSICAL_INPUT`。                   |
| 152123 / ODATA → PDATA_NDS | 37 列直传，包括两列分区；限定 `${data_day_str}` 和该来源批次。                                                            | 可与前后运输合讲，但保留日期控制。37 个绑定均为 `PHYSICAL`。                                                                                             |
| 152217 / PDATA_NDS → DM    | 内外两层投影直接选择同一组 37 列，限定 `${yyyy-MM-dd}` 和来源批次。                                                       | `castTable` 是子查询别名，这段 SQL 没有因此进行类型转换。37 个绑定均为 `PHYSICAL`。                                                                      |
| 166630 / DM → 最终表       | 按日期、来源批次选出 34 个业务字段，不输出采集时间和分区列；`truncate` 槽实际是无条件 `DELETE`。                          | 是目标刷新和导出定义，未展示新业务公式。当前 Facts 没有最终字段绑定，不能把 SQL 的 34 项选择自动升级为已确认的目标逐列映射，更不能把空绑定说成没有数据。 |

这条链最值得保留的是**日期约定和刷新方式**。151780 的 SQL 是已展开的固定日期，后几跳仍有不同占位符。静态证据没有给出它们某次运行时一致的参数，因此不能宣称“同一天的数据已连续穿过这 5 跳”。源视图怎样决定报备状态、截止日期和金额，仍是这条链之外的待核实知识。

## L002：成交回报进入统一事件模型，再回到接口字段

```text
titans_dm.trd_trs_underlying_deal
  → odata_n_tit.d_trd_trs_underlying_deal
  → pdata_n.t05_otc_deri_swap_mtch_retu_evt
  → dm_hk_n.otc_trd_trs_underlying_deal
  → ods_titans.otc_trd_trs_underlying_deal
```

| 任务 / 跳               | SQL 实际动作                                                                                                       | 讲解取舍与证据边界                                                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| 78593 / 源 → ODATA      | 22 个源字段直传，追加当前采集时间。                                                                                | 可简讲为抽取。23 个最终绑定中 22 个 `PHYSICAL`，时钟表达式为 `SQL_CANDIDATE`。                                                   |
| 202899 / ODATA → 事件表 | 编号加前缀、截取交易日、市场代码映射，另按受影响交易日决定重写哪些分区。                                           | 应深讲：这一跳改变对象表达和维护范围。29 个绑定中 22 个 `PARTIAL`、7 个 `NO_PHYSICAL_INPUT`；部分状态不能当作完整字段依赖证明。  |
| 202186 / 事件表 → DM_HK | 还原接口列名，拆交易对手编号，使用源产品编号和源市场代码，4 个审计字段填空；读取基准日前 10 天至基准日，包含两端。 | 应深讲：输出不是源表逐列复原。25 个绑定中 21 个 `PHYSICAL`，4 个空值经外层投影表现为 `DERIVED_OUTPUT`，其值须回到内层 SQL 确认。 |
| 202219 / DM_HK → ODS    | 22 个字段直传，同样限制来源和日期窗口，另重新生成 `data_time`，不输出来源与日期分区列。                            | 可简讲为窗口导出加导出时间。23 个绑定中 22 个 `PHYSICAL`、1 个 `NO_PHYSICAL_INPUT`；未核实目标更新行为和实际落地记录。           |

202899 首先把源 `ID` 变成 `TIT306-<ID>` 的事件编号，同时保留原值为 `Mtch_Retu_Id`。客户、产品分别形成 `TIT060-<KEY_CTPTY_ID>`、`TIT-<KEY_INSTRUMENT_ID>`；空白源键输出空串。数量、金额、全价、净价和费用主要换成模型列名，没有在这里重新计算。市场则同时保留源代码，并以 `NVL(DW_CD_VAL,MARKET)` 产生转换后的代码；映射受目标表、目标列、源表、源列、来源系统共同限定。它体现的是统一对象表达，和[客户编号](10-party-customer-identity.md)的来源命名空间知识相连。

更容易漏掉的是重写范围。这个快照从 `2026-05-20` 的输入分区中，找出交易日、创建日或更新日不早于该日的记录，先抽取其**交易日集合**，再取该输入分区中这些交易日的所有记录，按交易日写分区。举个示意：如果今天修改了一笔旧日交易，SQL 意图是重建那个交易日的集合，不只是输出修改的那一行。这里没有汇总金额；映射是否一对一、回补所需记录是否齐全，仍缺实际数据核验。

202186 又展示了不同的消费目的：它输出 `Mtch_Retu_Id`，而非带前缀的事件编号；客户编号用 `split(cutp_pty_id,'-')[1]` 取第二段；产品用保留下来的 `Src_Prd_Id`，市场用 `Src_Exch_Type_Cd`，**没有使用刚转换出的标准市场码**。拆客户编号隐含格式假设，不能宣称任意源键都能无损还原。源创建时间、创建人、修改时间、修改人也没有被恢复，而是填空串。最终再写的 `data_time` 是新时钟值。因此，“终点列名像起点”不等于源记录经过一次无损往返。

两步之间还有一个范围差异：202899 可因当天修改而回补更早的交易日，202186 却只读取基准日前 10 天至基准日。若修改涉及窗口之外的旧交易日，即使前一步重写了该日数据，该次后一步查询仍不会选中。这里仅按两份 SQL 推导选择条件，不断言实际发生过遗漏；也不能把“存在表路径”解释成所有回补都会沿路径导出。

学习时，L001 的运输段可以合成一段讲；L002 应在 202899 和 202186 两处停下来，分别问“统一了什么、按什么范围维护”和“这个消费者选择了哪套编号与口径”。这种取舍来自真实字段与规则变化，和[字段主题观察](18-field-themes.md)一致；当前只验证了这两条链，尚未把其他 197 条链按语义分类。

## 证据索引

固定图版本为 `df6f0ae4b6ef465f751351b14fd02ea08542d824d7bfea36e5a58dd1039e23c3`。以下文件均由[当前批次清单](../../../sql-static-lineage-data/artifacts/graphs/titans-otc/batches/945d7d1e13928a269480cf6786450e5916e5255806b36dd16dcba3a1b19726d9/batch-manifest.json)定位，9 份投影的声明哈希及 SQL 内容哈希已核对。最终绑定统计按 `target_dataset` 和 `write_observation_id` 限定，再精确关联 `expression_id`；状态是静态证据状态，并非运行结果。行号均指证据内相应 SQL 槽的文本行。

- [151775](../../../sql-static-lineage-data/task-projections/tasks/151775/versions/90f2d722139395660cfe40ab957bddebce211129bc7954880f741e8211271969.evidence-v3.json)：`query` 1–37，重点 30。
- [151780](../../../sql-static-lineage-data/task-projections/tasks/151780/versions/7bb26098a15403adb0125c3bfdf2b79b1c7a24f81469a3656086dd117a065df2.evidence-v3.json)：`query` 1–42，重点 38–41。
- [152123](../../../sql-static-lineage-data/task-projections/tasks/152123/versions/57503348cbfe9f3463274f01927f9e3cce97c41ffc3300310c0586ecc515ea32.evidence-v3.json)：`query` 1–42。
- [152217](../../../sql-static-lineage-data/task-projections/tasks/152217/versions/898761d5804a3d6dce3a0b228e280a43c0d59720409861978d44fc2ac21bac9e.evidence-v3.json)：`query` 2–79，重点 39–79。
- [166630](../../../sql-static-lineage-data/task-projections/tasks/166630/versions/31324246fbb647cc04292b08b7dc2fe18d75455d2b4269e8ce49f1b0df1d39b9.evidence-v3.json)：`query` 1–37、`truncate` 1；`bindings` 为空。
- [78593](../../../sql-static-lineage-data/task-projections/tasks/78593/versions/20a3eff353d54fcf609b8177aafd74245f7a1835b6117ad119f4eecb4c9be506.evidence-v3.json)：`query` 1–25。
- [202899](../../../sql-static-lineage-data/task-projections/tasks/202899/versions/e603995ee0fee029bbad7f51da68ac44be503e0618145f0809ef12e73b3ebcd1.evidence-v3.json)：`query` 1–10、13–43、44–54。
- [202186](../../../sql-static-lineage-data/task-projections/tasks/202186/versions/c9d0b894cf322002e2f3fde2caad3f05958df17cce7df4c3eb14eb443ec7abee.evidence-v3.json)：`query` 28–55。
- [202219](../../../sql-static-lineage-data/task-projections/tasks/202219/versions/a4bac0b73558bb4838d7db54f8250432712fd0c9698f401920a7be0f41b57c35.evidence-v3.json)：`query` 1–27。

# 从字段数字识别主题：一张表不只属于一个加工片段

这次选择三项实际加工，回答三个问题：基础表只补少数字段，是否仍值得先学；一张日报内部能否拆出不同主题；一个指标只有一列数值，是否就意味着加工简单。**结果支持按字段用途组织可以重叠的知识片段，但还没有形成全图加工簇。**

## 先固定统计对象，避免数到中间表达式

本轮只读固定发布 manifest 指向的三个任务投影与不可变证据。每项先取得 `localClosure.finalWrites`，再同时按最终 `qualifiedName` 对应的 `target_dataset`、`writeObservationId` 对应的 `write_observation_id` 筛选 `bindings`，最后用 `binding.expression_id` 精确查找同 ID 的表达式。三个任务各只有一个选中的最终写入。

| 任务 | 最终目标 | 写入标识 |
|---|---|---|
| 207284 | `pdata_news_n.t02_prd_unit_nav_s_tit` | `write-observation:207284:12` |
| 230202 | `dm_otc_n.otc_rev_daily_rpt` | `write-observation:230202:platform-target:0` |
| 159763 | `dm_index_n.index_grp3_compscal_otcderi_cs_mthapd` | `write-observation:159763:platform-target:0` |

207284 是 SQL 显式写入；另两项是 Pack 声明的查询输出。所选绑定均为 `RESOLVED`，没有重复目标字段或缺失表达式。绑定成功说明输出落点已识别，不等于所有输入依赖已追清。分母是本次最终写入的绑定字段数，不是整表 DDL 列数；207284 的静态分区 `src_id/grp_id` 没有出现在这 23 条绑定中，不补入分母。

“源覆盖目标数”的计算是：查看选中表达式现有的 `input_fields`，按其中的 `table` 分组，同一来源在同一目标字段只计一次。原始来源名与 `field_id` 原样保留，不根据相似名字合并；也不另行递归展开或把 SQL 人工判断补写进 Facts。表达式中保留公共输入，包括 `grp_def`，这不改变前面的表级临时剥离口径。

这些数字称为 **Facts 暴露的输入足迹**。它可能包含 CASE 判断、窗口计算等上下文，且不覆盖所有 JOIN、过滤和分组控制，不能称为纯数值贡献率。不同来源可以覆盖同一目标字段，比例不能相加当成 100%。

## 三组可复核的状态数字

| 任务 | 绑定字段 | `PHYSICAL` | `PARTIAL` | `DERIVED_OUTPUT` | `NO_PHYSICAL_INPUT` | 至少一项输入足迹的目标 | 去重输入字段 ID |
|---|---:|---:|---:|---:|---:|---:|---:|
| 净值加工 207284 | 23 | 20 | 0 | 0 | 3 | 20 | 19 |
| 创收日报 230202 | 72 | 54 | 0 | 18 | 0 | 54 | 52 |
| 交叉销售月日均 159763 | 11 | 4 | 1 | 1 | 5 | 5 | 11 |

`PHYSICAL` 表示表达式记录中的依赖状态。最后两列分别数目标字段和输入字段，不能互换：同一个输入可以服务多个输出。159763 的五个有足迹目标包含一个 `PARTIAL`，只统计了它已暴露的部分；`DERIVED_OUTPUT` 没有输入列表时保留该状态，不按“没有贡献”解释。表中的状态数量为零，只表示没有该状态记录。

## 第一组：证券基础只补四列，却使行情能够被认领

207284 的 20 个有输入足迹目标中，两个来源的覆盖没有重叠。

| 来源，按 Facts 原名 | 覆盖目标字段 | 占全部 23 个绑定 |
|---|---:|---:|
| `odata_n_tit.d_mkt_risk_daily_info` | 16 | 69.6% |
| `t02_scr_base_info` | 4 | 17.4% |

证券基础的原名没有 schema，SQL 也使用未限定名，本次不擅自补全。若仅以 20 个有足迹字段作分母，两源比例才是 80% 与 20%；必须说明采用哪个分母。

四个字段是 `secu_id`、`src_sys_prdno`、`scr_cd`、`crrc_cd`，提供证券身份和币种。它们由 `a.key_instrument_id=b.in_code` 的左连接补入，证券来源还限定 `src_id='TIT'`。公共表的学习价值，是让读者知道这些净值属于哪个对象、按什么币种理解，而不只是提供很多列。

行情来源覆盖的 16 列也并非全是业务量值。直接 SQL 可分出八个量值：单位净值、资产净值、虚拟净值、结算价、收盘价、成交额、流通市值、总市值；其余还包括记录编号、净值日期、人员与时间等。另三个无物理输入字段由运行日期、固定来源文字和生成时间给出。

因此，这个片段至少包含“行情量值”“证券身份与币种”“日期及记录追溯”三个阅读主题。16 比 4 不能解释成行情价值是证券身份的四倍；左连接没有匹配时，行情量值可能仍在，身份却不完整。

## 第二组：日报的 72 列，存在三个明确的重叠输出

230202 共有 54 个目标暴露输入足迹。各来源覆盖数如下，统一以 72 个绑定为分母，表中保留整数以便复算。

| 来源 | 覆盖目标数／72 |
|---|---:|
| `pdata_n.t98_otc_deri_comp_sale_info` | 40 |
| `pdata_n.t98_otc_deri_comp_sale_adtnl_det` | 4 |
| `pdata_n.t98_sb_tit_day_hold_indx` | 4 |
| `pdata_n.t98_otc_opt_comp_eday_prvs_fee` | 3 |
| `pdata_news_n.t02_fxr_cfets_quot` | 3 |
| `pdata_n.t98_otc_book_hold_sum` | 3 |
| `odata_n_ois.g_client_revenue_coefficient` | 2 |
| `pdata_news_n.t02_ira_ibor` | 2 |
| `pdata_n.t01_corp_cust` | 1 |
| `pdata_n.t03_otc_deri_book_adtnl_info` | 1 |
| `pdata_news_n.t02_tit_scr_base_info` | 1 |

覆盖次数合计 **64**，但目标并集只有 **54**。多出的十次来自三个重叠输出：`curr_rev` 暴露八个来源，`opt_npv_curr_rev` 三个，`map_undrl_cd` 两个。销售基础覆盖 40/72，约 55.6%，说明它是重要背景，不能据此把日报所有字段归入“销售主题”。

直接 SQL 让这些数字有了含义：客户、合约、账簿等字段提供身份和条款；`Tdy_Yield` 是直接匹配的持仓盈亏；`Simu_Hedg_Pal` 是模拟对冲结果；`Curr_Rev` 在不同分支结合费用、资金成本、本金、盈亏和汇率计算。动态对冲分支的 Delta 真正参与数值分配，不能归为仅有筛选作用。`Map_Undrl_Cd` 则在账簿映射和证券分类之间回退，负责把记录放入相应标的范围。

账簿附加表只出现在一个最终输出的输入足迹中，但其 `Cntr='DYNAMIC_HEDGING'` 还控制哪些账簿进入标的盈亏池。汇率只覆盖三列，却参与金额折算。少字段公共输入因此可能决定范围或金额口径，不能按覆盖数直接折叠掉。

剩余 18 个目标停在 `DERIVED_OUTPUT`，包括部分费用参数、生成时间及分区字段。这里没有把它们当成零输入，也没有把 54/72 宣称为完整血缘覆盖率。已足够确认的主题是身份与条款、规模与日期、持仓及模拟盈亏、计提与折算；它们在同一张日报内重叠，可与[持仓、估值与盈亏](08-positions-valuation-pnl.md)对应阅读。

## 第三组：只有一列指标值，仍有分配、分类和身份控制

159763 的来源覆盖落在五个目标上，其中两个目标重叠。

| 来源 | 覆盖目标数／11 | 对应目标 |
|---|---:|---|
| `dm_index_n.grp_def` | 3 | `grp_id1/2/3` |
| `pdata_n.t98_otc_deri_comp_sale_adtnl_det` | 1 | `index_val` |
| `pdata_n.t98_otc_comp_mng_rela_info` | 1 | `index_val` |
| `pdata_n.t98_otc_deri_comp_sale_info` | 1 | `tag_id` 的已知部分 |
| `pdata_news_n.t02_tit_scr_base_info` | 1 | `tag_id` 的已知部分 |

覆盖次数为 **7**，目标并集为 **5**。`grp_def` 的同一个输入字段 `grp_id` 经过三个别名服务三个输出，因此三列身份不等于三个不同输入字段。

`index_val` 的足迹包括动态名义本金与三列分配比例。SQL 先按组织规则展开分支，乘相应比例，再按客户、机构、员工和标签分组，除以当月已过的自然日数。它只有一个数值输出，但内部发生了合约日记录到月度归属指标的粒度变化。

`tag_id` 在当前 Facts 为 `PARTIAL`。直接 SQL 能看到：它由部门、标的类型、币种及若干合约和客户条件选择固定标签。证券基础这里只贡献一个已知输入字段 `crrc_cd`，却会改变标签归属；标签又是分组键，所以不能把这一列解释成无关装饰。这里的客户条件不应扩大成未经证实的通用客户规则。

最后，三个 `grp_def` 内连接将客户、组织、员工的业务值转成组 ID，其中客户和员工子集还限定启用状态。它既给出身份值，也决定是否能够进入最终结果。该表在粗粒度图分析中可以作为公共配置折叠，详细解释这个指标时仍须展开其作用。

`busi_mon` 的表达式状态为 `DERIVED_OUTPUT`，SQL 内层实际上给出运行月份参数；本次统计保持原状态，由 SQL 另行说明。五个 `NO_PHYSICAL_INPUT` 则是固定或生成信息。这个案例适合与[合约到交叉销售](04-contract-to-cross-sale.md)一起理解，不能因“只有一列金额”而简化为字段搬运。

## 这轮数字能支持什么结论

三个样例已经给出可复核的主题边界：净值片段分量值与身份，日报分身份、规模、盈亏及计提，月指标分金额分配、标签和组身份。主题可以共享同一张表，也可以共享同一个输出字段。当前没有按这些数字计算全图社区、认定全图已分簇或生成唯一分类。

下一轮评估候选片段时，可以同时问“多少目标引用了它”和“它在 SQL 中决定什么”。两者合看，才有条件判断哪些公共资产适合先学、哪些连接需要重点解释。字段覆盖是发现线索，身份、时间、金额、分类与控制用途仍由实际 SQL 核对。

## 不可变证据与复算定位

固定发布版本：`df6f0ae4b6ef465f751351b14fd02ea08542d824d7bfea36e5a58dd1039e23c3`。三份投影声明 hash 与 manifest 一致，全部所读 SQL 内容 hash 已核验。统计临时在内存中执行，没有写程序文件或修改加工产物。

- [207284 证据](../../../sql-static-lineage-data/task-projections/tasks/207284/versions/7eaf83d31c4455e99031efc5aff2013849087a813ce2da23cf9c915498c59a08.evidence-v3.json)：按上表写入标识筛 `bindings`；query 17–46 行；表达式 ID 前缀为 `task:207284:statement:12:relation:root.project:expression:project_expression:`，所选末尾序号 0–22。
- [230202 证据](../../../sql-static-lineage-data/task-projections/tasks/230202/versions/054fea93fea9ed6256ee5087deea9b8e94b43aef5625415a20840276b3a06ae3.evidence-v3.json)：按上表写入标识筛 `bindings`；query 90–100、139–146、201–249 行；表达式 ID 前缀为 `task:230202:statement:0:relation:root.project:expression:project_expression:`，所选末尾序号 0–71。
- [159763 证据](../../../sql-static-lineage-data/task-projections/tasks/159763/versions/c87821fad514ef930309c036b4a8b04a78b1be5539385b41aa0ce1a3ddc81a31.evidence-v3.json)：按上表写入标识筛 `bindings`；query 14–43、46–70、75–144 行；表达式 ID 前缀为 `task:159763:statement:0:relation:root.project:expression:project_expression:`，所选末尾序号 0–10。

行号指证据 `sqlSources.slot=query` 内的 SQL 文本，不是 JSON 文件行号。状态与输入足迹表直接来自选定绑定的表达式；主题划分和用途判断是本文在 SQL 核验后给出的解释。

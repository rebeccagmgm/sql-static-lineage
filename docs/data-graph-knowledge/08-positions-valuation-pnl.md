# 持仓、估值与盈亏：从合约明细到账簿消费

**最后更新：2026-09-08。**

持仓回答“某天持有什么、数量多少”；估值记录该对象的市值、定价和风险指标；盈亏记录当日或累计收益，并继续区分已实现、未实现及清算状态。这三类信息可以出现在同一张宽表中，仍不能相互替代。

本章核验的实际链路是：源系统的腿持仓、腿估值、日持仓分别进入数据集市，创收日报再把账簿日持仓汇成标的日盈亏，并结合合约与模拟对冲指标分配创收。**没有证据表明本批 SQL 将互换腿明细直接汇总生成“账簿持仓汇总表”。**该表接收的是上游 `D_POS_POSITION_DAILY` 已提供的结果；上游怎样算出结果仍待补证。

## 先认清每一行的对象

以下是 SQL 支持的记录含义，不是已经通过数据验证的唯一键。五张表的 DDL 均以 `src_tbl、busi_date` 分区，未声明主键；连接是否一对一仍须核验。

| 对象与表                                          | 一行怎样理解                                   | 关键标识与日期                                                                            |
| ------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 互换持仓 `t03_otc_swap_comp_hold_info`            | 某业务日的一笔腿持仓，保留标的、方向和数量     | 普通来源以 `KEY_LEG_POSITION_ID` 写入 `Swap_Comp_Hold_Id`，fast 用 `ID`；另有合约、腿编号 |
| 腿估值 `t98_otc_swap_comp_leg_valu_info`          | 某业务日的一笔腿估值结果                       | `Valu_Id`、合约、腿、账簿；普通与 fast 的源估值编号不同                                   |
| 账簿持仓 `t98_otc_book_hold_sum`                  | 账簿中的一笔日持仓结果，并非每账簿每天只有一行 | `ID → Src_Hold_Id`，另有账簿、产品、多空方向                                              |
| 日持仓指标 `t98_sb_tit_day_hold_indx`             | 一笔持仓在计算日的估值、合约及风险指标         | `POSITION_ID → Src_Hold_Id`；`QUOTE_DATE → Calc_Date、busi_date`                          |
| 期权子交易指标 `t98_sb_otc_opt_sub_trd_prcg_indx` | 子交易的定价结果；多标的分项还区分标的         | `Sub_Trd_Id`、`Prcg_Date`、定价类型、标的；不能只按合约去重                               |

前三类输出业务日取 `SRC_BUSI_DATE`，与读源时筛选的采集分区日期不同。部分任务会依据更新日期及源、目标日期分组计数差异选择重写日期；其中 `GROUP BY BDATE` 是装载控制，不是在汇总金额。121573 则固定输出业务日分区，同时另存 `AS_OF` 对应的定价日，二者不能自动画等号。

## 同名字段，要连同来源和币种阅读

普通持仓任务 105392 将数量、市值及已实现、未实现收益分别映射入表；合约编号由腿编号关联 `D_REF_TRS_LEG` 取得，账簿编号在该分支写空。fast 持仓任务 183096 保留账簿、名义本金和动态名义本金，却将多项收益、市值字段写成空字符串。它还限定 `POSITION_TYPE='EOD_POSITION'` 并排除 `LONG_SHORT_SWAP`。因此同表某分支没有金额，不等于业务金额为零。[持仓证据 S1、S2](#证据索引)

估值分支补充了另一类信息：106210 将 `VALUE、TOTAL_PNL、REALIZED_PNL、UNREALIZED_PNL` 分别写成市值、当日收益、当日已实现及未实现收益；另保留原币、本币、累计及已清算／未清算口径。183098 的对应字段则来自结算币种列：

```sql
-- 183098，slot=query，57、60 行（节选）
MARKET_VALUE_SETTLE AS Mval
TOTAL_PNL_SETTLE AS Tdy_Yield
```

这一步是承接源计算结果，没有在 SQL 中重新计算估值模型或汇率折算。fast 还单列结构化、利息、分红等累计收益。跨来源相加前，必须确认币种与收益分项，不能仅凭 `Mval` 或 `Tdy_Yield` 名字一致合并。

账簿任务 106590 同样直接映射 `TOTAL_PROFIT → Tdy_Yield`、`REALIZED_PROFIT → Tdy_Rlz_Yield` 等字段。值得保留的命名疑点是：`SETTLED_ACCU_RL_PNL` 被写入名称含 `Unrlz` 的 `Lcrrc_Settd_Accum_Unrlz_Yield`，但注释说“累计已交收的已实现收益”。解释时应同时展示源列和注释，不按后缀猜含义；已实现也不能直接读成已到账现金。[估值及账簿证据 S3–S6](#证据索引)

期权侧则保留模型输出。121573 写入 `PV、MODEL_PRICE、Delta、Gamma` 等，借产品编号关联子交易及账簿；154812 是多标的子交易分项，按 `EXTERNAL_TRADE_ID = Sub_Trd_Id` 连接，并保留 `PARTIAL_INS_ID`，只填部分指标，`Pv、Mdl_Pric` 写空。这里的业务类型名称含 `PARTIAL`，与 Machine Facts 的依赖状态 `PARTIAL` 是两回事。日持仓任务 121575 另接收 PV、NPV、估值报告 PV、`SIM_DAILY_PROFIT → Simu_Hedg_Pal`；这些定价或模拟结果不能当作已实现现金。[指标证据 S7–S9](#证据索引)

## 哪一步真的汇总，又如何回到合约

创收日报 230202 有两条账簿持仓消费路径。第一条按产品、日期、账簿关联合约，取得该笔 `pd.Tdy_Yield`；第二条先筛选动态对冲账簿，再形成标的与日期的盈亏池：

```sql
-- 230202，slot=query，208–210、242 行（节选）
nvl(if(rb.Map_Undrl_Cd='',null,rb.Map_Undrl_Cd),ins.undrl_clas) as Map_Undrl_Cd,
sum(b.Tdy_Yield) as Tdy_Yield,
b.busi_date
-- ...
group by nvl(if(rb.Map_Undrl_Cd='',null,rb.Map_Undrl_Cd),ins.undrl_clas), b.busi_date
```

账簿映射为空时回退证券分类；证券查找又优先使用互换腿持仓的标的产品，回退到账簿持仓产品。这解释了腿持仓为什么出现在消费链中：此处用它帮助辨认标的，求和的数值仍来自账簿持仓 `Tdy_Yield`。详见[账簿基础](01-book-foundation.md)。

动态对冲分支在同一标的汇总对照与日期下，用各合约 `abs(Delta)` 的占比，分配“账簿侧标的盈亏减模拟对冲盈亏合计”的差额；再加该合约模拟对冲盈亏及直接匹配的持仓盈亏，乘人民币中间汇率。这里是在形成日报的计提创收口径。静态对冲分支另按本金表达式分配分组盈亏：分子取 `det.Init_Nom_Prin`，分母取 `info.Init_Nom_Prin` 并排除指定客户，不能默认是相同记录集合的普通本金占比，也没有证明分配比例必然加总为 1。两种规则不能混用。合约与归属侧可续读[销售基础](03-sale-foundation.md)和[合约到交叉销售](04-contract-to-cross-sale.md)。

**教学示例，非实际数据：**假设同标的同日有两笔合约，Delta 绝对值为 30、70，模拟盈亏为 20、30，标的盈亏池为 100。需要分配的差额就是 50，两笔各分到 15、35；加回各自模拟盈亏后为 35、65，随后还要加各自直接匹配的持仓盈亏并折算币种。可见日报创收既不是直接抄一列市值，也不是把所有收益列相加。例子假设连接未增行且只有这两笔记录；真实分组范围必须以 SQL 窗口条件为准。

Facts 对日报最终 `Tdy_Yield、Undrl_Tdy_Yield` 均记录账簿持仓字段为 `PHYSICAL` 来源。这两个直接输出与另一个最终字段 `Curr_Rev` 要分开：后者还以 Delta、模拟盈亏和汇率参与数值计算。账簿过滤、腿关联和标的分组的选择控制另留证据，不能把同任务出现的所有表都算成每一个金额字段的值来源。

## 已确认规则与仍需确认的理由

当前证据确认了字段映射和 SQL 口径，未验证运行结果及业务正确性。下一步最有价值的是确认四件事：

- `D_POS_POSITION_DAILY` 怎样由源系统明细核算而来，以及与腿估值如何对账；本章尚无这段公式。
- 为何 fast 排除特定互换类型、为何动态按 Delta 而静态按名义本金分配；SQL 可见，业务理由未证实。
- 日报用运行日账簿、腿及合约产品关系解释历史持仓，是否符合历史归属要求；多条腿或映射多匹配也可能放大汇总行数。
- Delta 分母为零、缺失汇率默认 1、缺失金额默认 0 时，应怎样处理；现有代码有默认值，不代表这些异常已获业务接受。

211472、211644 的 SQL 仍含 `${src_table}`，不能凭任务名补成物理源。109369 本份证据没有输出绑定；其他多个生产任务的字段依赖为 `PARTIAL`，也不能说没有读取金额。这里只把已读 SQL 作为实现证据，保留这些机器证据边界。

## 证据索引

范围固定为图版本 `df6f0ae4b6ef465f751351b14fd02ea08542d824d7bfea36e5a58dd1039e23c3`；12 份 projection 声明的 `contentHash` 均与指定 batch manifest 一致，均为 `LEGACY_NOT_L1`。行号指 evidence 内 `sqlSources` 的 `slot=query` 文本行号，不是 JSON 行号。表用途不采用可能经 AI 增强的描述作证明。

| 编号／任务  | 本章核验范围与精确来源                                                                                                                                                                                                                                                                     |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| S1／105392  | [普通持仓](../../../sql-static-lineage-data/task-projections/tasks/105392/versions/657387f97228aaa734c48771972cf15dc39b6ca1646edf9a53721c98e33983eb.evidence-v3.json)：11–64、136–141 行，标识、收益、腿关联                                                                               |
| S2／183096  | [fast 持仓](../../../sql-static-lineage-data/task-projections/tasks/183096/versions/960060f1409886b55bd8c988bad4550761a137ee0e2a89aac325c8a2949355ef.evidence-v3.json)：31–84、156–164 行，空值、账簿、筛选                                                                                |
| S3／106210  | [普通腿估值](../../../sql-static-lineage-data/task-projections/tasks/106210/versions/312d0ef248cdb867462fec5d4e93cb776bfba324ef67e690f3b8853264539cf8.evidence-v3.json)：31–89、154–159 行，金额及清算口径                                                                                 |
| S4／183098  | [fast 腿估值](../../../sql-static-lineage-data/task-projections/tasks/183098/versions/08a3669330ed074e223cb6e9787fad78332fd15f73ef23bb61ab7681415345c4.evidence-v3.json)：57–89、135–165 行，结算币种与收益分项                                                                            |
| S5／106590  | [账簿日持仓](../../../sql-static-lineage-data/task-projections/tasks/106590/versions/925dbec834cbbc8a47ddab67c1f738867f729cdcc1c74c5fb5691a91522a1535.evidence-v3.json)：1–27、30–89、162–183 行，日期控制及源金额映射                                                                     |
| S6／109369  | [同表另一任务](../../../sql-static-lineage-data/task-projections/tasks/109369/versions/2d43d43e6d0b5b4e6c239112d435095693df3310e4c27644a22857fcef48bac0.evidence-v3.json)：1–8、118–137 行，同类读源与关联；`bindings=[]`                                                                  |
| S7／121573  | [期权子交易指标](../../../sql-static-lineage-data/task-projections/tasks/121573/versions/27e2c7c7527b0768e6a774dc8c551f611edfdec8b798b9280f7dff82ca2789fc.evidence-v3.json)：1–19、35–54、76–78 行，定价与关联                                                                             |
| S8／154812  | [多标的分项指标](../../../sql-static-lineage-data/task-projections/tasks/154812/versions/e80e4c9a0c51dd4eacace488a31916b142136e5fe8b716770bc98ef0d324d423.evidence-v3.json)：32–89、107–114 行，分项粒度与填充差异                                                                         |
| S9／121575  | [日持仓指标](../../../sql-static-lineage-data/task-projections/tasks/121575/versions/b7b3ac040506ac0390c6f42095016bf242134976220643ff6b2de17abc24f837.evidence-v3.json)：30–37、135–143、205–223、249–252 行，PV、模拟盈亏及计算日                                                         |
| S10／230202 | [创收消费](../../../sql-static-lineage-data/task-projections/tasks/230202/versions/054fea93fea9ed6256ee5087deea9b8e94b43aef5625415a20840276b3a06ae3.evidence-v3.json)：95–100、139–146、201–249 行，分摊、汇总、匹配；`expressions` 的 `root.project` 提供值来源，`relations` 提供控制证据 |
| S11／211472 | [参数化持仓](../../../sql-static-lineage-data/task-projections/tasks/211472/versions/449ab14f2e9c586b3aee756e0838582c2bc73193c3a8fc860aefc415ab1e80fc.evidence-v3.json)：133–139 行，未解析读源及过滤                                                                                      |
| S12／211644 | [参数化估值](../../../sql-static-lineage-data/task-projections/tasks/211644/versions/9cde7321e318af11e4c9aa0acbb33d1fc4f91543846e6fc118aa5df878e0e4de.evidence-v3.json)：32–53、135–140 行，金额表达式及未解析读源；`Mval、Tdy_Yield` 为 `SQL_CANDIDATE`                                   |

DDL：[互换持仓](../../../sql-static-lineage-data/tables/hive/pdata_n.t03_otc_swap_comp_hold_info__gfhive/ddl.sql)、[腿估值](../../../sql-static-lineage-data/tables/hive/pdata_n.t98_otc_swap_comp_leg_valu_info__gfhive/ddl.sql)、[账簿日持仓](../../../sql-static-lineage-data/tables/hive/pdata_n.t98_otc_book_hold_sum__gfhive/ddl.sql)、[日持仓指标](../../../sql-static-lineage-data/tables/hive/pdata_n.t98_sb_tit_day_hold_indx__gfhive/ddl.sql)、[期权子交易指标](../../../sql-static-lineage-data/tables/hive/pdata_n.t98_sb_otc_opt_sub_trd_prcg_indx__gfhive/ddl.sql)。

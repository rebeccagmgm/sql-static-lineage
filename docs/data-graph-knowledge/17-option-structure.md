# 期权结构参数：怎样从合约条款变成下游判断

`pdata_n.t03_otc_opt_comp_stru_elmn_info` 值得单独理解的原因，是其中少量参数会决定下游选择哪一天、怎样识别产品特征。生产 SQL 大部分是字段映射，但消费端已经出现实际规则，不能据映射简单就把这张表视为无关背景。

本篇核验三个生产任务 108951、108952、210339，以及子交易宽表消费者 107481。重点带读一条路径：**源结构的收益付款安排 → 合约结构参数 → 子交易宽表的实际终止日期选择**。

## 先区分对象、条款、观察序列和计算结果

在[合约对象](07-contract-objects.md)中，合约与子交易回答“这是什么对象、由哪些下层对象组成”。结构元素表补充的是与父合约关联的一组产品安排及属性。它并没有把每个参数拆成一行，也没有在本批 SQL 中计算期权价格。

| 材料 | 在已核验加工中回答的问题 | 不宜混同的内容 |
| --- | --- | --- |
| 合约与子交易 | 父合约是谁，子交易编号、标的、本金和日期是什么 | 多笔子交易不等于多份父合约 |
| 本篇的合约结构元素 | 产品类型、收益付款安排、观察频率、参与率、跨币种和保护期等怎样记录 | 一个结构记录不等于一个观察日或一笔估值 |
| 子交易观察日与障碍资料 | 各观察日期及相应障碍参数是什么 | 观察频率字段不等于完整观察日序列 |
| [定价与风险指标](08-positions-valuation-pnl.md) | 某定价对象的 PV、模型价格、Delta、Gamma 等结果是什么 | 结构参数不能直接当作定价结果或已实现收益 |

结构表也不是纯粹静态配置：它同时接收期末价格、当前交易数量和事务状态等来源字段。应按字段职责阅读，不能把整表统一理解成签约时永不变化的条款。

## 一行怎样关联回合约

三个写者都把 `KEY_OTC_TRADE_ID` 写入 `Opt_Comp_Agt_Id`，把 `UNDERLYING_INS_ID` 保存在 `Src_Prd_Id`，另用 `TIT-` 前缀构造 `Prd_Id`。这区分了父合约编号与标的产品编号：两者出现在同一行，承担不同关联职责。

输出为一组来源记录的宽式表达，按 `src_tbl、busi_date` 分区，三份 Facts 各有 66 个非分区输出绑定。SQL 没有按合约聚合或去重；DDL 也没有声明唯一键。因此，“某来源日期下，与某期权合约关联的一组结构信息”是可以使用的记录解释，不能升级为“每个合约每天恰好一行”。

| 字段用途 | 源字段 → 输出字段举例 | 阅读重点 |
| --- | --- | --- |
| 产品与方向 | `CONTRACT_TYPE → Src_Agt_Type_Cd`；`CONTRACT_SUB_TYPE → Src_Agt_Sub_Type_Cd`；`DIRECTION → Opt_Dir_Type_Cd` | 消费者可以据此选择产品规则 |
| 时间与安排 | `START_DATE/END_DATE → Bgng_Prcg_Date/End_Prcg_Date`；`REBATE_TIMING → Ko_Yield_Pay_Type_Cd`；`OBSERVATION_FREQ → Obsv_Arng_Type_Cd` | 日期值、付款安排与观察频率是不同信息 |
| 收益条款 | `KNOCKOUT_EXTRA_PAR → Call_Prtc_Rate`；返息利率、票息及敲出收益率分别映射 | 保留不同参数名称，不能把它们直接相加成收入 |
| 跨币种参数 | `QUANTO_COEFFICIENT → Quanto_Coef`；`INIT_EXCHANGE_RATE → Bgng_Rate`；另有计算与用户录入汇率列 | 本步承接来源值，没有解释这些值怎样在源端产生 |
| 保护与重置 | 保护期开始／终止日、敲出重置百分比与价格、重置结束日 | 这些条款与普通起止日分别保留，不能用一个“有效期”概括 |

此处还有一个明确的标准化规则：`Inta_Bm_Cd = NVL(DW_CD_VAL, INTEREST_CALC_BASIS)`。写者按目标表、目标字段、源表、源字段与系统限定转码资料，关联不到非 NULL 的仓库代码时保留原计息基准。这个回退不会自动把空字符串当作缺失；当前也未核验转码表是否每个源值唯一。

证据：108952 query 第 1–42、52–78 行；其余两份写者的对应表达式见文末索引。

## 一个结构参数怎样决定下游的日期

107481 以子交易为入口，限定来源、日期和交易状态，再内连接同日满足风险报送标志的账簿。它随后按父合约编号左连接同日结构表：

```sql
-- 107481，slot=query，第 220–225 行的关联要点
DS.Opt_Comp_Agt_Id = OI.Opt_Comp_Agt_Id
```

这里不是把结构记录当成新子交易。父合约的结构属性会进入各子交易行；如果父侧多行匹配，还可能放大子交易行数。当前没有实际数据证明关联唯一。

随后，付款安排控制 `Actl_Trmt_Date`：

```sql
-- 107481，slot=query，第 70–72 行
case when DS.Ko_Yield_Pay_Type_Cd = 'EXPIRY' then OI.Maty_Date
     else coalesce(OI.Trgr_Date, BARRIER.UO_Trgr_Line_Date,
                   BARRIER.DO_Trgr_Line_Date, OI.Sub_Trd_Trmt_Date,
                   OI.Maty_Date)
end as Actl_Trmt_Date
```

这条规则可以分开理解：

- **结构参数决定选哪条分支。**`Ko_Yield_Pay_Type_Cd` 来自源 `REBATE_TIMING`。
- **日期数值来自子交易或障碍资料。**命中 `EXPIRY` 时选到期日；否则按表达式中的先后顺序寻找非 NULL 的触发、触线、终止或到期日期。

教学示意，假定所有关联唯一：同一子交易到期日为 12 月 31 日，触发日期为 9 月 10 日。结构参数为 `EXPIRY` 时，这一列取 12 月 31 日；参数未命中该值时，因首个回退日期已存在，取 9 月 10 日。它说明付款安排会改变这列的日期选择，不表示我们已验证真实终止事件，也不等同于证明款项已在该日到账。

结构未匹配或该参数为 NULL 时，也会进入 ELSE 路径。因而即使结果仍有一个日期，也不能反推结构资料完整。`COALESCE` 只按 NULL 回退，空字符串的行为还须按实际值检查。

Machine Facts 对这一表达式明确区分了 `BRANCH_SELECTOR` 与 `RESULT_VALUE`：结构表提供分支判断，日期资料提供结果值。这是字段级分析中很有价值的区别——**没有直接输出日期值的那一列，仍可能决定最终日期口径。**

## 同一消费者还新增了哪些解释

107481 把 `Quanto_Coef` 和 `Bgng_Rate` 分别转为小数输出，并形成：

```text
Quanto_Bgng_Rate = NVL(Quanto_Coef, 0) × NVL(Bgng_Rate, 0)
```

这是已见的字段组合，不是本篇重建出的期权定价公式。单列保留 NULL 与组合列在缺值时得到 0，可以同时存在；不能把组合值为 0 一律解释为真实参数就是 0。源汇率怎样选取、quanto 系数怎样确定，本批 SQL 没有给出计算过程。

产品子类型还被转换为两列标志：`TERMINATION_AT_KO → Ko_Trmt_Flag=1`，`CONTINUE_AT_KO → KO_Cont_Flag=1`；其他情况各自为 0。这两列描述 SQL 识别到的产品安排，不能据此断言敲出事件已经发生。同一输出另有依据合约敲出日期是否存在形成的 `KO_flag`，正好体现“产品安排”和“事件日期信号”的区别。

还有一个来源边界：107481 的 `Trmt_ki` 直接读取源结构表的 `TERMINATION_KNOCK_IN`，没有经过本篇 PDATA 结构表。即使业务主题相同，也不能画成所有参数都先经统一结构表再向下传播。

证据：107481 query 第 151–168、195、220–230 行。观察日期和障碍列表的独立关联见同任务第 262–277 行及[合约对象](07-contract-objects.md)。

## 三个写者不能只看目标分区名称

108951、108952 的已保存 SQL 分别读取普通源结构表的 `2026-06-11`、`2026-08-27` 日期。210339 则实际读取 `D_REF_OPTION_DEAL_STRUCTURE_P`，筛 `busi_date='h15'`，却把目标 `src_tbl` 写为不带 `_P` 的标准名称，目标业务日期写为 `2026-05-20`。

因此，三份映射看起来接近，不足以证明是同时运行的三条业务来源，更不能用目标 `src_tbl` 反推唯一物理输入。本篇保留 `h15` 的原表达式，尚未核验对应分区及运行参数约定；不把它改写成日期。前面的真实消费采用 107481 与 108952 共同可见的 `2026-08-27` 日期，说明 SQL 之间可接续，不证明生产数据已经到达。

## 本片段的价值与证据边界

这个片段补足的是“条款参数怎样控制消费”的知识：对象编号把参数接到子交易，少量参数选择日期或生成产品标志，另一些参数作为值参与组合，观察序列和定价结果仍来自各自材料。它与合约对象、Greeks 结果有关联，但不是对那些文章换名重复。

本次只读取 4 个任务：**108951、108952、210339、107481**，以及目标 DDL。四份 projection 声明的内容 hash 与固定 manifest 一致。生产者部分字段依赖为 `PARTIAL`；107481 的上述表达式及角色可见，但其 `bindings=[]`，所以本篇结合原始 SELECT 解释，没有宣称已具备完整最终输出绑定或跨任务因果验证。

尚待补证的重点是结构记录与合约的唯一对应、未匹配结构及空值的实际影响，以及条款选择与业务终止口径的约定。当前无需为了读懂这段 SQL 推导金融定价公式。

固定版本为 `df6f0ae4b6ef465f751351b14fd02ea08542d824d7bfea36e5a58dd1039e23c3`。以下行号均指 evidence 中 `sqlSources[slot=query].content`，不是 JSON 文件行号。

| 任务与精确证据 | SQL 行号与核验内容 |
| --- | --- |
| [108951](../../../sql-static-lineage-data/task-projections/tasks/108951/versions/4e46bd33ec785e1fa9aa5f9a94735bcb38eec01197284cb459c33cfec3868c35.evidence-v3.json) | query 第 1–42、52–78 行：身份、结构字段、日期分区及计息基准转码 |
| [108952](../../../sql-static-lineage-data/task-projections/tasks/108952/versions/c304f1b695905fc80c12f77f1336aa07e1ec1d3af59aa7c8f71ee8a12bfb9b32.evidence-v3.json) | query 第 1–42、52–78 行：消费样例对应日期的字段映射；第 13 行付款安排；第 57、70–78 行转码及回退 |
| [210339](../../../sql-static-lineage-data/task-projections/tasks/210339/versions/5a0fcde53d937d762b295d188b55bb88f0bfaa27d3967f92aa5c05b27844c65b.evidence-v3.json) | query 第 1、57–78 行：目标日期与标准来源标签、实际 `_P` 读源及 `h15` 过滤 |
| [107481](../../../sql-static-lineage-data/task-projections/tasks/107481/versions/d934b8cb1caf8975689bddf6801ad9d2afc27867600b583054ca3d8cf74bd20e.evidence-v3.json) | query 第 70–72 行日期选择；151–168 行系数组合及产品／事件标志；195、198–230 行消费范围、结构关联及源端旁路；262–277 行独立观察序列。`expressions` 中 `Actl_Trmt_Date` 提供分支与结果角色 |

字段定义及分区：[结构元素 DDL](../../../sql-static-lineage-data/tables/hive/pdata_n.t03_otc_opt_comp_stru_elmn_info__gfhive/ddl.sql)。

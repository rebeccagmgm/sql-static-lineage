# 账簿附加信息：少量属性怎样影响不同加工

`pdata_n.t03_otc_deri_book_adtnl_info` 保存账簿的组织、柜台、控制开关和标的映射等附加属性。先学它，是因为同一组账簿信息会被不同过程使用：结算异常监测借它补充所属部门，创收日报借它筛选持仓、确定标的汇总口径。

它适合作为公共业务基础知识。这里的“公共”是对复用作用的判断，不表示它只是可以忽略的背景表，也不表示所有合约加工都必须经过它。

## 一行记录描述什么

可以把一行理解为某个业务日期下的一份账簿属性记录。生产 SQL 将源 `KEY_BOOK_ID` 原样写入 `Book_Agt_Id`，并固定 `Book_Agt_Modifr='20411'`。所查消费者用 `Book_Agt_Id` 关联账簿；这里确认了修饰符取值及其使用对象，未展开完整修饰符字典。

日期有两层：`busi_date` 是分区中的业务日期，用于选取快照；`Eff_Date`、`Exp_Date` 分别来自源生效、到期日期，描述业务有效期。读取某天快照，不等于已经按有效期筛选。

“每天每个账簿严格只有一行”尚未证明。DDL 没有唯一约束，生产 SQL 也没有去重。跨日期理解记录时，需同时考虑 `src_tbl`、`busi_date`；实际业务键唯一性仍需数据核验。

先记住四组属性即可：

| 属性         | 主要字段                                                 | 当前能确认的含义                               |
| ------------ | -------------------------------------------------------- | ---------------------------------------------- |
| 标识与有效期 | `Book_Agt_Id`、`Book_Agt_Modifr`、`Eff_Date`、`Exp_Date` | 识别账簿并保留源有效日期                       |
| 组织与柜台   | `Bel_Dept`、`Bel_Co`、`Cntr`、`Ost_Otc_Ind`              | 部门、公司、柜台、场内外标识                   |
| 业务开关     | 财务、风控、确认书、结算通知书等标志                     | 保留并转换源开关；各项具体执行用途尚未逐一核验 |
| 映射与说明   | `Map_Undrl_Cd`、`Remark`                                 | 标的映射及备注                                 |

## 生产主要在统一表达

三个已核验生产任务都以字段重命名、补固定值和日期、转换开关为主，没有 JOIN、聚合或去重。例如财务报送标志将 `Y` 转为 `1`、`N` 转为 `0`，其他值原样保留，因此不能说它已被严格规范为二值。

105382、106096 读取 `odata_n_tit.d_ref_book`；144293 读取 `odata_n_tit.d_ref_book_pb` 的 `h15` 分组，却仍写入同一个 `src_tbl='ODATA_N_TIT.D_REF_BOOK'` 标签。可见来源分区标签不能替代真实 SQL 读源。

三份 SQL 快照分别使用 2026-06-11、2026-08-27、2026-05-19，不代表同步运行，也不能由此判断当前哪条生产路径实际执行。

## 用途一：给结算异常补充部门

结算异常监测任务 181556 先从合约、事件、流程及收付款信息形成异常记录，再读取当天账簿快照，按账簿编号执行内连接，并把账簿的 `Bel_Dept` 写入结果。

这里应分清两件事：部门的值来自账簿表；异常原因来自前面的业务判断。内连接还意味着，没有匹配账簿的记录不能通过这一步；若匹配不唯一，也可能增加中间行数，最终数量需结合后续去重和实际数据判断。

## 用途二：少数字段决定盈亏如何汇总

创收日报任务 230202 的一个分支，先筛选 `Cntr='DYNAMIC_HEDGING'` 的账簿，再按账簿编号内连接持仓。之后按标的映射和持仓日期汇总盈亏：

```sql
nvl(if(rb.Map_Undrl_Cd='',null,rb.Map_Undrl_Cd),ins.undrl_clas)
```

这个表达式优先使用账簿映射；映射为空时回退到证券信息的 `undrl_clas`。它同时进入分组键，汇总结果再按标的和日期关联回日报。

**教学示意，非实际数据：**同一天，两个通过账簿筛选的持仓记录盈亏为 10 和 20，映射结果都是 A；在其他连接未改变行数的前提下，这一步会把它们汇总成标的 A 当日盈亏 30。账簿表没有提供 10 或 20，却影响记录是否参与、汇总到哪里。

因此，这里的变化可以读成：账簿相关持仓 → 标的与日期的盈亏 → 关联回合约日报。理解这个过程后，可以继续阅读[合约销售基础](03-sale-foundation.md)，认识日报另一侧的合约信息。

字段比例也必须谨慎：中间 `SELECT *` 展开全部账簿字段，不代表全部字段有效贡献最终结果。Facts 显示，日报最终 `Book_Agt_Id`、`Cntr` 的值来自销售收入表；`Map_Undrl_Cd` 可来自账簿映射，`Undrl_Tdy_Yield` 的数值来自持仓汇总表。值来源、过滤、关联和分组应分别分析。

## 已经懂了什么，还缺什么

已确认的是上述 SQL 实现及字段依赖。将账簿视为“公共属性与控制依据”，是由两个消费者支持的解释；具体业务为何这样设置，仍需业务材料或人员确认。

尤其需要保留一个问题：创收分支使用运行日账簿快照关联 2022 年以来的持仓，没有按每个持仓日匹配账簿有效期。实现可见，但历史归属口径是否符合预期尚未核实。这是后续值得研究的规则问题，不能直接判作正确或错误。

## 证据索引

范围固定为发布版本 `df6f0ae4b6ef465f751351b14fd02ea08542d824d7bfea36e5a58dd1039e23c3` 所引用的产物。本次只读核验三个生产与两个消费任务；五份 projection 的声明 `contentHash` 与 batch manifest 一致。以下行号指 evidence JSON 内 `sqlSources` 的 `slot=query` 文本行号，并非 JSON 文件行号。

- 元数据：[表说明](../../../sql-static-lineage-data/tables/hive/pdata_n.t03_otc_deri_book_adtnl_info__gfhive/table.json)、[DDL](../../../sql-static-lineage-data/tables/hive/pdata_n.t03_otc_deri_book_adtnl_info__gfhive/ddl.sql)。
- 105382：[生产证据](../../../sql-static-lineage-data/task-projections/tasks/105382/versions/7b85f75ff52ed4b978821bc3dc3320ce9945630d4db26c881301a084a48b13d8.evidence-v3.json)，query 1–43 行：字段映射、开关转换和读取来源。
- 106096：[生产证据](../../../sql-static-lineage-data/task-projections/tasks/106096/versions/f0d4f2252001ab02bbeb3f36d15219e1bb128ec25c825127e64304eab120a538.evidence-v3.json)，query 1–44 行：同类标准化、业务日期快照。
- 144293：[h15 生产证据](../../../sql-static-lineage-data/task-projections/tasks/144293/versions/c19e3c55e147b9ccca7978a8026975fefbf86531d7a76c0b81d5fbe8019146a6.evidence-v3.json)，query 1、42 行：写入分区标签与实际读源不同。
- 181556：[结算异常证据](../../../sql-static-lineage-data/task-projections/tasks/181556/versions/679fa05dcf80c91d0c5d52cbcc62ed2b1a64a00744372fdae8d379a6cf5967d7.evidence-v3.json)，query 101、661–666 行：部门输出及账簿内连接。
- 230202：[创收日报证据](../../../sql-static-lineage-data/task-projections/tasks/230202/versions/054fea93fea9ed6256ee5087deea9b8e94b43aef5625415a20840276b3a06ae3.evidence-v3.json)，query 206–244 行：账簿过滤、映射、聚合与结果关联；`expressions` 中最终 `root.project` 提供字段物理来源，`relations` 保留过滤和聚合依据。

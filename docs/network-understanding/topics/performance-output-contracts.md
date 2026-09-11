# 考核与经营报表的传输、去重和占位值

本页说明计算结果进入考核接口时还会发生的变化，连接[主篇](../chapters/09-performance-and-assets.md)与[收入及绩效接口](performance-income-and-evaluation.md)。所列任务的全部 SQL 槽位均已核读。它们很多是单表投影，但不是所有输出值都原样保留：接口可改类型、补零、筛客户、择一行，甚至把源中存在的字段固定写零。

<a id="pt-three-month"></a>

## 三个月回补的收入报表

110566、110678、110694、110695 分别读取客户两融、期权、产品和其他业务比较报表，110880 读取客户×员工×关系的月报，110892 读取机构×客户分类的收入分析。六项都选当前月及前两个月，截断目标对应三个月分区。金额多 cast decimal(16,2) 后补 0；组织／客户分类转整数。接口没有重新推导源表的同比、环比或累计收入。[110566：query 1–36；110678：query 1–36；110694：query 1–36；110695：query 1–18；110880：query 1–55；110892：query 1–35，各 truncate 1][^110566][^110678][^110694][^110695][^110880][^110892]

其中两融、期权、产品比较表的许多占比与单位资产收入列明确为常数 0；110880 的收入占比和单位资产收入也多为 0。它们不是由分子为零计算得来，不能据接口这些值判断业务没有贡献。110880 保留源关系类型、起止日、weight，却不在本层使用权重再乘一次；110892 的客户分类汇总已由源表给定，本层不再聚合。

174041、174119、174129、174163、174164 分别传客户的佣金、财富、其他、期权、两融收入，各选三个月且机构字段非空，并截断同三个月。输出仍是客户月收入明细，totl_incm 一律写 0；实际可用的是各收入组件。财富出口还把 pub_onl_opr_incm 写 0。客户姓名缺失补“无”，客户类型缺失补 2、层级补 0。这里的默认代码只是源码事实，代码的业务字典需看源定义。[174041：query 1–19；174119：query 1–51；174129：query 1–21；174163：query 1–21；174164：query 1–24，各 truncate 1][^174041][^174119][^174129][^174163][^174164]

<a id="pt-relation"></a>

## 员工关系收入按最大主收入择一行

五个关系收入接口都要求归属员工 own_emp、关系类型、客户号和 emp_no 非空，按“业务月×客户号×关系类型×员工号”分组，以本家族主收入降序 row_number=1 选一条；它们不是把重复行加总。同分没有额外稳定排序，不能保证取哪一条。每一条保留该胜出行的组件、所属组织与归属员工信息，而输出 weight 与 totl_incm 为 0。[下表所列 query 全文及 truncate 1]

| 任务   | 实际来源                        | 排序主收入 | query 行       |
| ------ | ------------------------------- | ---------- | -------------- |
| 176278 | wt_taum_cust_rela_comm_incm_mon | comm_incm  | 1–53[^176278]  |
| 176288 | wt_taum_cust_rela_csfc_incm_mon | csfc_incm  | 1–61[^176288]  |
| 176290 | wt_taum_cust_rela_fort_incm_mon | fort_incm  | 1–115[^176290] |
| 176292 | wt_taum_cust_rela_opt_incm_mon  | opt_incm   | 1–55[^176292]  |
| 177015 | wt_taum_cust_rela_oth_incm_mon  | oth_incm   | 1–55[^177015]  |

这五项均取当前及前两个月，截断同范围目标分区。176288 的两项扣除子项用 NULL cast 后补 0，尽管非关系两融出口承接对应源字段；176290 的公募交易佣金、公募考核切分、线上运营收入都固定为 0。因而不能要求客户收入表所有组件简单按员工关系展开后逐项守恒；既要看上游分摊，也要看这层有意的接口字段差异。

<a id="pt-assets"></a>

## 资产报表的重传窗口各不相同

下列八项都没有重新折标或分摊，而是选择计算好的报表行传输；删除或截断范围与各自查询窗口对应。

| 任务   | 来源报表／粒度       | 传输范围及特殊处理                   | query 行      |
| ------ | -------------------- | ------------------------------------ | ------------- |
| 151193 | 机构月日均资产分类   | 年初至当前月                         | 1–14[^151193] |
| 151197 | 机构年日均资产分类   | 上月与当前月                         | 1–14[^151197] |
| 152787 | 员工月日均资产分类   | 年初至当前月，资产和增长率转四位小数 | 1–18[^152787] |
| 152789 | 员工年日均资产分类   | 当前月，缺增长率显示 --              | 1–19[^152789] |
| 152794 | 员工月日均资产总览   | 年初至当前月                         | 1–13[^152794] |
| 152795 | 员工年日均资产总览   | 当前月，三项资产值若为 -- 改为 0     | 1–18[^152795] |
| 231823 | 分公司月日均资产分类 | 年初至当前月                         | 1–13[^231823] |
| 231825 | 分公司年日均资产分类 | 上月与当前月                         | 1–14[^231825] |

这些行还带业务、调整和考核系数；系数在这层只是投影。主篇已说明特殊折标分支不一定能由三个展示系数直接复算，因此出口存在系数列不构成通用乘法合同。152795 把未展示值改零与 152789 保留 -- 的做法也不同，调用方不能混用。

<a id="pt-selection"></a>

## 评价结果与审核奖励的出口筛选

203960 从机构评价指标的当前月取 indi_code 非空行，按月×指标代码×机构选择 indi_val 降序第一条，并将值及初始值缺失补 0。排序表达式没有显式 cast；源字段若是字符串，是否按数值排序要核对实际类型。234977 把客户评价效果值转为六位小数，选当前月、机构可转整数且非空，并要求客户存在于另一张跟进名单；EXISTS 只按客户号匹配，没有季度／月份条件。因此它是客户筛选后的评价出口，不等于全体客户评价。[203960：query 1–14、truncate 1；234977：query 1–28、truncate 1][^203960][^234977]

43700 和 93550 都读取网上开户审核奖励汇总，但前者取当前月，以运行日写 busi_date，将 return_type 映射为 delete_flag，并仅删目标当天；后者取上月，将 delete_flag 写 NULL，删除目标上月。日期列、删除语义和月份都不同。奖励计算见主篇及开户奖励来源任务，本页只解释这两种已核实的输出。[43700：query 1–16、truncate 1；93550：query 1–6、truncate 1][^43700][^93550]

读取发布 SQL 证明的是以上静态处理；本页没有证明源报表数值准确、后续指标后处理已运行或目标用户界面实际显示这些字段。单表出口的 EXPLAINED 只代表传输与转换规则已解释，不能代替其上游计算家族的审阅。

[^43700]: Task 43700，发布 evidence：[SQL 快照](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/43700/versions/d0c79e52d7c60bdb6d4e9f333f691d42c740e7d13bd08f3e836f9cd2aafaf54e.evidence-v3.json)。

[^93550]: Task 93550，发布 evidence：[SQL 快照](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/93550/versions/6725a0d109f3f6d355f30bc76db7deb4a7067b1a010c7579c52ac87e409aab99.evidence-v3.json)。

[^110566]: Task 110566，发布 evidence：[SQL 快照](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/110566/versions/914b9bf516a7a3c371028a7fab292cc2df41190a1d06d0849c71274f2446ba54.evidence-v3.json)。

[^110678]: Task 110678，发布 evidence：[SQL 快照](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/110678/versions/d7e32d4692ff9308d3988d53516fe9db6d08b810b83326480022c6ba8d33c28c.evidence-v3.json)。

[^110694]: Task 110694，发布 evidence：[SQL 快照](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/110694/versions/bdadafb7f5623edd7c5c8129b5d6e7fce2bb8b0dd59e530e2bb2fb0decc46a0c.evidence-v3.json)。

[^110695]: Task 110695，发布 evidence：[SQL 快照](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/110695/versions/eac4b68d26353168ee227ff382fc6f3b7264e69515efa2246a60032e5bf8571a.evidence-v3.json)。

[^110880]: Task 110880，发布 evidence：[SQL 快照](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/110880/versions/749672df21e455842a957c0832733e00726626fa6dc1b4efbd4acd55c98c922e.evidence-v3.json)。

[^110892]: Task 110892，发布 evidence：[SQL 快照](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/110892/versions/f85261b6d8b28c76cb4f70474f2270904fdeea79a30a12654ea8c9c1c7064b73.evidence-v3.json)。

[^151193]: Task 151193，发布 evidence：[SQL 快照](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/151193/versions/0a8f44a41597a2c8574d3e3adb1d7b472d3a8ec354ce52bb633f1492b703d034.evidence-v3.json)。

[^151197]: Task 151197，发布 evidence：[SQL 快照](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/151197/versions/b41a4212173ab41e3cb60437a0bd7f692058c2834bd5b3d834e0701e6fa740a0.evidence-v3.json)。

[^152787]: Task 152787，发布 evidence：[SQL 快照](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/152787/versions/f87b637d1ffd29ca38a37c29908abb032b2377e0c7c9f4af56ccb24803819c76.evidence-v3.json)。

[^152789]: Task 152789，发布 evidence：[SQL 快照](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/152789/versions/5ed1224ea7e11597af4408486a6d0ed79f3331dda7c44ac42c81e5760cafab77.evidence-v3.json)。

[^152794]: Task 152794，发布 evidence：[SQL 快照](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/152794/versions/2f4e03be08ef2147dca79ac20adac9e5af929bed3f9a6c6fcaad3d861e3dd35f.evidence-v3.json)。

[^152795]: Task 152795，发布 evidence：[SQL 快照](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/152795/versions/f615f982b6ec3320246d37994d1c0390dcbfac728959557770978a31e3df604c.evidence-v3.json)。

[^174041]: Task 174041，发布 evidence：[SQL 快照](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/174041/versions/f04b926608f49741a9c9a0e8cadcbd49781d5487fb49ea3e8fa7c3826ba41f7c.evidence-v3.json)。

[^174119]: Task 174119，发布 evidence：[SQL 快照](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/174119/versions/f369ecc7c9b096a31421aec276ceb216319a1aa3f2718708dc21d41f50569c9d.evidence-v3.json)。

[^174129]: Task 174129，发布 evidence：[SQL 快照](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/174129/versions/5fe9090fbb842311860956b32023a2e722150e8198d64f36e6340e4360b6237d.evidence-v3.json)。

[^174163]: Task 174163，发布 evidence：[SQL 快照](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/174163/versions/667f7fa7145eb0f34677ed3aa830d9a181a839194c08899e0c16ab6bb8ed0b6a.evidence-v3.json)。

[^174164]: Task 174164，发布 evidence：[SQL 快照](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/174164/versions/7c3676c39b53c0f556f57db7585e4910ba193ded0d9cbad4e5633bb564234267.evidence-v3.json)。

[^176278]: Task 176278，发布 evidence：[SQL 快照](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/176278/versions/a65cc63caad568d3420846fcc61dfff3ecda18d28233f134944b63e0a8b0d155.evidence-v3.json)。

[^176288]: Task 176288，发布 evidence：[SQL 快照](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/176288/versions/2294e56a309686d97a95c897e4ca83a5cd170846128a8c260c3d317342a903d7.evidence-v3.json)。

[^176290]: Task 176290，发布 evidence：[SQL 快照](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/176290/versions/80fddc8269001fd739109ea96190558774c66e012155560552bdf9cc760d7eb9.evidence-v3.json)。

[^176292]: Task 176292，发布 evidence：[SQL 快照](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/176292/versions/6717cc3eea291911931ffb0400e357832d93cbfe0f5b78c4139d8a71bf3165c7.evidence-v3.json)。

[^177015]: Task 177015，发布 evidence：[SQL 快照](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/177015/versions/fb71d3715e0da034a7ad1bf6dad60b03f4d2fd0094575e0dd249524e1293dbda.evidence-v3.json)。

[^203960]: Task 203960，发布 evidence：[SQL 快照](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/203960/versions/e59ef12b5fafffec7ebcecdae583f2a28396382dcfb411a9eebafc329dc19772.evidence-v3.json)。

[^231823]: Task 231823，发布 evidence：[SQL 快照](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/231823/versions/10c60d668e36e2d9ed5a50fbe479aa267f1032b0e630d89c0f1728d7726c31f3.evidence-v3.json)。

[^231825]: Task 231825，发布 evidence：[SQL 快照](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/231825/versions/cd5f28909cb6c58c716fe7ef3247f1c0f74e3974d08e3d279a72ad01b65ad479.evidence-v3.json)。

[^234977]: Task 234977，发布 evidence：[SQL 快照](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/234977/versions/4a93adffe121fafabb95f817bbd1f0ddfd4b8fc727208041290a36f9aac7ad2a.evidence-v3.json)。

<a id="pt-supplement"></a>

## 发布缺 SQL 的五个出口，补充快照确认了什么

以下五项在固定发布 evidence 没有 SQL。本节只使用 supplemental-pack-inventory.json 指定的当前 Input Pack query，逐条按 task.json.sqlFiles 相对路径与 hash 核读，没有替换发布来源。

146711 取当天企微标签变化结果，要求 external_userid 非空，投影客户号、添加／删除标签数组和适当性等字段；本层没有计算标签变化，也没有证明消息已送达。[补充 query 1–3][^146711]

174788 读取机构数字大屏日指标，174871 读取月指标，174873／174875 分别读取其他日／月指标。四项 query 均没有日期 WHERE 条件，因此不能将任务名称中的“推送”解释为只送计算日；174871 把月交易额、资产占比和业务月重命名，174788 把交易额占比重命名为年占比，后两项只投影指标代码、值及日期／月份。已提供补充槽位只有 query，删除目标、覆盖方式、目标读取与运行成败仍无证据。[174788：补充 query 1–26；174871：1–15；174873／174875：1–5][^174788][^174871][^174873][^174875]

[^146711]: Task 146711，补充 Input Pack query：[SQL 快照](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/tasks/hive2oracle/146711/sql/query.sql)，采集 2026-09-07T07:18:39.266Z；元数据路径及 hash 见 performance-review.json。

[^174788]: Task 174788，补充 Input Pack query：[SQL 快照](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/tasks/hive2postgre/174788/sql/query.sql)，采集 2026-09-07T10:09:51.666Z；元数据路径及 hash 见 performance-review.json。

[^174871]: Task 174871，补充 Input Pack query：[SQL 快照](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/tasks/hive2postgre/174871/sql/query.sql)，采集 2026-09-07T10:09:51.688Z；元数据路径及 hash 见 performance-review.json。

[^174873]: Task 174873，补充 Input Pack query：[SQL 快照](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/tasks/hive2postgre/174873/sql/query.sql)，采集 2026-09-07T10:09:51.707Z；元数据路径及 hash 见 performance-review.json。

[^174875]: Task 174875，补充 Input Pack query：[SQL 快照](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/tasks/hive2postgre/174875/sql/query.sql)，采集 2026-09-07T10:09:52.793Z；元数据路径及 hash 见 performance-review.json。

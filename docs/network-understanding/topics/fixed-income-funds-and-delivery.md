# 固收资金、保证金、权限与下游交付

账户余额、合同保证金参数、客户保证金日报和贷款/回购交易是不同对象。余额表达某时点可见资金状态，参数表达合同约定，日报表达报表记录，交易金额表达业务发生规模。名称里都有“资金”不意味着它们可以互相验证或抵消。

## 每日余额与两次日内预付金

210687 从 `T98_OTC_DERI_AST_ACCT_BAL_SUM` 读取 TITANS 实际资金余额来源，直接取对手简称、源 `Busi_Date` 和 `Actl_Tot_Bal`，把当前调度日另写入分区。源查询只有 `SRC_TBL` 条件，**没有源业务日过滤**，所以一个当天分区可以装入多天历史余额；将其解释为“当天余额总和”会混合日期。[210687 · query · 1-13行](../../../../sql-static-lineage-data/task-projections/tasks/210687/versions/3ddec785306c7a820e421ee8b1c4a92780a55d0aa318389ffbf35fc0504c7f86.evidence-v3.json) [210687 输出DDL](../../../../sql-static-lineage-data/tables/hive/dm_fii_n.sum_capital_acct_balance_day__gfhive/ddl.sql)

204961、204964、210322 从这个当天模型分区送出数据，把源业务日改名为 `business_date`。后两项用 `row_number()+unix_timestamp()` 生成 ID，这是装载时标识，不是客户/日期的稳定业务键。204961 的名字含 MySQL、类别也为 hive2mysql，但发布登记目标实际为 Oracle；204964 为 COLLECTION_FAILED，只登记裸表名。本文能核实它们读了什么，不能据名称补出物理出口或声称插入成功。[204961 · query · 1-8行](../../../../sql-static-lineage-data/task-projections/tasks/204961/versions/ccfc40bad425536487a26e8a64bf0ebfb9338970aac54c4109264938e8722bf4.evidence-v3.json) [204964 · query · 1-9行](../../../../sql-static-lineage-data/task-projections/tasks/204964/versions/7d5a5d5ba286c0f96059177ee28584d9fbd36c3a9514922af5a3ddeea2627930.evidence-v3.json) [210322 · query · 1-9行](../../../../sql-static-lineage-data/task-projections/tasks/210322/versions/a3a1421d183855eb92ff48e58bee0f88f7431c6e5a1ec9fa254344159929f11b.evidence-v3.json)

233309/233341 则直接读 `d_capital_daily_actual_balance_p`，源 `busi_date` 分别是字面量 h1550、h1650；真正资金日期来自 `src_busi_date`，模型分区另写当天。两项分别创建 `capital_daily_actual_balance`、`capital_daily_act_balance`，不是简单同表换一个小时。233311/233312 分别从对应表当天分区输出，发布目标均仅是裸 `gfedw.fixed_income_advance_payments` 字符串且覆盖状态 COLLECTION_FAILED。静态查询没有证明两个日内版本的先后替换或最终下游版本。[233309 · query · 6-13行](../../../../sql-static-lineage-data/task-projections/tasks/233309/versions/73762588d54b62179d57a991e92c0b155440c3d056e3b100f67ebe3fcc15e940.evidence-v3.json) [233341 · query · 6-13行](../../../../sql-static-lineage-data/task-projections/tasks/233341/versions/4bf07c42a45363573fb6286694256846da14b3a64e63cb7d4fe15d6cd3e8ca2a.evidence-v3.json) [233311 · query · 1-9行](../../../../sql-static-lineage-data/task-projections/tasks/233311/versions/118b2d3b552115c8a16f830ae916ff76ee3f34df664d7750555f3d53472587da.evidence-v3.json) [233312 · query · 1-9行](../../../../sql-static-lineage-data/task-projections/tasks/233312/versions/64b95ad96253903a896f3180911c2f0296a76eb134f42460e6d3a0903e559507.evidence-v3.json)

## 合同保证金与 A1020 日报的边界

[合约页](fixed-income-contracts.md)的保证金方向、初始线、追保线、授信比例来自合同参数或担保方案；这些字段没有在本范围内与每日实收保证金对账。借券券源经合约产品接入，[月度统计](fixed-income-income-and-customers.md)中的回购按交易类型归集金额；它们也不能替代账户余额。

为理解“固收委衍生品部衡泰客户保证金日报 A1020 已拉取”这类标志，本主题额外核读了范围外的精确检查任务 209504，仅作为上下文证据，不加入 75 项主范围。其发布 SQL 只判断 `dm_fii_test.CSTD_OTC_DERI_CUST_BAIL_INFO` 中，当天且 `src_tbl='ODATA_N_XIR.T_VTRD_A1020'` 的行数是否至少为 1。只要一行便返回 1；它没有核查所有客户、金额、状态、重复、缺失或期望行数。[209504 · query · 1-9行](../../../../sql-static-lineage-data/task-projections/tasks/209504/versions/e327614ea01ba817dce1fe9685d43aeee6fa6f537492b5ebefb3f22723ca6334.evidence-v3.json)

本次通过数综只读表查询，按**精确 schema 与表名**取得该对象：GUID `3527fa49-7b75-47c2-868b-ce08420f0f91`，描述为“衡泰日报_客户保证金_A1020”，登记状态 DELETED，分区为 `src_tbl/busi_date`，生产任务与上下游列表为空。原始业务响应及查询参数保留在[审阅账本](../evidence/fixed-income-review.json)的 `supplementalMetadataQueries`。这是当前元数据目录的登记结果，不证明底层物理表已经删除；也没有提供该测试表的生产 SQL。因此尚不能解释其金额推导或证明日报目前可用。目录中的 `dm_cisp_test` 同名对象不被替代为这条链的证据。

## 用户—角色—账簿权限，和账簿业务开关

177414 从未删除且用户类别50的 TITANS 用户出发，经 OA 账户、ERP 姓名、用户角色、角色权限连接到账簿；按用户/OA/姓名/账簿聚合权限代码和名称。它筛权限类别2、资源类型50，排除柜台 HKFICC_TEST，但没有统一的固收部门过滤。用户角色与角色权限历史表也没有当前有效区间过滤，所以它是现有查询生成的授权视图，不是所有时点权限的完整判定器。178477 进一步排除空账簿并全表删除后输出权限结果。[177414 · query · 11-122行](../../../../sql-static-lineage-data/task-projections/tasks/177414/versions/57c88ec9119667e875e0ad4146166ae96334211260a547625767bb0465574e32.evidence-v3.json) [178477 · query · 1-12行](../../../../sql-static-lineage-data/task-projections/tasks/178477/versions/415be78f4c07dbd9bc005eff96a738eb9d7fe8e65a62e1f7e69c47aed894416a.evidence-v3.json) [178477 · truncate · 1-1行](../../../../sql-static-lineage-data/task-projections/tasks/178477/versions/415be78f4c07dbd9bc005eff96a738eb9d7fe8e65a62e1f7e69c47aed894416a.evidence-v3.json)

243918 则明确只取当天 GFS_FICC 账簿，连接未删除的账簿 AGT 持有人、有效账簿名和柜台字典，输出所属公司/部门/柜台以及财务、风控、报备、结算通知、交易确认、资金、限额、二次复核开关。输出生效/失效日，但没有按这两列再过滤账簿；这不同于[合约页](fixed-income-contracts.md)使用有效账簿的范围。243958/243965 读该表当天结果，分别登记到 StarRocks 与 MySQL 对象。开关表达配置意图，不证明报送已成功完成。[243918 · query · 25-98行](../../../../sql-static-lineage-data/task-projections/tasks/243918/versions/aab2b14b7f098f61063cf104e5d919bc3d2a5427a318cd7a1c37f97b4efdd852.evidence-v3.json) [243958 · query · 1-26行](../../../../sql-static-lineage-data/task-projections/tasks/243958/versions/9ab449395738c4ce29ca9b1808c235c7073e824ebbc1be689d7dbacc9d8ae48d.evidence-v3.json) [243965 · query · 1-26行](../../../../sql-static-lineage-data/task-projections/tasks/243965/versions/6f24ecaf84a953d1dd8a8db77201509e100455f64c300d2bb7c8273d7390e5c9.evidence-v3.json)

## 出口类型、转换和替换范围

| 出口家族 | 已核实的行为 | 使用边界 |
|---|---|---|
| 业务规模、PV、簿记 | 当天分区选择；规模按业务分类清理，PV/期权与互换簿记按日期清理 | 期权清理漏含债券期权分类，见[规模页](fixed-income-scales.md)；PV选数使用大小写不同日期占位符，其平台替换行为未实跑验证 |
| 到期提醒 212155 | 当天窗口结果，加装载时间 | `wind_code string` 是查询中的别名写法，不是 DDL 类型声明；按目标位置加载是否对应需运行合同验证 |
| 日内持仓导出 | 裁切或改名源业务日期，对空标的/币种补值；h1730 对冲读删昨天及以后 | 裸表名目标和同表多生产者保留未知，不能用调度邻居推定实际消费批次 |
| 互换主表 234682、测试资产腿 234717 | 当天选数，多项金额/汇率空串转 NULL | 这是数值装载规范化，不是金额重算；资产腿明确进 UAT |
| 事件与测试盈亏 | 234637读正式标的事件；234628读测试事件；237081/237086读正式宽表写UAT | 新补234457当前脚本写正式schema，与原测试事件出口尚未接通 |
| CRM月报及协同 | 月报全表替换，协同当天distinct；保留自身日期及机构过滤 | 业务分类与月份过滤不能解释为通用经营口径 |

[184452 · query · 1-7行](../../../../sql-static-lineage-data/task-projections/tasks/184452/versions/194ebcb9e32c21c46f8bf82085cae35378ffbd1224d6aa1fac6e4af42141facc.evidence-v3.json) [208843 · truncate · 1-2行](../../../../sql-static-lineage-data/task-projections/tasks/208843/versions/8cba73d1e341bad484ab2602d799777234db52511f4769feb972b8405ff4e5a4.evidence-v3.json) [208844 · truncate · 1-2行](../../../../sql-static-lineage-data/task-projections/tasks/208844/versions/af29af42f4444c7ae5f939dce9831e57b0de1a5bc6987faf2b254bba5cb1cd24.evidence-v3.json) [212155 · query · 1-17行](../../../../sql-static-lineage-data/task-projections/tasks/212155/versions/fe64fbc660026a4e2eeec294d107b2787162110db91a66edd4d46f44d87f6b34.evidence-v3.json) [234682 · query · 1-134行](../../../../sql-static-lineage-data/task-projections/tasks/234682/versions/7ab8c06a21dbba87ec03ae003381a299d33efe478ee2edb98946c7404a58d002.evidence-v3.json) [234637 · query · 1-44行](../../../../sql-static-lineage-data/task-projections/tasks/234637/versions/aaf3417e2495a8d4dfac65ed1199bde93ae4a2419687784fed723023821f72aa.evidence-v3.json)

发布登记中的 `platform target` 是平台配置与静态投影证据，尤其 211076/211090/211097/212590、222589/222728、227482/227488、232022、234637/234682 等类别带 h2sr 的项，登记仍是 Hive 目标。有 SQL 可以解释选数与加工，但本文不会把这些登记反向改成推测的 StarRocks 输出。无唯一物理目标的项也保留原覆盖状态。

## 仍未解决的三项与一条断开的上下文链

211155（仿真推送）在发布中无 SQL，精确当前任务包也未找到，无法判定是否与其名称提及的另一任务完全相同。234824、234826 为邮件类任务，发布无 SQL，当前明确任务包 `sqlFiles=[]`；因此本文仅保留定位，不能从标题认定发送内容、触发条件或送达情况，也没有执行发送操作。

第四个原发布无 SQL 的任务 234457 已通过当前平台补证解释了事件聚合，但它仍不属于固定发布 SQL，其与 234628 的 schema 差异仍在。A1020 则是范围外用于理解日报标志的精确上下文链，已经主动查询到目录登记结果，生产公式仍无证据。它们的限制影响不同，不能用一个笼统“无数据”代替。

返回[固收入口](../chapters/11-fixed-income.md)，相关主题：[源系统](../chapters/01-sources-and-systems.md)、[公共对象](../chapters/02-public-objects.md)、[资金与保证金](../chapters/05-funds-and-margin.md)。

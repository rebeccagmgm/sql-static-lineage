# 固收持仓与盈亏：合约、腿、对冲标的和批次

一份互换有合约总盈亏，也有资产腿、费用腿盈亏；对冲账户还持有证券、期货等标的。前两者回答客户合约怎样产生收益，后者回答账簿拿什么对冲。它们共享日终持仓来源，但层级不同，不宜把同一经济结果重复累加。

## 合约与腿收益的模型加工

233302 通过协议静态信息取得内部编号，用协议关系找到 Book，用协议产品关系找到产品，再接当天 `T98_OTC_BOOK_HOLD_SUM`。合约日收益与累计收益来自该表；资产腿/费用腿日收益及累计收益来自 `T98_OTC_SWAP_COMP_LEG_VALU_INFO`，按腿全局序号、业务日、账簿连接。年收益统一由当日累计减上一年 12 月 31 日累计构成，缺失的前值用 0。[233302 · query · 81-158行](../../../../sql-static-lineage-data/task-projections/tasks/233302/versions/5fe116a3c996ffb504a95e9ef68de65f3e7a1e5963bdf5db6860428eee144fca.evidence-v3.json) [233302 · query · 283-427行](../../../../sql-static-lineage-data/task-projections/tasks/233302/versions/5fe116a3c996ffb504a95e9ef68de65f3e7a1e5963bdf5db6860428eee144fca.evidence-v3.json)

这张表的终止标志由业务日是否达到实际结算日（缺失则期末定价日）计算，不是直接复制审批状态。普通 `DYNAMIC_NOTIONAL` 固定写 `'-'`；原币和本币名本另有字段。协议关系、产品关系、账簿名没有当前有效区间条件，最终也没有固收部门过滤；因此它是位于固收 topic 的宽表，不能单凭目录归属认为里面只含固收合约。[233302 · query · 94-100行](../../../../sql-static-lineage-data/task-projections/tasks/233302/versions/5fe116a3c996ffb504a95e9ef68de65f3e7a1e5963bdf5db6860428eee144fca.evidence-v3.json) [233302 · query · 159-226行](../../../../sql-static-lineage-data/task-projections/tasks/233302/versions/5fe116a3c996ffb504a95e9ef68de65f3e7a1e5963bdf5db6860428eee144fca.evidence-v3.json) [233302 · query · 428-429行](../../../../sql-static-lineage-data/task-projections/tasks/233302/versions/5fe116a3c996ffb504a95e9ef68de65f3e7a1e5963bdf5db6860428eee144fca.evidence-v3.json) [233302 输出DDL](../../../../sql-static-lineage-data/tables/hive/dm_fii_n.wide_idx_otc_swap_pos_pnl__gfhive/ddl.sql)

## 对冲标的持仓与风险量

234568 从当天 `T98_OTC_BOOK_HOLD_SUM` 排除 OTCOPTION、OTC_OPTION_CONTRACT、FEE、TRS，留下对冲标的持仓，输出数量、价格、单位成本、市值、日/累计/年盈亏。年初对照不仅按产品和账簿，还包括投资类型、多空和限售解禁日期；空多空、空串或 N/A 被归为 LONG。Greeks 和结算币转本币汇率从当天 `T98_SB_TIT_DAY_HOLD_INDX` 按同样维度接入。它读取现成风险量，没有在这里计算 Delta/Gamma/Theta/Vega。[234568 · query · 43-190行](../../../../sql-static-lineage-data/task-projections/tasks/234568/versions/7b5bb68f5faf8aad936f1f22be2620495c45fa2eda82fbec129fa4b601b313ae.evidence-v3.json)

这张宽表同样没有 GFS_FICC 筛选。237081/237086 把它和上述合约盈亏宽表的当天结果输出到登记为 `bd_dm_fii_uat` 的对象，任务也属于测试 topic。这支持“测试下游在消费模型”，不支持“正式风控/财务已采用”。[237081 · query · 1-44行](../../../../sql-static-lineage-data/task-projections/tasks/237081/versions/46b869ace234ec5977d899c8fccde090b0b63d080b06abf7c32d38533a97161f.evidence-v3.json) [237086 · query · 1-81行](../../../../sql-static-lineage-data/task-projections/tasks/237086/versions/952863c71f5c7f48d8e7723e735c60dab929439cbec1b33201808f77cbc07012.evidence-v3.json)

## 期权日终页并非所有字段都按名称计算

231741 的账簿集合由名称含“期权”、排除“虚拟/测试/test”，并由有效账簿静态信息限定 GFS_FICC。主分支把当天期权持仓与日终指标按产品、计算日、类型、多空、账簿连接；另一个 UNION 分支用估值终止日，缺失时用提前终止日/期末日接当天持仓与指标。第二分支仍限定 `pd.busi_date=当天`，所以它不是完整年度已终止合约档案。取消、草稿和待处理草稿被排除。[231741 · query · 96-120行](../../../../sql-static-lineage-data/task-projections/tasks/231741/versions/3a189e95a52a24b2a5e7f35ad1378cfaf4212b036dde7cdf319ae83fff3d5a5e.evidence-v3.json) [231741 · query · 285-386行](../../../../sql-static-lineage-data/task-projections/tasks/231741/versions/3a189e95a52a24b2a5e7f35ad1378cfaf4212b036dde7cdf319ae83fff3d5a5e.evidence-v3.json) [231741 · query · 446-552行](../../../../sql-static-lineage-data/task-projections/tasks/231741/versions/3a189e95a52a24b2a5e7f35ad1378cfaf4212b036dde7cdf319ae83fff3d5a5e.evidence-v3.json)

它保留客户经理、费用、初始与动态名本、标的价格、跨币种类型及映射分类，但产品名称、持仓总成本、平均成本、股份类型是 NULL。`initial_pl` / `initial_pl_base` 注释写“期初定价日盈亏”，实际连接的是上一年 12 月 31 日持仓的**当日**已实现与未实现收益，不能按注释当作合同起始日损益。ID 是依当前结果排序生成的行号，不是稳定跨日业务键。[231741 · query · 175-284行](../../../../sql-static-lineage-data/task-projections/tasks/231741/versions/3a189e95a52a24b2a5e7f35ad1378cfaf4212b036dde7cdf319ae83fff3d5a5e.evidence-v3.json) [231741 · query · 315-322行](../../../../sql-static-lineage-data/task-projections/tasks/231741/versions/3a189e95a52a24b2a5e7f35ad1378cfaf4212b036dde7cdf319ae83fff3d5a5e.evidence-v3.json) [231741 · query · 487-496行](../../../../sql-static-lineage-data/task-projections/tasks/231741/versions/3a189e95a52a24b2a5e7f35ad1378cfaf4212b036dde7cdf319ae83fff3d5a5e.evidence-v3.json)

## h1730、h22、h23 是三种选数方式

| 家族 | h22/h23 | h1730 | 目标与使用界限 |
|---|---|---|---|
| 合约及腿收益 | 218455/218461 读取 `d_v_ficc_trs_position_pb` 当天分区，并分别筛 `grp_id=h22/h23`；源 `data_time` 透传 | 223407 读取 `d_v_ficc_trs_position_p` 的 `busi_date='h1730'`，自行写当天分区和装载时间 | 三项均写 `dm_fii_n.v_ficc_trs_position`，不是三张永久独立日终表 |
| 对冲持仓 | 218511/218506 读取 `d_v_risk_hedging_position_tit_pb` 当天分区，筛 h22/h23 和 GFS_FICC | 223522 读取同一 PB 表，但 `busi_date>=昨天`、`grp_id=h1730`，保留源业务日 | 三项均写 `dm_fii_n.v_risk_hedging_position_tit`，需保留同表多任务写入边界 |

这六项的主要工作是传输既有收益与风险字段，并裁切源日期；没有重新计算合约或对冲盈亏。其小时名只表达所选批次，不证明任务实际在该时刻运行。源视图对已实现/未实现的算法需查源系统，不能从一串透传字段还原。[218455 · query · 42-86行](../../../../sql-static-lineage-data/task-projections/tasks/218455/versions/3ae7acf1beb413aad5737dca1008f87233041d0b0774df5d89dc702df843244f.evidence-v3.json) [218461 · query · 82-86行](../../../../sql-static-lineage-data/task-projections/tasks/218461/versions/f3f1fb0eeb5d4f180d78cd1c79c1dc5e6cba242530279291c667fe589d06a05d.evidence-v3.json) [223407 · query · 77-85行](../../../../sql-static-lineage-data/task-projections/tasks/223407/versions/1189963173ffbae3882338710083f06f2206f409a2385d2a15848fcd945eecb4.evidence-v3.json) [218506 · query · 214-221行](../../../../sql-static-lineage-data/task-projections/tasks/218506/versions/00d5b6668d6e4100cd84ff3ff282755553e2993d7bde5196b65994830180fe36.evidence-v3.json) [218511 · query · 214-221行](../../../../sql-static-lineage-data/task-projections/tasks/218511/versions/e33d727627270f27d7938d9a6a210547110bd101852111c44c5f98179faaac69.evidence-v3.json) [223522 · query · 214-221行](../../../../sql-static-lineage-data/task-projections/tasks/223522/versions/6ed48af52ffcc4538b69dcae3680dfbbaa9f3860759f18192f800870e3fcf209.evidence-v3.json)

三个合约收益导出 218608/218610/223571 的发布查询相同：读共享模型当天分区，把 `src_busi_date` 改为目标 `busi_date`。因此下游日期是收益数据原日期，模型分区是选数日期。三个对冲导出对空标的、空币种补值；h22/h23 读删当天，h1730 的 223574 读删从昨天开始的范围。任务目标只登记裸表名，仍保留 SCHEDULE_ONLY，不能从“h2tidb”名称补全精确物理库。[218608 · query · 1-41行](../../../../sql-static-lineage-data/task-projections/tasks/218608/versions/646bbac607cf0d96c0c5eda07222b6556c172ce61500b6a6fdfe38864309fcd3.evidence-v3.json) [218612 · query · 1-108行](../../../../sql-static-lineage-data/task-projections/tasks/218612/versions/fc304744260fa647ab199ade7bd814d6d7b8a98102c2a1759ab4d9e6c60858ce.evidence-v3.json) [223574 · query · 107-108行](../../../../sql-static-lineage-data/task-projections/tasks/223574/versions/64fdc7e72e05439b970cc38bc4de20cdedde5d66e275e5b00b115e9596847e4a.evidence-v3.json) [223574 · truncate · 1-1行](../../../../sql-static-lineage-data/task-projections/tasks/223574/versions/64fdc7e72e05439b970cc38bc4de20cdedde5d66e275e5b00b115e9596847e4a.evidence-v3.json)

这些日内传输与模型加工提供不同观察视角。没有实际批次、替换事务和运行实例证据时，不能判断共享表当前保留了哪个版本，也不能确认一个下游导出消费了哪个上游时刻。

返回[固收入口](../chapters/11-fixed-income.md)，相关模型见[风险与定价](../chapters/06-risk-and-pricing.md)、[财务与估值](../chapters/07-finance-and-valuation.md)。

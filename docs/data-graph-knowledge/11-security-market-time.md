# 证券、汇率与日历：少数字段怎样决定加工口径

**最后更新：2026-09-08。**

证券基础信息帮助确认“这是哪个产品、归到哪个标的”；汇率同时带来币种与报价日期的选择；日历决定哪些日期参加计算。这些表未必提供很多金额字段，却可能改变关联对象、折算结果和汇总权重。因此，学习它们要先认清键与日期，再看值如何参与公式。

本章核验九个任务，围绕公共规则展开。实例证明了具体用途，不能据此计算全域贡献比例；源表用途描述只作检索提示，结论以 SQL、字段绑定和 DDL 为依据。

## 一个证券有几种编号

`pdata_news_n.t02_scr_base_info` 接收 TITANS 产品基础信息。103230 保留源 `KEY_INSTRUMENT_ID`，补来源前缀，并生成另一套统一证券编码；这三者不是可互换的别名。

| 字段            | 当前 SQL 中的形成方式                        | 阅读和连接时注意什么                                     |
| --------------- | -------------------------------------------- | -------------------------------------------------------- |
| `in_code`       | 原样承接 `KEY_INSTRUMENT_ID`                 | 是源内部编码；查同一来源后再关联                         |
| `src_sys_prdno` | `concat('TIT-',in_code)`                     | 是带来源前缀的产品编号，不能直接与原始内码相等连接       |
| `secu_id`       | 组合证券类别、生成序号、证券代码或内码、市场 | 之后还可能被替换表中的编码覆盖；本章未证明跨系统永久唯一 |
| `scr_cd`        | 对源 `WIND_CODE` 做去空格及拆分处理          | 证券代码还需连同类别、市场理解，不能仅凭代码判断同一对象 |

```sql
-- 103230，slot=query，87、139 行（节选）
concat('TIT-',in_code) as src_sys_prdno
coalesce(b.secu_id,a.secu_id) as secu_id
```

第二个表达式中的 `b` 是 `t02_scr_cd_rplc_info`，按证券代码、类别、市场、来源四项连接。末尾去重也使用包含统一编码、来源产品编号、类别、代码、市场和中文名称的组合，不能理解为“每个内码只保留一行”。类别转换同样有损细分，例如多个期权类别都转为 `OPT`；需要源产品家族时，应继续保留原值。[证券基础证据 K1](#证据索引)

`t02_tit_scr_base_info` 补充 TITANS 特有属性。103234 的 `grp_id='01'` 读取产品表，承接基础表身份字段，并保存原始 `WIND_CODE`、`INS_FAMILY` 和 `SUMMARY_MAPPING → undrl_clas`。103236 的 `grp_id='02'` 读取编码表，保存 `SEC_CODE、CODE_VALUE、UPPER_CODE_VALUE` 对应的来源与编码值。两组都按 `b.in_code = a.KEY_INSTRUMENT_ID` 连接，但后一组是编码映射记录；不能把两组混合后假定每个产品只有一行。[K2、K3](#证据索引)

这些表主要按来源或来源分组覆盖分区，`busi_date` 是记录字段，不是这些表的日期分区。消费者读取当前身份信息来解释历史行情时，应另行确认是否需要历史版本，不能因有日期列就假设已经按日期匹配。

## 身份信息怎样进入实际行情结果

净值任务 207284 从 `D_MKT_RISK_DAILY_INFO` 取得单位净值、资产净值、收盘价等，按原始产品内码左连接证券基础表，补上 `secu_id、src_sys_prdno、scr_cd、crrc_cd`。`QUOTE_DATE` 形成净值日期，源采集分区日期则形成输出 `busi_date`，两者职责不同。

该任务最终 23 个输出表达式中，Facts 确认 16 个依赖行情源表、4 个依赖证券基础表，另 3 个没有物理字段输入。这里的 16 个包含记录编号、人员和时间字段，并非 16 个行情数值；4 个身份字段虽然少，却决定净值属于哪个产品、用什么币种解释。关联条件另算控制证据；无匹配仍可留下行情记录，但补充字段可能为空，多匹配可能增行。[K4](#证据索引)

在创收日报中，证券的 `undrl_clas` 还作为账簿标的映射缺失时的回退值，参与盈亏分组。它没有提供盈亏金额，却可能改变钱被汇到哪个标的，详见[持仓、估值与盈亏](08-positions-valuation-pnl.md)。

## 汇率必须带着币种和日期使用

105616 将 `D_REF_RMB_MIDRATE.MIDRATE` 原样写入 `t02_fxr_cfets_quot.mid_price`；`QUOTE_DATE` 转成 `trd_dt`，源 `CURRENCY` 留在 `src_crrc_cd`，经字典转换后写入 `crrc_cd`，另一币种列固定为 `156`。这一步没有倒数、乘百或除百操作。[K5](#证据索引)

字段注释中的“本币／外币”不足以单独证明所有货币对的报价方向和计价单位。现有消费者能说明它如何被使用：

| 消费任务          | 取哪条汇率                                           | 怎样作用于金额                                                                                            |
| ----------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 230202 创收日报   | `src_crrc_cd = Sett_Crrc_Cd`，报价日等于计提明细日   | 相关创收分支乘 `mid_price`；SQL 注释说明从结算币种转人民币，缺失时默认 1                                  |
| 176330 保证金明细 | `src_crrc_cd = Crrc_Cd`，报价日等于 `Strt_Pric_Date` | 部分 CALL／PUT 分支中，非人民币且合约币种等于结算币种时，原币名义本金乘中间价；币种不同时改用持仓初始汇率 |

```sql
-- 176330，slot=query，286 行
ON default.datekey2date(MID.trd_dt) = TRS.Strt_Pric_Date
AND MID.src_crrc_cd = TRS.Crrc_Cd
```

所以“某日处理的金额”未必使用某日汇率，可能固定在合约期初。上述用法支持这两个消费口径，仍需报价规范或样本核对一单位源币对应多少目标币，不能推广成所有汇率通用规则。[K7、K8](#证据索引)

h15 任务 144298 另有差异：读取 `_pb` 表及 `grp_id='h15'`，但输出来源标签仍为普通表名；币种映射缺失时有回退规则，而 105616 直接取字典值。解释缺失编码或来源差异时，应查看实际读源和表达式，不能只看标签。[K6](#证据索引)

## 交易日、自然日和快照日不能混用

`t02_scr_trd_cal` 的 DDL 同时定义 `cal_date`、市场和 `trd_flag`。149048 读取指定来源、分组和上交所日历，按月统计日期记录数，再用 `num / sum(num)` 加权月度指标，形成年度口径：

```sql
-- 149048，slot=query，22、26、29–33 行（节选）
count(zzr_date) num
-- zzr_date 来自 default.datekey2date(b.cal_date)
from pdata_news_n.t02_scr_trd_cal b
where src_id = 'TL' and grp_id = '01' and mkt_cd = 'SSE'
and cal_date between '${yyyy}0101' and '${yyyyMMdd}'
```

这里没有筛选 `trd_flag`，因此只能确认“按日历表收录的日期记录数加权”，不能称为按交易日数加权；是否等于自然日数，还取决于日历是否完整且每天唯一。Facts 把 `cal_date` 记录为计数及权重的物理来源，市场和日期范围则限制参加计算的记录。[K9](#证据索引)

230202 的另一分支使用 `pretradedate(下月首日,1)` 挑选月末利率，再用日期差及逐日展开铺到下一段日期，以计提日关联。可见“选交易日报价”与“向后铺开自然日”是两个步骤。当前未读取该函数实现，不能认定它与上述上交所日历使用同一市场规则。

后续优先确认身份连接的唯一性、汇率方向及报价单位、缺失汇率默认 1 的业务理由，以及日历完整性和日期函数的市场规则。本批图未覆盖日历生产任务，不等于日历没有来源；`PARTIAL` 或 `DERIVED_OUTPUT` 也不等于字段没有作用。静态证据说明加工方式，实际数据与业务验收仍需另行核对。

## 证据索引

固定图版本为 `df6f0ae4b6ef465f751351b14fd02ea08542d824d7bfea36e5a58dd1039e23c3`。九份 projection 的声明 `contentHash` 均与指定 batch manifest 一致，均为 `LEGACY_NOT_L1`。以下行号指 evidence 内 `sqlSources` 的 `slot=query` 文本行号，非 JSON 文件行号。

| 编号／任务 | 精确证据与本章核验范围                                                                                                                                                                                                                                             |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| K1／103230 | [证券基础生产](../../../sql-static-lineage-data/task-projections/tasks/103230/versions/596e2e2f3fc5be88024c6ab5d2187ae32b575c25b6f911ca0717e678548bcb6b.evidence-v3.json)：19–38、75–87、112–115、139、165–173、206–208 行，标识生成、替换及去重                   |
| K2／103234 | [产品属性分组](../../../sql-static-lineage-data/task-projections/tasks/103234/versions/cf51b5b8d869d4d157da96242f414f73840432148e1ed2be5eeb5575c72c3bba.evidence-v3.json)：17–35、52–53、65–67 行，身份继承、源属性及连接                                          |
| K3／103236 | [编码映射分组](../../../sql-static-lineage-data/task-projections/tasks/103236/versions/caf7458d4328ea965d5380809c1fc782ddcb5d2a3384bcc7ca37ae43a92be6d5.evidence-v3.json)：17–24、47–50、63–65 行，编码来源与内码                                                  |
| K4／207284 | [净值消费](../../../sql-static-lineage-data/task-projections/tasks/207284/versions/7eaf83d31c4455e99031efc5aff2013849087a813ce2da23cf9c915498c59a08.evidence-v3.json)：19–45 行；仅统计最终 `root.project` 的 23 个表达式，16／4 来源分组不包括 JOIN 控制          |
| K5／105616 | [普通汇率生产](../../../sql-static-lineage-data/task-projections/tasks/105616/versions/9a3d6a7904621ea9fb202b79dc7a338522dfdfb8bf12e533474d0da24bec827e.evidence-v3.json)：19–37 行，报价日、币种映射、中间价                                                      |
| K6／144298 | [h15 汇率生产](../../../sql-static-lineage-data/task-projections/tasks/144298/versions/ba293c6a42ece99065f1630676cbb40ded5be47f43da169936dd0c0f5397ae6d.evidence-v3.json)：21–37 行，币种回退及实际读源                                                            |
| K7／230202 | [创收与日期消费](../../../sql-static-lineage-data/task-projections/tasks/230202/versions/054fea93fea9ed6256ee5087deea9b8e94b43aef5625415a20840276b3a06ae3.evidence-v3.json)：95、146、208、242、250–271 行，汇率乘法、标的映射、月末报价与逐日展开                 |
| K8／176330 | [保证金消费](../../../sql-static-lineage-data/task-projections/tasks/176330/versions/c9763fb10152545e4c88b30b9c5ed278b75bafff150f988ad1cb1fa2255d7ead.evidence-v3.json)：219–228、268–286 行，币种分支、初始汇率与期初报价日                                       |
| K9／149048 | [日历权重消费](../../../sql-static-lineage-data/task-projections/tasks/149048/versions/f3b36228e9dfcf43e0f6344177b1f77bbee975472bd9f924682d236764043ee5.evidence-v3.json)：7–37、60–91 行，日期计数与月度权重；`expressions` 保留 `num、num1` 对 `cal_date` 的依赖 |

DDL：[证券基础](../../../sql-static-lineage-data/tables/hive/pdata_news_n.t02_scr_base_info__gfhive/ddl.sql)、[TITANS 证券属性](../../../sql-static-lineage-data/tables/hive/pdata_news_n.t02_tit_scr_base_info__gfhive/ddl.sql)、[人民币中间价](../../../sql-static-lineage-data/tables/hive/pdata_news_n.t02_fxr_cfets_quot__gfhive/ddl.sql)、[证券日历](../../../sql-static-lineage-data/tables/hive/pdata_news_n.t02_scr_trd_cal__gfhive/ddl.sql)、[净值行情](../../../sql-static-lineage-data/tables/hive/pdata_news_n.t02_prd_unit_nav_s_tit__gfhive/ddl.sql)。

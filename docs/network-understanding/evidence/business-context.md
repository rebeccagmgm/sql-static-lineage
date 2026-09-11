# 源系统与业务入口：证据索引

研究对应固定发布版本 `df6f0ae4b6ef465f751351b14fd02ea08542d824d7bfea36e5a58dd1039e23c3`。SQL 为该发布所指 evidence-v3 中的 `sqlSources`；下文“行”均从对应 SQL 槽位第一行计数，不是 JSON 文件行号。SQL 证明静态实现；不证明调度执行、数据到达、实际消费或业务验收。正文见[业务怎样进入这片数据网络](../chapters/01-sources-and-systems.md)。

表定义按 [table-catalog.json](table-catalog.json) 中精确物理身份记录的 `metadata.tablePath` 与 `metadata.ddlPath` 读取。匹配使用现有物理节点身份合同，对 platform、dataSource、qualifiedName 执行 trim+lowercase 后验证同一节点；没有用同名替代。正文不展示连接信息。

本轮查阅的四个源 TablePack 和对应 OData TablePack 采集于 2026-08-21，时间并非 SQL 发布时刻。源 DDL 中正式字段注释优先于标有“【AI】”的落地注释；落地字段类型和采集字段集合以实际 DDL/SQL 为准。DDL 约束只证明声明，不证明实际数据质量。

<a id="s1"></a>

## S1　TITANS 交易功能职责

- 正文来源：Wiki pageId `280644528`，《TITANS系统交易部分T1级保障方案》，本轮读取版本 41。
- 定位：[缓存正文](wiki-pages/280644528/page.md) 第 1–4 行背景、第 21–39 行最小关键功能集；[版本元数据](wiki-pages/280644528/metadata.json)。
- 已证：文档将部分 TITANS 功能界定为直接面向客户交易，列出境内期权、境内及跨境多空互换等下单、撤单能力。
- 边界：这是系统交易部分的职责及保障设计，未覆盖全部系统职责；未提供文档最后修改日期，不能称“已核实现行生产功能”。读取时间为 2026-09-08，缓存正文哈希 `8e9a55ca3de892aa05a3b9905424beb260a998af712cc6dd1a2866d244bc410a`。

<a id="s2"></a>

## S2　交易对象与 OData 采集

- 任务 `52806`：[发布证据](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/52806/versions/6e98d78af4c6808097d4e4f8a77b342fadcba0a72d6720d8294692e8c14f8a1c.evidence-v3.json)，`query` 第 1–12 行；`packPartition.busi_date` 为运行日期参数，最终写对象 `odata_n_tit.d_trd_otc_trade`。
- SQL 哈希 `a6072eb052fe4179a82610d25861d6d734723453deafefbe588881ff63ba8506`。
- TablePack 精确索引键：`titans_dm.trd_otc_trade`（Oracle）、`odata_n_tit.d_trd_otc_trade`（Hive），两者在 catalog 中分别有独立物理节点。
- 核读源 DDL：主键 `KEY_OTC_TRADE_ID`；注释区分内部交易流水、合约流水、账簿；数值编号与落地字符串类型不同。核读目标 DDL：`busi_date` 为分区。
- 已证：查询直接选择源交易字段，无 `WHERE`，用 `SYSDATE` 新增 `DATA_TIME`。未证明入库模式、源全历史保留或当次执行成功。

<a id="s3"></a>

## S3　账簿对象与配置有效期

- 任务 `78329`：[发布证据](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/78329/versions/71c7bf1f130669c0a8266d2cf483a55844f149c2057d4481520f84ff58afe8ed.evidence-v3.json)，`query` 第 1–27 行；目标 `odata_n_tit.d_ref_book`。
- SQL 哈希 `ed5eddd16a11c1e9bc2343c92dd0e2df6a54f51ef6392e270ec9296e028c7b7b`。
- TablePack 精确索引键：`titans_dm.ref_book`（Oracle）、`odata_n_tit.d_ref_book`（Hive）。
- 核读源 DDL：主键 `KEY_BOOK_ID, VALID_STARTDATE, VALID_ENDDATE`；公司、部门、柜台、归属主体字段；财务、风控、资金等开关注释。源 `ENABLE_CHECK_NEGATIVE_POSITION` 存在但不在该采集查询中。
- 边界：没有宣称账簿号单列唯一、有效期不重叠、开关必然被所有下游使用。

<a id="s4"></a>

## S4　交易对手对象

- 任务 `213687`：[发布证据](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/213687/versions/25cc8bcc06c5b16325e4f358f80d1ff72fd72f346909c3feff82f018ac4fc473.evidence-v3.json)，`query` 第 1–18 行，`create` 第 1–20 行；目标 `odata_n_tit.d_ref_counterparty`。
- SQL query 哈希 `42f2e8e27755b96b14bdf9097a79f69411930b771db6a8cce6056648e1e9d266`。
- TablePack 精确索引键：`titans_dm.ref_counterparty`（Oracle）、`odata_n_tit.d_ref_counterparty`（Hive）。
- 核读源 DDL：主键 `ID`；`CTPTY_TYPE` 注释为产品、机构、个人；保留主体、注册码、内部标识和账户组标识。源字段 `IS_DELETED` 的注释为“是否启用标识”，本章未推定其码值方向。
- 边界：不得将该 ID 自动等同其他系统客户号。任务内建表片段将 ID 声明为 double，而当前 TablePack 为 string；未据此断言实际落库字段类型曾经怎样迁移。

<a id="s5"></a>

## S5　保证金流水与三种日期

- 任务 `78594`：[发布证据](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/78594/versions/42e1373ad81521e48a93ecf8590f1c7c2ec9790c75db902f663f342605c81cf6.evidence-v3.json)，`query` 第 1–19 行。
- SQL 哈希 `99f7766479932b072f708fe7f9dbcceb3d7dd576e1430a643890e50588efbab6`。
- TablePack 精确索引键：`titans_dm.margin_account_ledger`（Oracle）、`odata_n_tit.d_margin_account_ledger`（Hive）。
- 核读源 DDL：主键 `KEY_MRG_LEDGER_ID`；台账日期、台账发生时间、发生金额、操作前后保证金余额、生效业务日有独立字段和注释。
- 已证：第 4 行将源 `BUSI_DATE` 改名 `SRC_BUSI_DATE`；第 17 行 `SYSDATE` 生成采集时间；第 18 行保留 `ACTUAL_BUSI_DATE`。`packPartition` 独立提供目标分区日期。查询无 `WHERE`。

<a id="s6"></a>

## S6　保证金事件模型如何形成

- 任务 `173965`：[发布证据](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/173965/versions/72f151a922e782aedceb8624ddfe0ef164489e69656dc3c8b23b050a8daa7eda.evidence-v3.json)，`query` 68 行；SQL 哈希 `d22f68617e0a6bde87696208f2b7329333f10d76bfc6460d0f18d594d1dcd9f2`。
- 第 1–26 行：当前发生日期及源/模型各日期记录数不等的日期进入重算集合。
- 第 27–54 行：写保证金变动事件；编号加来源前缀；发生日、生效日分别保留；`NVL` 转码回退；源台账日期作业务分区。
- 第 55–58 行：源采集分区过滤、待重算日期匹配、账户号关联；账户表未显式限制分区。
- 第 59–67 行：按目标表/字段、源表/字段和来源系统选择代码映射。
- 边界：固定证据内包含 2026-05-19 日期和 2026-05-20 生成时间，不能称为当前日 SQL。历史条数不变但值变更，不会仅因条数差异进入重算集合；这是条件逻辑推断，未核实实际漏更新。未核验账户/映射表连接键唯一性。

<a id="s7"></a>

## S7　ATP 成交流水经范围筛选后交给 TITANS

- 筛选任务 `177682`：[发布证据](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/177682/versions/daf1575b297605d5c582baf259c3d9d73c3281d184b176de5efcf19dfa11e8b4.evidence-v3.json)。`query` 第 66 行注释说明 ATP 场内证券成交流水，第 132–156 行按前一日规则号组合客户与资金账户，再与当日事件连接；输入限定来源表 `ODATA_N_SSO.T_T_REPORT`。
- 推送任务 `180065`：[发布证据](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/180065/versions/f782a3383de2863c639012cfcb8df23a230a88c73e6775b974ee511e011feab1.evidence-v3.json)。`query` 第 1–67 行为目标字段，第 137–203 行为读取与字段映射；`truncate` 第 1 行按交易日期清理目标。
- TablePack `pdata_nds.t05_sso_exch_scr_mtch_evt` 注释为“华锐ATP场内证券成交事件”，与 SQL 用途一致。
- 已证：这是面向 TITANS 的业务范围筛选与交付，不是全量柜台成交的无条件转送。未证明规则表连接唯一、运行成功、目标应用已消费。

<a id="s8"></a>

## S8　ETF 与代收代付的接收对象

- 任务 `246247`：[发布证据](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/246247/versions/ce0f56a3043f64d0408014eeeeb63e1c10b643ac4581eaef06da08e8ce1b18c0.evidence-v3.json)。`query` 第 1–21 行，按业务日期读取成分股成交信息，目标 `titans_tradeflow.trans_t_report_etf_component`；`truncate` 按交易日期清理。
- TablePack `dm_otc_n.trans_t_report_etf_component`：`qty` 注释为“成交数量或资金比例因子”，`amt` 为“现金替代金额，成交金额”，另有回报类型。正文因此不把所有行都解释为普通股票成交。
- 任务 `238141`：[发布证据](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/238141/versions/e1435d673ffcf80224e394becbecb79ddbc562cba0dc1d13ac2edbb5630a33eb.evidence-v3.json)。`query` 第 1–45 行，源 `dm_otc_n.trans_realdsfmxinfo` 限定 `src_id='RCC'`；`truncate` 第 1 行全表清理接收对象。
- TablePack `titans_etl.trans_realdsfmxinfo`（GoldenDB）注释为“实时代收代付明细表”，字段包括清算业务类别、中登发送日期、交收状态和配对状态。
- 边界：上述输入的全部上游生产过程不在本章凭名称展开；任务边和接收表都不能证明应用端已经获得数据。

<a id="s9"></a>

## S9　其他主体资料如何补入交易解释

- 任务 `86840`：[发布证据](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/86840/versions/98e14680334a17fef9cf23bcf7f2845dfd68541494598961fb3b0f6b26be0d56.evidence-v3.json)。`query` 第 15–20 行取外部交易对手编号、简称、公司名等；第 339–348 行连接境内/香港交易对手资料。
- 境内来源 `odata_n_ois.o_otc_derivative_counterparty`：当日、`delete_flag='0'`、`department!='HK'`；香港来源 `odata_n_ois.g_hk_counterparty`：当日、`delete_flag='0'`；两分支 UNION ALL 后以 `rcm.outside_ctpty_code=cp.client_id` 连接。
- TablePack 分别注释为“衍生品交易对手维护表”“香港交易对手”；字段包括主体名称、注册码、组织机构代码等。
- 边界：这是主体补充的具体 SQL 分支证据，不是 OIS 全系统职责说明；未核验连接唯一性和两个分支是否绝无重复。

<a id="s10"></a>

## S10　ETF 数据的多源职责与快照保存方式

- 正文来源：Wiki pageId `308694858`，《ETF 基础信息数据同步概要设计》，本轮读取版本 34。
- 定位：[缓存正文](wiki-pages/308694858/page.md) 第 1–5 行交易所静态文件来源，第 45–73 行 TITANS ETL 方案；[版本元数据](wiki-pages/308694858/metadata.json)。
- 已证：文档区分交易所文件、柜台、DSP 和 TITANS ETL；第 64–65 行区分 ETL 最新成功批次与平台按业务日期覆盖的历史快照，并注明历史查询起点 2026-07-22。
- 边界：文档正文使用“当前大数据推数方案”，本产品将其表述为“该文档记载的方案”；文档最后修改日期未返回。阅读时间 2026-09-08，正文哈希 `62d22c09eb5d82d47ca94fa8729c2540e88a70c8ad642dccdc1e9ff96782d0bf`。S8 的代收代付目标清理方式与方案方向相符，未因此认定其他未核读推送完全相同。

<a id="s11"></a>

## S11　ODATA_N_TIT 全部 650 任务的审阅底账

范围由当前固定发布的 `task-catalog.tasks.filter(t => t.topicName === 'ODATA_N_TIT')` 确定，精确任务号集合保存在 [source-review.json](source-review.json) 的 `scopeTaskIds`，逐项证据在 `tasks`。没有把主题外新增发现自动并入这 650 项。

- 650 项均有 query；101 项另有 create，共 751 个已读槽位。
- 每个槽位用原 UTF-8 内容重算 SHA-256，与发布 `sqlSources.sha256` 相符。650 项 query 共 24,304 行，419 种不同字节哈希。
- 645 项有发布物理图，5 项为 `SCHEDULE_ONLY/TASK_NOT_INDEXED`。5 项不是 SQL 缺失：`34901`、`63680`、`119130`、`129078`、`217186` 的 query 已逐条读取，缺口是发布 statements/datasetIo/物理绑定为空。
- 逐项保留 `reviewedSql` 的 slot、行段、哈希、`evidencePath`、源对象身份、发布目标、`packPartition`、转运模式、原样控制条件、生成表达式和输出字段名。没有以同一源表名取代 query 字节差异。
- 审阅使用严格分层：`LOCATED` 5 项（已读 SQL，物理接续未证）；`TRANSFER_PATTERN_VERIFIED` 593 项（采集/保存规则已核对，业务字段字典尚不完整）；`BUSINESS_SEMANTICS_EXPLAINED` 52 项（指定源对象粒度、键及重要日期字段已有正文和源 DDL 支持，并非全字段或运行验收）。家族归类本身不提升审阅等级。
- 家族主归属互斥且合计 650；允许单个任务另记辅助家族。归属依据是发布 SQL 的源对象、元数据和实际字段，不使用任务名称作为“已解释”证据。

哈希分组后仍分别审阅的内容包括全部 WHERE/日期条件、空字符串及日期生成列、`rawtohex`、CASE、UNION ALL、ROW_NUMBER、批次与日期分区、建表槽位及重复 INSERT。101 个 create 槽位均为建表定义，分为无分区、业务日期分区、批次与业务日期双分区；临时表创建不误当成最终业务交付。未运行 SQL。

## 五项未建立物理绑定的逐项证据

| 任务   | query 行段 | 已读 SQL 来源                                                                           | 具体缺口                                                            |
| ------ | ---------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 34901  | 1–42       | `titans_otcclearing.pos_otc_position_daily`；第42行业务日或更新日命中                   | `packTarget` 为名称字符串，`packPartition=null`；发布无语句事实和IO |
| 63680  | 1–42       | 与34901同 query 哈希 `880d8cfa7256f8feb3943b6f505f2ffe382b2e3902072efe8f0aba58d166f2ff` | 同上；不能据同SQL认定同一物理执行                                   |
| 119130 | 1–17       | `TITANS_DM.RISK_LIMIT_INDEX_INFO`，无行过滤                                             | 目标及日期分区配置可见，发布语句事实和IO缺失                        |
| 129078 | 1–21       | `TITANS_DM.RISK_QUICK_CHECK_LOG`，无行过滤                                              | 同上；检查状态等业务码未补全                                        |
| 217186 | 1–21       | `TITANS_DM.REF_STRATEGY_INDEX`，源业务日期另名保留                                      | 同上；策略及数量字段的完整字典未补证                                |

全部对应的精确 evidencePath/sha256 在 `source-review.json.tasks` 中按任务号可直接定位。本轮没有以名称匹配表包补造这五条物理边。

<a id="s12"></a>

## S12　八个家族的业务对象与粒度证据

以下表格列出正文新增解释实际核读的源 DDL。确切 TablePack 路径由 `source-review.json.tasks[].sourceObjects` 保存，并能回查同一物理节点的 table-catalog；各列约束和注释来自源 DDL，不靠落地表名猜测。表里任务仅为指向同源对象的代表，同一对象其他变体的采集条件仍按各自 SQL 独立记录。

| 家族/代表任务          | 源对象及已核读要点                                                                                                         | 正文结论边界                                                                           |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 交易 `78469`           | `titans_dm.trd_trs_event`；主键 KEY_TRS_EVENT_ID；事件日期、录入时间、实际成交时间、调整前/变动/调整后名义本金各有注释     | 事件与交易是不同对象；未枚举所有事件类型状态码                                         |
| 结构 `78464`           | `titans_dm.ref_otc_option_deal`；主键 KEY_OTC_TRADE_ID；对外合同号、交易对手、交易达成日、期权费支付日、兑付日、名义本金等 | 合同层要素，未以此直接计算收益                                                         |
| 结构 `78463`           | `titans_dm.ref_option_deal_structure`；主键 KEY_OTC_TRADE_ID；合约类型、方向、定价日、观察安排、挂钩标的                   | 结构层的字段责任，未证明所有明细关系一对一                                             |
| 结构 `78466`           | `titans_dm.ref_trs_leg`；主键 KEY_LEG_ID；KEY_OTC_TRADE_ID、LEG_SEQ_ID、腿类型、方向、利率和计息参数                       | 源注释明确腿序号在交易中唯一；源 CURRENCY 注释存在用词异常，本章不据该注释定义币种字段 |
| 持仓指标 `78590`       | `titans_dm.pos_eod_calc_metrics`；主键 POSITION_ID+QUOTE_DATE；QUOTE_DATE 注释为计算日期                                   | 持仓与日期共同决定指标记录粒度；估值公式不在本次采集查询中                             |
| 外汇敞口 `215871`      | `titans_dm.pos_eod_fx_exposure`；主键 POSITION_ID+CCY_SEQ+QUOTE_DATE；敞口币种、金额、数量、汇率分别保存                   | 同一持仓不同货币序号不是重复记录                                                       |
| 资金 `78575`、`78583`  | 源每日余额查询分别保留账户、源业务日期和余额；资金每日余额另有可用、冻结、应收、总额                                       | 仅按实际查询解释列，不臆定所有余额之间的会计等式                                       |
| 主体 `78329`、`213687` | 账簿及交易对手源 DDL 见S3、S4                                                                                              | 源对象关键粒度已证，跨系统客户映射仍须具体Join                                         |
| 权限 `34880`、`34899`  | `titans_admin.adm_role` 主键 KEY_ROLE_ID；`adm_user_role` 主键 KEY_USER_ID+KEY_ROLE_ID                                     | 角色和用户角色关系的数量含义不同                                                       |
| 流程 `126922`          | `titans_workflow.plc_process_def` 主键 DEF_ID；流程标识、业务模块、流程名称、可执行状态有注释                              | 定义与运行实例区分；本章未定义状态值码义                                               |
| 流程 `126921`          | `titans_workflow.act_hi_procinst` 主键 ID_；实际query保留实例/定义/业务键及起止时间、STATE_                                | DDL没有字段注释，名称只用于有限解释；该任务仍保持传输已核实等级                        |
| 行情 `101077`          | `titans_dm.ref_wind_yield_curve` 主键 KEY_WIND_CURVE_ID+QUOTE_DATE+TENOR；行情日期、期限和各收益率有注释                   | 不同期限点不是重复数据；不定义收益率的外部计算方法                                     |
| 参数选择 `101080`      | `titans_dm.cfg_pricing_env_vol_surf` 主键 KEY_PRICING_ENV_ID+KEY_INSTRUMENT_ID+CALL_OR_PUT；关联KEY_VOL_SURFACE_ID         | 配置决定所选曲面；不证明运行中已使用该配置                                             |
| 相关性 `114497`        | `titans_dm.ref_correlation_daily_info` 主键 KEY_CORRELATION_ID+AS_OF；两标的ID、日期、相关性值有注释                       | 日期是相关性记录的一部分，不能只按一对标的唯一化                                       |
| 报备 `78468`           | `titans_dm.trd_otc_contr_report` 主键 KEY_OTC_TRADE_ID；报备状态、日期、截止日、附件状态各有注释                           | 记录报备状态不等于已取得外部接收回执                                                   |
| 文书 `179125`          | `titans_operation.ope_settle_notice` 主键 ID；文书与合约、结算日期、账户、主体分别有字段                                   | 文书对象不能作为账户余额或单笔交易的替代                                               |

家族其他表按完整 SQL 的对象和字段识别其材料类别，并在 `source-review` 中保留未建立完整字典的边界；没有把每个对象都提升为语义已解释。源元数据的 `DELETED` 登记状态也逐项保留，不能据此宣称实时数据库一定没有该对象。

<a id="s13"></a>

## S13　650项传输与保存规则的完整差异分类

每组精确适用任务在 `source-review.json.transferPatternSummary.taskIds`，每项 query 的原始条件及生成表达式保存在 `controlEvidence` 与 `projectExpressionEvidence`，对应槽位哈希与行号可回到发布证据。以下补充需要读者判断的差异，不以重复任务数量计算新的业务种类。

| 模式与任务数量        | 已核实的变体/例外                                                                                                                           | 证据定位                                                                                                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 无行过滤字段选择 538  | 多为显式源字段及采集时间；部分增加目标日期、空字符串占位；TRS视图 ID 有 `rawtohex`                                                          | 每项 query 全文及生成表达式；`40224/66118` 的第2行；`70642/71663` 第6–11行、`70654/71743` 第5–6行余额占位；`78466/78474/136196/136197/144139/198803` 第24行腿类型占位 |
| 事件日或更新日 5      | `34883/63759` 用日期字符格式化，`245314` 使用两个半开日期区间；`34901/63680` 用源业务日或更新时间                                           | `34883` 第33行；`63759` 第42行；`245314` 第42–43行；`34901/63680` 第42行                                                                                              |
| 业务日期窗口 16       | 单日QUOTE_DATE/AS_OF/BUSI_DATE；部分年初至目标日；部分仅日期下界；对冲持仓有单日与两日两版本；Greeks采集有上下界                            | 精确原条件由每项controlEvidence保留；`92677` 第18–19行；`198638` 第9行；`198713` 第117行；`198723` 第116行；`218632/218635/223024` 第111行；`244037` 第92行           |
| 创建或更新时间窗口 11 | 行情覆盖目标日零时至参数次日15时（闭上界）；结果采集按参数次日到再下一日创建窗口；日内持仓/事件若干用SUBSTR匹配参数日期；另有更新日半开区间 | `143402/143403/144736/207700` 第36行；`147153` 第11–12行；`183249` 第34–35行；`233001` 第54行；`233002` 第136行；`237106` 第117行；`237111` 第94行；`243272` 第9行    |
| 风险盈亏跨期补齐 11   | 在续当日与终止年内UNION；不同日期的日盈亏字段置零；最后估值筛选存在NVL估值终止日/实际结算日与仅实际结算日两种；权衍分支没有相同置零表达式   | `50169/71643` 第8–10、23–49行；`52578/71630/172106/172108/244045` 第53–145行；`171353/171354/244368` 第53–144行；`72224` 第18–44行                                    |
| 多来源合并 6          | 保证金参数/账户、互换监控合并TITANS与OIS并写来源标签；期权参数合并TRS参数视图和零售期权参数，后者大量空字符串补齐                           | `41540` 第22–50行；`41825` 第10–34行；`41828/71734` query；`41831/71703` 两个UNION分支                                                                                |
| 批次保存 54           | 读取指定批次写grp_id+日期；多数使用配置日期，4项使用create_time或src_busi_date截取，1项调用日期转换函数；有多条重复INSERT需按出现顺序保留   | `144141/146688` 第1–17行；`146686` 第1–32行；`147156` 第12行；`198710/198717/198727` 输出分区日期表达式；`223027` 第5行；所有其他精确批次见账本                       |
| 行情最新合并 4        | 日内分区与已有行情UNION ALL，按证券内码+行情日期，以data_time倒序取第一条；批次分别h15、h10、h08                                            | `143404` 第49–128行；`143405/144739/207701` 第41–120行                                                                                                                |
| 合约最新合并 5        | 对合约引用+账簿按源日期降序；普通4项先临时表后回写；`244357` 先合并日内与PB旧结果且含两套日期写序列                                         | `200585/201066/212496/212497` 第109–171行；`244357` 第109–285和396–572行                                                                                              |

批次保存组中按源日期保存的三项是 `198710`、`198717`、`198727`，按创建日期保存的是 `147156`，对源日期去分隔符并调用转换函数的是 `223027`。这与其他任务按已展开目标日期保存不同。批次常量来自发布 SQL，不推定其调度真实执行时刻。

所有窗口中的 `d/e` 参数均保留原文。本章未独立核验平台宏对交易日历、节假日和边界的具体展开算法；已展开日期只描述对应静态快照。按同一源表归组时，字段清单、输入槽位、日期常量及重复写入仍由各自SQL哈希区分。

本轮发现的实际表达式范围包括：采集时间函数、日期常量、源日期改名、空字符串、RAWTOHEX、CASE日盈亏置零、SUBSTR日期截取、ROW_NUMBER、日期格式转换及UNION来源标识。复杂表达式已与发布 expression facts 交叉核对；“无WHERE”不表述为“完全没有加工”。

## 仍需整个产品继续覆盖的边界

本章已对 ODATA_N_TIT 的650项完成源落地方式审阅，并将它们逐项安置到八个业务对象家族；语义已解释的52项与仅传输已核实的593项仍严格区分。完整产品还需把主题外源材料及经营、财务、风险、机构、人员和资讯等各分支的使用过程落实到对应章节；本章不靠schema名称扩写所有系统职责，也不代替这些分支的深加工解释。

正文已证与未证分开：本次确认输入字段、DDL 声明、查询条件、对象关系表达和接收方式；没有执行数据查询，也没有把静态解析状态当作生产验收。Wiki 检索候选未作为业务事实引用；没有将名词索引页面当成术语正文。

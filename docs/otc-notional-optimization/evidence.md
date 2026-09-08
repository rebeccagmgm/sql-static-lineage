# 证据来源、范围与复核

本轮基于本地现有生产材料快照进行静态分析。未查询业务数据、未执行调度、未新建或更新 Facts／业务图投影。

## 固定版本与覆盖

发布版本：`df6f0ae4b6ef465f751351b14fd02ea08542d824d7bfea36e5a58dd1039e23c3`。

manifest：相邻数据目录的 `artifacts/graphs/titans-otc/batches/945d7d1e13928a269480cf6786450e5916e5255806b36dd16dcba3a1b19726d9/batch-manifest.json`。绝对路径、文件 SHA256 和采集时刻见 [source-index.json](evidence/source-index.json) 的 `/publication`。

该批共 3,615 个任务：2,385 个 PROJECTED，1,084 个 SCHEDULE_ONLY，146 个 COLLECTION_FAILED。仅用全批投影的 `localClosure.externalReads/finalWrites` 发现选定表的直接读消费者；没有全域扫描字段、判断所有任务业务逻辑或生成全量优化排行。

| 选择组 | 主分析任务 | 选取理由 |
| --- | --- | --- |
| 产品与公共事实 | 86840、86841、86842、220650、107491 | 比较同字段不同算法、当日与历史规模，以及粒度变化 |
| 归属与月日均 | 159763、224351 | 比较共同输入、不同归属和汇总结果，判断事实／指标边界 |
| 销售日报与参数 | 118141、220979、220981 | 比较真实重复分类、重复窗口及参数时间差异 |
| 月度与客户结果 | 199727、199706、229121 | 判断已存指标、派生分母和主题宽表复用 |
| 风险别名反例 | 200030 | 验证同值列不等于重复计算，不按字段名误并 |

补充 6 个下游只核消费位置与用途：100170、230266、148368、160773、160780、165154。主分析共 14 任务，含补充共 20 任务，保存 45 段 SQL 原文（query／create／prepare／truncate 按材料存在情况保留）。

未扩展到其他本金族成员、所有风险报表或完整外部应用。没有重复做旧试验的 104 成员全量比较；旧研究仅作为候选导航，结论以本轮绑定材料为准。

## 从结论回查原文

| 文件 | 内容与定位方式 |
| --- | --- |
| [source-index.json](evidence/source-index.json) | 按 `/tasks` 中 `taskId` 定位固定 projection/evidence 路径、SQL 内容哈希、Facts 来源及校验状态；`/scope` 区分主分析和补充对象 |
| [sql/](evidence/sql) | `<taskId>-<slot>.sql` 是 evidence `sqlSources[].content` 原文，不添加行号前缀；正文的 L 均从该文件第一行计 |
| [facts-excerpts.json](evidence/facts-excerpts.json) | 从 14 个主任务已有 output-field-bindings 与 unknowns 选取记录；保留来源路径、解压后内容哈希、原始 binding_id 和状态 |
| [table-metadata.json](evidence/table-metadata.json) | 15 个输出表元数据与 DDL 快照，保留采集日期、分区和文件哈希；元数据采集时间未必与 SQL 同步 |
| [direct-consumers.json](evidence/direct-consumers.json) | 11 个主分析输出表的已发布直接读任务、读次和这些任务的最终写表；这是影响发现索引，不是运行使用统计 |

Facts 的 SQL 快照可能经过语句槽组织，与 raw query 内容不同；因此分别记录 input-pack raw SQL hash 与 analysis SQL hash，不混作一个验证。`PACK_DECLARED_QUERY_OUTPUT` 是配置声明目标的输出绑定，不描述 SQL 显式 INSERT，更不证明执行成功。

## 已执行的材料一致性核验

- 20 个任务的投影声明 contentHash 与 manifest 一致；另外记录投影与 evidence 的字节 SHA256。未把“声明一致”冒充重新计算完整语义投影哈希。
- 45 段 SQL 逐段重算 SHA256，与固定 evidence 的声明一致；本轮另存的 SQL 原文保持相同内容。
- 14 个主分析任务当前 Facts manifest 的文件哈希都匹配发布投影绑定；14 份 raw query 也匹配 input-pack 和固定 evidence query。
- 含补充任务共 19/20 个当前 Facts manifest 匹配发布绑定。**100170 的当前 registry manifest 已不同，因此不把该 registry 的 Facts 拼入本次发布证据。**它的消费结论只依据固定发布 SQL；该 SQL 与现有 raw query 内容仍一致。
- 28 份主任务 Facts 摘录源文件的解压后内容哈希匹配 manifest；15 份 DDL 文件匹配各表元数据记录的哈希。

上述一致性只证明材料定位与引用可信，不证明业务数据、币种、唯一键或实际运行正确。最终交付时的文件、链接和来源稳定性检查见 [validation.json](evidence/validation.json)。

## 实际消费证据与边界

基础表有 47 个批内直接读任务，日事实有 21 个；它们是两个不同的影响范围，存在交集，不能相加当成唯一任务数。159763 的指标有 4 个读任务；224351、229121 各有 1 个。其余选定输出当前没有可见读任务，不据此判闲置。

| 消费者 | 本轮实际读到的行为 | SQL 位置 |
| --- | --- | --- |
| 100170 | 从归属后日规模取当前计算快照，`accrued_date → busi_date`，金额转 decimal | [L9–13](evidence/sql/100170-query.sql) |
| 230266 | 读取客户指标表当前快照，输出换手率／新增／上月末存续 | [L22–29](evidence/sql/230266-query.sql) |
| 148368 | 读取交叉销售月日均，按客户、机构、标签、月份汇总 | [L241–244](evidence/sql/148368-query.sql) |
| 160773 | 读取交叉销售月日均，保留客户、机构、员工和标签 | [L60–63](evidence/sql/160773-query.sql) |
| 160780 | 读取交叉销售月日均，并按两个标签分别乘 0.8／0.26 | [L61–65](evidence/sql/160780-query.sql) |
| 165154 | 读取交叉销售月日均，汇总到客户、员工、标签和月份 | [L311–320](evidence/sql/165154-query.sql) |

图 CLI 的 `status` 返回 `NEO4J_UNAVAILABLE`；本轮消费固定发布 manifest 的不可变文件，未启动服务或发布新版本。这足以支持 SQL 和静态消费比较，但没有完成线上 Neo4j 查询验证。

14 个主任务均为 `LEGACY_NOT_L1`。原始 Facts 留有未知项，尤其窗口和派生绑定边界已保留在摘录。图用于筛选路径，Facts 用于定位输出和边界，SQL 与 DDL 用于比较公式及语义；没有把这些投影当成多份独立业务证据重复计票，也没有宣称图自动证明等价。

所有优化建议都区分静态事实、分析推断和实施前问题。没有量化资源节省、宣称金额已经出错、推断外部报表无人使用，或批准整表替代。建议的验收对象是可决策分析稿；业务口径确认、数据对账和实施属于后续工作。

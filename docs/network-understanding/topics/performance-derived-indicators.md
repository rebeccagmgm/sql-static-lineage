# 标准资产汇总、比较基期与派生指标

同名的“标准资产增长率”并没有统一公式：有的比较当前月与上月，有的比较当前年日均与固定基期，有的比较本季累计日均与上季完整日均；输出还可能分别是小数、百分数或带百分号的字符串。本页把 30 项已逐项核读全部 SQL 槽位的派生加工放在一起，供核对具体指标时选择正确链条。源证据固定于[主篇](../chapters/09-performance-and-assets.md)声明的发布版本，实际阅读和来源路径逐项记录在 [performance-review.json](../evidence/performance-review.json)。

“并存”只表示固定图里同时有这些代码与消费者关系，不等于两套制度同时有效。哪一条已被业务批准或在应用中实际使用，不能由创建时间、任务名称或 `status='1'` 推定。折标、客户—机构—员工关系的底层计算见[主篇的折标与归属](../chapters/09-performance-and-assets.md#p09-conversion)。

<a id="derived-aggregation"></a>

## 员工与机构汇总：收起维度时仍会改变金额

**员工月日均 148806、149243** 分别消费客户—机构折前、折后月日均标准资产，先按客户、标签、月合并机构，再沿资产包关系归到员工。取前六个月月末及计算日的员工快照、同日资产包关系，员工要求删除标志 0；资产包要求类型 01、有效标志 1。这样历史月份使用对应月末关系，而不是所有月份统一套计算日关系；但员工与关系都未做 `distinct`，不在这里重新分摊权重。输出为员工 × 标签 × 月，缺少匹配指标可形成金额 0、标签为空的组合，最终 STAFF 定义并无状态过滤。两个 query 返回当月加此前六个月，即最多七个月；prepare 明确删除的却只有当月分区，历史分区的覆盖行为需要写入器或运行证据。〔两项 query 1—39、prepare 1—2〕[^148806][^149243]

**员工年日均 149236、149951** 不是简单把月均相加。普通资产按 `月均 × 本月已过日历行数 / 年初至今总日历行数` 求和，使用 TL/SSE 日历，但没有交易日标志筛选；缺少某月资产不会重分配该月在分母中的权重。它们排除总标签以及三个专门品类，然后分别从 OTC 年日均跨销售规模与托管产品年均指标补回。折前直接取值；折后对标签 074443705 乘 1.02，074443704 乘 0.27，托管 074443736 乘 0.07。OTC 分支若出现其他标签，折后 CASE 没有 ELSE，不能假设也有金额；输出也没有再次生成一个总标签。这组系数与主篇解释的 160780 客户—机构—员工链不同，是必须随 taskId 保留的差异。〔149236 query 1—64；149951 query 1—61〕[^149236][^149951]

**机构折前 148906、149087** 把客户维度汇总掉，并另按最近交易日机构树把营业部等下级归到分公司。月版读取当年范围内当前月及过去六个月；年版读取计算日年日均，并在每月 1—2 日同时读上月末的年日均。下级原始机构与上卷分公司通过 `UNION ALL` 并存，不能把不同组织层级相加为公司总资产。历史月份也使用最新这份机构树，机构调整可改变回刷的分公司归属。〔148906 query 1—55；149087 query 1—51〕[^148906][^149087]

**机构折后 148911、149092** 还增加金额规则：排除源总标签，先按机构与品类汇总，对骐骥聚盈标签 074451861 截至 3 亿元，再由截断后的各品类重建总标签；分公司上卷后，同一品类再次截到 3 亿元并重建分公司总标签。月版与年版沿用上一段各自的时间窗口。若两个营业部各有该品类 2 亿元，营业部各保留 2 亿元，而分公司显示 3 亿元，所以此处不满足父值等于子值之和；这是具体 SQL 规则，不宜当成对账差异直接修平。〔148911 query 1—120；149092 query 1—119〕[^148911][^149092]

<a id="derived-period"></a>

## 月、季、年比较必须保留完整关系键与基期

**客户—机构—员工月增长率 161841、161844** 分别对折前、折后三元关系按 `(本月金额−上月金额)/上月金额` 计算。上月行把月份向后平移一月，再与本月行合并，完整分组键保留客户、机构、员工、标签、输出月。因此客户换员工或换机构时，不会先把旧、新关系归到同一客户再比较，而可能出现旧关系减少与新关系缺基期。两边源月份都限制不早于当年 1 月，1 月不会读上年 12 月基期。没有零分母保护，也没有乘 100；最终客户、机构必须命中有效组合，员工只是左接，未知员工不会因这一 JOIN 被删掉。〔两项 query 1—21〕[^161841][^161844]

**三元关系年增长率 161845、161848** 比较计算日年日均与 `temp.*_year_apd_aim_2026` 固定表中上年 12 月 31 日的基期，基期不是运行时从普通年日均表自动取出的数字。两项都在月初 1—2 日追加上月末比较结果；注释说“3 号固化”，实际代码是 2 日及之前可计算上月。输出为月份分区的小数比率，同样无零分母保护。固定基期表为什么调整、何时批准、是否每年换表，当前证据未给出，2026 后不能假定会自动迁移。〔两项 query 1—42、prepare 1—2〕[^161845][^161848]

**员工固化月额与季均 162117、162136** 是另一条链。162117 只按员工汇总当月客户—机构—员工折前金额；“月末固化”写在注释中，query 没有“仅月末运行”的限制。162136 再取本季首月至当前月的固化月额，按当季日历行数加权成季均，仍无交易日过滤。两项都仅保留有效 STAFF；前者明确删当月分区，后者删当前季度分区。〔162117 query 1—5；162136 query 1—36；两项 prepare 1—2〕[^162117][^162136]

**162120、162564** 分别对上述固化月额、季均作环比，结果先乘 100 再拼接 `%`，是展示字符串。季版在第一季度明确比较上年第四季度，其余比较本年上一季度；月版可读上年 12 月，没有 161841 的当年截断。两项无零分母保护，并通过 tag_def 的指定标签维度白名单控制输出。小数 0.2、数字 20、字符串 `20%` 三者不能未经换算放在同一列排序或加权。〔162120 query 1—22；162564 query 1—21〕[^162120][^162564]

**170941** 又不同：对员工资产包折前月日均直接求当前月与上月总额，再求增长率；基期缺失或为零时结果 0。它从最近交易日未删除员工出发保留无资产人员，且对月均源没有限制标签，所有标签都加入求和。如果源既有总标签又有其子标签，就存在重复计入的条件。这个指标不能简单替换为逐三元关系增长率的平均。〔query 1—25〕[^170941]

<a id="derived-customer-growth"></a>

## 客户增长：季均基期与“同比”的具体日期

**234350** 按客户汇总折后月日均，收起机构维度，取本季首月至计算日的日历权重，形成“客户 × 标签 × 当前月”的本季累计季均。尽管名字有“错期”，本 query 没有另外引用错期参数或平移月份；实际操作是对当前来源的季度日历加权。该输出被下面三项直接作为增长或份额计算的来源。〔query 1—36〕[^234350]

| 任务           | 粒度与公式                                  | 基期和边界                                                                                                                                                            |
| -------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 201980         | 客户 × 标签；`(本季均−上季均)/上季均 × 100` | 当前月的本季累计均值，对比上季末月份的完整季均；无零分母保护。query 1—19。[^201980]                                                                                   |
| 234362         | 客户 × 标签；本季均减上季均                 | 与 201980 同一单客户来源、同一基期；输出原金额单位。query 1—15。[^234362]                                                                                             |
| 201994         | 客户 × 机构 × 标签；本季均减上季均          | 消费客户—机构版本，机构维度保留，不能把客户迁移影响先抵销。query 1—16。[^201994]                                                                                      |
| 187911、187976 | 客户；折后年日均同比增长值、小数增长率      | 当前日年日均对比“上年同月最后一日”的年日均，而不是上年同日，也不是上年 12 月；只取总标签和有效个人、机构客户。增长率无零分母保护。两项 query 1—16。[^187911][^187976] |

例如 9 月 8 日运行同比，SQL 选择上年 9 月 30 日作基期；这会把本年截至 9 月 8 日的年均与上年截至 9 月底的年均比较。把任务名里的“同比”翻译成“相同已过天数比较”会改变含义。

<a id="derived-share-yield"></a>

## 份额增长与单位资产创收变化

**202172 机构份额增长率** 消费机构年日均司占比，按 `(当前份额−上年12月份额)/上年12月份额 × 100` 计算，同时无条件生成当前月和前一月两个版本；最终仅保留营业部、分部类型。前一月分支的基期仍按当前计算年份的上年 12 月拼接，年初的比较尤其需要注意。其旧的客户—机构来源代码已注释，实际来源是机构单维度版本；不能把注释源计为活动值来源。prepare 只删当前月。〔query 1—44、prepare 1—2〕[^202172]

**202175 客户份额增长率** 先在有效个人、机构客户内，用每位客户季均除以同标签同期客户季均总额形成份额，再对本季与上季份额求相对增长率并乘 100。它衡量的是“在选定客户总体中的份额变化”，分母是这一客户集合，不包括托管产品、场外对手等其他组合类型；客户自己的金额上涨，若总体涨得更多，份额仍可下降。两层除法都没有零分母保护。〔query 1—47〕[^202175]

**159991、160031 单位资产创收变化** 并不重新算收入或资产，直接消费 `index_grp1_StdAstUnitAstIncome_CovtPst_AstPkgRela_Qtr` 的当前月与上季末值。159991 输出两个值各自缺失补 0 后的差；160031 输出 `(当前值−基期)/基期`，把空结果补 0，没有额外乘 100。关键是连接只按员工 grp_id，没有按标签连接，当前标签还沿用左侧；如果同员工上季存在多个标签，会发生交叉匹配。这里确认的是代码条件，实际是否出现重复，需要源数据唯一性证据。〔两项 query 1—30〕[^159991][^160031]

<a id="derived-evaluation"></a>

## 考核派生：平均的分母与缺值语义

**199242 员工当季月均收入** 先把考核收入总标签减去三个指定收入标签 074443518、074443526、074443522，按员工与月求净额，再对本季已出现的月份取普通 `avg`。它既不是按日历天数加权，也没有补出无输入月份的零行；若季度已过两个月但只有一个月有源记录，分母仍是 1。代码还无条件计算“前一月所在季度首月至前一月”的月均，虽然注释称 8 号固化，上月分支没有日期门槛；prepare 只删除当月分区。〔query 1—42、prepare 1—2〕[^199242]

**236123 季日均增长率** 取主篇解释的考核系数折后、剔除特定品类后的季度均值 230016，以标签 074452004 为基期、074452006 为期末，输出 `(期末−基期)/基期`。当前月基期缺失或为零返回 0；追加的上月分支在同样条件下却返回 NULL，并只在计算日不晚于本月 7 日时执行。不能把两种缺值解释成业务上确实零增长，也不能据表注释把刷新窗口扩大到整个月或只限季度初。〔query 1—39〕[^236123]

**236275 管理评价积分达标率** 从当日绩效考核客户—员工标签 074449301 确定范围，在有效客户定义上连接当月每客户总积分。客户分数至少 3 分计为达标，分母是关系行的客户计数，没有去重；缺积分的客户仍进入分母但不进入分子。输出达标人数/客户数的小数比率。此处没有实现“剔除客户”的附加规则，那只是“待定”注释；考核客户范围的上季末关系及本季自主开发含义由上游标签决定，本任务仅消费其结果。〔query 1—32〕[^236275]

这些派生结果继续供员工收入评价、机构资产报表和人员指标后处理使用；阅读最终考核结果时，应同时查[收入与综合评价](performance-income-and-evaluation.md)、[绩效指标后处理](performance-postprocessing.md)和[输出消费契约](performance-output-contracts.md)。本页确认的是公式、粒度、输入窗口及显式条件，未证明调度固化实际发生，也未证明历史源、固定基期或分区覆盖满足代码假设。

[^148806]: Task 148806，发布 evidence：[SQL 快照](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/148806/versions/0ed6fef3e3b67cf2bb112e65c6d1c3540f70232b53e6d14294fac9f1333684b9.evidence-v3.json)。

[^149243]: Task 149243，发布 evidence：[SQL 快照](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/149243/versions/c731e47a531c4b00dc62616b8e62c19b7c1200a7990528a4d67b8b88701b770b.evidence-v3.json)。

[^149236]: Task 149236，发布 evidence：[SQL 快照](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/149236/versions/30f80576a30fc415e8f792881ee7f1a5a72b5c7227b9deaef16103ce7bb3abf9.evidence-v3.json)。

[^149951]: Task 149951，发布 evidence：[SQL 快照](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/149951/versions/1d983521e3aab695da5ade188306f5ddb94fc7611bee002c64536e414639cff6.evidence-v3.json)。

[^148906]: Task 148906，发布 evidence：[SQL 快照](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/148906/versions/2e1ad2ebe13b4151041c080a8bec34b240cdf543f1c5de3275bcce68862f81ab.evidence-v3.json)。

[^149087]: Task 149087，发布 evidence：[SQL 快照](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/149087/versions/0049cdbd316843c4cb116dd3d6253501cdbbc4aebd91ff96dcf4e6c9ef4c4c63.evidence-v3.json)。

[^148911]: Task 148911，发布 evidence：[SQL 快照](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/148911/versions/b073ed284455cf637ad43bb4cc64a125a8464e9dc55b1d566b13149ea4f22684.evidence-v3.json)。

[^149092]: Task 149092，发布 evidence：[SQL 快照](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/149092/versions/11c269bb5a0ecaba16da936a04f87fb50d35573d150f4833bd2a310a834b13a7.evidence-v3.json)。

[^161841]: Task 161841，发布 evidence：[SQL 快照](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/161841/versions/324362b9d691f0ccc52c8847287a5f18fa270a9bee00ba0ce18aa92133d1d26a.evidence-v3.json)。

[^161844]: Task 161844，发布 evidence：[SQL 快照](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/161844/versions/79951e11fb4998581eaffb5f7fb80354bd29d2b239d9d513077c79fd8ebe8048.evidence-v3.json)。

[^161845]: Task 161845，发布 evidence：[SQL 快照](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/161845/versions/88b51afacdb49eedac62591b33cd7dd0495ca9eea012c8e85f6e4b25a08eec32.evidence-v3.json)。

[^161848]: Task 161848，发布 evidence：[SQL 快照](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/161848/versions/0cfd6f1eadcddcfbde9b291e107da0f04226144f7b3dfc30f24d0751727edd47.evidence-v3.json)。

[^162117]: Task 162117，发布 evidence：[SQL 快照](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/162117/versions/f0c55186899ee7fa02c2da7686b8a4b2d5f99f5836eaaae5d28b0b529c4a63c8.evidence-v3.json)。

[^162120]: Task 162120，发布 evidence：[SQL 快照](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/162120/versions/0cd27dde8b46a3922aad253306ca905b01f38d3c55bd49cb467bf4a45a8447cc.evidence-v3.json)。

[^162136]: Task 162136，发布 evidence：[SQL 快照](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/162136/versions/3e5d87f1edc59dcd39e041893f758333495ba33a69636e678278578ba83f003c.evidence-v3.json)。

[^162564]: Task 162564，发布 evidence：[SQL 快照](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/162564/versions/c272bc6842f676afd1d76635b302c0109b80d781a3130784afd8f5d34eb93862.evidence-v3.json)。

[^201980]: Task 201980，发布 evidence：[SQL 快照](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/201980/versions/41bb9499cb9b83e0199f6dc0352bcfe0189868e831fd5cc043a0ea70c60bec05.evidence-v3.json)。

[^201994]: Task 201994，发布 evidence：[SQL 快照](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/201994/versions/c8dfb216f406772c879fb26d5a545ce0a6b3c891e833203e3c2cc550a1a311be.evidence-v3.json)。

[^234362]: Task 234362，发布 evidence：[SQL 快照](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/234362/versions/6645c9380087c1e7ca46939be12d11708b5f8c5f666cd66041a22d0e7012faeb.evidence-v3.json)。

[^187911]: Task 187911，发布 evidence：[SQL 快照](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/187911/versions/314950effe4d1b45d9921855100ec39c20c1e2d2eabe520f10dd01c6ac9b314f.evidence-v3.json)。

[^187976]: Task 187976，发布 evidence：[SQL 快照](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/187976/versions/0e1519065e1b07fee10e823f1615ac14f4f6c64feea4d0535714575ecc19ed81.evidence-v3.json)。

[^159991]: Task 159991，发布 evidence：[SQL 快照](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/159991/versions/dbb87947182a45945601dc355cc0106f3fd05c50678c45c8815c05271d2ab23a.evidence-v3.json)。

[^160031]: Task 160031，发布 evidence：[SQL 快照](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/160031/versions/38838030fe3f8d41e47ae4e308540401cadd492ca8dc5a89350c6d21f3e8e2c0.evidence-v3.json)。

[^202172]: Task 202172，发布 evidence：[SQL 快照](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/202172/versions/6d1d110e62532022f70fa6d5438cd3463b40db21b87083e0097239b8ec277aa6.evidence-v3.json)。

[^202175]: Task 202175，发布 evidence：[SQL 快照](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/202175/versions/6a38e714b39c3a726ddc6a940f597f10e72cab819b9bb5a0094763c25f2650df.evidence-v3.json)。

[^234350]: Task 234350，发布 evidence：[SQL 快照](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/234350/versions/8317768fead091ba503c58cfdf091a749a188e9e9c357402943290c6bf5577fe.evidence-v3.json)。

[^199242]: Task 199242，发布 evidence：[SQL 快照](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/199242/versions/dd3fa3409fa83393ceada096c085a19acdb2c3f2692791e777d7517e650c13da.evidence-v3.json)。

[^236123]: Task 236123，发布 evidence：[SQL 快照](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/236123/versions/88eb55d4ac1cb4b20b8101a36dc370753af30cef1da8ad2f03142faa8ee9826e.evidence-v3.json)。

[^236275]: Task 236275，发布 evidence：[SQL 快照](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/236275/versions/6e6783985f0904d9b0a16a459218197775eb2bff085ae5a8cd01dc92f734653f.evidence-v3.json)。

[^170941]: Task 170941，发布 evidence：[SQL 快照](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/task-projections/tasks/170941/versions/b19796bfaa3ffe70fef9817d9c9e4b49d1622ad8f07f55b5ace0259af265e6f8.evidence-v3.json)。

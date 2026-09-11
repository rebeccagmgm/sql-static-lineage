# 业务加工知识库

这个知识库解释当前 data-graph 所覆盖的业务与数据加工体系：谁参与业务，交易怎样成为持仓、资金、损益和经营结果，各种口径为何不同，以及它们怎样相互连接。

**本次交付为已收拢的知识库版本，可从下面的导读或问题入口直接阅读。** 按用户的资源约束，已停止继续扩查。当前内容覆盖多个主要业务过程，但尚未达到全网完整交付标准；具体缺口在各页和覆盖账本中保留。研究范围固定为本次发布中的 3,615 个任务与 2,903 个物理表节点，范围数量不等于业务解释完成度。

首次阅读建议先看[整个网络在做什么](chapters/00-overview.md)，再看[对象、时间、粒度与比较](topics/time-grain-and-comparison.md)，随后选择与自己问题有关的业务主题。证据附录供追溯使用，不必按顺序阅读。

## 从全貌开始

1. [整个网络在做什么](chapters/00-overview.md)：主要业务过程、共享基础和不同结果的关系。
2. [源系统带来了哪些信息](chapters/01-sources-and-systems.md)：交易、结构、持仓、资金、主体、行情、权限和接口；不同采集窗口与保存方式。
3. [先分清主体、账户、合约、账簿和证券](chapters/02-public-objects.md)：对象身份、关系、状态与日期，避免后续加工接错对象。
4. [合约、交易结构与持仓](chapters/03-contracts-and-positions.md)：协议、结构、交易、持仓与日视图怎样连接，哪些编号不能直接合并。
5. [证券、行情与定价输入](chapters/04-market-and-pricing-inputs.md)：证券身份、价格、曲线、波动率、参数选择与日内批次。
6. [资金、清算与保证金](chapters/05-funds-and-margin.md)：账户、余额、资金发生与保证金结果怎样区分。
7. [风险、损益与监控](chapters/06-risk-and-pricing.md)：主要计算分支、保证金与检查，阅读时注意本页列明的待补事项。
8. [财务、估值与交割接口](chapters/07-finance-and-valuation.md)：不同业务如何变成财务记录，哪些映射与时间窗口改变了结果。
9. [经营分析与客户服务](chapters/08-operations-and-customers.md)：客户与销售关系、创收、日报、交易结算和接口。
10. [标准资产与考核](chapters/09-performance-and-assets.md)：归属、折算、封顶、统计期间与评价。该主题保留尚未解释完整的家族。
11. [香港业务](chapters/10-hongkong.md)：账簿归属、日终与盘中分支、持仓资金与财务分发。
12. [固收](chapters/11-fixed-income.md)：规模、合约与资产腿、持仓盈亏、客户协同、资金及下游交付。
13. [合规与报送](chapters/12-compliance-and-reporting.md)：合约交易接口、机构与产品客户资料、AML 身份、资金指标、名单辅助控制及复评候选。
14. [权限与人员](chapters/13-access-and-shared-support.md)：员工、账号、角色、菜单、账簿和定价环境权限，以及跨系统核查。
15. [专业消费与资金部](chapters/14-specialized-consumers.md)：资产概览、回购、票据、期权互换明细与组合履保；其他专业消费仍有缺口。
16. [交付与控制](chapters/15-delivery-and-controls.md)：推送、回执、目标端加工、检查与脚本证据边界。
17. [质量检查](topics/quality-check-families.md)：键与码表、历史区间、数量、存在性、业务规则及检查自身的盲区。

## 按问题进入

| 想弄清的问题                                                 | 当前入口                                                                        |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| 为什么图里出现许多看似不属于同一笔交易的系统？               | [全貌](chapters/00-overview.md)                                                 |
| 同一源表的两次采集，能否当成相同数据？                       | [源系统与落地规则](chapters/01-sources-and-systems.md#source-transfer-patterns) |
| 客户编号、协议编号、交易编号可以直接相连吗？                 | [公共对象](chapters/02-public-objects.md)                                       |
| 客户表里有协议、评级、额度等字段，实际填入了什么？           | [主体与客户](topics/party-and-customer.md)                                      |
| 账户为何表示账簿，当前资料和历史区间该怎样关联？             | [公共身份与历史](topics/public-identity-and-history.md)                         |
| 字典、业务系数、流程配置怎样影响其他结果？                   | [码表、系数与配置](topics/reference-codes-and-parameters.md)                    |
| 用户、员工外部编号、角色、资源和菜单如何区分？               | [组织与权限模型](topics/organization-and-access.md)                             |
| 合约终止后为什么仍会出现损益记录？                           | [风险与损益](chapters/06-risk-and-pricing.md)                                   |
| 财务记录里的数量、方向、账户为何与业务字段不同？             | [财务与估值](chapters/07-finance-and-valuation.md)                              |
| 香港数据是否等于源系统中直接标为香港的账簿？                 | [香港业务](chapters/10-hongkong.md)                                             |
| 固收规模、存量名义本金和新增业务金额有什么区别？             | [固收](chapters/11-fixed-income.md)                                             |
| 合规接口里的成交金额为何不等于实际收付款？                   | [合约如何成为合规交易记录](topics/compliance-contract-events.md)                |
| 同一客户在机构、产品和托管资料里为什么编号或标签不同？       | [合规客户资料](topics/compliance-customer-info.md)                              |
| 一个内部客户号为什么对应多个业务客户？                       | [AML 客户身份](topics/aml-customer-identity.md)                                 |
| AML 的资产、月度发生额和评级基础为什么不能混用？             | [AML 资金与评级基础](topics/aml-funds-and-features.md)                          |
| 名单候选、设备清理和数据检查分别证明了什么？                 | [AML 名单与辅助控制](topics/aml-lists-and-controls.md)                          |
| 资金部报表中的资产、利率、期限和履保余额采用什么口径？       | [资金部使用股衍数据](topics/treasury-management.md)                             |
| 普通 ATP 成交和 ETF 成分股成交，为什么可能采用不同账户范围？ | [经营与客户服务](chapters/08-operations-and-customers.md)                       |
| 全公司多个系统为何被连到股衍图中？                           | [跨系统人员角色汇总](topics/cross-system-user-roles.md)                         |
| 检查通过、推送成功分别能证明什么？                           | [检查与证据边界](topics/quality-and-evidence.md)                                |
| 某类质量检查具体检查什么，为什么可能漏掉异常？               | [质量检查家族](topics/quality-check-families.md)                                |
| 数据送到目标端后还会怎样改变？                               | [目标端业务后处理](topics/delivery-postprocessing.md)                           |
| 某个解释依据哪份 SQL，材料是否完整？                         | [证据与范围](evidence/scope-summary.md)                                         |
| 两份结果都叫规模或收益，为什么不能直接比较？                 | [对象、时间、粒度与比较](topics/time-grain-and-comparison.md)                   |

## 当前版本的内容缺口

合规的部分接口字段、受益人、完整黑名单与 CISP 分支，以及部分专业消费者尚未形成充分正文；考核、风险、合约及已有主题也保留具体待核分支。当前[19 份审阅汇总](evidence/coverage-summary-19-reviews.md)已纳入合规、公共基础及 AML 新增说明：368 项没有主题审阅记录，335 项仅定位或仍待核。其他状态表示已有业务、传输或模板说明，不代表该任务的全部字段与业务语义均已完成验收。

共用对象和口径放在公共页面，具体业务页说明自己如何使用它们。已有内容、推断与未知分开保留，后续可沿精确缺口补充，无须重做整套研究。

## 怎样判断这里的结论

- **SQL 实现事实**：代码实际读取、筛选、关联、计算和写出的行为，可追到固定版本证据。
- **业务解释**：依据字段、规则与业务资料解释该加工的作用；必要时明确解释依据和适用范围。
- **待确认事项**：材料缺失、代码与注释不一致、对象唯一性未证实或当前消费不明；直接说明影响哪些判断。

这里的静态证据不证明任务已运行成功、数据已送达或业务口径已被验收。快照日期是所读材料的日期，不能自动当成当前业务日。

[范围与来源底账](evidence/scope-summary.md) · [知识内容覆盖账本](evidence/coverage-summary-19-reviews.md) · [完整交付约定和工作状态](WORKLOG.md)

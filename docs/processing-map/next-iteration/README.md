# 加工地图下一批：骨架复用与逐层分析

2026-09-07 阅读提示：关于当前“先把本批 PDATA 搞清楚”的分析工作，请先读 [PDATA 理解与推进指引](../pdata-understanding-guide.md)。本目录保留已有工程方案；新指引不变更其任务或实施状态，整套工程也不作为 PDATA 理解工作的前置条件。

日期：2026-09-07。状态：**方案已编写，实施尚未开始**。本目录供下一位实现 Agent 接手；不能把任务清单或接口示例当成已有能力。

## 1. 本批要交付什么

把用户认可的《股衍加工地图 · 从全局到证据》继续做深：保留全局主加工骨架，使成员、关联和数字能够由规则重算；从来源节点进入主画面的分析页；修正 `odata_n_tit` 首层下钻。以现有 3,615 个任务的固定材料验证方法，暂不扩展十几万任务。

用户的 0、1、2、4 点针对**全局骨架**；只有第 3 点针对 **`odata_n_tit` 下钻**。不得把整批工作缩成一个 odata 页面，也不得把来源分析做成全库统计大屏。

| 工作包 | 用户能看到的结果 | 本批边界 |
| --- | --- | --- |
| 骨架复用 | 同一套规则重跑后更新区域成员、关联、数字、布局；保留并行路线、跨层读取和交付边界 | 自动计算已定义视图，不承诺自动理解任意业务体系 |
| 来源区域细化 | “Titans 可见来源”和“其他可见来源”都有可继续阅读的入口；区分来源组成、实际去向及待解释关联 | 总览保持克制，schema 差异放到下一层 |
| Titans 来源分析 | 从来源进入 schema／业务分类，再进入具体表或视图，看到用途、消费路线及证据 | 覆盖本批可见成员；未知类型、未分类、缺证据均可见 |
| odata 下钻重整 | 先理解区域内加工类别、输入输出和下游，再进入批次整理、跨源合并案例 | 不是逐一手工解释该 schema 的全部对象 |
| 数据消费定型 | 构建期消费版本明确的图导出、必要元数据和共享 knowledge；生成可离线阅读的快照 | 浏览器不直连图；本批不建设动态服务或新图发布器 |
| 迁移验证 | 换一个来源范围，沿用同一算法、布局与前端，得到可阅读的分析页 | 在本批图中选一个未用于 Titans 开发的来源验证，不扩大图范围 |

## 2. 实现 Agent 的阅读顺序

1. 本页：范围、当前基线、不可走偏的地方。
2. [架构方案](architecture.md)：数据消费、事实与知识边界、布局和兼容策略。
3. [详细实现方案](implementation-plan.md)：模块、合同、算法、命令和分阶段交付。
4. [验收标准](acceptance.md)：技术验收与真实阅读价值分别检查。
5. [OpenSpec 任务清单](../../../openspec/changes/make-processing-map-reusable/tasks.md)：逐项执行并记录验证。

本目录是详细方案的唯一维护位置。OpenSpec 的 proposal、design、specs、tasks 负责变更范围、规范和进度，不复制一份完整架构正文。

## 3. 已核验的基线

| 项目 | 当前事实 |
| --- | --- |
| 原入口 | [`docs/processing-map.html`](../../processing-map.html)，静态单文件 |
| 原源代码 | [`scripts/processing-map/`](../../../scripts/processing-map/README.md) |
| 固定图版本 | `4f61cee7134b1cba7686191bc0e8606ab28cc4d673935a50298e7ba792babf9a` |
| 图范围 | 3,615 个任务、2,740 个表身份节点、111 个 schema 名称、245 个 schema 方向 |
| 当前总览 | **14 个框、18 条可视连线**；已核对源码与 HTML 内嵌数据。早期对话的“13 框、22 线”不是当前基线 |
| 原视图 | overview、odata、pdata、news、nds、otc、index、delivery、principal，共 9 个 |
| Titans 可见来源 | titans_dm 218 个、titans_refdata 16 个表身份，共 234 个；不等于已确认 234 张物理表 |
| Titans 关联 | 514 个去重读取任务、5 个输出关联任务；来源组并非只有出边 |
| odata 首层下钻 | 人工挑选的 9 节点、7 边、3 任务，展示两组加工案例，未承担整个区域的分析 |
| 页面消费 | build.mjs 读取本地导出并内嵌 DATA；点击不查 Neo4j、不读外部文件 |

数字仅描述这一固定历史材料。3,615 不是全部图节点数量，也不表示每个任务已经深入分析或运行验证。

## 4. 当前入口与实现起点

- 原构建器：[build.mjs](../../../scripts/processing-map/build.mjs)。图版本变化会要求复核人工说明；没有自动生成新骨架。
- 原编排：[content.mjs](../../../scripts/processing-map/content.mjs)。人工节点、坐标、区域职责、代表链在此。
- 原交互：[view.js](../../../scripts/processing-map/view.js)。来源节点目前进入右侧 `regionDetail`，主要是任务集合和区域方向。
- 固定输入：`tmp/processing-skeleton/table-network.json`、`schema-flows.json`、`schema-summary.json`。其生产者是 ignored 的 `tmp/processing-skeleton/export.mjs`，不是正式公开导出命令。
- 固定证据：[fixed-sql.json](../fixed-sql.json)、`tmp/otc-principal-value-case/four-writer-evidence.json`。旧证据路径不能假定仍可读取。
- 共享知识：由 [`config/workspace-paths.json`](../../../config/workspace-paths.json) 的 `dataRoot` 解析到 `dataRoot/knowledge`；复用 [`task-knowledge.mjs`](../../../scripts/knowledge/task-knowledge.mjs) 的路径解析和既有任务读取能力。
- 元数据候选：用户提供的 `数综基础信息/原信息`，采用已有索引读取能力按本批对象提取；不把几 GB 文件打包进地图。
- 已有事实说明：[当前实现](../implementation.md)、[知识重建讨论](../knowledge-reconstruction-discussion.md)、[图查询 CLI](../../agent-graph-cli.md)。

## 5. 实施约束

1. 原 `docs/processing-map.html` 作为阅读基线保留；本批先输出 **`docs/processing-map-next.html`**。不自动替换原入口，不改写旧生成物。
2. 保留 SVG、暗色阅读组织、证据面板、固定 SQL、销售合约及本金专题。G6、ELK、WebGL、任意子图实时查询不在本批。
3. 新的骨架／来源／区域视图必须由数据和规则计算；不为新节点手补 x/y，不复制 odata 的“几个样例冒充全区域”做法。
4. 节点穿透进入主画面，保留面包屑、返回和阅读位置；右侧继续承担任务及证据详情。
5. schema 分类、业务标签和物理对象类型分开。允许多标签；不从 `v_`、`_p`、`_pb` 后缀直接断言类型或加工语义。
6. 静态表级关联不是逐字段因果、同批次接续或运行成功。特别保留交付配置、日志、文件导出的区别。
7. `scripts/inventory-map/`、`docs/inventory-map.md`、`package.json` 及其他现有脏改动是先前工作，不能重置或当作本批已验收实现。本批不依赖 inventory-map 实验的整套服务或数据库。
8. 第一阶段使用现有固定输入；缺失就报告具体文件，不重新采集全域、不发布图、不启动另一套 Facts 计算。

## 6. 可直接交给实现 Agent 的任务说明

> 请实施 `make-processing-map-reusable`，先读本目录四份文档和 OpenSpec tasks。目标是保留原加工骨架的解释力，完成可重跑计算、来源主画面穿透和 odata 分析重整。按任务顺序执行，先做固定材料导入与真实成员重算，再做一个可端到端阅读的 Titans 来源样本，之后完善 odata 和迁移验证。不要从全库盘点、G6、通用平台或大量统计图开始。保留仓库现有改动及原 HTML。每完成一个阶段，报告页面读者现在能回答什么问题、验证依据和实际缺口；全部技术测试通过不等于业务验收完成。

本轮仅编写方案和任务，未创建新的数据快照、标签目录或页面。当前环境未找到可调用的 OpenSpec CLI，采用仓库现有 spec-driven 文件结构人工编写；后续如 CLI 可用，先运行 `openspec validate make-processing-map-reusable --strict`。本轮不能宣称已通过该命令。

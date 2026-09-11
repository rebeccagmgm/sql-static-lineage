# 实施任务：骨架复用与逐层分析

日期：2026-09-07。状态：**仅方案，实施尚未开始**。所有复选框保持未完成，执行者完成且保存验证依据后再勾选。

详细方案的唯一维护位置是 [`docs/processing-map/next-iteration/`](../../../docs/processing-map/next-iteration/README.md)。执行前依次读架构、实现方案和验收标准；下列文件名和命令以详细实现方案为准。当前环境没有可调用的 OpenSpec CLI，本轮未运行规范验证，不得声称 `openspec validate` 已通过。

本批保留 `docs/processing-map.html`，新增 `docs/processing-map-next.html`；不运行全库采集、不安装 G6、不建设在线服务、不重新发布图。保留仓库现有脏改动和先前 inventory-map 实验，不把它们当成本批已验收实现。

本批拟新增的模块归属如下，名称不是现有能力声明：

| 阶段 | 主要文件与入口 |
| --- | --- |
| 1 | `scripts/processing-map/next/{cli,input,relations}.mjs`、`definitions/*.json`、相关 `tests/*.test.mjs`；`package.json` 增加四个 `processing-map:*` 命令和目标测试脚本 |
| 2 | `next/{metadata,knowledge}.mjs`；共享 catalog 的 `tags.json`、`schemas.json`、`objects.json`、`regions.json` 和 `notes/*.md` |
| 3 | `next/compute.mjs`、来源定义、原 `view.js` 的兼容导航适配及模板／样式必要改动 |
| 4 | `next/{layout,snapshot}.mjs`、overview／来源定义；`next/cli.mjs` 的 build／inspect |
| 5 | `next/compute.mjs` 的区域视图、odata 定义和相关共享知识；原代表案例的兼容挂接 |
| 6 | `next/compat.mjs`；必要时将原 build 的纯 payload 组装抽取到 `scripts/processing-map/payload.mjs`，供旧 build 与新兼容层共用 |
| 7 | 来源迁移配置、相关测试、实际命令与交付说明；不另建来源专用算法或知识查询平台 |

`next/` 均指 `scripts/processing-map/next/`。计划命令为 `processing-map:import`、`processing-map:metadata`、`processing-map:build`、`processing-map:inspect`，映射 `node --import tsx scripts/processing-map/next/cli.mjs <subcommand>`；目标测试为 `test:processing-map-next`，映射 `node --import tsx --test scripts/processing-map/next/tests/*.test.mjs`，按仓库惯例配置 `prepare:deps` pre hook。这些命令尚未实现，本轮不运行。

## 1. 导入固定材料并重算真实成员

本阶段先证明关系和成员可重算，再编排新页面。输入为明确指定的 network、flows、summary，输出为 dataRoot 下版本明确的输入包及一致性报告。普通导入的 retained SQL／principal 可选；本次固定黄金基线需带齐，以验收原专题兼容。

- [ ] 1.1 在 `next/cli.mjs`／`input.mjs` 按 implementation-plan 的合同实现显式导入器及参数校验，增补上述 npm 入口和 pre hook；复用 `config/workspace-paths.json` 的 dataRoot 解析，将必要输入保存到 `dataRoot/processing-map/inputs/<bundleId>/`。build 强制显式给出 `--output`，必需关系输入及已明确提供的附件缺失时列出路径并停止；未提供可选旧证据不阻断结构导入，不回退到全域采集。
- [ ] 1.2 实现清单、文件摘要及内容身份；相同输入文件字节、knowledge、definition、algorithm 下，额外记录的导入时间／位置与构建机器不改变 ID，原材料自身 exportedAt 等内容变化允许新 inputRevision。保留关系 graphVersion 及旧专题独立 graphVersion，识别并登记可选历史依赖。
- [ ] 1.3 从 network 的原始 edges 重建去重读／输出关联，与 tasks.inputs/outputs 及 tables.readers/writers 双向比较，再构造 datasetId、taskId 索引及各 schema 的 dataset／reader／output 集合，重算输入 schema × 输出关联 schema 的方向成员；不重写字段因果或调度因果引擎。
- [ ] 1.4 对裸数组 flows／summary 做双向完整集合校验，并为缺方向、漏成员、额外成员、未知端点、同 count 错成员增加必要测试；失败不能覆盖旧产物。对齐 3,615 任务、2,740 datasets、111 schemas、245 方向，并提交成员对照报告。
- [ ] 1.5 从原 `content.mjs` 提取等价的区域／方向配置并验证 14 节点、18 可视边基线，以及 Titans 234 成员、514 readers、5 output 关联和 484／30／4／1 四方向；只证明成员与映射，不手工抄数字作为生产输入。

## 2. 接入共享 knowledge 与有界元数据

本阶段输入为已导入成员、共享 knowledge 与本地元数据索引，输出为可追溯分类、精简元数据摘录及匹配报告。

- [ ] 2.1 在方案约定的 `dataRoot/knowledge/catalogs/titans-otc/` 建立本批最小词表、schema／对象分类和解释合同；复用现有 knowledge 路径／读取能力，不改写 `tasks/107491` 的既有合同。记录绑定、证据、范围和解释状态。
- [ ] 2.2 用独立 metadata 命令按 Titans 234 个成员和 odata 范围调用已有 JSONL 偏移索引读取器，生成不可变的小型元数据包和 EXACT／CANDIDATE／MISSING 匹配报告；build 只消费已有小包，不能隐式建全库索引、全库内存加载或将整份原信息复制进 HTML。
- [ ] 2.3 将 datasetId 身份、schema、TABLE／VIEW／UNKNOWN 事实与业务分类分开；实现多标签的稳定主归属、交叉筛选和按身份去重，未分类对象保持可见。覆盖同名多候选及 `gf_rdbms_table` 不代表 TABLE 的类型边界。
- [ ] 2.4 实现 knowledgeRevision 及证据适用性检查；无解释显示待整理，摘要失配标记 STALE 或隔离为独立历史案例，不能沿用为当前已验证说明。提供标签重跑、多标签去重及证据失配的必要测试依据。

## 3. 先做 Titans 的端到端来源穿透

本阶段用一个来源把计算、页面与证据串通。输出应能回答来源用途和实际消费，而非增加一个统计入口。

- [ ] 3.1 实现通用来源视图计算器，以 selector、分组维度和预算为参数生成“来源组成—对象类别—消费去向”；保留每个节点和方向的成员及身份，不增加 Titans schema 的算法特例。
- [ ] 3.2 将原总览的 Titans 点击动作接到主画面来源页，继续支持 schema／类别筛选、成员分页和具体对象分析；展示关键用途、已知类型、读取任务、输出关联和下游区域。
- [ ] 3.3 实现或适配主画面导航路径、面包屑、返回和每视图相机状态；任务／SQL／证据保留侧栏，开合侧栏不重置画布。以“总览 → Titans → 类别 → 对象 → 任务 → 返回”验证完整流程。
- [ ] 3.4 在来源页明确呈现 Titans 的 484／30 正向及 4／1 反向关联，后两者标为待判定的输出关联；提供实际对象或任务的用途／消费解释，并能进入未知类型及未分类成员。
- [ ] 3.5 提交第一份可离线阅读的 `docs/processing-map-next.html`、上述流程截图及至少一条有证据的来源阅读发现；逐项记录不能回答的问题，再进入全局完善，不能把原 HTML 替换成新入口。

## 4. 完成可重跑骨架、自动布局和来源区域细化

本阶段输出全部受管视图的确定布局、版本身份与差异报告；默认等价基线通过后，再应用来源细化配置。

- [ ] 4.1 实现方案定义的阶段定列、有限次重心排序、稳定 ID 平局处理和统一边通道；所有新计算视图禁止逐节点 x/y，跨层、逆向及同列关联不得因布局被删除。
- [ ] 4.2 计算 overview 的成员、聚合方向与去重数字，保存每条边的分项及成员；将所有方向分到已展示、聚合隐藏或未映射集合，提供主画面的“其他关联／待解释”入口并校验集合完整。
- [ ] 4.3 用来源配置细化 Titans／其他可见来源的入口；X 定义为进入 O 的方向中动态排除 S 当前命中 schema 及 O 本身的补集，基线标签恰好复现旧固定排除规则。验证 titans_refdata 改 sourceSystem 后从 S 转 X，迁回时也不丢失或重复；X 不能改称全库非 Titans 外部来源。总览保留主加工阅读顺序，框数变化由规则和差异报告解释。
- [ ] 4.4 完成 snapshotId、definitionRevision、algorithmVersion、变更报告及 inspect 的同快照来源／对象／方向成员 JSON 查询，分页默认 30、最大 100；相同文件字节及配置／算法下连续构建得到相同规范化快照和布局，变更导入位置／时间不改 ID，再只改 schema 分类／标签重跑，证明前端及计算器无需修改。不承诺重新导出的语义等价文件同 ID。
- [ ] 4.5 接入节点／边／成员页／HTML 预算、原子产物替换和超限错误；记录实际体积、最大视图规模及构建耗时，提供与原图同窗口尺寸的布局对照截图，不用增加库或手补坐标绕过问题。

## 5. 将 odata 首层改为区域分析，保留明确案例

本阶段输入为整个 odata 的本批成员和已有证据，输出为区域分析首层及独立代表案例层。

- [ ] 5.1 复用通用视图计算和分类能力生成 odata 输入来源、已知加工职责、产物／下游关系及未分类入口；区域分析以全体本批成员为范围，不能只覆盖原 9 节点／7 边。
- [ ] 5.2 将 144134／144141 与 41540 移到第二层“代表加工案例”，保留完整名称、表／任务类型、选例理由及覆盖边界；从区域职责可进入案例，再到固定 SQL。
- [ ] 5.3 核对 144134 目标配置和 144141 的 `h15` 读取，图示和文字保留 `_p` 日期分区与 h15 批次未匹配的边界；核对 41540 的 UNION ALL＋来源标识，不解释成去重或统一业务口径。
- [ ] 5.4 保存区域页／案例页截图、分类依据和固定 SQL 定位，验证缺解释／STALE 对象仍有正确入口；给出至少一条区域加工阅读发现及尚不能证明的内容。

## 6. 保留原证据、专题和离线体验

本阶段只迁移必要的兼容阅读能力，不扩展原有专题范围。新图版本与旧案例不能无标识混用。

- [ ] 6.1 在 `compat.mjs` 按独立的历史版本适用性挂接旧 pdata、news、nds、otc、index、delivery、principal 等保留视图及任务详情；若抽取 `payload.mjs`，保持原 build 默认行为和校验，不直接 import 有写出副作用的旧 build，也不让其固定版本闸阻断新结构。固定基线保留完整边成员、SQL、销售知识和本金入口，历史失配时隔离为历史参考或需复核。增加“新 schema 合法关系＋旧专题失配”及“新图无旧附件”验收，结构仍生成，旧专题不标当前。
- [ ] 6.2 验证 JSON／HTML 嵌入转义、文档链接和数据来源边界，保留无外部连接策略；记录 `file://` 下无外部请求、无脚本错误和完整阅读流程，不能通过本地服务掩盖离线缺陷。
- [ ] 6.3 对照原 HTML 摘要确认未覆盖原产物，完成新页面的任务／SQL／knowledge／本金回归及返回相机检查；只运行与新增计算和导航相关的目标测试及仓库要求检查，保留具体失败信号。

## 7. 迁移验证、阅读验收与交付说明

本阶段完成“方法可复用”的验证，不扩展十几万任务。技术结果与用户阅读确认分开报告。

- [ ] 7.1 在同一输入包中选择 Titans 开发未使用的另一真实来源（如确认存在的 OIS 范围），仅增加 selector、标签和知识后生成分析页；证明没有复制算法、添加特定 schema 分支或手补布局。
- [ ] 7.2 对迁移页执行组成／分类／消费／对象穿透验证，给出来源独有的阅读结论及证据缺口；结合 Titans 和 odata 提交至少三条有事实依据的阅读发现，不能用表数排行凑数。
- [ ] 7.3 按 [acceptance.md](../../../docs/processing-map/next-iteration/acceptance.md) 分别记录 T1—T7 技术状态与阅读任务答案，提供截图和证据入口；把需用户确认的阅读问题标为待反馈，不冒充业务验收已通过。
- [ ] 7.4 更新实际命令、模块入口、输入／知识维护方法、输出及版本说明；交付可重跑命令、数据缺口、资源记录和原图差异。若 OpenSpec CLI 可用，执行并记录严格验证；未执行则明确写未验证，不将方案任务提前标为完成。

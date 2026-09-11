# KG 风格查询视图方案

日期：2026-09-06。状态：方案，未实现。

## 1. 要解决什么

现有底层能回答细的问题（谁写了哪一列、公式是什么、分区是什么），但默认入口把内部节点摊给使用者。knowledge-graph 的入口更清楚：先问对象，再给上下文、路径、证据和缺口。

本方案做一层**只读查询视图**。它不替代 Facts，也不重写 `data-graph` 的点边。它把已有材料按「任务 / 表 / 列」组织成答案。

金样已经能说明这层必须同时做两件事：

- 入口像 knowledge-graph：问 `pdata_n.t98_otc_deri_comp_sale_info.init_nom_prin`，先看到这列是什么、谁在写、谁在读。
- 细节仍按我们的身份拆开：四个 `grp_id`、三种公式，不能并成一条 `DERIVED_FROM`。

对照阅读见 [value-case-otc-principal.md](../value-case-otc-principal.md)。

## 2. 非目标

- 不修改 `packages/data-graph` 的编译、发布、存储或 CLI。
- 不新建 Neo4j 库，不搬运 knowledge-graph 的构图脚本。
- 不采集新证据，不改 Input Pack / Facts 合同。
- 不把读写端口、候选边、接续索引做成默认返回。
- 不做指标登记、LLM 口径生成、权限网关、语义向量检索。
- 不把调度邻居写成表依赖。
- 不把「491 个 MISSING_PACK」或质检任务强行变成字段投影。

## 3. 从 knowledge-graph 借什么

只借查询组织，不借点边合并。

| 借用                                     | 在本方案中的落点                 |
| ---------------------------------------- | -------------------------------- |
| 先问对象，再给上下文                     | 三个原语：列 / 任务 / 列对照     |
| 答案里同时有结论、实体、路径、证据、缺口 | 统一响应信封                     |
| 上游、影响、分支差异是问题，不是画整张图 | 第一期只做列对照；追溯留到第二期 |
| 不确定就标缺口，不编造成确定             | `gaps[]` 必填，可为空            |

不借：

- 字段节点按「表名+列名」合并后当多跳主路径。
- 用调度 `DEPENDS_ON` 推断 `DATASET_DEPENDS_ON`。
- 过滤 / 连接当成「影响整张表」的间接边，不再区分作用列。
- 用自由文本 `transformOperation` 代替表达式。
- 指标主数据和代码登记口径（我们没有这份主数据）。

## 4. 必须保住的优势

这些信息在默认答案里就要看见，不能只藏在展开开关后面。

1. **写入身份。** 同一张表同一列，按任务、写入观察、静态分区分开列。`grp_id=01/02/03/04` 是四条口径，不是一个列节点上的四个标签。
2. **公式与角色。** 表达式文本、分支选择器、取值分支、已解析的来源物理列、SQL 字符位置。
3. **接续纪律。** 跨任务连接只陈述已确认接续、唯一写入者、或多个候选；候选不写成确认。第一期列上下文只报「有哪些写入者 / 读者」，不跑新的接续引擎。
4. **调度只是线索。** 任务上下文可以带调度邻居，并标明 `scheduleReference`，不得写成「因此读取了某张表」。

目录层可以用 `(表, 列)` 做**搜索键**。搜索键不是证据身份。答案里的每一条加工必须挂到具体 `taskId` + `writeObservationId`（或等价绑定）。

## 5. 放在哪、读什么

文档在 `docs/kg-view/`。以后若写代码，单独目录（例如 `scripts/kg-view/`），只依赖数据根，不改 `packages/data-graph`。

只读：

| 材料                                        | 用途                           |
| ------------------------------------------- | ------------------------------ |
| `field-facts/registry/tasks/<id>/bundle/`   | 绑定、表达式、dataset-io、语句 |
| `sql-static-lineage-data/tasks/`、`tables/` | 任务类型、DDL 注释             |
| 已有任务投影 / batch-manifest               | 覆盖状态、调度邻居（可选）     |

不读、不写 Neo4j。现有图若被别的流程使用，与本视图并行，互不发布。

```text
问「这列什么意思」
        │
        ▼
  kg-view 查询（本方案）
        │
        ├─ 默认层：任务 / 表 / 列 / 分区口径 / 公式摘要 / 读者
        └─ 展开层：表达式角色、SQL 片段、证据文件路径
                │
                ▼
     Facts 包 + Table Pack（已有）
```

`compileCatalogTask` 已有表—列和 `DERIVED_FROM` 的编译实验。本方案**可以参考其身份函数**，但不把它并进 `data-graph` 发布，也不把目录层当成唯一列节点。

## 6. 默认层与展开层

默认层只使用四个对外词：**任务、表、列、加工**。加工一条 = 一次写入（任务 + 分区 + 公式摘要 + 来源列名）。

展开层才出现：`writeObservationId`、表达式角色、SQL span、Input Pack 路径、接续候选。Agent 和人默认只看默认层。

过滤、聚合、粒度若尚未缩到「这一列的路径」，放在加工的 `controls` 里，并在 `gaps` 标明「语句级，未证明只作用于该列」。

## 7. 第一期三个原语

统一信封：

```json
{
  "query": "column_context",
  "input": {},
  "status": "OK",
  "summary": "一句话结论",
  "entities": [],
  "variants": [],
  "evidence": [],
  "gaps": []
}
```

`status`：`OK` | `PARTIAL` | `NOT_FOUND`。有材料但口径不唯一或证据不齐，用 `PARTIAL`，不要用空结果冒充「没有加工」。

### 7.1 `column_context`

输入：`table`（限定名）、`column`。可选 `taskId`、`partition`（如 `grp_id=03`）。

默认返回：

- 表与列的目录身份、DDL 注释（若有）。
- `variants[]`：每个写入者一行。必有 `taskId`、`writeKind`、静态分区、公式摘要、来源列（表.列）、覆盖状态。
- `readers[]`：读过这张表且表达式或 SQL 提到该列的任务；标出是否带分区谓词。未核到列级的表级读者进 `gaps`，不写进确定读者。
- `summary`：是否多口径、是否有人未带分区条件读取。

展开才返回完整 `expression_text`、角色拆解、SQL span。

金样输入：`pdata_n.t98_otc_deri_comp_sale_info` + `init_nom_prin`。  
金样必须出现四条 variant（`86840/01`、`86841/02`、`86842/03`、`220650/04`），且 `86842` 标明不做汇率折算。

### 7.2 `task_context`

输入：`taskId`。

默认返回：任务名、类型、覆盖状态、写出表、读入表、调度邻居（标为 `scheduleReference`）。  
有投影时加：写出列清单（列名 + 一行公式摘要），不摊端口图。

无 Facts 的任务：`status=PARTIAL`，只返回调度上下文和缺口码（`SCHEDULE_ONLY` / `COLLECTION_FAILED` / `MISSING_PACK`）。质检、导出、手工冻结按原覆盖规则陈述，不编造字段加工。

### 7.3 `compare_columns`

输入：两组 `(table, column)`，或同一列下的两个 `taskId` / 分区。

默认返回：相同点、关键差异、能否视为同一口径、待确认项。比较键固定为：来源列集合、公式结构（规范化文本或角色树）、分区、过滤（若已挂到该列）、粒度（若有）。

金样：同一列上比较 `86840` 与 `86842`。结论必须是「不能直接归并」，差异必须点出汇率折算和名义本金选取。

第一期**不做** `trace_upstream` / `trace_downstream` 多跳。列上下文只给直接来源列和直接读者。多跳等金样接口稳定后再加，且跨任务跳只使用已确认接续或唯一写入者，候选单独列出。

## 8. 证据与缺口

`evidence[]` 每条包含：`taskId`、材料种类（`binding` / `expression` / `dataset-io` / `ddl` / `sql-span`）、Facts 或 Pack 的相对路径、可选字符范围。不内嵌整份 SQL。

`gaps[]` 使用稳定码，例如：

| 码                        | 含义                              |
| ------------------------- | --------------------------------- |
| `NO_WRITER_IN_FACTS`      | 本批次 Facts 中没有该列的输出绑定 |
| `READER_TABLE_ONLY`       | 只证明读了表，未核到该列          |
| `CONTROL_STATEMENT_LEVEL` | 过滤/聚合挂在语句上，未缩到该列   |
| `MULTI_WRITER_UNRESOLVED` | 多个写入者，接续未确认            |
| `COVERAGE_NOT_PROJECTED`  | 任务无字段投影                    |
| `FORMULA_UNPARSED`        | 有绑定无表达式节点                |

禁止用调度边填 `NO_WRITER_IN_FACTS`。

## 9. 分期

**P0（本文件夹先写清，实现约 3～5 日）**

- 三个原语的离线查询，输入 Facts 根，输出 JSON。
- 金样：`init_nom_prin` 的 `column_context` 与 `86840` vs `86842` 的 `compare_columns`。
- 固定响应信封和缺口码。

**P1（金样有人用过再做）**

- `search_entities`（任务名、表名、列名）。
- 单跳上游/下游，接续默认确认或唯一写入者。
- 表级 `dataset_context`（读者/写者计数，不做字段摊开）。

**P2（明确需要再做）**

- 独立进程服务或 Agent 工具包装。
- 分支比较的共同上游。仍读文件索引，不强制新图库。

## 10. 验收

P0 通过，当且仅当：

1. 金样 `column_context` 给出四个分区口径，公式与 [value-case-otc-principal.md](../value-case-otc-principal.md) 一致，不合并成一个公式。
2. `compare_columns(86840, 86842)` 结论为不能直接归并，并写出汇率与名义选取差异。
3. `task_context(86842)` 能列出写出表和 `init_nom_prin` 摘要，不要求调用 Neo4j。
4. `git diff packages/data-graph` 为空（本方案实现期间）。
5. 对无 Facts 的质检任务，返回 `PARTIAL` + 覆盖缺口，不伪造列加工。

不作为 P0 验收：全库指纹、乱加工清单、图体积下降、MISSING_PACK 清零。

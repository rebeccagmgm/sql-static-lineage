# 文档索引

## 加工地图与知识库阅读原型（2026-09-06）

- [知识重建讨论要点与推进路径](processing-map/knowledge-reconstruction-discussion.md)：问题、共识、公共分类与字段定义方法、AI 注释和表/视图区分、实际覆盖缺口及后续建议顺序。
- [当前进展与阅读入口](processing-map/README.md)：已完成成果、图/Facts/人工整理的来源分工、9 个视图、验证结果及后续接续点。
- [加工地图 HTML](processing-map.html)：可离线打开的总览、区域下钻、任务集合、四产品公式与固定 SQL。
- [设计思路](processing-map/design.md)：实际加工骨架、阅读层级、并行与横向依赖，以及后续知识积累方式。
- [实现说明](processing-map/implementation.md)：文件职责、取数与打包、校验范围、重建方法和当前限制。

## 业务阅读样例（2026-09-06）

- [整体流向与各层内部加工骨架 V0](processing-skeleton-v0.md)：采集整理、PDATA 并行路线、应用内加工、交付与监控；附 [111 个 schema 盘点](processing-skeleton-inventory.md)。
- [四路合约本金如何汇成一张宽表](value-case-otc-principal.md)：加工地图、宽表解释、初始本金对照、真实下游消费与待确认问题。
- [KG 风格查询视图](kg-view/README.md)：只读查询入口方案，不改 `data-graph`；方案正文 [kg-view/design.md](kg-view/design.md)。

## Titans OTC Agent 查询（2026-09-05）

- [Agent CLI 合同与示例](agent-graph-cli.md)
- [3,615 任务图谱验收](titans-otc-graph-acceptance.md)
- [共享投影与消费方案](titans-otc-graph-reuse-design.md)


## 当前主链（2026-09-03）

| 文档 | 用途 |
| --- | --- |
| [execution-plan-gold-case-investigation.md](execution-plan-gold-case-investigation.md) | **P0 执行规格**：方案、命令链、产物契约、路线图（§0 / §8） |
| [domain-asset-graph-architecture.md](domain-asset-graph-architecture.md) | **架构**：机器单位、三层、两条产品线、端到端数据流 |
| [execution-plan-asset-graph.md](execution-plan-asset-graph.md) | **执行总地图**：WP 状态、里程碑 M0–M3 |
| [value-scenarios-dm-otc-n.md](value-scenarios-dm-otc-n.md) | **价值场景清单**：§1 应用方向（V1–V3）+ §2 架构可行性 + §4 技术能力（A–D），验证与实施顺序 |

| 文档 | 用途 |
| --- | --- |
| [graph-accuracy-architecture.md](graph-accuracy-architecture.md) | WP-6…WP-12 准确性冻结 |
| [graph-user-narrative.md](graph-user-narrative.md) | L0–L3 对用户陈述 |
| [execution-plan-task-local-projection.md](execution-plan-task-local-projection.md) | WP-3 纸条 |
| [execution-plan-task-local-union.md](execution-plan-task-local-union.md) | WP-5 并集 + WP-8 接续 |

### 金样一句话

四锚点 taskId → **`--expand-upstream` 穿透闭包** → 纸条 + **`union-continuation-index.json`** → gaps / L0–L3；HTML 可选。

### 接下来做什么（顺序）

1. 跑 `project-task-local --task-ids … --expand-upstream`（GC-0 步骤 1）
2. 跑 `union-continuation-index`（GC-0 步骤 2）
3. 写 `gold-case-gaps.jsonl` + 分锚点 L0–L3（GC-3）
4. 扩 golden / 一键脚本（GC-4 / GC-2）

细节：**[execution-plan-gold-case-investigation.md §8](execution-plan-gold-case-investigation.md)**。

## L1 主线与采集

| 文档 | 用途 |
| --- | --- |
| [l1-scope-and-architecture.md](l1-scope-and-architecture.md) | L1 边界 |
| [input-pack.md](input-pack.md) | Task/Table Input Pack V1 |
| [input-pack-from-cache.md](input-pack-from-cache.md) | 缓存离线组装 |
| [schedule-evidence-sqlite.md](schedule-evidence-sqlite.md) | Schedule evidence SQLite：备份、同步、relation 边界与主读迁移 |
| [sparkindex-evidence-to-pack/README.md](sparkindex-evidence-to-pack/README.md) | sparkIndex：evidence → Input Pack（两条组装路径；fill/选批不写 pack） |
| [acceptance.md](acceptance.md) | 验收入口 |

## 已暂停 / 实验性

| 文档 | 用途 |
| --- | --- |
| [experimental/README.md](experimental/README.md) | 暂停工作说明 |
| [experimental/execution-plan-closure-on-union.md](experimental/execution-plan-closure-on-union.md) | WP-10 闭包接并集（已暂停） |

旧路径 `docs/execution-plan-closure-on-union.md` 仅保留重定向桩。

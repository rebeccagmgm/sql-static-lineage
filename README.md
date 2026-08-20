# SQL Static Lineage L1

这是一个独立、只读、证据约束的 SQL Static Lineage L1 主线。它只回答本地 SQL 与声明的 Schema/View snapshot 能证明什么，不执行 SQL、不触发调度、不读取业务数据行，也不把 Consumer 的推断写回 Canonical Machine Facts。

## 当前结论

- 整理状态：`COMPLETE`。新目录已经有单一 L1 scope、架构、迁移清单和验收入口。
- 代码迁移状态：`BASELINE_MIGRATED`。已迁移 parser/analyzer engine、P0 写入绑定基线、Schema/Plan adapter 和 Task Inspection Consumer。
- 算法验收状态：`PENDING`。当前迁移代码仍产生 Contract `1.3.0`；Reader 会把它标为 `LEGACY_NOT_L1`。这不是 Contract 2.0，也不是 86840 的闭合结论。

唯一主线和边界见：

- [L1 scope 与架构](docs/l1-scope-and-architecture.md)
- [迁移清单与来源证据](docs/migration-inventory.md)
- [验收入口与 Gate](docs/acceptance.md)
- [86840 Gold Case 入口](tests/gold/README.md)

## 最小运行入口

在本目录安装依赖后：

```text
npm test
npm run typecheck
npm run inspect -- --facts-root <current-facts-root> --task-id 86840 --question-spec <question.json> --output <derived-output>
```

`inspect` 只读 Current Index 选中的 Bundle，并输出 `task-inspection.json` 与 `index.html`。它不扫描任务目录、不重新解析 SQL、不使用 Profile 猜测字段。

## 目录边界

```text
src/                         parser/analyzer engine snapshot
scripts/plans/               engine -> L1 observation adapter
scripts/machine-facts/       per-task fact assembly and publication
scripts/query/               validated Current Bundle loader and Reader
schemas/                     current baseline schemas; Contract 2.0 remains pending
tests/                       focused regression tests; no generated corpus
tests/gold/                  86840 acceptance entry; evidence is intentionally absent
docs/                        scope, migration, acceptance and review records
```

不要在这里加入 Panorama、下游任务发现、业务语义、LLM/Wiki、复杂 Hop/Projection、数据库服务或历史生成数据。任何新增能力必须先证明它服务于 L1 的字段闭合或受证据约束的消费入口。

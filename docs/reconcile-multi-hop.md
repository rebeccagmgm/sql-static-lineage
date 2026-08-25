# 表级多跳数据路径

`reconcile-multi-hop` 从一个调度 `taskId` 出发，离线展开：

```text
当前 Task --READ--> Table <--WRITE-- producer Task
```

递归节点始终是 Task，Table 只是任务间的数据桥梁。遍历只消费经过校验的 Task/Table Input Pack V1 和 `TABLE_PRODUCER_INDEX` confirmed edge；不调用 Horae、SZData/OpenCLI，不把任务名、候选顺序或 UNKNOWN 关系升级成 producer。

命令默认加载 `config/multi-hop-terminal-table-rules.json`。配置命中的表会记录为 `REFERENCE_CONFIG` terminal，并且不会查询其 confirmed producer；也可用 `--terminal-table-config <path>` 显式指定另一份 JSON 配置。该配置只控制多跳递归边界，不改变 Input Pack 或静态 SQL 血缘产物。

## 运行

```text
npm run reconcile-multi-hop -- \
  --task-id <root-task-id> \
  --data-root <input-pack-root> \
  --producer-index <producer-index.json> \
  --max-depth 3 \
  --max-tasks 100 \
  --max-edges 500 \
  [--root-one-hop <frozen-one-hop.json>] \
  [--terminal-table-config <terminal-table-rules.json>] \
  [--output <multi-hop.json>]
```

多个根任务可以使用批量入口，避免每个根任务重复扫描整套 Task/Table Pack：

```text
npm run reconcile-multi-hop:batch -- \
  --task-ids <task-id-1,task-id-2,...> \
  --data-root <input-pack-root> \
  --producer-index <producer-index.json> \
  --output-dir <result-dir> \
  [--root-one-hop-dir <one-hop-result-dir>] \
  [--max-depth 3] [--max-tasks 100] [--max-edges 500]
```

`--root-one-hop-dir` 中可放置 `reconcile-<taskId>.json` 或 `<taskId>.json`。批量入口只建立一次 evidence repository，开始时校验并在结束时复核 `inputFingerprint`，然后复用给所有根任务；批次运行期间不要修改 `tasks/` 或 `tables/`。

启动时会校验 producer index 的结构、`contentHash` 和当前 Input Pack 的 `inputFingerprint`。显式索引失效或陈旧时直接失败，不回退到实时补证。`PARTIAL` 索引可以消费其中 confirmed edge，但结果标为 `PARTIAL_EVIDENCE`。

## 遍历与预算

- 排序 BFS 保证 Task 的 `minDepth`；root depth 为 0，`maxDepth` 表示 producer Task 跳数。
- `maxTasks` 统计去重 Task node，包含 root 和尚未展开的终止节点。
- `maxEdges` 统计唯一 READ edge 与 WRITE edge；producer bridge 单独计数。
- 同一表可以有多个 confirmed producer，全部保留，不收敛成“唯一最佳”任务。
- 菱形路径保留每条 bridge，但共享 Task 只展开一次；真实回边标为 `CYCLE`。
- 达到边界时通过 `limits.truncationReason` 和 terminal 留证，不静默丢弃。

## SQL 与 identity 门槛

Task READ 仓库在启动时一次建立严格 Task/Table catalog，随后按 Task 懒解析 SQL。Task Pack、SQL、Table Pack、DDL 任一 hash 失败均 fail closed 到对应分支。

- 裸表名仅在 Task Pack 的限定任务名可证明默认 schema 且未与限定 target 冲突时继承该 schema；证据缺失或冲突时保持 `QUALIFIED_NAME_ONLY`。
- SQL syntax diagnostic 会阻断该 statement，reason 为 `SQL_PARSE_FAILED`。
- parser 的 `body` / `branches` topology unknown 会阻断该 statement。
- `native_lineage` / `output_columns` 属于字段层缺口，不阻断表级 READ。
- 多语句任务逐 statement 隔离；坏 statement 不污染同表或其他表的干净 statement。
- READ 只有唯一解析到 `(platform,dataSource,qualifiedName)`，且 `dataSource != default`，才可查询 producer。

## 调度骨架边界

可选 `rootOneHop` 只是冻结的 root depth=1 调度快照，输出在 `scheduleSkeleton`，边界固定为 `ROOT_DEPTH_1_ONLY`。它不参与 data frontier，也不会把 schedule-only parent 猜成 producer。

## 输出与 counts

artifact 保存 `taskNodes`、`tableNodes`、`readEdges`、`writeEdges`、`producerBridges`、`terminals`、覆盖率和 provenance。`countSemantics=NODE_AND_UNIQUE_EDGE_COUNTS`：counts 是去重节点/边观察计数，不是物理表全覆盖率，也不证明调度执行、数据到达或业务正确性。

86840 冻结 gate 在 depth=1 保持 27 个 READ、22 个本地 confirmed producer；仅来自实时 supplemental evidence 的 4 个父任务不进入离线 frontier，`pdata_n.ref_dw_cd_val` 保持无 confirmed producer 的 terminal。

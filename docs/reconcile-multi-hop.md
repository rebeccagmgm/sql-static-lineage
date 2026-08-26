# 表级多跳数据路径

`reconcile-multi-hop` 从一个调度 `taskId` 出发，离线展开：

```text
当前 Task --READ--> Table <--WRITE-- producer Task
```

递归节点始终是 Task，Table 只是任务间的数据桥梁。每个 Task 先执行/消费一次
one-hop reconciliation；BFS 下一层只取该结果的
`finalUpstreamTaskIds.primary`。`additional` 作为当前层的保留证据但不再展开，
`partitionAwareNextDataTaskIds.unknown` 永不进入 frontier。遍历仍只消费经过校验的
Task/Table Input Pack V1 和 `TABLE_PRODUCER_INDEX` confirmed edge；producer index
只提供 Table READ/WRITE bridge 证据，不重新决定递归集合。

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

### 在线补采缺失 producer Task Pack

离线 Input Pack 不完整、而表详情可能提供关联调度任务时，使用 autofill 外层编排：

```text
npm run reconcile-multi-hop:autofill -- \
  --task-id <root-task-id> \
  --data-root <input-pack-root> \
  --producer-index <producer-index.json> \
  --max-depth 3 --max-tasks 100 --max-edges 500 \
  --output <multi-hop.json> \
  --report <autofill-report.json> \
  [--trust-existing-index]
```

每轮先冻结访问到的 one-hop Horae 结果；对“SQL 已确认 READ、producer index 尚无
confirmed WRITE、且不属于终止配置”的表，查询表详情并把其中 Task ID 仅作为 Input
Pack 补采候选。候选 Pack 采集后，每轮只更新一次 producer index。任务只有在其 SQL
WRITE 被新索引确认后才成为 Table bridge；表详情中的 Task ID 本身不是 producer 证据。

下一轮仍只沿各 Task 的 `finalUpstreamTaskIds.primary` 前进。表详情发现但不属于 Horae
直接父任务的生产者会保留在 `additional`，作为未展开 Task 节点和 Table bridge 展示，
不会调用其 Horae 上游。发现失败、限流重试耗尽或补采后 Pack 仍不可用会写入 report，
状态为 `PARTIAL`，不会冒充完整结果。默认表查询最多重试 3 次，OpenCLI 单次调用限制
30 秒，并由 `maxRounds`、`maxDiscoveryTables`、`maxDiscoveredTasks` 控制外部补采规模。

默认启动时严格计算当前 Input Pack fingerprint 并更新 index。只有调用方能保证
`data-root` 是运行期间不可变的冻结快照时，才可显式传 `--trust-existing-index`，跳过
启动阶段的全文件 hash，复用已通过结构/hash 校验且与 manifest fingerprint 一致的
现有 index；一旦本次补采写入任何 Task Pack，后续仍强制增量更新 index。report 的
`initialIndexMode` 会保留这一证据边界。

默认入口带有明确的 V8 old-space 边界：单根 384 MiB、批量 512 MiB。
`bounded` 是同一配置的显式别名。内存充足且更关注吞吐时，可选择不设上限的
`throughput` 入口：

```text
npm run reconcile-multi-hop:bounded -- <与单根入口相同的参数>
npm run reconcile-multi-hop:batch:bounded -- <与批量入口相同的参数>
npm run reconcile-multi-hop:throughput -- <与单根入口相同的参数>
npm run reconcile-multi-hop:batch:throughput -- <与批量入口相同的参数>
```

批量入口按唯一访问 Task 复用解析结果和按需 DDL Schema，不会为每个 root
重新建立全量上下文。bounded/default 会增加 GC CPU，但复杂样本默认不会任由 V8
堆持续膨胀；`throughput` 只适用于调用方已提供外部内存隔离的场景。

## 可视化

已生成的 multi-hop JSON 可以按调度 ID 转成离线 HTML 图：

```text
npm run visualize-multi-hop -- \\
  --task-id 181058 \\
  --artifact-dir <multi-hop-output-dir> \\
  --output <lineage.html>
```

命令会先生成同目录的 `viz-model-181058.json`，再由模板渲染 HTML；也可以显式指定
`--viz-model <viz-model.json>`。viz model 是展示层模型，不改变原始 multi-hop artifact。

也可以直接传单个 JSON：

```text
npm run visualize-multi-hop -- \\
  --task-id 181058 \\
  --artifact <reconcile-multi-181058.json>
```

页面按实际上游到目标方向排列 Task；同一物理表对应多个 producer Task 时合并为一个
血缘节点，卡内同时展示表名、关联 Task ID 和可证明的 WRITE 分区。ODATA 表仍逐表
展示；方向由从左到右的连线和箭头表达，不再把 READ/WRITE 技术计数或原始 evidence
JSON 塞进卡片。该命令只读取已生成 artifact，不重新解析 SQL，也不调用 Horae。

启动时会校验 producer index 的结构、`contentHash` 和当前 Input Pack 的 `inputFingerprint`。显式索引失效或陈旧时直接失败，不回退到实时补证。`PARTIAL` 索引可以消费其中 confirmed edge，但结果标为 `PARTIAL_EVIDENCE`。

## 遍历与预算

- 排序 BFS 保证 Task 的 `minDepth`；root depth 为 0，`maxDepth` 表示 producer Task 跳数。
- `maxTasks` 统计去重 Task node，包含 root 和尚未展开的终止节点。
- `maxEdges` 统计唯一 READ edge 与 WRITE edge；producer bridge 单独计数。
- 同一表可以有多个 confirmed producer，全部保留，不收敛成“唯一最佳”任务。
- 菱形路径保留每条 bridge，但共享 Task 只展开一次；真实回边标为 `CYCLE`。
- 达到边界时通过 `limits.truncationReason` 和 terminal 留证，不静默丢弃。

## SQL 与 identity 门槛

Task READ 仓库启动时只建立 Task/Table 元数据索引；Task SQL 只在 BFS 实际访问该
Task 时读取、校验和解析，解析完成后不保留 SQL 正文。one-hop 的 DDL Schema 也只为
当前 Task 涉及的表加载，并按表复用。全量 Task/Table Pack 的有效/无效计数和问题来自
已校验且 fingerprint 一致的 producer index；访问分支上的 Task Pack、SQL 或 DDL hash
失败仍 fail closed 到对应分支。

- 裸表名仅在 Task Pack 的限定任务名可证明默认 schema 且未与限定 target 冲突时继承该 schema；证据缺失或冲突时保持 `QUALIFIED_NAME_ONLY`。
- SQL syntax diagnostic 会阻断该 statement，reason 为 `SQL_PARSE_FAILED`。
- parser 的 `body` / `branches` topology unknown 会阻断该 statement。
- `native_lineage` / `output_columns` 属于字段层缺口，不阻断表级 READ。
- 多语句任务逐 statement 隔离；坏 statement 不污染同表或其他表的干净 statement。
- READ 只有唯一解析到 `(platform,dataSource,qualifiedName)`，且 `dataSource != default`，才可查询 producer。

## 调度骨架边界

可选 `rootOneHop` 是冻结的 root one-hop 证据快照，并参与 root 的
`finalUpstreamTaskIds.primary` 选择。没有提供后续 Task 的 one-hop 快照时，multi-hop
以显式离线空调度输入调用 one-hop：不会调用默认 Horae runner，此时 one-hop 只能在
有足够 producer-index 证据时走 `DATA_FALLBACK`。有 scheduler primary 但没有
Table WRITE bridge 的任务会通过 `scheduleEdges` 保留调度来源和 evidence，不会伪造
Table bridge。

`scheduleSkeleton` 仍只保存 root depth=1 的兼容性投影；各层 one-hop 的调度来源在
Task node 的 `upstreamDecision.evidence` 和 `scheduleEdges` 中保留。

## 输出与 counts

artifact 保存 `taskNodes`、`tableNodes`、`readEdges`、`writeEdges`、`producerBridges`、
`scheduleEdges`、`terminals`、覆盖率和 provenance。`countSemantics=NODE_AND_UNIQUE_EDGE_COUNTS`：
counts 是去重节点/边观察计数，不是物理表全覆盖率，也不证明调度执行、数据到达或业务正确性。

86840 冻结 gate 在 depth=1 保持 27 个 READ、22 个本地 confirmed producer；仅来自实时 supplemental evidence 的 4 个父任务不进入离线 frontier，`pdata_n.ref_dw_cd_val` 保持无 confirmed producer 的 terminal。

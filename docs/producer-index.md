# Table producer 反向索引

Table producer index 是从 Task/Table Input Pack V1 完全重建的离线派生产物，用于回答：

```text
(platform, dataSource, qualifiedName) -> confirmed producer Task[]
```

它不是 Input Pack 资产、调度关系缓存或运行实例索引。构建和查询都不调用 Horae、SZData 或其他实时平台。

## 构建

```text
npm run producer-index -- --data-root <input-pack-root> [--output <producer-index.json>]
```

输出文件必须位于 Input Pack 根目录之外。未传 `--output` 时只写标准输出。

V1 的 `producer-index` 命令仍是显式全量重建。`inputFingerprint` 来自排序后的相对输入路径及实际内容哈希；`contentHash` 覆盖除 `generatedAt` 和自身以外的完整语义内容。数组使用固定 code-unit 顺序，绝对根路径不进入 artifact。

## 持续更新（快照复用 + 变化检测）

对批量任务使用独立的更新命令，并让所有对账任务复用同一个索引快照：

```text
npm run producer-index:update -- --data-root <input-pack-root> \
  --output <producer-index.json> [--manifest <producer-index.manifest.json>]
```

命令在索引文件旁生成一个独立的 `TABLE_PRODUCER_INPUT_MANIFEST`。manifest 保存本次 Input Pack 的 `inputFingerprint`、Task/Table Pack 输入摘要和单调递增的 `generation`：

- 输入未变化且旧索引、manifest 均可验证时，直接复用旧索引，不重新解析 SQL；
- 首次运行或发现新增、修改、删除 Pack 时，安全回退到一次全量重建，并递增 generation；
- 索引和 manifest 都通过临时文件校验后原子发布，旧文件损坏时不静默沿用；
- `changedPacks` 只用于审计和调度判断，不把候选关系升级为 confirmed producer。

当前这是“快照复用 + 变化检测”，不是 Task/Table 级增量重算：发生变化时仍会全量重建。manifest 本身仍需读取并校验当前 Input Pack，因而它不能消除首次扫描成本；它避免的是稳定快照反复解析全部 SQL。定期全量校验和真正的按 Pack 增量合并尚未实现。

## Confirmed producer 门槛

confirmed edge 的逻辑键为：

```text
platform + dataSource + qualifiedName + taskId
```

必须同时满足：

1. WRITE 方向来自 `DIRECT_PLATFORM_TARGET`、`SQL_EXACT_TABLE_TARGET` 或显式的 qualified SQL `INSERT OVERWRITE / INSERT INTO / MERGE INTO / CTAS`。
2. 表身份唯一绑定到有效 Table Pack；`dataSource=default` 不算已解析身份。
3. Task Pack、SQL 文件、Table Pack 和 DDL 文件通过现有 hash 校验。

普通 `FROM/JOIN`、任务名、候选顺序和分区值不能生成 producer edge。

同一表允许多个 producer Task。同一 Task 对同一表的多次 WRITE 收在该 edge 的 `writes[]` 中，每条 observation 分别保留 direct target 或 SQL write 类型、声明写模式、SQL write kind、分区和 provenance，不选择“最像”的一条。

## Non-confirmed relations

方向未知、表身份缺失或多义、输入损坏等观察保存在 `nonConfirmedRelations`，不进入 confirmed 查询。`directionStatus` 与 `tableRef.identityStatus` 正交：显式 SQL WRITE 即使缺少唯一物理身份，方向仍为 `WRITE_CONFIRMED`；候选 target 则保持 `UNKNOWN`。

- `TABLE_TASK_RELATION_DIRECTION_UNKNOWN` 即使包含完整三元组也仍是 UNKNOWN。
- qualified SQL WRITE 找不到唯一 Table Pack 时保留为未确认观察，不静默丢弃。
- `dataSource=default` 是未解析占位值，不能显示为 `identityStatus=RESOLVED`。
- 坏 Input Pack 只隔离对应输入；artifact 标为 `PARTIAL`，其他有效 producer edge 仍可使用。

递归代码只能调用 `lookupConfirmedProducers()`。人工复核和覆盖率统计可单独调用 `lookupNonConfirmedRelations()`，不能把两者混合后再选择候选。

## 分区与证据边界

分区只属于 Task-to-Table WRITE observation，不参与物理表 identity。`${...}`、`{{...}}` 等表达式保持 `RUNTIME_EXPRESSION`；采集到的具体值仅为 `OBSERVED_RENDERED_VALUE`。

`SUCCESS` 只表示本次发现的输入均成功处理；`PARTIAL` 表示至少一个 Task/Table/SQL/DDL 输入无效。二者的覆盖语义始终是 `OBSERVED_EVIDENCE_ONLY`，都不证明 producer 全覆盖、调度执行、数据到达或业务正确性。

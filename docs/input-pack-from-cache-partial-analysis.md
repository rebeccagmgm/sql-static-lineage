# 离线 from-cache 全量：PARTIAL 深入分析

> 数据来源：`sql-static-lineage-data/tmp/from-cache-full/logs/summaries.jsonl`  
> 批次：`need-create` **11642** 条写入正式根（无 `--force`）  
> 生成时间：2026-09-02  
> 机器可读明细：`tmp/from-cache-full/partial-analysis/`

## 1. 结论摘要

| 本轮状态 | 数量 | 含义 |
| --- | ---: | --- |
| SUCCESS | 3195 | 任务 + 表证据齐，可当完整 Pack |
| **PARTIAL** | **8209** | **Pack 已落盘**，但按契约标「不完整」 |
| FAILED | 238 | 校验失败，未形成合法 Pack |

PARTIAL **不是失败、也不是没写盘**。判定来自
`inputCollectionStatus`（`scripts/input/shared/task-endpoints.ts`）：

```text
PARTIAL ← 任一为真：
  · 候选表解析结果条数为 0
  · 存在未解析表（tablesUnavailable）
  · missingQuery（组装后没有 sql.query）
  · （本路径未启用）端点冲突 / 引用不可用
```

---

## 2. PARTIAL 三大桶（互斥）

| 桶 | 数量 | 占比 | 说明 |
| --- | ---: | ---: | --- |
| **A. 表目录缺口** | **6652** | 81.0% | 有 `warnings` / `tablesUnavailable` |
| **B. 空 SQL 身份包** | **1523** | 18.6% | 无表警告，磁盘 `sqlFiles: []` |
| **C. 有 SQL 但缺 query** | **34** | 0.4% | 多仅有 `truncate`，`missingQuery=true` |

### 2.1 A — 表目录缺口（主因）

离线 Table 解析对不上 jsonl 目录。警告码（一条任务可多码，故次数 > 任务数）：

| 警告码 | 出现次数 | 涉及任务数（约） | 含义 |
| --- | ---: | ---: | --- |
| `HIVE_DDL_MISS` | 5472 | 4162 | Hive DDL jsonl 无该表 |
| `RDBMS_CORE_AMBIGUOUS` | 3355 | 3314 | RDBMS 核心 jsonl 同名多行，拒绝对账 |
| `TABLE_JSONL_MISS` | 2196 | 1766 | 元数据/核心均找不到 |
| `HIVE_DDL_AMBIGUOUS` | 74 | — | Hive DDL 多行歧义 |
| `RDBMS_DDL_MISS` | 41 | — | 有核心无 DDL |
| `SQL_CREATE_CONFLICT` | 1 | — | 任务 CREATE 与目录冲突 |

**按类型（表缺口 PARTIAL）**

| taskCategory | 数量 | 主导警告 |
| --- | ---: | --- |
| oracle2hive | 2655 | RDBMS_CORE_AMBIGUOUS → TABLE_JSONL_MISS → HIVE_DDL_MISS |
| hiveTask | 1007 | HIVE_DDL_MISS |
| mysql2hive | 742 | HIVE_DDL_MISS → RDBMS_CORE_AMBIGUOUS |
| sparkIndex | 681 | HIVE_DDL_MISS（次要 HIVE_DDL_AMBIGUOUS） |
| hiveTask-2.0 | 419 | HIVE_DDL_MISS |
| postgre2hive | 315 | HIVE_DDL_MISS / RDBMS_CORE_AMBIGUOUS |
| hive2oracle | 206 | TABLE_JSONL_MISS / RDBMS_CORE_AMBIGUOUS |
| hive2mysql | 163 | RDBMS_CORE_AMBIGUOUS |
| hive2postgre | 134 | 同上 |
| qualityTask | 117 | TABLE_JSONL_MISS |
| hive2starrocks | 87 | RDBMS_CORE_AMBIGUOUS |
| 其他 | … | 见 `partial-stats.json` |

典型例：`oracle2hive/68` — 有 `query.sql` 与 target，但源表
`HS_OPT.COVERSTOCKJOUR` 歧义、Hive 镜像 `odata_ygt.…` miss、数据源标签
`oracle_rbjygl_85.236` miss → `tablesWritten: 0` → PARTIAL。

**高频未解析名（截前 15）**

| qualifiedName | 次数 | 备注 |
| --- | ---: | --- |
| PDATA_N.IF | 313 | 伪表/解析噪声嫌疑 |
| oracle_rbjygl_85.236 | 181 | 数据源标签被当成表名 |
| pdata_news_n.t02_co_cncpt_tags | 91 | Hive DDL miss |
| oracle_wande_89.132 | 69 | 数据源标签 |
| pdata_n.t98_cust_lbl_info | 48 | Hive DDL miss |
| … | | 完整榜见 `partial-analysis/partial-stats.json` |

→ **压 PARTIAL 的主杠杆**：补 Hive DDL 覆盖、消 RDBMS 核心歧义、避免把
`oracle_*_x.y` 数据源标签当表候选。

### 2.2 B — 空 SQL 身份包（次因）

无表警告，但 Pack 只有调度身份，`sqlFiles: []`，`tablesWritten: 0`。
因 `tableResultCount===0` 或 `missingQuery` 进 PARTIAL。

| taskCategory | 数量 | 说明 |
| --- | ---: | --- |
| hiveTask-2.0 | 678 | 抽样看缓存也无 `hive-task.sql` |
| hiveTask | 286 | 同上 |
| exeSql | 216 | 无 SQL 槽属预期偏身份 |
| checkdbflag | 131 | 校验类，常无业务 SQL |
| checkHdfsFlag | 115 | 同上 |
| sparkScript | 23 | log 无 `待执行sql为`，抽不到（已放弃强补） |
| runScript / runScript-2.0 | 12+9 | 缺可用 `run-script.sql` 或 UNAVAILABLE |
| mongo2hive / file2hive / hiveEmail / alert 等 | 余量 | 身份或通道配置，无 query |

缓存线索：空 SQL 的 hiveTask 样本里 **看不到 `hive-task.sql`**；
`cacheArtifacts` 常只有 `szdata-schedule-detail.json`（± horae-task-type）。

→ 与「表 jsonl」无关；要减这批需补 hive-task / run-script 缓存，或接受
校验类/脚本类身份 Pack。

### 2.3 C — 有 SQL 但缺 query（34）

多数 `hive2*`：**只有 `truncate`，没有 `query`** → 组装 `missingQuery=true`
→ PARTIAL。目标表往往已写出（`tablesWritten: 1`），警告为空。

例：`hive2oracle/6456` — `sqlFiles: [truncate]`，target
`GFVAL.SRC_NYGT_HIS_PRICE` 已落，仍 PARTIAL。

→ 与 Horae/`hive.sql` 补全相关；query 补上且表齐后可变 SUCCESS（需 `--force`
重写已有 Pack）。

---

## 3. 全量 PARTIAL 类型分布（8209）

| taskCategory | PARTIAL | 其中表缺口 | 其中空 SQL |
| --- | ---: | ---: | ---: |
| oracle2hive | 2655 | 2655 | 0 |
| hiveTask | 1299 | 1007 | 286 |
| hiveTask-2.0 | 1101 | 419 | 678 |
| mysql2hive | 742 | 742 | 0 |
| sparkIndex | 681 | 681 | 0 |
| postgre2hive | 315 | 315 | 0 |
| hive2oracle | 228 | 206 | 6 |
| exeSql | 216 | 0 | 216 |
| hive2mysql | 168 | 163 | 3 |
| hive2postgre | 140 | 134 | 1 |
| checkdbflag | 137 | 6 | 131 |
| qualityTask | 117 | 117 | 0 |
| checkHdfsFlag | 115 | 0 | 115 |
| hive2starrocks | 87 | 87 | 0 |
| mongo2hive | 68 | 51 | 17 |
| file2hive | 37 | 23 | 14 |
| hive2file | 29 | 29 | 0 |
| sparkScript | 23 | 0 | 23 |
| runScript | 12 | 0 | 12 |
| 其余 | … | | |

---

## 4. `tablesWritten` 分布（PARTIAL）

| tablesWritten | 任务数 | 解读 |
| --- | ---: | --- |
| 0 | 4427 | 表全没解析上，或根本无表候选 |
| 1–3 | 3015 | 写出部分表，仍有 miss / 或缺 query |
| 4–10 | 662 | 多表任务部分缺口 |
| 11+ | 105 | 大 SQL，个别表 miss 即 PARTIAL |

---

## 5. 与 SUCCESS / FAILED 对照

- **SUCCESS 3195**：同批里表解析全中且存在 `sql.query`（及契约其余条件）。
- **FAILED 238**（未入 PARTIAL）：
  - ~231：`SQL_EXACT_TABLE_TARGET` 需要 SQL 目标 + Table evidence
  - ~5：需要 physical target
  - ~2：`partition.src_tbl` 空串  
  清单近似：`tmp/from-cache-full/diff/need-create.txt`（事后 diff 剩余 238）。

---

## 6. 建议优先级（若要降 PARTIAL）

1. **Hive DDL 覆盖**（影响 hiveTask / sparkIndex / mysql2hive / 大量 HIVE_DDL_MISS）
2. **RDBMS 核心消歧**（oracle2hive / hive2mysql 等 AMBIGUOUS）
3. **候选过滤**：数据源标签（`oracle_*_x.y`）、`PDATA_N.IF` 类噪声
4. **SQL 缓存**：缺 `hive-task.sql` 的 hiveTask；`hive2*` 缺 query  
5. **可接受 PARTIAL**：check* / exeSql / sparkScript（log 无 SQL）— 不必强追 SUCCESS

---

---

## 8. 专题：`oracle2hive` PARTIAL（2655）

> 机器明细：`tmp/from-cache-full/partial-analysis/oracle2hive-breakdown.json`

### 8.1 先结论

这批 **全部有 `sql.query`**（2655/2655），不是缺 SQL。  
PARTIAL 几乎都是 **表候选解析失败**——每个任务通常同时带着 **3 类候选**：

| 候选从哪来 | 形态举例 | 常见失败码 |
| --- | --- | --- |
| `task.source` | `oracle_rbjygl_85.236` | `TABLE_JSONL_MISS`（本就不是表） |
| SQL `FROM`/`JOIN` | `HS_OPT.COVERSTOCKJOUR` / `CRMII.…` | **`RDBMS_CORE_AMBIGUOUS`** |
| `task.target`（Hive） | `odata_ygt.nygt_t_coverstockjour` | `HIVE_DDL_MISS` 或 `TABLE_JSONL_MISS` |

契约：任一候选 `unavailable` → 整任务 PARTIAL。  
所以常见「三重奏」警告并不表示三件事同等重要——**真正卡死 Oracle 源表的是 AMBIGUOUS**；另外两项经常是标签噪声 + Hive 目标缺 DDL。

### 8.2 任务级警告组合

| 组合 | 任务数 | 解读 |
| --- | ---: | --- |
| `HIVE_DDL_MISS` + `RDBMS_CORE_AMBIGUOUS` | 988 | Oracle 源歧义 + Hive 目标有元数据无 DDL |
| `RDBMS_CORE_AMBIGUOUS` + `TABLE_JSONL_MISS` | 818 | Oracle 源歧义 + 标签/镜像完全 miss |
| **仅** `RDBMS_CORE_AMBIGUOUS` | 427 | 只卡在源表歧义（目标可能已写出） |
| 仅 `HIVE_DDL_MISS` | 205 | 源已解析或未抽到 Oracle 名，卡在 Hive |
| 仅 `TABLE_JSONL_MISS` | 124 | 多是标签 / 冷门名 |
| 三码齐全 | 40 | 三重奏完整版 |
| 其它（含少量 `RDBMS_DDL_MISS`） | 余量 | |

触及码的任务数（可重叠）：

- `RDBMS_CORE_AMBIGUOUS`：**2273**（85.6%）
- `HIVE_DDL_MISS`：1276（48.1%）
- `TABLE_JSONL_MISS`：1016（38.3%）
- `RDBMS_DDL_MISS`：22

`tablesWritten`：0 的 1903；≥1 的 752（部分表写出仍因其它候选 fail 而 PARTIAL）。

### 8.3 三条失败码分别是什么

解析顺序见 `resolveOne`（`offline-table-resolver.ts`）：先本地 Pack → Hive DDL/元数据 →（关系型才）RDBMS core+DDL → 否则 `TABLE_JSONL_MISS`。

#### A. `RDBMS_CORE_AMBIGUOUS`（主因）

- **对象**：Oracle `SCHEMA.TABLE`（如 `HS_USER.*`、`HS_ASSET.*`、`CRMII.*`）。
- **原因**：`gf_rdbms_table_core_restored.jsonl` 按 `schema.table` 建索引时，**同名表在多套库/多实例重复**，索引标成 `AMBIGUOUS`，解析器 fail-closed，不猜哪一行。
- 索引现状：`ambiguousKeys` **约 23.4 万**；其中 `hs_*` 约 2.9 万、`crmii.*` 约 0.8 万。例：`hs_user.stkcode`、`hs_opt.coverstockjour`、`crmii.tapp_channeltype` 均在歧义集中。
- 警告里大小写混用（`HS_USER.STKCODE` vs `hs_asset.client`）是候选原文；查找已 lower-case。

**名称形态（按警告次数）**：`ORACLE_SCHEMA.TABLE` ~1209 + 其它 dotted ~1098（多为小写 schema.table）。

#### B. `TABLE_JSONL_MISS`

两类占绝大多数：

1. **数据源标签当表**（~368 次）：`oracle_rbjygl_85.236`、`oracle_wande_89.132`、`oracle_jgj_69.202`…  
   来自 `task.source`（平台数据源 ID），`extractOfflineTableCandidates` 对 `source` 也 `add()`，被当成 `qualifiedName`。
2. **Hive 镜像名完全不在目录**（`odata_*` ~898 次）：元数据 + DDL 都没有，落到最终 `TABLE_JSONL_MISS`。

真正缺 Oracle 物理表且 core 也没有的很少（`ORACLE_SCHEMA.TABLE` miss 仅约 24 次）。

#### C. `HIVE_DDL_MISS`

- **对象**：几乎都是 Hive 目标 / 镜像：`odata_ygt.*`、`odata_jgj.*`、`odata_n_*`、`gf_dcp.*`。
- **含义**：Hive **元数据能命中**（或走到 Hive 分支），但 **DDL jsonl 无可用 `querytext`**，又没有任务侧 CREATE 可兜底 → 不能落 Table Pack。
- 与 AMBIGUOUS 常成对：源表 Oracle 歧义、目标表 Hive 缺 DDL。

### 8.4 典型任务解剖：`68`

```text
source  = oracle_rbjygl_85.236          → TABLE_JSONL_MISS（标签）
target  = odata_ygt.nygt_t_coverstockjour → TABLE_JSONL_MISS（或同类 Hive 缺口）
SQL 读  = HS_OPT.COVERSTOCKJOUR         → RDBMS_CORE_AMBIGUOUS
sqlSlots = [query]  ✓
tablesWritten = 0
→ PARTIAL
```

同一模式贯穿 `oracle2hive` 大头（柜台 HS_* / CRMII + odata_* 镜像 + oracle_* 数据源）。

### 8.5 若要降这 2655，建议顺序

1. **候选过滤（收益最大、改动局部）** — **已改**  
   - `*2hive` 不再把 `source` 数据源标签（如 `oracle_rbjygl_85.236`）当表候选。  
   - 见 `extractOfflineTableCandidates` + `isDatabaseSourceToHiveTask`。  
   - 已落盘的 PARTIAL Pack 需 `--force` 重跑才会刷新 warnings。
2. **RDBMS 消歧（真正解锁源表 Pack）** — **已改**  
   - `*2hive` 用 `horae-datasource`：`server_tag` → `service` → 优先查  
     `schema.table@gforacle_<service>#<service>`，避免裸 `schema.table` 的 AMBIGUOUS。  
   - 例：`oracle_rbjygl_85.236` + `HS_OPT.COVERSTOCKJOUR` →  
     `…@gforacle_jyglrac#jyglrac`。  
   - 已落盘 Pack 需 `--force` 重跑才会换掉旧 warnings / 补 Table Pack。
3. **补 Hive DDL（走 Horae 运行日志）** — **已落脚本**  
   - `*2hive` 目标常不在 Hive DDL jsonl，但日志里有 AnyLoader  
     `Process hive ddl:` → `CREATE EXTERNAL TABLE …`。  
   - 清单从 collect `summaries.jsonl` 取桶 `ONLY_HIVE_TARGET_GAP`  
     （`partial-gap-from-summaries.ts`）。  
   - 填充：`npm run input-pack:fill-hive-ddl-from-log -- --from-summaries <summaries.jsonl>`  
     → 缓存 `tasks/<id>/hive-target-ddl.sql` → 离线组装进 `sql.create`。  
   - 再 `--force` 跑 `input-pack:from-cache` 才能把 Table Pack 写进正式根。

### 8.7 消歧后剩余 PARTIAL（合并至 2419，2026-09-02）

两轮 `--force` 重跑（精确 `gforacle_svc#svc` → 再加 **`#svc` 后缀唯一命中**）：

| 桶 | 任务数 | 含义 |
| --- | ---: | --- |
| **仅 Hive 目标缺口** | **1341** | Oracle 源已消歧；卡在 `odata_*` 等 Hive miss/DDL |
| **仍含 AMBIGUOUS** | **1026** | 源表仍歧义 |
| **RDBMS DDL 缺口** | **52** | core 命中但 DDL miss/歧义 |
| SUCCESS（2655 批累计） | **236** | 源+目标都齐 |

`#svc` 后缀一轮（原 1359 AMBIGUOUS）：SUCCESS 35 + 转仅 Hive 293 + DDL 5 → **AMB 降至 1026**。  
例：`124` / `CRMII.TAPP_CHANNELTYPE` — 拼 `gforacle_jgjdb#jgjdb` 不存在，改命中 `…@gforacle_jgjdb1#jgjdb`。

#### 仍 AMBIGUOUS 的 1026

| 原因 | 约量 | 说明 |
| --- | ---: | --- |
| **task.source 为空** | **~481** | Pack 无 source，无法查 horae-datasource |
| **有 source 仍对不齐** | **~545** | 无 `#svc` 唯一实例（如只有 `#jgjdbuat`）、或同 `#svc` 多条 concrete（如多个 `#winddb`）、或 core 无该表 |
| source 不在 datasource 表 | **0** | 有 source 的都能查到 |

下一步：回补 **空 source**；对同 `#svc` 多实例再定规则（或接受 AMBIGUOUS）。

---

## 9. 附件路径

| 路径 | 内容 |
| --- | --- |
| `tmp/from-cache-full/partial-analysis/partial-stats.json` | 全量统计 JSON |
| `tmp/from-cache-full/partial-analysis/oracle2hive-breakdown.json` | oracle2hive 专题统计 |
| `tmp/from-cache-full/partial-analysis/ids-table-gap.txt` | 表缺口 ID |
| `tmp/from-cache-full/partial-analysis/ids-warn-HIVE_DDL_MISS.txt` | 含该警告的任务 |
| `tmp/from-cache-full/partial-analysis/ids-warn-RDBMS_CORE_AMBIGUOUS.txt` | 同上 |
| `tmp/from-cache-full/partial-analysis/ids-warn-TABLE_JSONL_MISS.txt` | 同上 |
| `tmp/from-cache-full/logs/summaries.jsonl` | 逐任务采集摘要 |
| `tmp/from-cache-full/diff/summary.json` | 缓存全乎 vs 正式根 diff |

重跑统计：

```powershell
node sql-static-lineage-data\tmp\from-cache-full\partial-analyze.cjs
node sql-static-lineage-data\tmp\from-cache-full\partial-analysis\oracle2hive-analyze.cjs
```

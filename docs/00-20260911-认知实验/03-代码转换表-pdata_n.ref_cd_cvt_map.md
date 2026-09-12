# 代码转换表：pdata_n.ref_cd_cvt_map

## 一句话

**`ref_cd_cvt_map` 是平台的公共代码转换对照表：按"源系统 + 源表 + 源字段 + 源码值"定位一行，把各源系统的业务代码翻译成数仓标准代码 `dw_cd_val`，也支持按标准代码反查源码或取描述。**

## 表结构（图内全部 10 列）

| 字段 | 角色 |
| --- | --- |
| `src_sys_name` | 源系统标识（路由键） |
| `src_tab_name` / `src_fld_name` | 源表 / 源字段名（路由键） |
| `src_cd_val` | 源系统的原始代码值（转码 JOIN 键） |
| `src_cd_desc` | 源代码描述 |
| `tgt_tab_name` / `tgt_tab_fld` | 目标表 / 目标字段名（路由键） |
| `dw_cd_val` | 数仓标准代码值（转码结果，主要输出） |
| `dw_cd_desc` | 标准代码描述 |
| `upd_date` | 更新时间（极少被用） |

前 5 列是"定位键"，后 4 列是"翻译结果"。同一个物理码值（如 `01`）在不同 `src_sys_name + src_tab_name + src_fld_name` 下含义完全不同，**不能只按 `src_cd_val` 匹配**。

## 消费规模（当前发布图，版本 8651e582…，与 grp_def 轮次同版）

| 统计口径 | 数字 |
| --- | --- |
| 消费任务数（READS_TABLE 按任务去重） | **359** |
| 下游直接写入目标表 | 约 202 张 |
| 目标表最多的 schema | pdata_n（102 表 / 223 任务），其次 dm_rsk_n、dm_otc_n、spdata_n、dm_index_n 等 17 个 schema |

用户此前提到的"180 多"与本次图统计 359 不一致；359 是按任务去重的直接消费口径，差异原因待复核（可能对应不同版本或不同的统计入口）。规模数字按 doc-01 同样原则**先作为本轮图统计结果保留**，不影响下面的用法解释。

## 主要使用方式

### 1. 路由过滤 + `src_cd_val` 转码 JOIN（绝对主流）

消费任务几乎都按同一个三段式模板用这张表：

```sql
LEFT JOIN pdata_n.ref_cd_cvt_map c
  ON a.field_value = c.src_cd_val          -- 用业务表的码值对上源码
 AND c.src_sys_name = 'TIT'                -- 五个路由条件把对照表
 AND c.src_tab_name = 'REF_TRS'            -- 收窄到"本字段专用"
 AND c.src_fld_name = 'CONTR_STATUS'       -- 的那一小段码表
 AND c.tgt_tab_name = 'T03_OTC_SWAP_COMP_INFO'
 AND c.tgt_tab_fld  = 'COMP_STAT_CD'
-- 输出：c.dw_cd_val（或 nvl(c.dw_cd_val, field_value) 兜底）
```

Facts 证据（SQL_PLAN condition_columns，683 个消费任务中 648 个有谓词证据）：

| JOIN 条件列 | 出现次数 |
| --- | ---: |
| `src_cd_val` | 1,569 |
| `dw_cd_val` | 536 |
| `tgt_tab_name` / `tgt_tab_fld` / `src_tab_name` / `src_fld_name` / `src_sys_name` | 各 19 |
| 其他（`rn`、`crrc_code`、`clientkind` 等） | 零星 |

图上字段读取宽度也印证：`dw_cd_val` 被 213 个任务读取（406 处），是最主要输出列。

JOIN 类型：LEFT JOIN 绝对主导（原始 SQL 聚合抽样约 1,626 处 LEFT，仅 1 处 INNER）。图边 grain 标记大量出现 `GRAIN_JOIN_NULLABLE_SIDE_MAY_EXPAND`——**LEFT JOIN 未命中不丢行，但同一码值命中多条映射时会扩行**。

### 2. 反查 / 双向映射

`dw_cd_val` 也作为 JOIN 键出现 536 次（约 105 个任务）——用数仓标准代码反查回源码或核对，属于逆向用法，规模约为正向的 1/3。

### 3. 取描述

`src_cd_desc`（7 任务）、`dw_cd_desc`（6 任务）输出代码含义，属少数派用法。

### 4. 转码兜底（nvl 模式）

高频出现 `nvl(c.dw_cd_val, field_value)`：映射命中用标准码，未命中保留原值。这是转码"不丢数据"的常见写法；相反，用 INNER JOIN 或直接取 `dw_cd_val` 不兜底时，未映射记录会被置空或丢弃——排查"为什么这个字段的值变了/空了"时先查映射是否命中。

## Filter 画像（回答"filter 什么"）

路由五列的等值过滤几乎存在于所有消费者任务（图 DATASET_CONTROL：`tgt_tab_name` 358 任务 / `tgt_tab_fld` 358 / `src_fld_name` 350 / `src_sys_name` 348 / `src_tab_name` 347，各 600+ 条 FILTER 边）。

Facts `source_text` 中字面过滤值的分布：

| 过滤列 | 字面等值过滤出现次数 | 去重字面值数 |
| --- | ---: | --- |
| `tgt_tab_fld = '…'` | 2,012 | 目标字段维度：COMP_STAT_CD、AGT_STAT_CD、EXCH_TYPE_CD、CRRC_CD、INTA_BM_CD、RATE_TYPE_CD、CERT_TYPE_CD… |
| `src_fld_name = '…'` | 2,008 | CONTR_STATUS、DAY_COUNT、INTEREST_TYPE、EXCHANGE_RATE_TYPE、INVEST_TYPE、EVENT_STATUS… |
| `tgt_tab_name = '…'` | 1,992 | T03_AGT、T03_OTC_SWAP_COMP_INFO、T03_AGT_STAT_H、T01_CORP_CUST… |
| `src_tab_name = '…'` | 1,954 | REF_TRS、REF_INS_OPTION_INFO、REF_TRS_LEG、AML_BENEFICIARY… |
| `src_sys_name = '…'` | 1,857 | 见下 |

按源系统分布（涉及任务数）：**TIT 140、RCC 55、XIR 16、OIS 10、PAS 8**，其余 TA5、ICC、CRM、ECR、CSO 等 25 个系统零星出现。TIT（交易核心）+ RCC（清算）覆盖了绝大多数转码场景。

完整"五元组"组合共 394 种，最高频的三个：

| 五元组（src_sys/src_tab/src_fld → tgt_tab/tgt_fld） | 任务数 |
| --- | ---: |
| TIT / REF_OTC_OPTION_DEAL / CONTR_STATUS → T03_OTC_OPT_COMP_INFO / COMP_STAT_CD | 23 |
| TIT / REF_TRS / CONTR_STATUS → T03_OTC_SWAP_COMP_INFO / COMP_STAT_CD | 20 |
| TIT / REF_TRS / CONTR_STATUS → T03_AGT_STAT_H / AGT_STAT_CD | 10 |

**核心理解：每个消费任务都把这张"全局大码表"过滤成自己字段的专用小码表再用。**路由条件写在 JOIN ON 里还是 WHERE 里会改变语义（ON 里 LEFT JOIN 不丢主表行；WHERE 里等于把 LEFT JOIN 变 INNER）。

## 最重要的使用笔记

1. **路由条件缺一不可。**漏掉任何一个路由列，`src_cd_val` 会在不同源系统/不同字段间撞车（同一个 `01` 可能是"合约状态"也可能是"证件类型"），LEFT JOIN 下直接扩行污染。
2. **JOIN 位置影响语义。**路由条件放 ON 与放 WHERE 对 LEFT JOIN 结果不同（见上）。
3. **未映射 ≠ 脏数据。**源系统新增代码值而对照表未登记时，nvl 模式保留原值、纯转码模式输出 NULL；这通常是"码表待补录"而非加工错误。
4. **个别任务的转换规则不等于公共字典规则。**如 163965 样本中 `org_type_cd1/org_type_cd2` 双路转码再 CASE 归并（"优先取 csdc_organ_type"）是具体任务的规则，不能推广。

## 与相邻表的区别

| 表 | 回答的问题 |
| --- | --- |
| `ref_cd_cvt_map` | 这个源系统的这个字段，码值 X 应该翻译成数仓的什么码？ |
| `grp_def`（见 doc-01） | 这个业务对象是谁、属于什么类型？ |
| 各 dm 表内嵌状态字段 | 转码后的标准状态码在业务结果里是什么值？ |

`ref_cd_cvt_map` 不存业务事实，不参与金额/数量计算，只做代码层面的翻译；它是任务间复用度最高的"字典"型资产。

## 证据边界

- 图统计（359 消费任务、字段/控制足迹）来自已发布 titans-otc 图，版本 `8651e582cd85…`，只读查询，脚本留存 `tmp/ref-cd-cvt-map-consumption.ts`。
- 谓词与字面过滤值来自 Machine Facts（`field-facts/registry/tasks/<id>/bundle/relation-nodes.jsonl.gz` 的 `condition_columns` 与 `source_text`），683/683 个消费任务有 Facts bundle，结果存 `tmp/ref-cd-cvt-map-facts-predicates.json`、`tmp/ref-cd-cvt-map-filter-values.json`；原始 SQL 抽样聚合（`tmp/ref-cd-cvt-map-predicates.ts`）作交叉验证。
- 消费任务中 184 个任务没有 `schedule-evidence/tasks/<id>/hive-task.sql` 原文，原始 SQL 口径比 Facts 口径覆盖少；Facts 口径为准。
- 字面值统计按 relation 片段聚合，未逐条回核每个任务的完整 SQL 分支；"180 多"与 359 的规模差异待复核。

# MATERIAL_GAP export (titans-otc)

Graph version: `1fc9dd200607c1e33549148bb5285435218fcd1bf7c84826813f63feb2f4766f`
Total: **510** tasks

## Focus categories

| Category | Count |
|----------|------:|
| hive2starrocks | 143 |
| MISSING_PACK | 129 |
| sparkIndex | 53 |
| hive2postgre | 46 |
| hive2mysql | 42 |

## Files

- `summary.json` — counts by category and sub-reason
- `all-material-gap.csv` — full list for spreadsheet
- `<category>.json` / `<category>-ids.txt` — per-category lists
- `<category>--<subReason>-ids.txt` — sub-reason splits
- `other-categories.json` — 97 tasks in 11 categories: HttpTask, RdpTask, hive2oracle, hiveTask, hiveTask-2.0, kyuubiTask, oracle2hive, oracle2oracle, runScript, runScript-2.0, sparkScript

## Sub-reason legend

| subReason | Meaning |
|-----------|---------|
| MISSING_PACK | No task pack on disk |
| NEED_MACHINE_FACTS | Pack exists with SQL; run facts pipeline |
| NEED_FACTS_AND_TARGET_SCHEMA | Pack has bare target name; facts + DDL/schema needed |
| PACK_NO_SQL_NEED_FACTS_OR_SCHEDULE_ONLY | Pack has no query SQL (common hive2* log tasks) |
| SCHEMA_UNRESOLVED | Facts exist but target schema cannot be resolved |

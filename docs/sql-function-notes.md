# SQL 函数知识库入口

函数、调度日期变量、兼容性资料及原始出处已迁入：

[function-catalog.sqlite](E:/02_area/股衍数据-数据cookbook/sql-static-lineage-data/knowledge/function-catalog.sqlite)

本文件只保留入口。三批原始资料、旧整理快照和用户匹配口径均在 SQLite 中，文档记录与用户规则分开保存，不自动启用解析规则。

在仓库根目录查询：

```powershell
node --import tsx scripts/knowledge/function-catalog.ts stats
node --import tsx scripts/knowledge/function-catalog.ts find --name pretradedate --limit 20
node --import tsx scripts/knowledge/function-catalog.ts source --id <查询返回的source_id>
```

导入新资料使用同一命令的 import --input sources.json；输入结构见 scripts/knowledge/function-catalog.ts。相同来源原文重复导入不会重复入库，新版本和不同来源的冲突记录保留并存。

# Calcite Rel Bridge

This is an independently invoked sidecar for the Plan Facts differential lane.
It is pinned to Apache Calcite `1.42.0`, does not belong to the default Node
pipeline, and does not read or write canonical lineage artifacts.

From the repository root, the Maven module can be tested with:

```powershell
mvn -f tools/calcite-rel-bridge/pom.xml test
```

The current core accepts protocol v1 JSONL, validates the bounded
`PLAN_FACTS_REL_V1` envelope and its schema/type/mapping fields, and directly
constructs unoptimized Calcite table scan, project, filter, join, aggregate,
and set-operation nodes. It emits mapped table-occurrence,
expression-lineage, predicate, unique-key, functional-dependency, and
row-count/cardinality observations where Calcite can evaluate them.
Unsupported relation/expression kinds fail closed. `RAW_SQL_V1` is parsed only
as a protocol envelope and is deliberately not passed to a SQL parser by this
bridge. Every physical input line produces one compact UTF-8 JSON response
line; stdout contains no diagnostics.

When Maven is unavailable, run the module-local boundary check instead:

```powershell
powershell -ExecutionPolicy Bypass -File tools/calcite-rel-bridge/test-runtime.ps1
```

Hard limits follow `scripts/calcite-differential/protocol.ts`: 4 MiB input
line, 64 KiB SQL, 128 tables, 256 columns per table, 1,024 relation nodes,
4,096 expressions, 8,192 mappings/output items, and a 4 MiB response. A
request may lower a limit but cannot raise it.

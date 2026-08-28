# Deprecated Calcite offline oracle compatibility tool

New work should use `tools/calcite-rel-bridge/` and the
`scripts/calcite-differential/` protocol. This directory is retained only for
the existing `test:calcite-oracle` fixtures and older callers; it is not the
production field-lineage or causal-slice engine.

This is an independently invoked, sidecar-only oracle. It is deliberately not
part of the Node production pipeline and does not read or write canonical
field-lineage artifacts.

The build is pinned to Apache Calcite `1.42.0` in `pom.xml` and produces an
uber-jar. From the repository root:

```powershell
mvn -f tools/calcite-oracle/pom.xml package
Get-Content tests/fixtures/calcite-oracle/basic-request.json |
  java -jar tools/calcite-oracle/target/calcite-offline-oracle-0.1.0.jar
```

Each physical input line is one compact JSON request and each output line is
one JSON response. The protocol is strict UTF-8 JSONL, protocol version `1`,
and has explicit `SUCCESS`, `UNSUPPORTED`, and `FAILED` statuses. The supported
request subset is bounded to 64 KiB SQL, 128 tables, 256 columns per table,
256 KiB per physical JSONL line, and a 1 MiB response by default. A request can
lower those limits but cannot raise the hard limits. Input is rejected before a
String is allocated when a physical line exceeds the hard bound.

The configured `maxOutputBytes` applies to success, error, and fallback
responses. If an `OUTPUT_LIMIT` fallback cannot retain an oversized
`requestId`, the fallback omits that optional field.

Catalogs are deliberately rejected with `UNSUPPORTED` (`CATALOG_UNSUPPORTED`);
use `schema.name` identities in this sidecar. Malformed UTF-8, JSON Unicode
escapes, and JSON numbers return `FAILED` with `JSON_INVALID`. Parse/validate/
relational-conversion failures return `FAILED` with `PLANNER_FAILURE`, while
deliberately excluded SQL capabilities retain `UNSUPPORTED`.

The success observation includes expression lineage, predicates, unique keys,
functional dependencies, table occurrences, and row-count/cardinality
metadata when Calcite can provide them. Unknown Calcite metadata is represented
as `null` or an omitted observation; it is never converted into a negative
proof. Functional dependencies use Calcite 1.42's `RelMetadataQuery.getFDs`
metadata and retain separate `CALCITE_METADATA` and `SCHEMA_STATISTICS`
provenance when the same dependency is observed from both sources.

When Maven is unavailable, the owned runtime check can compile against the
locked local dependency cache and exercise the JSONL process end to end:

```powershell
powershell -ExecutionPolicy Bypass -File tools/calcite-oracle/test-runtime.ps1
```

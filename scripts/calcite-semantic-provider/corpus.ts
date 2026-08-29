import { readFileSync } from "node:fs";
import type { CalciteSemanticProviderRequest, ProviderTable } from "./protocol.ts";

interface CorpusFile {
  readonly schema: { readonly tables: readonly ProviderTable[] };
  readonly samples: readonly { readonly id: string; readonly sql: string; readonly expectedDependencyKinds: readonly string[] }[];
}

export interface ProviderCorpusCase {
  readonly id: string;
  readonly request: CalciteSemanticProviderRequest;
  readonly expectedDependencyKinds: readonly string[];
}

export function loadProviderCorpus(path: string): readonly ProviderCorpusCase[] {
  const parsed = JSON.parse(readFileSync(path, "utf8")) as CorpusFile;
  return parsed.samples.map((sample) => ({
    id: sample.id,
    expectedDependencyKinds: sample.expectedDependencyKinds,
    request: {
      protocolVersion: 1,
      requestId: `corpus:${sample.id}`,
      sqlSourceId: `fixture:${sample.id}`,
      statementOrdinal: 0,
      dialect: "ANSI",
      sql: sample.sql,
      schema: parsed.schema,
      requestedMetadata: ["expressionLineage", "predicates", "uniqueKeys", "functionalDependencies", "tableOccurrences", "rowCountCardinality"],
      limits: { maxOutputBytes: 1048576, maxOutputItems: 4096 },
    },
  }));
}

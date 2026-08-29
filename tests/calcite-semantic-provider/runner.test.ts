import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { parseCandidateTaskSemanticFacts } from "../../scripts/calcite-semantic-provider/contract.ts";
import { runProviderPoc } from "../../scripts/calcite-semantic-provider/runner.ts";
import type {
  CalciteSemanticProviderRequest,
  CalciteSemanticProviderResponse,
} from "../../scripts/calcite-semantic-provider/protocol.ts";

const facts = parseCandidateTaskSemanticFacts(JSON.parse(readFileSync(join(
  "tests", "fixtures", "calcite-semantic-provider", "valid.json",
), "utf8")));
const request: CalciteSemanticProviderRequest = {
  protocolVersion: 1,
  requestId: "request:one",
  sqlSourceId: "slot:one",
  statementOrdinal: 0,
  dialect: "ANSI",
  sql: "SELECT amount FROM APP.orders",
  schema: { tables: [{ schema: "APP", name: "orders", columns: [{ name: "amount", type: "DECIMAL", nullable: true }] }] },
};
const response: CalciteSemanticProviderResponse = {
  protocolVersion: 1,
  requestId: request.requestId,
  status: "SUCCESS",
  facts,
  fingerprint: { tool: "calcite-semantic-provider", calciteVersion: "1.42.0", protocolVersion: 1, buildFingerprint: "fixture" },
};

describe("Calcite semantic provider POC runner", () => {
  it("executes each semantic digest once in one batch", async () => {
    const execute = vi.fn(async (_requests: readonly CalciteSemanticProviderRequest[]) => [response]);
    const report = await runProviderPoc([
      request,
      { ...request, requestId: "request:duplicate" },
    ], { classpath: "fixture" }, execute);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0]?.[0]).toHaveLength(1);
    expect(report).toMatchObject({ requestCount: 2, uniqueDigestCount: 1, cacheHitCount: 1 });
    expect(report.responses.map((item) => item.requestId)).toEqual([
      "request:one", "request:duplicate",
    ]);
    expect(report.safety).toEqual({
      reportKind: "CALCITE_SEMANTIC_PROVIDER_POC",
      canonicalArtifactsWritten: false,
      nativeSemanticFallback: false,
    });
  });
});

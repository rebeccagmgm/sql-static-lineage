import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  loadSourceEndpointBoundaryConfig,
  matchingSourceEndpointBoundaryRole,
} from "../../scripts/reconcile/shared/source-endpoint-boundary-config.ts";

describe("source endpoint boundary config", () => {
  it("matches titans source schemas and ingest categories independently", () => {
    const config = loadSourceEndpointBoundaryConfig(
      fileURLToPath(
        new URL("../../config/source-endpoint-boundary-rules.json", import.meta.url),
      ),
    );
    expect(
      matchingSourceEndpointBoundaryRole(config, "titans_dm.trd_otc_trade", "sparkIndex"),
    ).toMatchObject({ role: "TITANS_SOURCE" });
    expect(
      matchingSourceEndpointBoundaryRole(config, "source_schema.table", "oracle2hive"),
    ).toMatchObject({ role: "INGEST_SOURCE" });
    expect(
      matchingSourceEndpointBoundaryRole(config, "dm.trades", "sparkIndex"),
    ).toBeNull();
  });
});

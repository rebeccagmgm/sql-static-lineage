import { describe, expect, it } from "vitest";

import { parseRunSrcTableTemplateRebuildArgs } from "../scripts/input/mainline/run-src-table-template-rebuild.mjs";

describe("run-src-table-template-rebuild", () => {
  it("requires an explicit bounded task list", () => {
    expect(() => parseRunSrcTableTemplateRebuildArgs([])).toThrow(
      "TASK_IDS_FILE_REQUIRED",
    );
  });

  it("uses the supplied local task list", () => {
    expect(
      parseRunSrcTableTemplateRebuildArgs([
        "--task-ids-file",
        "tmp/targeted-ids.txt",
      ]),
    ).toEqual({ taskIdsFile: "tmp/targeted-ids.txt" });
  });

  it("rejects the retired platform-fill controls", () => {
    expect(() =>
      parseRunSrcTableTemplateRebuildArgs([
        "--task-ids-file",
        "tmp/targeted-ids.txt",
        "--allow-platform-fill",
      ]),
    ).toThrow("PLATFORM_FILL_FORBIDDEN");
  });
});

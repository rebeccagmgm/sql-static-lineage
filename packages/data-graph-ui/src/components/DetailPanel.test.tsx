import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DetailPanel } from "./DetailPanel";

describe("DetailPanel table metadata", () => {
  it("renders field type, one-based order, partition status and catalog version", () => {
    const html = renderToStaticMarkup(
      <DetailPanel
        loading={false}
        node={{
          id: "field:demo.busi_date",
          kind: "PHYSICAL_FIELD",
          table: "pdata_n.demo",
          column: "busi_date",
          metadata: {
            table: { status: "AVAILABLE", description: "示例表" },
            field: {
              status: "AVAILABLE",
              comment: "业务日期",
              rawType: "decimal(18, 4)",
              ordinal: 2,
              partition: true,
            },
            source: "table.json",
            sourceHash: "source-hash",
            ddlHash: "ddl-hash",
            metadataCatalog: {
              status: "READY",
              version: "catalog-version",
              builtAt: "2026-09-10T00:00:00.000Z",
              parserVersion: "parser-version",
            },
            versionRelation: "RUNTIME_INPUT_PACK_NOT_GRAPH_VERSION",
          },
        }}
      />,
    );

    expect(html).toContain("示例表");
    expect(html).toContain("业务日期");
    expect(html).toContain("decimal(18, 4)");
    expect(html).toContain("字段顺序：</b>3 · 分区字段");
    expect(html).toContain("元数据目录版本：catalog-version");
    expect(html).toContain("不等同于画布的已发布图谱版本");
  });
});

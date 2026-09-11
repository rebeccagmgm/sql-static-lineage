import test from "node:test";
import assert from "node:assert/strict";
import { buildSourceTopicAnalysis } from "./source-analysis.mjs";

const definition = {
  id: "titans",
  title: "TITANS topic 来源",
  targetSchema: "odata_n_tit",
  sourceSchemaPrefix: "titans_",
};

test("groups every direct TITANS-topic ingress to OData without pulling in unrelated TITANS schemas", () => {
  const analysis = buildSourceTopicAnalysis({
    definition,
    flows: [
      { from: "titans_dm", to: "odata_n_tit", tasks: 4, taskIds: ["1", "2", "3", "4"] },
      { from: "titans_refdata", to: "odata_n_tit", tasks: 2, taskIds: ["5", "6"] },
      { from: "titans_etl", to: "pdata_n", tasks: 1, taskIds: ["7"] },
      { from: "odata_n_ois", to: "odata_n_tit", tasks: 1, taskIds: ["8"] },
    ],
    schemas: [
      { schema: "titans_dm", tables: 8 },
      { schema: "titans_refdata", tables: 2 },
      { schema: "titans_etl", tables: 3 },
      { schema: "odata_n_ois", tables: 1 },
    ],
  });

  assert.deepEqual(
    analysis.sourceSchemas.map((item) => [item.schema, item.tasks, item.tables]),
    [["titans_dm", 4, 8], ["titans_refdata", 2, 2]],
  );
  assert.equal(analysis.tableIdentities, 10);
  assert.deepEqual(analysis.uniqueIngressTaskIds, ["1", "2", "3", "4", "5", "6"]);
});

test("keeps a task unique when it reads multiple schemas in the same source topic", () => {
  const analysis = buildSourceTopicAnalysis({
    definition,
    flows: [
      { from: "titans_dm", to: "odata_n_tit", tasks: 2, taskIds: ["1", "2"] },
      { from: "titans_refdata", to: "odata_n_tit", tasks: 2, taskIds: ["1", "3"] },
    ],
    schemas: [
      { schema: "titans_dm", tables: 8 },
      { schema: "titans_refdata", tables: 2 },
    ],
  });

  assert.equal(analysis.directionTaskCount, 4);
  assert.deepEqual(analysis.uniqueIngressTaskIds, ["1", "2", "3"]);
});

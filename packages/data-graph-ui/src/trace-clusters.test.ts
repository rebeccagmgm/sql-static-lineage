import { expect, it } from "vitest";
import { readGlobalClusters, restrictTraceClusters } from "./trace-clusters";
import { adaptTrace } from "./graph-adapter";
import type { TraceResult } from "./types";

const raw: TraceResult = {
  version:"v1",layer:"table",direction:"up",depthLimit:2,edgeLimit:400,truncated:false,stoppedBy:null,
  elapsedMs:1,terminalNodes:[],frontierNodeIds:[],
  taskClusters:{"103234":"观达","103235":"沙溪"},
  nodes:[{id:"target",kind:"PHYSICAL_DATASET",table:"pdata_news.n.t02_tit_scr_base_info",depth:0},
    {id:"task:103234",kind:"TASK",taskId:"103234",depth:1},
    {id:"task:103235",kind:"TASK",taskId:"103235",depth:1},
    {id:"foreign",kind:"PHYSICAL_DATASET",table:"odata.instrument",depth:2}],
  edges:[{id:"a",from:"task:103234",to:"target",kind:"WRITES_TABLE"},
    {id:"b",from:"task:103235",to:"target",kind:"WRITES_TABLE"},
    {id:"c",from:"foreign",to:"task:103235",kind:"READS_TABLE"}],
};
it("filters the main lineage canvas including other writers of a shared table", () => {
  const result = restrictTraceClusters(raw,["观达"]);
  expect(result.trace.nodes.map(n => n.id)).toEqual(["target","task:103234"]);
  expect(adaptTrace(result.trace).nodes.map(n => n.id)).toEqual(expect.arrayContaining(["target","task:103234"]));
  expect(adaptTrace(result.trace).nodes.some(n => n.data.raw?.taskId === "103235")).toBe(false);
  expect(result.omittedTaskIds).toEqual(["103235"]);
  expect(raw.nodes).toHaveLength(4);
  expect(restrictTraceClusters(raw,[]).trace).toBe(raw);
});
it("filters field paths and associated evidence without reconnecting across excluded tasks", () => {
  const fieldTrace: TraceResult = {...raw,layer:"field",nodes:[
    {id:"a",kind:"WRITE_FIELD",taskId:"103234",depth:0},
    {id:"b",kind:"READ_FIELD",taskId:"103234",depth:1},
    {id:"c",kind:"WRITE_FIELD",taskId:"103235",depth:2},
  ],edges:[{id:"value",from:"b",to:"a",kind:"VALUE"},{id:"bridge",from:"c",to:"b",kind:"CONTINUES",status:"CONFIRMED"}],
    terminalNodes:[{nodeId:"c",reason:"test",role:"SOURCE",ruleRef:"test"}],frontierNodeIds:["c"]};
  const filtered = restrictTraceClusters(fieldTrace,["观达"]).trace;
  expect(filtered.nodes.map(n => n.id)).toEqual(["a","b"]);
  expect(filtered.edges.map(e => e.id)).toEqual(["value"]);
  expect(filtered.frontierNodeIds).toEqual([]);
  expect(filtered.terminalNodes).toEqual([]);
});
it("restores the global selection including unrecorded cluster and tolerates invalid storage", () => {
  expect(readGlobalClusters({getItem:()=> '["观达", ""]'})).toEqual(["观达", ""]);
  expect(readGlobalClusters({getItem:()=> '{broken'})).toEqual([]);
  expect(readGlobalClusters({getItem:()=> '[1]'})).toEqual([]);
});

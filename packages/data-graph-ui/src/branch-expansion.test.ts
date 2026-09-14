import { expect, it } from "vitest";
import { appendTableBranch } from "./branch-expansion";
import type { TraceResult } from "./types";
const base: TraceResult = {version:"v1",layer:"table",direction:"up",depthLimit:2,edgeLimit:400,truncated:false,stoppedBy:"DEPTH_LIMIT",frontierNodeIds:["root"],terminalNodes:[],elapsedMs:1,
  nodes:[{id:"root",kind:"PHYSICAL_DATASET",depth:2}],edges:[]};
const branch: TraceResult = {...base,depthLimit:1,nodes:[{...base.nodes[0]!,depth:0},{id:"task:1",kind:"TASK",taskId:"1",depth:1},{id:"input",kind:"PHYSICAL_DATASET",depth:2}],
  taskClusters:{"1":"观达"},frontierNodeIds:["input"],edges:[{id:"in",from:"input",to:"task:1",kind:"READS_TABLE"},{id:"out",from:"task:1",to:"root",kind:"WRITES_TABLE"}]};
it("appends a single branch, preserves old depths, and is idempotent", () => {
  const first = appendTableBranch(base,branch,base.nodes[0]!,"up",[]);
  expect(first.addedNodes).toBe(2);
  expect(first.trace.nodes.map(node=>node.depth)).toEqual([2,3,4]);
  expect(first.trace.nodes[0]).toBe(base.nodes[0]);
  expect(first.trace.frontierNodeIds).toEqual(["input"]);
  expect(appendTableBranch(first.trace,branch,base.nodes[0]!,"up",[]).addedEdges).toBe(0);
  expect(base.nodes).toHaveLength(1);
});
it("places reverse-direction expansion on the opposite side and honors clusters", () => {
  const reverse = {...branch,edges:branch.edges.map(edge=>({...edge,from:edge.to,to:edge.from}))};
  expect(appendTableBranch(base,reverse,base.nodes[0]!,"down",[]).trace.nodes.map(n=>n.depth)).toEqual([2,1,0]);
  const filtered = appendTableBranch(base,branch,base.nodes[0]!,"up",["沙溪"]);
  expect(filtered.addedNodes).toBe(0);
  expect(filtered.omittedTasks).toBe(1);
});
it("rejects changed versions and capacity overflow without altering the base", () => {
  expect(()=>appendTableBranch(base,{...branch,version:"v2"},base.nodes[0]!,"up",[])).toThrow("版本");
  expect(()=>appendTableBranch(base,{...branch,edges:Array.from({length:401},(_,i)=>({...branch.edges[1]!,id:String(i)}))},base.nodes[0]!,"up",[])).toThrow("上限");
  expect(base.edges).toEqual([]);
});
it("does not append the opposite side of a task-centered response", () => {
  const both = {...branch,nodes:[...branch.nodes,{id:"other",kind:"PHYSICAL_DATASET",depth:1}],edges:[...branch.edges,{id:"opposite",from:"root",to:"other",kind:"READS_TABLE"}]};
  expect(appendTableBranch(base,both,base.nodes[0]!,"up",[]).trace.nodes.some(node=>node.id === "other")).toBe(false);
});

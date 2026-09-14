import { expect, it } from "vitest";
import type { Node } from "@xyflow/react";
import type { LineageNodeData } from "./graph-adapter";
import { placeBranchNodes } from "./branch-placement";
const node = (id: string, depth: number): Node<LineageNodeData> => ({id, position:{x:0,y:0}, data:{raw:{id,kind:"PHYSICAL_DATASET",depth},isAnchor:false,highlightActive:false,activeFieldIds:[]}});
it("keeps existing positions and places only added nodes without overlap", () => {
  const positions = new Map([["root",{x:720,y:100}],["old",{x:360,y:100}]]);
  const result = placeBranchNodes([node("root",2),node("old",3),node("new",3)],positions,{anchorId:"root",direction:"up"});
  expect(result.map(n=>n.position)).toEqual([{x:720,y:100},{x:360,y:100},{x:360,y:280}]);
  expect(positions.size).toBe(2);
});
it("places downstream additions to the right of an upstream-oriented graph", () => {
  const result = placeBranchNodes([node("root",2),node("new",1)],new Map([["root",{x:0,y:0}]]),{anchorId:"root",direction:"up"});
  expect(result[1]!.position).toEqual({x:360,y:0});
});

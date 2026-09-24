import {describe,expect,it} from "vitest";
import {continuationRoots, physicalTableKey, selectedFieldCount} from "./field-object";
import type {GraphNode,GraphEdge} from "./types";
const write:GraphNode={id:"w",kind:"WRITE_FIELD",taskId:"228609",table:"dm.t",column:"created_by",metadata:{table:{status:"AVAILABLE"},identity:{platform:"hive",dataSource:"one",qualifiedName:"dm.t",stableTableId:"dm.t__one"}}};
const read:GraphNode={...write,id:"r",kind:"READ_FIELD",taskId:"228812"};
const edge:GraphEdge={from:"w",to:"r",kind:"CONTINUES",status:"CONFIRMED"};
describe("field object navigation",()=>{
 it("continues upstream from the writer and downstream from the reader",()=>{
   expect(continuationRoots([read,write],"up",[edge])).toEqual([write]);
   expect(continuationRoots([write,read],"down",[edge])).toEqual([read]);
 });
 it("does not discard an unmatched or candidate read",()=>{
   expect(continuationRoots([read,write],"up",[])).toHaveLength(2);
   expect(continuationRoots([read,write],"up",[{...edge,kind:"CANDIDATE"}])).toHaveLength(2);
 });
 it("counts one physical field across task identities",()=>{
   expect(selectedFieldCount([read,write])).toBe(1);
   expect(selectedFieldCount([read,{...write,column:"created_datetime"}])).toBe(2);
 });
 it("separates the same table name in different physical sources and never guesses missing identity",()=>{
   const other={...write,metadata:{...write.metadata!,identity:{...write.metadata!.identity!,dataSource:"two"}}};
   expect(physicalTableKey(other)).not.toBe(physicalTableKey(write));
   expect(physicalTableKey({...write,metadata:undefined})).toBeUndefined();
   expect(selectedFieldCount([write,other])).toBe(2);
 });
});

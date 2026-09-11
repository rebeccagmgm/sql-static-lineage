import { describe, expect, it } from "vitest";
import { metadataIdentity } from "../src/asset-graph/service.ts";
const linked = {platform:"hive",dataSource:"warehouse",qualifiedName:"dm.target",identityStatus:"CONFIRMED"};
describe("write-field metadata identity", () => {
  it("uses the dataset linked to the write when field detail lacks platform and datasource", () => {
    expect(metadataIdentity({detail:{qualifiedName:"dm.target",column:"branch_no"}},linked)).toEqual(linked);
  });
  it("retains complete physical identities", () => {
    const own = {...linked,dataSource:"different"};
    expect(metadataIdentity({detail:own},linked)).toEqual(own);
  });
  it("does not override uncertainty or conflicting partial evidence", () => {
    for(const own of [
      {qualifiedName:"dm.other"},
      {qualifiedName:"dm.target",dataSource:"different"},
      {qualifiedName:"dm.target",identityStatus:"UNKNOWN"},
      {qualifiedName:"dm.target",stableTableId:"unverified-stable"},
    ]) expect(metadataIdentity({detail:own},linked)).toEqual(own);
  });
  it("does not infer identity from table names when no confirmed linked dataset exists", () => {
    const node={detail:{qualifiedName:"dm.target"}};
    expect(metadataIdentity(node)).toEqual(node.detail);
    expect(metadataIdentity(node,{...linked,identityStatus:"CANDIDATE"})).toEqual(node.detail);
  });
});


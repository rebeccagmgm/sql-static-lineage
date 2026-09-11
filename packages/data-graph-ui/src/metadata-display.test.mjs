import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("@xyflow/react", () => ({
  Handle: () => null,
  Position: {Left:"left",Right:"right"},
  useUpdateNodeInternals: () => () => {},
}));
import { LineageNode } from "./components/LineageNode";
import { DetailPanel } from "./components/DetailPanel";
describe("graph metadata display", () => {
  it("labels a merged producer card with all task identities", () => {
    const member={id:"w1",kind:"WRITE_FIELD",taskId:"p1",writeId:"write:1",table:"pdata.shared",column:"amount"};
    const aliases=["p2","p3","p4"].map(taskId=>({...member,id:taskId,taskId,writeId:`write:${taskId}`}));
    const html=renderToStaticMarkup(createElement(LineageNode,{id:"shared",data:{members:[member],fieldAliases:{w1:aliases},writeRefs:[member,...aliases].map(n=>({taskId:n.taskId,writeId:n.writeId}))}}));
    expect(html).toContain("4 个生产任务");
    expect(html).toContain("任务 p1、p2、p3、p4");
    expect(html).toContain("4 组写入证据");
  });
  it("retains the table description on a compact consumption card", () => {
    const html=renderToStaticMarkup(createElement(LineageNode,{
      id:"read-group",
      data:{compactRead:true,isAnchor:false,members:[{
        id:"field:yyb",kind:"READ_FIELD",taskId:"214294",table:"pdata_nds.tmr_drwt",column:"yyb",
        metadata:{table:{status:"AVAILABLE",description:"两融委托与成交明细"},field:{status:"ANNOTATION_NOT_RECORDED"}},
      }]},
    }));
    expect(html).toContain("共同消费汇合");
    expect(html).toContain("两融委托与成交明细");
    expect(html).toContain("展开说明");
  });
  it("displays multiple owner accounts in task details and a missing state", () => {
    const detail={version:"test",taskId:"1",owner:" user_one, user_two ",bindings:[],controls:[]};
    const render=(value)=>renderToStaticMarkup(createElement(DetailPanel,{detail:value,loading:false}));
    expect(render(detail)).toContain("user_one、user_two");
    expect(render(detail)).toContain("负责人：");
    expect(render({...detail,owner:undefined})).toContain("未收录");
  });
});


it("shows a recorded constant reason on the field and never labels missing evidence as constant", () => {
  const raw={id:"constant",kind:"WRITE_FIELD",table:"dm.output",column:"name",
    valueOrigin:{kind:"CONSTANT",label:"常量：空字符串",expression:"'' AS name"}};
  const render=(node)=>renderToStaticMarkup(createElement(LineageNode,{id:"field",data:{raw:node}}));
  expect(render(raw)).toContain("常量：空字符串");
  expect(render({...raw,valueOrigin:undefined})).not.toContain("常量：");
});

describe("merged field value origins", () => {
  const read = {id:"read",kind:"READ_FIELD",table:"dm.output",column:"code"};
  const write = (id, value = "'N05'") => ({
    ...read, id, kind:"WRITE_FIELD", taskId:"task", writeId:id,
    valueOrigin:{kind:"CONSTANT",label:`常量：${value}`,expression:`${value} AS code`},
  });
  const render = (aliases, writeRefs = []) => renderToStaticMarkup(createElement(LineageNode, {
    id:"card", data:{members:[read],fieldAliases:{read:aliases},fieldWriteRefs:{read:writeRefs}},
  }));

  it("shows a write alias origin below the field comment even when the representative is a read", () => {
    expect(render([write("w1")])).toContain("常量：&#x27;N05&#x27;");
  });
  it("deduplicates equal origins across writes", () => {
    const html = render([write("w1"),write("w2")]);
    expect(html.match(/value-origin-badge/g)).toHaveLength(1);
    expect(html).not.toContain("部分写入");
  });
  it("marks mixed or missing write origins as partial", () => {
    expect(render([write("w1"),{...write("w2"),valueOrigin:undefined}])).toContain("部分来源：常量");
    const html = render([write("w1"),write("w2","'N06'")]);
    expect(html.match(/value-origin-badge/g)).toHaveLength(1);
    expect(html).toContain("N05");
    expect(html).toContain("N06");
    expect(render([write("w1")],[{taskId:"task",writeId:"w2",rawNodeIds:[],rawEdgeIds:[]}])).toContain("部分来源：常量");
  });
  it("does not infer a constant from absent origins", () => {
    expect(render([{...write("w1"),valueOrigin:undefined}])).not.toContain("value-origin-badge");
  });
  it("keeps retained values informational and deduplicates their merged branch explanation", () => {
    const retained = {...write("w1"),valueOrigin:{kind:"EXPRESSION",label:"沿用本表原值",expression:"code"}};
    const mixed = {...write("w2"),valueOrigin:{kind:"EXPRESSION",label:"部分分支：沿用本表原值；部分分支：常量：'N05'",expression:"code UNION 'N05'"}};
    const html = render([retained,mixed]);
    expect(html.match(/沿用本表原值/g)).toHaveLength(1);
    expect(html).toContain('data-kind="EXPRESSION"');
    expect(html).not.toContain("来源未定位");
    expect(html).not.toContain("部分来源：部分分支");
  });
  it("summarizes connected and unresolved writes without saying the whole field stopped", () => {
    const unresolved = {...write("w1"),valueOrigin:{kind:"UNRESOLVED",label:"字段来源未定位，追溯到此停止",expression:""}};
    const html = renderToStaticMarkup(createElement(LineageNode,{id:"card",data:{members:[read],fieldAliases:{read:[unresolved,{...write("w2"),valueOrigin:undefined}]},connectedFieldIds:["w2"]}}));
    expect(html).toContain("部分来源已追到，另有来源未定位");
    expect(html).not.toContain("追溯到此停止");
    expect(html.match(/value-origin-badge/g)).toHaveLength(1);
  });
});


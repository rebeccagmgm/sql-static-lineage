明确区分：

```
Technical Lineage
vs
Business Lineage
```

Technical Lineage 面向数据工程师/架构师，保留 table、column、临时对象、source code、transformation 等详细技术信息；Business Lineage 则展示代表这些技术对象的更高层业务资产。

它的 Diagram View 还允许针对不同 use case 定义**哪些节点、边应该展示以及如何展示**，同一资产类型可以有多个不同 diagram view


```

Canonical Data Graph
3615 nodes
        │
        │ 人工
        ↓
View Definition
────────────────────
hidden:
  参数表
  technical log
  PARTY_INFO

groups:
  G1 = 持仓接入
  G2 = 持仓基础加工
  G3 = 日终持仓

knowledge:
  G1 + G2 + G3 = 持仓加工
────────────────────
        │
        ↓
Representation Pyramid

LOD 0       持仓
             │
LOD 1   [持仓加工]
             │
LOD 2   [接入]→[模型]→[日终]
             │
LOD 3   Table→Task→Table
             │
LOD 4   Field / SQL / Evidence

```

Collibra 的 Boxing Nodes，几乎就是你画的那个

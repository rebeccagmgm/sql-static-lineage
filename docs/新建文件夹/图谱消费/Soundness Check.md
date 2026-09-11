# 这轮调研让我对你的设计有一个重要修正

之前我会把它写成：

```
Canonical Graph
      ↓
Visual Reduction
      ↓
Knowledge Abstraction
```

现在我会加上一个很关键的中间概念：

```
                 Canonical Lineage Graph
                         │
                         ↓
                    User View
                         │
          ┌──────────────┴──────────────┐
          ↓                             ↓
   Visual Pruning                  Segmentation
 Hide / Filter               Focus / Source→Target
          │                             │
          └──────────────┬──────────────┘
                         ↓
                 Composite Modules
                  人工圈定 / Fold
                         │
                         ↓
                  Soundness Check
            不增加假的 lineage
            不丢真实 dependency
                         │
                         ↓
                  Knowledge View
                         │
                   Semantic Zoom
                         │
               drill down / roll up
```

**尤其 `Soundness Check` 我现在认为必须加。**

这不是锦上添花。

如果以后你的知识节点：

```
[持仓基础加工]
```

能够被 Agent 查询，那么它必须回答：

```
这个 abstraction 包含哪些事实节点？
哪些 input 真正能到哪些 output？
哪些只是 JOIN context？
哪些关系跨过了被折叠区域？
```

否则“知识抽象”会慢慢产生假知识。

这点恰恰是十几年前 workflow provenance 那帮人已经踩过的坑。
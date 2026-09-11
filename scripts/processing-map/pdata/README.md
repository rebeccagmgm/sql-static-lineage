# PDATA 结果与加工阅读图

生成 [PDATA 页面](../../../docs/processing-map-pdata.html)，保留整体分组、完整成员、表／任务读写关系、筛选、缩放、键盘操作和实际浏览路径。

阅读层级：PDATA → 类别中的加工关系 → 当前结果与加工正文。类别保留在左侧，完整成员作为侧栏查找目录，定位状态作为标签。选择结果、任务、阶段及证据都在当前类别内阅读；无需经过“状态分组 → 成员集合”才能看到内容。

销售实例：进入 S 后看销售基础的行、编号与日期，选择管理归属或按日明细，直接向下阅读105743／107491的连续正文。可展开阶段图定位到对应段落，再原处展开SQL。参数快照、收入与创收也在同一类别内查看，顶部保留“回看本类关系”。离开类别再返回时恢复所选结果、筛选、证据和展开状态。

成员、共享位置、判断依据与解释覆盖只维护在 docs/processing-map/pdata-output-placement.md。构建读取该文档，核对固定网络版本、完整输出集合、写入关联及分组索引，统计按实际行计算。共享成员是同一结果，不复制成多张表；有位置依据与已有写入解释分开显示。

类别首页的说明和图只选择已有解释支持的关键加工，不自动挑选输入最多的任务，不把完整表清单拼成正文。图中分别保留输入到任务、任务到结果的关系；完整读写关联在结果下展开核对。105743、107491的完整正文由Markdown生成，阶段图和SQL作为对照；其他任务复用已有说明，不宣称已全面展开。

118143 与118141并行消费；奖励汇总明确输入118141保底调整；230202同时读取销售基础、日明细及日计提费用，三条关系保留补充v3、固定v2缺失的限制。暂定成员、范围外生产、无消费者、临时未解析和220154目标映射冲突继续在结果和边界入口保留。

## 生成与检查

先使用项目依赖准备脚本；仅生成PDATA页面，不重建Facts、SQL投影或全局图谱。

```powershell
npm run prepare:deps
node scripts/processing-map/pdata/build.mjs
node --test scripts/processing-map/pdata/model.test.mjs scripts/processing-map/pdata/narrative.test.mjs
node scripts/processing-map/pdata/browser-check.mjs <已安装Playwright的node_modules目录>
node scripts/processing-map/pdata/navigation-check.mjs <已安装Playwright的node_modules目录>
```

浏览器检查把生成HTML装入隔离Edge的about:blank，阻断所有请求，不导航本地file地址。覆盖完整分组、两个阶段、结果及消费说明、SQL选段、实际返回／前进、筛选与视图恢复、分页及窄屏；截图与结果写入tmp/processing-map-pdata。该测试不证明应用内file地址可以打开，也不验证SQL运行或数据唯一性。

## 内容维护位置

- placement.mjs：读取已修正定位表、校验集合和索引；自由表述覆盖仍需使用明确的写入任务号及已核／沿用／补读标记。
- content.mjs：绑定SQL摘要的既有任务说明；不再另维护成员分类副本。
- analysis-*.json、understanding.mjs：已有逐任务阅读记录；105743／107491在原记录内扩充阶段ID、父阶段、输出粒度、关键关联及SQL行号。
- reading.mjs：类别关系导读、选定连接、重点结果、四产品写入与三项消费者的阅读内容；不维护成员分类或状态副本。
- explanations/105743.md、explanations/107491.md：连续加工正文；二级标题对应analysis-sales.json已有阶段标题。narrative.mjs在构建时安全渲染小范围Markdown，并校验每个阶段均有正文。SQL与行号继续取任务记录，不在正文复制SQL证据。
- category-view.js：类别关系、同页结果正文、成员查找及证据的就地阅读与恢复。
- reading-view.js：结果、阶段、选定关系图、分析原文和SQL证据入口；复用现有渲染、导航及画布。
- model.mjs、build.mjs：固定网络聚合、对应留存版本与已读SQL核验、离线HTML生成。
- graph.js、navigation.js、view.js、style.css、template.html：已有交互与页面呈现。

构建需要固定table-network.json、workspace-paths.json对应的数据目录、已有Cookbook及规范摘录、107491共享知识和上述分析文档。生成HTML、构建摘要，不再额外生成调研长文。核心已读SQL缺失或变化会停止构建，其他缺失SQL保留具体任务边界。

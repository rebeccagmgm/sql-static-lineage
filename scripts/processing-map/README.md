# 本地加工地图原型

路径更新：共享知识现位于 `config/workspace-paths.json` 的 `dataRoot/knowledge`，当前对应 `../sql-static-lineage-data/knowledge`。下文 `knowledge/...` 均相对于 dataRoot；读取脚本仍在代码仓库，命令保持不变。

直接用浏览器打开 `docs/processing-map.html`。全部数据、样式和脚本均已内置，无须启动 Neo4j 或本地服务，不请求外部资源。

入口是整体加工地图，支持区域下钻、关联任务清单、任务输入输出、四产品本金对照和固定 SQL 阅读。知识稿仍在原来的 Markdown 文件中。

`odata_n_tit` 现在进入独立的主页面 `docs/processing-map-odata.html`：区域对象全貌 → 对象分组 → 同名相关表与真实去向 → 表和任务 → SQL。返回总览可继续阅读其他区域。两个 HTML 各自离线可读；从总览跳转时须保存在同一目录。原有 `processing-map.html#odata` 地址也会转入新页面。

OData 页完整覆盖 411 张表、576 个接入任务、69 个内部任务和 521 个区域外读取任务。分组来自 `odata/content.mjs` 的显式对象成员；加工规则绑定 `odata-region-analysis-evidence.json` 中的任务与 SQL 摘要。同名后缀仅用于导航，不用于判断加工语义。页面收录本地 SQL，未逐项解释的任务会说明阅读范围。

主构建命令会一并重建 OData 页。单独重建与检查：`node scripts/processing-map/odata/build.mjs`、`node --test scripts/processing-map/odata/model.test.mjs`。更新结构或已核 SQL 后，构建会要求先复核分析绑定。

## 重建

在仓库根目录运行：

```powershell
node scripts/processing-map/build.mjs
```

任务 `107491` 的共享说明维护在 `knowledge/tasks/107491.json` 与同名 MD，读取与证据核验另见数据目录中的 `knowledge/README.md`。

需要现有 `tmp/processing-skeleton` 快照、`tmp/otc-principal-value-case/four-writer-evidence.json`、三个 Markdown 成稿，以及 `docs/processing-map/fixed-sql.json` 留存的固定 SQL、`knowledge/` 中的说明和最小证据摘录。留存材料不表示完整发布证据或当前生产版本。输入缺失会直接失败，不会重新采集或发布。

`content.mjs` 只组织已阅读的代表路线。计数和任务集合由快照提供。构建核对固定发布版本、任务成员和代表 SQL 摘要；更新批次时应重新核验解释后再更新版本约束。生成 HTML 后移动该文件仍可离线阅读。

这只是该批材料的阅读原型，不会自动随 Markdown 或图发布更新，也不表示全部任务语义已经整理完成。

## 共享加工链阅读

销售宽表和 OTC 收入分支提供“合约到创收”入口。正文与证据由构建器从 dataRoot/knowledge 读取，`reading.mjs` 仅渲染当前文稿所需的章节、表格、代码和受控文内链接，不是通用 Markdown 引擎。共享文件修改后需重新构建；构建会拒绝未注册的链接及缺失证据锚点。

针对本渲染器的检查：`node --test scripts/processing-map/reading.test.mjs`。阅读导航及浏览器验证说明见 `docs/processing-map/implementation.md`。

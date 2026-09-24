# 固定版本的 CDM 官方原文

来源：[FINOS Common Domain Model](https://github.com/finos/common-domain-model)。参考版本 [7.0.0](https://github.com/finos/common-domain-model/releases/tag/7.0.0)，固定提交 `a6ffe777bc12ef3d289579cb3a86d1cbffea63d2`；抓取日期及每份文件 URL、字节数、SHA-256 见 [manifest.json](cdm-7.0.0/manifest.json)。

这些是从固定提交下载的原文件，没有进行中文改写。原 [LICENSE](cdm-7.0.0/LICENSE.md) 与 [NOTICE](cdm-7.0.0/NOTICE.md) 一并保留；中文导读和适配建议在上一层目录。

## 建议阅读顺序

| 要看什么 | 官方原文件 |
|---|---|
| 整体模型维度 | [common-domain-model.md](cdm-7.0.0/docs/common-domain-model.md) |
| 模块组织与局部采用 | [namespace.md](cdm-7.0.0/docs/namespace.md) |
| 产品及组件组合 | [product-model.md](cdm-7.0.0/docs/product-model.md) |
| 交易、事件、状态 | [event-model.md](cdm-7.0.0/docs/event-model.md) |
| 协议模型 | [legal-agreements.md](cdm-7.0.0/docs/legal-agreements.md) |
| JSON 表达与版本差异 | [serialization.md](cdm-7.0.0/docs/serialization.md) |
| 类型、属性、基数和约束原文 | [rosetta 定义目录](cdm-7.0.0/rosetta-source/src/main/rosetta/) |

文件扩展名仍为 `.rosetta`，内容使用 Rune DSL。这里是阅读选集，13 份模型文件并不构成完整依赖闭包；未下载的文档附件和图片应通过官方站点查看。不要把本目录当作可直接编译的完整 SDK。

更新时选择新的明确版本，另存目录并对比采用过的定义。本轮不设置自动跟随 master，以免上游变化悄悄改变本地解释。

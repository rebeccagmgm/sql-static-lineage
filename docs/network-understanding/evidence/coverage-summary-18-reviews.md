# 知识内容覆盖账本

这个页面帮助找到已经写出的解释和仍需研究的范围。记录通过了固定发布版本、任务集合、文件哈希、SQL 行段和页面锚点校验；这些技术检查不证明知识内容充分，也不会自动授予“整库完成”。

已记录固定发布 SQL 核读的任务 2843 项；另有 97 项记录当前 Input Pack 补充 SQL 核读。两类可能重叠。补充来源独立验证 task.json 声明、采集时间、文件哈希与行段，不视为原发布中的 SQL 或新增图边。

另有 2 项记录当前平台定向查询的 SQL 核读，保留获取时间、响应中的任务身份与导出路径、SQL 字节数和双方哈希。这类材料同样是独立补证，不能替代固定发布或运行结果。

本次合并了当前目录中的全部主题审阅文件；正文充分性仍需独立审阅。

| 记录状态 | 不重复任务数 | 含义 |
|---|---:|---|
| 至少有一处业务解释 | 1730 | 以具体审阅页声明的范围为准，未承诺全字段、全部消费或运行正确 |
| 已有传输规则复核 | 905 | 输入输出及传输处理已有解释，业务字段含义未因此补全 |
| 已有单源映射或历史模板复核 | 262 | 以作者声明的模板范围为准，未因此完成业务语义解释 |
| 已定位或仍待核读 | 335 | 包括仅有范围记录、SQL未读和已读但存在缺口的任务，不能统称已审阅 |
| 尚无合并后的主题审阅记录 | 383 | 继续研究；名称分类不能替代解释 |

各任务可能参与多个主题，下表的范围会重叠，不能相加当成独立任务数。

| 主题审阅记录 | 任务数 | 原始审阅状态 |
|---|---:|---|
| [access-and-shared-support](access-review.json) | 17 | FAMILY_RULES_EXPLAINED 14；NO_SCRIPT_EVIDENCE 3 |
| [compliance-and-reporting](compliance-review.json) | 9 | BUSINESS_SEMANTICS_EXPLAINED 9 |
| [contract-structure-position](contracts-review.json) | 269 | LOCATED 82；BUSINESS_SEMANTICS_EXPLAINED 105；TEMPLATE_VERIFIED 82 |
| [delivery-and-controls](delivery-review.json) | 177 | CALL_BOUNDARY_EXPLAINED 9；NO_SCRIPT_EVIDENCE 70；FAMILY_RULES_EXPLAINED 95；LOCATED 3 |
| [finance-and-valuation](finance-review.json) | 50 | LOCATED 2；EXPLAINED 48 |
| [fixed-income](fixed-income-review.json) | 75 | BUSINESS_SEMANTICS_EXPLAINED 27；TEMPLATE_VERIFIED 45；LOCATED 3 |
| [funds-margin-settlement](funds-review.json) | 62 | TEMPLATE_VERIFIED 26；BUSINESS_SEMANTICS_EXPLAINED 36 |
| [hongkong-business-and-distribution](hongkong-review.json) | 486 | EXPLAINED 170；LOCATED 9；TRANSFER_VERIFIED 306；UNRESOLVED 1 |
| [market-and-pricing-inputs](market-review.json) | 78 | EXPLAINED 75；LOCATED 2；UNRESOLVED 1 |
| [operations-and-customers](operations-review.json) | 203 | TEMPLATE_VERIFIED 109；BUSINESS_SEMANTICS_EXPLAINED 85；LOCATED 9 |
| [performance-and-assets](performance-review.json) | 302 | UNRESOLVED 107；EXPLAINED 193；LOCATED 2 |
| [public-foundations](public-foundation-review.json) | 35 | FAMILY_RULES_EXPLAINED 34；LOCATED 1 |
| [public-object-model](public-objects-review.json) | 34 | FAMILY_RULES_EXPLAINED 33；LOCATED 1 |
| [quality-foundation](quality-foundation-review.json) | 25 | FAMILY_RULES_EXPLAINED 25 |
| [quality-check-families](quality-review.json) | 690 | FAMILY_RULES_EXPLAINED 669；NO_SQL_EVIDENCE 21 |
| [risk-and-pricing](risk-review.json) | 100 | EXPLAINED 81；LOCATED 19 |
| [titans-source-ingress](source-review.json) | 650 | TRANSFER_PATTERN_VERIFIED 593；BUSINESS_SEMANTICS_EXPLAINED 52；LOCATED 5 |
| [treasury-management](treasury-review.json) | 14 | TRANSFER_VERIFIED 6；FAMILY_RULES_EXPLAINED 8 |

## 尚无审阅记录的任务分布

这里用平台主题定位后续工作，不把主题名当作业务含义。缺失主题的任务仍在总范围中。

| 平台主题 | 任务数 |
|---|---:|
| (no topic metadata) | 150 |
| BD_S_TEST | 32 |
| HG_APP | 19 |
| EXP_DM_RM | 18 |
| DM_OTC_TEST | 16 |
| DM_OM_TEST | 13 |
| DM_CRD_N | 10 |
| DM_HK_TEST | 9 |
| DM_OPT_N | 9 |
| DM_SCRM_N | 8 |
| BD_TEST | 7 |
| EXP_N_CIV | 7 |
| GF_TIT | 6 |
| DM_CO_TEST | 5 |
| DM_ENGIN_N | 5 |
| DM_FIN_N | 5 |
| PDATA_NEWS_TEST | 5 |
| DM_CISP_TEST | 4 |
| DM_ASM_SUB_N | 3 |
| DM_CSTD_N | 3 |
| DM_DG_N | 3 |
| DM_FIN_TEST | 3 |
| DM_MAST_N | 3 |
| DM_RD_N | 3 |
| DM_RSK_TEST | 3 |
| EDW_CSA | 3 |
| EXP_MFIS_N | 3 |
| EXP_N_OIS | 3 |
| DM_AUD_N | 2 |
| DM_ECIF | 2 |
| DM_WM_N | 2 |
| EXP_CRM | 2 |
| EXP_JGJ_DIY | 2 |
| EXP_N_TIDB | 2 |
| GF_CIV | 2 |
| SEDW_PTY | 2 |
| DM_CISP_N | 1 |
| DM_CRM | 1 |
| DM_MAST_TEST | 1 |
| DM_NEWS_N | 1 |
| DM_RSK_N | 1 |
| DM_SD_N | 1 |
| DM_TIT | 1 |
| EXP_N_PRD | 1 |
| SEDW_SUM | 1 |

[完整逐任务记录](content-ledger-18-reviews.json) · [固定范围与证据状态](scope-summary.md) · [知识库入口](../README.md)

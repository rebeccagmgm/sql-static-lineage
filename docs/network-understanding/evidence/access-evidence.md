# 权限与人员：证据索引

[权限主线](../chapters/13-access-and-shared-support.md) · [跨系统汇总](../topics/cross-system-user-roles.md)

这里提供固定发布与当前Pack补充来源定位。SQL核读不证明实际授权或运行。

<a id="task-74272"></a>

## 74272

状态：FAMILY_RULES_EXPLAINED。[正文](../topics/cross-system-user-roles.md#access-export-precedence)

[固定证据](../../../../sql-static-lineage-data/task-projections/tasks/74272/versions/6b81e5da29aff435fc135d7402bd5cfe966227d1abf45f8bb3971370ea806adc.evidence-v3.json) SHA256：`09d62ae23eb45a3e913a8f39a699f4bf415a847564882c624426796119cea316`。

- 发布 query 1–190 行；SHA256：`a46aeefd5496939228cd057e4ec4a77734a396290fe4f02a771b6a72a7e22ab2`。

边界：sys_num跨系统唯一性未证实，特殊分支仍使用旧ATP标签；实际传输目标需明确配置。

<a id="task-134442"></a>

## 134442

状态：FAMILY_RULES_EXPLAINED。[正文](../topics/cross-system-user-roles.md#cross-system-source-families)

[固定证据](../../../../sql-static-lineage-data/task-projections/tasks/134442/versions/019112bbdd72cbad054aada4e9e2d2fb99dd12d64c82b920f7b2c97c9986ed10.evidence-v3.json) SHA256：`e292eee225d43b2a3f0e1f065a35922557bcac995902413cc3e44db9fd808aef`。

- 发布 create 1–1526 行；SHA256：`1ba37f4f6e47a3bd9c2527a52f6d2bf5153b06bbf9308da6d2e034132293456b`。
- 发布 query 1–270 行；SHA256：`61af458c5814e7d8da449905155655b0a488ef0179df6c7f7e033fb53d8fca33`。

边界：固定query删除临时表后再读写，当前Pack字节亦相同；平台执行顺序与运行交付尚未确认。

<a id="task-139809"></a>

## 139809

状态：NO_SCRIPT_EVIDENCE。[正文](../chapters/13-access-and-shared-support.md#access-notifications-and-gaps)

[固定证据](../../../../sql-static-lineage-data/task-projections/tasks/139809/versions/b2b35037cb0b58c944facd186e8929210704fb0d46d14362507f624d039befc2.evidence-v3.json) SHA256：`2f644537a1320f91ad6094a2fbd2ad1557fd1a16a6146b40a86a4c1e40d3af20`。

边界：邮件触发规则、内容与实际送达未知。

<a id="task-139813"></a>

## 139813

状态：NO_SCRIPT_EVIDENCE。[正文](../chapters/13-access-and-shared-support.md#access-notifications-and-gaps)

[固定证据](../../../../sql-static-lineage-data/task-projections/tasks/139813/versions/d522714eb3741bf94763e9c2e481c2a7607565f38f025bf956a17a0159f933b7.evidence-v3.json) SHA256：`1c6c1dcfad4c36a9b5904e337f036a548b1f5ed3c926c8634c66a746e177c535`。

边界：邮件触发规则、内容与实际送达未知。

<a id="task-139814"></a>

## 139814

状态：NO_SCRIPT_EVIDENCE。[正文](../chapters/13-access-and-shared-support.md#access-notifications-and-gaps)

[固定证据](../../../../sql-static-lineage-data/task-projections/tasks/139814/versions/83b24a909965331bae3019e9f06c7aca4f74324ca01b0e8de0a6851b94345c26.evidence-v3.json) SHA256：`f91a42657c8c43e31452889e4919695f4483ff635f4d69eed81e7296f09292c1`。

边界：邮件触发规则、内容与实际送达未知。

<a id="task-207500"></a>

## 207500

状态：FAMILY_RULES_EXPLAINED。[正文](../chapters/13-access-and-shared-support.md#tit-user-roles)

[固定证据](../../../../sql-static-lineage-data/task-projections/tasks/207500/versions/cc3a62477a638b25b0a26ce3ee7990dc1a0891d2726e28e765adbdd83b4546e2.evidence-v3.json) SHA256：`7419c67dc61fe999f681df889570ee471ed6bb1ff94e4bea37de7a95f99f8735`。

- 发布 query 1–49 行；SHA256：`b2d35797829935c30952989be08ecec44c00cf3b6cd8447ee98da3c576e86ab3`。
- 发布 prepare 1–2 行；SHA256：`9175493c69f5c661c380fccdc47cc1da7256dd9972bdcc13210f0ec16a35bb57`。

边界：实际源唯一性、运行与权限生效未用SQL结果或实机验证。

<a id="task-207507"></a>

## 207507

状态：FAMILY_RULES_EXPLAINED。[正文](../chapters/13-access-and-shared-support.md#tit-user-roles)

[固定证据](../../../../sql-static-lineage-data/task-projections/tasks/207507/versions/26866dc76f6a5902b95452586fb526fd40eae1856aa8dd5e2070b17676ed8950.evidence-v3.json) SHA256：`c45185c72fe3908d400e0d6038a97c0d9608ea33bc8092ee1cfc13ca236735a6`。

- 发布 query 1–9 行；SHA256：`b233b9fb7f796a6e333991f5466fec32bd51efdf45a30a9352506a8da0a7babd`。

边界：实际源唯一性、运行与权限生效未用SQL结果或实机验证。

<a id="task-207529"></a>

## 207529

状态：FAMILY_RULES_EXPLAINED。[正文](../chapters/13-access-and-shared-support.md#tit-menu-rights)

[固定证据](../../../../sql-static-lineage-data/task-projections/tasks/207529/versions/012b94307d2014ea920c8d012fba9ebd21582f59693e5950601b6f281d7e3585.evidence-v3.json) SHA256：`1783e334e50b690cdb64b6dc067a2ab79cf6e5f68a1c09b7eba73e4ba8c50d8b`。

- 发布 query 1–159 行；SHA256：`440b02b32814ab8637becf4ea443374c4039d77a252e3f4bdbe5145636d430b4`。
- 发布 prepare 1–2 行；SHA256：`426304c633f8968e39545d8d2de3c64b86755c8cc48e7a85ced861697bf2f84a`。

边界：实际源唯一性、运行与权限生效未用SQL结果或实机验证。

<a id="task-207571"></a>

## 207571

状态：FAMILY_RULES_EXPLAINED。[正文](../chapters/13-access-and-shared-support.md#tit-counterparty-rights)

[固定证据](../../../../sql-static-lineage-data/task-projections/tasks/207571/versions/b5692d68babe246ea889eb1653dacb68a14757f9db322849ee3af129b1598f8d.evidence-v3.json) SHA256：`94400f429c7fd7651ac65bcb00ad771f269e36e79801c06901bab924db47b777`。

- 发布 query 1–67 行；SHA256：`c50a7037e64bf2e62cfc4241c1a4ac0f1d85c0ffb6c204f812dad561f4cebe21`。
- 发布 prepare 1–2 行；SHA256：`3762b9152ebd8fffd1e439e4f3ffe04a5d8014615ec86cb71ce1186e8f0287c9`。

边界：实际源唯一性、运行与权限生效未用SQL结果或实机验证。

<a id="task-207617"></a>

## 207617

状态：FAMILY_RULES_EXPLAINED。[正文](../chapters/13-access-and-shared-support.md#tit-menu-rights)

[固定证据](../../../../sql-static-lineage-data/task-projections/tasks/207617/versions/0a51b2f508d5733613256387100c0bf1735aa1e4d3f1bc951904df42f13763af.evidence-v3.json) SHA256：`42ce7dc8869c548d06fc5f02ac314c177e3c28367c99cdabda5c4a436ca073eb`。

- 发布 query 1–16 行；SHA256：`45c6bc13c854e491b140b587e6fd96a706d505f6ccd594e9052c8ae85c974ec6`。

边界：实际源唯一性、运行与权限生效未用SQL结果或实机验证。

<a id="task-207618"></a>

## 207618

状态：FAMILY_RULES_EXPLAINED。[正文](../chapters/13-access-and-shared-support.md#tit-counterparty-rights)

[固定证据](../../../../sql-static-lineage-data/task-projections/tasks/207618/versions/26e89466692381bf2598e060165f656bac7485af8528b224d647a5a53d36fff0.evidence-v3.json) SHA256：`772daa684a499420e85e710d18a4d9bcee58403504b6cbed13d9fb18a43846d6`。

- 发布 query 1–7 行；SHA256：`00477b16e71faf4048b2f9bb6712639b8f87cd6c453e33166ca2de287b69f601`。

边界：实际源唯一性、运行与权限生效未用SQL结果或实机验证。

<a id="task-208179"></a>

## 208179

状态：FAMILY_RULES_EXPLAINED。[正文](../chapters/13-access-and-shared-support.md#tit-book-pool-pricing)

[固定证据](../../../../sql-static-lineage-data/task-projections/tasks/208179/versions/d0d61ed08bf5da455fb164e0e69396c34b7349bb2c415acc254e9c00a78a8481.evidence-v3.json) SHA256：`0cbdf765baeb771dfe3476d25c496a93876ed7bb91ed1dbecc3036613fe8c70b`。

- 发布 query 1–61 行；SHA256：`c1c106be78bd9fe850f7f43ae309d015709b40f2c15598012ff7aaecaf7c71be`。
- 发布 prepare 1–2 行；SHA256：`2637a0bfb8791f1c9ab684eab4235d29d59cf1c06bae484ad726d2f76d466fc8`。

边界：实际源唯一性、运行与权限生效未用SQL结果或实机验证。

<a id="task-208180"></a>

## 208180

状态：FAMILY_RULES_EXPLAINED。[正文](../chapters/13-access-and-shared-support.md#tit-book-pool-pricing)

[固定证据](../../../../sql-static-lineage-data/task-projections/tasks/208180/versions/6b45141906df610879c08a6c86b49def2b9a55538858266997428d25383baf44.evidence-v3.json) SHA256：`6bea05f75aa3585a6751a8e4a3cbaee6bc1574b7e267947915d2d1a008bbeb21`。

- 发布 query 1–48 行；SHA256：`1bbc4d31139d4808dd6576fc39fef693c4d1acbf25011ac4252b51cfe247c005`。
- 发布 prepare 1–2 行；SHA256：`05d9d9b7c6f178676f249c3e6b57f74e8c54c4db8f8166c6ec8cafc771883d85`。

边界：实际源唯一性、运行与权限生效未用SQL结果或实机验证。

<a id="task-208181"></a>

## 208181

状态：FAMILY_RULES_EXPLAINED。[正文](../chapters/13-access-and-shared-support.md#tit-book-pool-pricing)

[固定证据](../../../../sql-static-lineage-data/task-projections/tasks/208181/versions/9bc49fdcf9c03497a7c44044ab9d9f4eb506f0530e5f9d15ac298cda9742bf98.evidence-v3.json) SHA256：`af0daeb438a69cf14b9c342f817d28ea0c5c041eccf072ddd0df17ccd904d25d`。

- 发布 query 1–50 行；SHA256：`cc0acd7b0b202787a34352aebcea217baae19999f135aebfb7ed8a1e9b3eb645`。
- 发布 prepare 1–2 行；SHA256：`0cc82856372ffe26e8b8e8211d8279600fb3396366e40c999faf8787b5c2332f`。

边界：实际源唯一性、运行与权限生效未用SQL结果或实机验证。

<a id="task-208345"></a>

## 208345

状态：FAMILY_RULES_EXPLAINED。[正文](../chapters/13-access-and-shared-support.md#tit-book-pool-pricing)

[固定证据](../../../../sql-static-lineage-data/task-projections/tasks/208345/versions/a890d8933e20066b5e0bd6fbe5f5cdbc6c128e24ce67070e3b53ed99153c8f1d.evidence-v3.json) SHA256：`0448134f7e5751dec1eaa54f81176b58f65ac58e7e878c0c2303302b5ca8fa5d`。

- 当前补充 [query](../../../../sql-static-lineage-data/tasks/hive2mysql/208345/sql/query.sql) 1–9 行；采集 2026-09-07T10:09:58.715Z；SHA256：`8eb497a900fb7008f1be2ad4c7910b0382f6e5495ce4cbbc6b6daa50d938bc1e`。Pack声明与哈希见 JSON 审阅记录。

边界：实际源唯一性、运行与权限生效未用SQL结果或实机验证。

<a id="task-208346"></a>

## 208346

状态：FAMILY_RULES_EXPLAINED。[正文](../chapters/13-access-and-shared-support.md#tit-book-pool-pricing)

[固定证据](../../../../sql-static-lineage-data/task-projections/tasks/208346/versions/72b5174243875e1a947fa20dfd00f3e296a4fe72536c312aaec8efc82469217d.evidence-v3.json) SHA256：`ce2440134cabb89a7f82193d8c9d998190438df06a6542747bdc6f5ea1e7edbd`。

- 当前补充 [query](../../../../sql-static-lineage-data/tasks/hive2mysql/208346/sql/query.sql) 1–8 行；采集 2026-09-07T10:09:58.750Z；SHA256：`45d8238bcbcde1210ecdf38a565ecbad6cb870343405cce7029c883799655c35`。Pack声明与哈希见 JSON 审阅记录。

边界：实际源唯一性、运行与权限生效未用SQL结果或实机验证。

<a id="task-208717"></a>

## 208717

状态：FAMILY_RULES_EXPLAINED。[正文](../chapters/13-access-and-shared-support.md#tit-book-pool-pricing)

[固定证据](../../../../sql-static-lineage-data/task-projections/tasks/208717/versions/38ea828c3bb8f29dec539ddf2be06c53b6e9b8eefbef64e965f311c7539646c6.evidence-v3.json) SHA256：`a9191f57fafb34b5c3ff798eb55fba09fe2a239a3619fe8d9265f91d845271f9`。

- 发布 query 1–8 行；SHA256：`b767889f904043d263885d9c3307ceea8d5298e2161e90dbd8119e33ca4b0558`。

边界：实际源唯一性、运行与权限生效未用SQL结果或实机验证。

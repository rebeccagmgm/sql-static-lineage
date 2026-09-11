# 资金部专业消费：证据索引

[完整主题](../topics/treasury-management.md) · [逐项审阅](treasury-review.json)

范围固定14项；发布SQL与当前Pack补充SQL分列。

<a id="task-114802"></a>

## 114802

记录状态：TRANSFER_VERIFIED。[正文](../topics/treasury-management.md#treasury-export-and-receipts)

[发布证据](../../../../sql-static-lineage-data/task-projections/tasks/114802/versions/126cd886ffda40ecbe9d271441fd69ae70d1ecc8bee29d7bfd36eb71fc96366d.evidence-v3.json)；SHA256：`b5d068e23970747187ab5ed7d49a64a0acb9fbc3961b4cf947b5bc3cabba5f91`。

- query 1–98 行；SQL SHA256：`a75aa52eacb24fc8c2c53db4ad76829d44b7f480efbe43128c22cea4dfe7bf10`。
- truncate 1–3 行；SQL SHA256：`395afcf9d4db1ba72e43d82829c77632d203f92a27fbb0de6567fc2ccfc50773`。

静态SQL不证明任务运行、传输到达或实际业务消费。

<a id="task-134690"></a>

## 134690

记录状态：FAMILY_RULES_EXPLAINED。[正文](../topics/treasury-management.md#treasury-asset-overview)

[发布证据](../../../../sql-static-lineage-data/task-projections/tasks/134690/versions/322c8e3a8052d5b5d72fd823db3aacbb2be0aa6fb2b78ca1c19314a7df308fa0.evidence-v3.json)；SHA256：`e8956d2d48508261997fd58e2a6ebb6ec17acd195d228966cefcc292da62a285`。

- query 1–262 行；SQL SHA256：`870e94c7e958fb90747fdc2da2dcd029467563a4918bea9bde6f684572dadd14`。
- prepare 1–2 行；SQL SHA256：`4b90e3663184767478e074459d7f097fa7391849b30d48021884fe779341a745`。

资产类别特殊CASE与来源业务值不一致；统一接口多列为空；销售及配置连接唯一性未证实。 静态SQL不证明任务运行、传输到达或实际业务消费。

<a id="task-144442"></a>

## 144442

记录状态：FAMILY_RULES_EXPLAINED。[正文](../topics/treasury-management.md#treasury-export-and-receipts)

[发布证据](../../../../sql-static-lineage-data/task-projections/tasks/144442/versions/698f859a5c4239b48f852cefbc8a8a29bbba255aadf753882f6c0f3a8fb78030.evidence-v3.json)；SHA256：`c59cd5a84a4433223e2919772efcbe88a7b9fb3f4b05a8c3e89126e5487f1b99`。

- 当前补充 [query](../../../../sql-static-lineage-data/tasks/exeSql/144442/sql/query.sql) 1–20 行；采集 2026-09-07T07:16:11.047Z；SQL SHA256：`3c49f54b348e3571e4a684962e3701902b785354c16a39366a8932c28a08f208`；Pack声明哈希见审阅JSON。

静态SQL不证明任务运行、传输到达或实际业务消费。

<a id="task-162676"></a>

## 162676

记录状态：FAMILY_RULES_EXPLAINED。[正文](../topics/treasury-management.md#treasury-hk-repo)

[发布证据](../../../../sql-static-lineage-data/task-projections/tasks/162676/versions/30078b539b143cebf1fb45f6f98cc6773867456f982d5286121281d6110b9aab.evidence-v3.json)；SHA256：`69979baea88863139d29e6c1d9b670607dafe5a13972bb64dd86f329ffe25016`。

- query 1–254 行；SQL SHA256：`8244dd91999084c3b4f240aefab9916c08ff1d276f459bfaf91fee3b127fa096`。
- prepare 1–2 行；SQL SHA256：`f8868a312ccf1b0c52a85a0e68a6a116cfabf7321a542544e350f503a56c956d`。

自然日一期、Haircut比值与重复利率列按实际表达式解释；多腿/标的字符串结果唯一性未知。 静态SQL不证明任务运行、传输到达或实际业务消费。

<a id="task-163099"></a>

## 163099

记录状态：TRANSFER_VERIFIED。[正文](../topics/treasury-management.md#treasury-export-and-receipts)

[发布证据](../../../../sql-static-lineage-data/task-projections/tasks/163099/versions/5abdc5b65207b45091978a7051b260c1f4b502797c926d4e4000e9285a97abae.evidence-v3.json)；SHA256：`72d3ef873669247c9dac4fbef4ff7a02b14407b8420cd267e67c0499bab8b5f0`。

- query 1–35 行；SQL SHA256：`52be7fa63b803d77d5161b3f113156ee7b91a4538f6816488abe6a66426a5544`。
- truncate 1–2 行；SQL SHA256：`9aa0a9e29b6c962bb9c79b6598952d088620040447f246904ad8c83dd90cd962`。
- finish 1–18 行；SQL SHA256：`3ac23f87babf386d69fddf227ccfb232bcbe0fe91e5b0d73146bd8e9df28b57f`。

静态SQL不证明任务运行、传输到达或实际业务消费。

<a id="task-163640"></a>

## 163640

记录状态：FAMILY_RULES_EXPLAINED。[正文](../topics/treasury-management.md#treasury-hk-notes)

[发布证据](../../../../sql-static-lineage-data/task-projections/tasks/163640/versions/cb10eac43754103c5c6fa5ec67fd0b06b61b8132e28c652874d9dbb55c27740f.evidence-v3.json)；SHA256：`1310be30ef4ec6c8a7881af945d620c90baf6cc3f6018049f0ad5fe00725056d`。

- query 1–194 行；SQL SHA256：`c86a7454150d5f8c0cf154d688204e16360739f46f4beff50a61ffbffdd94260`。
- prepare 1–2 行；SQL SHA256：`3960ea13bb24dd9b9bedef4835832b4c50e92e182c344e108e5175f916b16629`。

库存/折价等固定值；发行部门先去下划线后判断旧字符串；产品多客户或多腿可能重复金额。 静态SQL不证明任务运行、传输到达或实际业务消费。

<a id="task-167808"></a>

## 167808

记录状态：TRANSFER_VERIFIED。[正文](../topics/treasury-management.md#treasury-export-and-receipts)

[发布证据](../../../../sql-static-lineage-data/task-projections/tasks/167808/versions/e86fc4ee8a3e88d7063adb3093b5b88eaa43d7efc6073a8872e16090871b5e56.evidence-v3.json)；SHA256：`a1d841959d971e01de956ff136d8fb4b679c7ef31517035a3c781754cce96690`。

- query 1–46 行；SQL SHA256：`1ce295a75d07e37d60943ed1851ea278c8cf4764f9b21c5a316be6ec338fd3f3`。
- truncate 1–1 行；SQL SHA256：`4515ad116313f5a80afbbd2a2f3abea306b714616ea3cf87c91f2f8483b215f0`。
- finish 1–18 行；SQL SHA256：`79cf8b43e5d062299f259ae6e8ccaf787f64823b3e823e232dde1bfccb7ad930`。

源只取参数日但前置清理删除目标全表，导出不含grp_id。 静态SQL不证明任务运行、传输到达或实际业务消费。

<a id="task-203181"></a>

## 203181

记录状态：FAMILY_RULES_EXPLAINED。[正文](../topics/treasury-management.md#treasury-export-and-receipts)

[发布证据](../../../../sql-static-lineage-data/task-projections/tasks/203181/versions/b39af93a6858ffddf37bc5538b63b16da5e4d6bb0d1f2ceb8030ef25cb5b2e10.evidence-v3.json)；SHA256：`5c84a2560e0dce07069a3e0810dd137223ea2fda37c95be22d90d84ce3336a31`。

- 当前补充 [query](../../../../sql-static-lineage-data/tasks/exeSql/203181/sql/query.sql) 1–20 行；采集 2026-09-07T08:46:12.463Z；SQL SHA256：`dda13fd8cd2ec7b00aebcf0a546b0a0574c974bebf05018cc9ed2b68628e344d`；Pack声明哈希见审阅JSON。

静态SQL不证明任务运行、传输到达或实际业务消费。

<a id="task-207458"></a>

## 207458

记录状态：FAMILY_RULES_EXPLAINED。[正文](../topics/treasury-management.md#treasury-option-detail)

[发布证据](../../../../sql-static-lineage-data/task-projections/tasks/207458/versions/1c265869555432e4e4fa5d2b4d4eb33155d85d200d7cf1483a689b412d2c918c.evidence-v3.json)；SHA256：`232c55be0169f9d57f86c55fda89da00eac02bd2817c8e470029b2388f755698`。

- query 1–349 行；SQL SHA256：`913989ad52f3c869331bfee4bdae0db481a71b7975cf3b002b30e443b7538536`。
- prepare 1–2 行；SQL SHA256：`23fd31f783a224dc81d6fb2a04e733bcf7d82ae630754ded29dc2fff5930cca3`。

履保取运行时昨天；事件状态未过滤；结构关联可能放大累计，需源唯一性证据。 静态SQL不证明任务运行、传输到达或实际业务消费。

<a id="task-207753"></a>

## 207753

记录状态：FAMILY_RULES_EXPLAINED。[正文](../topics/treasury-management.md#treasury-swap-detail)

[发布证据](../../../../sql-static-lineage-data/task-projections/tasks/207753/versions/58dcb86dfd4691efe47180252fa4fa0be526b8b5684064b596eb287448a15622.evidence-v3.json)；SHA256：`c2a8776440551a7a0ec1d9b34ec31f01d93d757b34d27cef5f46dc7d9717cfb6`。

- query 1–555 行；SQL SHA256：`ed38c8d97e6c12461d46562c14dd0c327c3aa2821536cfa29d871d037742eafd`。
- prepare 1–2 行；SQL SHA256：`d9dcb4633526ef1fc3a644eae182a11b0e5cb98b03596f4cc339eb1f5be098ea`。

履保取运行时昨天；结构/计息腿/持仓等关系可能扩行；配对关系有效期与其他关系不同。 静态SQL不证明任务运行、传输到达或实际业务消费。

<a id="task-214154"></a>

## 214154

记录状态：TRANSFER_VERIFIED。[正文](../topics/treasury-management.md#treasury-export-and-receipts)

[发布证据](../../../../sql-static-lineage-data/task-projections/tasks/214154/versions/795706647dc369a97abb0eb76f9272b72253807837eb8ab76eda10331b6ab662.evidence-v3.json)；SHA256：`30d245fc66e6f9fe11834145fcd0337f69ab4464733aab09bd395e01e15ad611`。

- query 1–58 行；SQL SHA256：`3805adfead5c2b66397d494a72edd0b1f0fd357d428ee22c4ac7052f8ccbd16a`。
- truncate 1–1 行；SQL SHA256：`e11267c21d26b1b1157f28c9a7fdb90e34c9490fcac17ef52cb2cc518b8faf9d`。
- finish 1–18 行；SQL SHA256：`2f420aa268bd539c0b299b3db6dd88847fe32395286c40edafb711b77c3a57b5`。

静态SQL不证明任务运行、传输到达或实际业务消费。

<a id="task-214155"></a>

## 214155

记录状态：TRANSFER_VERIFIED。[正文](../topics/treasury-management.md#treasury-export-and-receipts)

[发布证据](../../../../sql-static-lineage-data/task-projections/tasks/214155/versions/199bfc30355feb3e8f06f416ac708e2700a91cfac5af046b663b6a6703715009.evidence-v3.json)；SHA256：`7f251bfe4d63821921f479e247549d2d8b9f9c1e8e2259a021675e5182d7324d`。

- query 1–37 行；SQL SHA256：`ab813a0603d688bfda1eeee899e633f894e977e5d857349f64543985f286ccc7`。
- truncate 1–1 行；SQL SHA256：`72a2d74934c98ab03b179184967c38572bccacd9939644c01b4ef9114d463443`。
- finish 1–18 行；SQL SHA256：`5ffc662be14431ceea3abe2fb9905a6d830d11936bc8d75517a9fd7e9cb7c10e`。

静态SQL不证明任务运行、传输到达或实际业务消费。

<a id="task-215700"></a>

## 215700

记录状态：FAMILY_RULES_EXPLAINED。[正文](../topics/treasury-management.md#treasury-bundle-margin)

[发布证据](../../../../sql-static-lineage-data/task-projections/tasks/215700/versions/f59fae2734eae165fb2754be021ac88427d30f8d5a2f0c804e9472f0968238dd.evidence-v3.json)；SHA256：`8d1fc3b53a95e710e2b26a7e81cff214744b4a171b0e924f16f2b4c73b971bc2`。

- query 1–477 行；SQL SHA256：`68d81b794bae1e7ae12e6e4185f421930a9ce4e77bed6967738eade0ffd772e4`。
- prepare 1–2 行；SQL SHA256：`fc0a9af0c1c552ea57e9a22de93710dca2f2c2e17db011f3cf0eaf573838790d`。

余额汇率缺失回退1；是否计算过滤被注释；重复接口别名不可加总，组合参数唯一性未证实。 静态SQL不证明任务运行、传输到达或实际业务消费。

<a id="task-217643"></a>

## 217643

记录状态：TRANSFER_VERIFIED。[正文](../topics/treasury-management.md#treasury-export-and-receipts)

[发布证据](../../../../sql-static-lineage-data/task-projections/tasks/217643/versions/5599b2f89d6a8e006ffbc73ceb9fb9dc2c44e9259497b2b6fcfbac4f685d0f58.evidence-v3.json)；SHA256：`862576e7c1953a61d7f67eddebb2a8b865880bac5b3b052a822b767c76dd0c74`。

- query 1–58 行；SQL SHA256：`920a3c107947072eaa1edc848731545c72c925a1c71579fd82508ff43b1f0fb3`。
- truncate 1–1 行；SQL SHA256：`6bb84ff759732c785fb8eeaf84510698643cb6fc2bd46e8507951f6af5629667`。
- finish 1–18 行；SQL SHA256：`c4031a56f1322abff0fb67a3d94853af601cf2af505e01545f417a877d78f5bc`。

静态SQL不证明任务运行、传输到达或实际业务消费。

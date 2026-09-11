# 从合约事件到现金流与结算异常：把金额、状态和时限分开看

一次合约部分平仓，可以同时留下合约事件、收付款记录和结算通知书。这几种记录回答不同的问题：发生了什么业务变化、要收付什么款、收付流程走到哪一步、是否已经形成通知。**现金流报表出现一笔金额，并不能证明这笔钱已经到账。**

本篇选取期权收付款路线，沿生产、报表消费和异常监控解释这些区别。已读 SQL 没有展示业务系统从平仓事件计算并生成收付款的内部过程；它读取系统已有结果，再建立关联和检查规则。不能把“图上连接起来”写成“PDATA 计算了全部应收应付”。

## 先辨认四种记录

| 对象           | 一行的理解入口                         | 关键标识与内容                                       |
| -------------- | -------------------------------------- | ---------------------------------------------------- |
| 合约存续期事件 | 一次合约变化事件                       | 合约编号、源事件编号、事件类型、事件日、审批结束时间 |
| 收付款事件     | 一条收付款记录                         | `Recv_Pymt_No`、合约编号、金额、方向、状态、清算日   |
| 结算通知书     | 一份通知记录                           | `Sett_Ntfc_Id`、合约、资金账户、通知状态及结算金额   |
| 现金流报表     | 通过指定关联条件的收付款记录及产品信息 | 收付款编号、子交易、现金流日期、类型及金额           |

这些是 SQL 的对象定位方式，不是实际唯一性证明。同一个合约可以涉及不同收付款记录，连接后的行数还取决于键是否唯一。本次没有查询真实数据验证基数。

期权事件任务 124566 将源 `EVENT_FEE` 写为 `Evt_Amt`，保留事件类型、日期与审批时间，并转换事件状态。互换事件任务 124565 另从互换事件来源读取，不能把两者的源编号混用。

## 收付款表保存了什么金额

任务 104934 从 `odata_n_tit.d_trd_transfer` 建立 `pdata_n.t05_otc_recv_pymt_evt`：源 `TRANSFER_ID` 成为 `Recv_Pymt_No`，加前缀后成为事件编号；源产品编号也转换为带 `TIT-` 前缀的 `Prd_Id`。

金额主要直接取自源字段，没有在这一步按本金、价格或费率重新计算：`AMOUNT` 对应 `Amt`，`PAYABLE` 对应我司应付金额，`RECEIVALBE` 对应我司应收金额，`AMOUNT_ADJUSTED` 对应 `Aft_Adj_Amt`。原币种金额、调整后金额和方向另有字段，不能混成一个“收入”。

其中存在一个需要核实的细节：调整后两列将 `AMOUNT_RECEIVALBE` 映射为 `Aft_Adj_Our_Payb_Amt`，将 `AMOUNT_PAYABLE` 映射为 `Aft_Adj_Our_Rcvb_Amt`，与未调整列的名称方向表面相反。本篇保留实际映射，不凭名称纠正，也不据此编造业务公式。

日期同样不能混用：`Paid_Date` 来自 `PAYMENT_DATE`，`Actl_Paid_Date` 来自 `ACTUAL_PAYMENT_DATE`，`Clr_Date` 来自 `CLEARING_DATE`。这张表只按 `src_tbl` 分区；SQL 按事件编号比较旧表与当前来源，处理新增、变更、保留和删除标志，并非每天追加一份完整历史快照。因此消费者常按 `Del_Flag='0'` 读取，而不是拿报表运行日过滤它。

## 同一笔款，在三个下游有不同进入条件

### 收付款明细保留流程状态

154591 将收付款分别与期权、互换合约信息关联，再 `UNION ALL` 输出。它把 `PENDING_FO_VERIFIED` 译为待交易员确认、`PENDING_REVIEW` 译为待复核、`VERIFIED` 译为已确认、`SETTLED` 译为已收付。

但入口只排除删除、取消记录，并未限定已收付。因此这是一份包含流程中记录的收付款明细。期权分支按 `Comp_No=Ext_Ord_Id` 关联；互换分支按 `Comp_No=Ext_Comp_No` 关联，并再内连接账簿补部门。字段同叫“合约编号”，不代表每处都使用同一种编号。

### 子交易视图选择需要报送风控的账簿

150915 同样读取未删除、未取消的收付款，但先通过账簿内连接要求 `Rep_Risk_Flag='1'`，再用 `OI.Prd_Id=tt.Prd_Id` 连接期权子交易。105395 的生产 SQL 与收付款生产都对源产品编号使用 `TIT-` 前缀，这为该键提供了具体依据。

输出金额仍来自收付款表，子交易贡献身份和方向等信息；没有 `SUM` 或按子交易分摊金额的表达式。若产品键匹配多行，会出现多行关联，不能把输出行数直接理解成独立资金笔数。[账簿公共属性](01-book-foundation.md)在这里提供的是纳入控制。

### 现金流报表进一步限定产品范围

182997 的 `dm_otc_n.v_wm_cashflow_report_tit` 取：

```sql
date_format(tt.Clr_Date,'MM/dd/yyyy') AS CASH_FLOW_DATE,
tt.Aft_Adj_Amt AS CASH_FLOW_AMOUNT
```

它仅排除取消、删除并限定两类期权源产品，随后按账簿编号与内部合约编号连接当天 OTC 部门合约；再取 `Sub_Trd_Seq='1'` 的子交易，并要求能关联到 `Rela_Csm_Prd` 非 NULL 的合约。SQL 没有同时排除空字符串。三个内连接共同界定报表范围，并非所有 OTC 现金流。

Facts 确认现金流日期、类型、金额均来自收付款表。报表没有要求 `SETTLED`，也没有拿实际支付日判断到账，更没有汇总求和。

**教学示意，非真实数据：**一条调整后金额为 100、状态为 `VERIFIED` 的记录，只要通过这些关联条件，就可能进入现金流报表；明细会显示“已确认”。这两处呈现并不矛盾，也都不足以证明银行已收付 100。

## 通知书把结算结果和账户放在一起

181103 从结算通知来源保留浮动收益、固定收益、平仓费用、返还保证金、总结算金额等字段。它们是各自的源字段映射，已读 SQL 没有证明“总结算金额等于这些分项相加”。返还保证金尤其不能自动归为创收。

通知中还保留资金账户协议编号和账户编号。103940 的账户附加信息则提供账户币种、启用标志和用途等属性。这帮助识别款项关联的账户，但本轮没有核验账户流水、余额或银行凭证。

通知与收付款通过 185098 维护的事件关系历史连接：一端是 `TIT292-通知编号`，另一端是 `TIT157-收付款编号`。消费者取运行日有效关系，使用 `Strt_Date <= 日期 < End_Date`，再去掉前缀匹配原编号。有效关系的读法可复用[协议关系历史](02-agreement-history.md)的说明；不能因为同属一个合约，就跳过这条具体关系。

另一个并行对象是 112816 的期权结算信息，它保留结算金额、交易净收取金额和实际支付、结算日期。当前所读现金流 SQL 没有使用它；名称都含“结算”并不构成已证明的加工链。

## 异常监控检查“该有的记录是否按时达到门槛”

181556 的期权部分平仓分支，先选择 `PARTIAL_TERMINATION` 且事件状态码为 `3` 的事件，再左连接收付款：内部合约编号相同、事件日等于清算日、类型为 `PARTIAL_TERM_FEE`，且状态属于 `VERIFIED/SETTLED`。

随后依据交易日历判断：找不到匹配创建时间，或创建日期已达到日历给出的下一交易日门槛，就形成“TRANSFER 未生成”异常。还有检查日期窗口、合约状态、特定编号和标的排除，以及期初日期不早于 2024 年的限制。**因此标签不等于源系统完全没有记录：一条尚待确认的收付款也无法满足这里的匹配条件。**

通知书分支继续经关系历史寻找通知，接受 `GENERATED/NOTIFIED/REPLIED/VERIFIED/WITHDRAW` 状态。期权部分平仓分支按合约和事件日期取创建时间最早的候选，再判断缺失或超时；这里时限参照收付款创建日，而前面的收付款检查参照事件审批日。它们不能简化成同一个“超一天”规则。

最终还要内连接当天账簿补部门。没有进入异常结果，可能是流程符合条件，也可能是未进入检查范围、关联未通过。这个分支检查状态、时间和对应关系，没有将应收金额与银行到账金额逐笔对账。

## 这段知识的边界

本篇把金额来源、报表范围和监控门槛接了起来。尚未证实源系统如何从事件生成收付款、调整后应收应付映射的业务原因、关联键真实唯一性及实际到账情况。12 个任务来自同一发布清单，但缓存 SQL 日期不同；这里验证的是静态实现，不代表同批运行成功。

## 证据索引

固定发布版本 `df6f0ae4b6ef465f751351b14fd02ea08542d824d7bfea36e5a58dd1039e23c3`。12 份 projection 声明的 `contentHash` 均与 manifest 一致。以下行号指 evidence 中对应 `sqlSources.slot` 文本行号，不是 JSON 文件行号。

- 104934：[收付款生产](../../../sql-static-lineage-data/task-projections/tasks/104934/versions/67040eec1090a912b4e6ea9e169927c81b04ec9fb1c933ce79dfeff3333997b5.evidence-v3.json)，create 58、64–118、178–235；query 13–257：分区、标识、金额日期映射与变更维护。
- 124566：[期权存续期事件](../../../sql-static-lineage-data/task-projections/tasks/124566/versions/3464ce52f29b558673a9349e3cc62527561fa2593f8dd0ae4d2aef2f4f44f051.evidence-v3.json)，query 3–28、134–145：事件、费用和状态转码。
- 124565：[互换存续期事件](../../../sql-static-lineage-data/task-projections/tasks/124565/versions/e4caa8bb64cd287aa65c158098934f9a131617e492e50a855591cec5a3787031.evidence-v3.json)，query 3–25、120–138：互换事件身份及独立来源。
- 154591：[收付款业务明细](../../../sql-static-lineage-data/task-projections/tasks/154591/versions/06f577e72f02e1971a3a4092069a4d10ad60e58d0b8553af7ea46a4b0e1d9d46.evidence-v3.json)，query 29–74、76–123：金额与状态保留、两个合约分支的连接。
- 150915：[期权子交易收付款](../../../sql-static-lineage-data/task-projections/tasks/150915/versions/caf32d77463864cde7abd15b7c6841b510185597baf148c573d37c6d4784dd32.evidence-v3.json)，query 21–60：账簿风控标志、产品键、明细金额。
- 105395：[期权子交易生产](../../../sql-static-lineage-data/task-projections/tasks/105395/versions/93b25f37dacd77806b165a4be4c6ba11ca43908665655040f2883878b54d50d0.evidence-v3.json)，query 6–13、63、85–95：子交易与产品标识及合约连接。
- 182997：[现金流报表](../../../sql-static-lineage-data/task-projections/tasks/182997/versions/bacd203e7dcebb94efb938ecb7f427f86c56a9f7cdbc8f0116ab89f8a954436c.evidence-v3.json)，query 18–54；最终 `root.project` 字段表达式：现金流金额来源及连续内连接范围。
- 181103：[结算通知书生产](../../../sql-static-lineage-data/task-projections/tasks/181103/versions/45dd5e62789251a58efd77a7fea9ca5a388badb0bcf531b22cad9c05108e3be7.evidence-v3.json)，create 55–103：通知身份、状态、账户和分项金额。
- 185098：[通知与收付款关系](../../../sql-static-lineage-data/task-projections/tasks/185098/versions/5af7c4ebd22460c96b882ed5d004e64ce0d318ec5a42eb37eb490852aac0f585.evidence-v3.json)，create 18–45；query 70–106：两端事件编号及关系历史维护。
- 103940：[资金账户附加信息](../../../sql-static-lineage-data/task-projections/tasks/103940/versions/697599523389492c596f999d540dcaf0187173acddc3ba0a479bd4c3ec0c7bef.evidence-v3.json)，query 3–21：账户编号、币种、启用及用途。
- 112816：[期权结算信息](../../../sql-static-lineage-data/task-projections/tasks/112816/versions/dba93b984f19e80f6d6b3908126fc9cf645b7c8699c1a49196530db096bb5658.evidence-v3.json)，query 3–26：结算金额、净收取金额和实际日期。
- 181556：[结算异常监控](../../../sql-static-lineage-data/task-projections/tasks/181556/versions/679fa05dcf80c91d0c5d52cbcc62ed2b1a64a00744372fdae8d379a6cf5967d7.evidence-v3.json)，query 1–24、106–165、352–427、648–666：交易日历、收付款及通知门槛、候选选择与账簿内连接。

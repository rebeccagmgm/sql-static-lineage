/*
金仕达 / 把三类资料接成销售基础记录（任务86842，grp_id=03）

02 确认书排序 → 选最新 ─────────────────────── a ─┐
03 持仓排序 → 选最新 → 补证券 → 按确认书汇总 ─ ins ┤
01 加工日的境内客户 ───────────────────────── cp ┤
02 源合约类型字典 ────────────────────────── sct ┘
                                                  ↓
                         本脚本按键连接、筛范围 → 11分类/本金/90列输出

接起来靠三组键，不靠名字：
  a.key_trade_comfirm_id（确认书ID）= ins.key_trade_comfirm_id
  a.counterparty_id（交易对手）= cp.client_id（客户编号）
  a.trs_type（互换类型）= sct.dw_cd_val（字典代码）

确认书ID不是主合约编号；客户/字典重复匹配可能扩展行数，不保证一确认书一行。
阅读入口：../04_业务模块/03_金仕达/README.md；@include不是Hive语法。
*/
-- @include ../../00_公共设置.sql

-- 一、准备资料：各文件内部按步骤阅读；编号是业务主题，不是数据库物理执行顺序。
WITH
-- @include ../03_金仕达/01_公共资料.sql
,
-- @include ../03_金仕达/02_合约及来源属性.sql
,
-- @include ../03_金仕达/03_标的及篮子.sql

-- 二、写入当前分支：仅覆盖指定加工日+grp_id分区；四个分支分开写入，不在此UNION。
insert overwrite table T98_OTC_DERI_COMP_SALE_INFO partition(busi_date = '${data_day_str}', grp_id = '03')
-- 三、装配目标字段：列顺序与统一DDL一致；分类、本金和固定值均在11中说明。
SELECT
-- @include ../03_金仕达/11_输出字段.sql
-- 四、连接加工主线：确认书a → 持仓标的ins / 境内客户cp / 类型字典sct。
from latest_confirmation a
-- 标的：以确认编号连接；末尾WHERE还要求标的万得代码非NULL，因此未匹配标的的确认会被剔除。
left join underlying_summary ins
on ins.key_trade_comfirm_id = a.key_trade_comfirm_id
-- 客户：a.counterparty_id直接连接境内客户；不经过TITANS客户编号映射。
LEFT JOIN sale_customer cp
on a.counterparty_id = cp.client_id
left join contract_type_dictionary sct
on sct.dw_cd_val = a.trs_type
-- 五、最终范围：保留EFFECTIVE、EFFECTIVE_PENDING、TERMINATED、TERMINATING、TERMINATING_PENDING。
-- 此条件包含已终止状态，不能简单理解为“仅存续合约”。
where a.Contr_Status in ('EFFECTIVE', 'EFFECTIVE_PENDING', 'TERMINATED', 'TERMINATING', 'TERMINATING_PENDING')
-- 额外门槛：起始日和标的万得代码必须非NULL；不额外剔除空字符串。
    and a.start_date is not null and ins.Undrl_Wd_Cd is not null
;

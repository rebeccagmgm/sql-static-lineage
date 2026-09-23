/*
11 / 把不同对象的信息放进同一份销售合约资料

先按“从谁取值”阅读，再看目标字段：
  trade / rt → 合约身份、日期、源类型、账簿及币种
  rcm / cp   → 客户编号与客户资料
  his_ini    → 结构腿初始持仓的标的摘要与金额；his_dy → 当日持仓金额
  rtl        → 结构腿的IPO、限售属性
  rtl_f      → 非结构腿的固定/浮动利率、利差及利率挂钩标的
  rel / mrg / mr / mp / TOCR → 关联合约、保证金、组合抵扣模式及实际结算日

这是主脚本SELECT的表达式清单，按目标表位置输出90个非分区字段；
busi_date/grp_id由主脚本指定。经营分类、本金与汇率两个文件通过include嵌入，不是独立结果表。
行末中文名取自目标DDL；涉及原字段与目标名称不一致的地方在下方补充说明。
*/
-- 01 身份与客户：确定合约编号及交易对手。
trade.internal_trade_id as Agt_Id, -- 合约编号
'TRS' as Busi_Type, -- 业务类型
rcm.outside_ctpty_code as Cutp_Pty_Id, -- 交易对手客户编号
cp.abbreviation as Cutp_Pty_Shor_Name, -- 交易对手当事人简称
cp.corporate_name as Cutp_Pty_Full_Name, -- 交易对手当事人名称
cp.Signature_Name as Sign_Prd_Name, -- 代签产品名称
cp.industry as Indt_Cd, -- 行业代码
cp.aptitude as Corp_Qual, -- 企业资质
-- 经营分类：展开09_经营分类.sql的代码、名称两列；与后面的源合约类型分开保留。
-- @include 09_经营分类.sql
-- 02 源系统类型：保留源类型及字典描述，与经营分类并列展示。
rt.trs_type as Src_Contr_Type, -- 源合约类型
sct.dw_cd_val_desc as Src_Contr_Type_Desc, -- 源合约类型描述
'' as Src_Sub_Contr_Type, -- 源合约子类型
'' as Src_Sub_Contr_Type_Desc, -- 源合约子类型描述
-- 03 标的及方向：展示初始持仓的标的摘要；当日持仓只参与动态本金。
-- 个股/篮子按证券表币种区分市场；本金换算则用合约币种选择汇率。
his_ini.underlying_ins_id as Undrl_Ins_Id, -- 标的ID
his_ini.wind_code as Undrl_Wd_Cd, -- 标的万得代码
his_ini.ins_sht_desc as Undrl_Name, -- 标的名称
case when his_ini.ins_family in ('EQUITY', 'GDR', 'BASKET') and his_ini.currency not in ('HKD', 'USD') then 'OTH_STOCK'
         when his_ini.ins_family in ('EQUITY', 'GDR', 'BASKET') and his_ini.currency = 'HKD' then 'HK_STOCK'
         when his_ini.ins_family in ('EQUITY', 'GDR', 'BASKET') and his_ini.currency = 'USD' then 'US_STOCK'
         when his_ini.ins_family not in ('EQUITY', 'GDR', 'BASKET') then 'NON_STOCK'
         else '-' end as Undrl_Type, -- 标的类型
'' as Undrl_Type_Desc, -- 标的类型描述
if(his_ini.interotc_underlying_category = 'BONDS', 'BOND', his_ini.ins_family) as Src_Undrl_Type, -- 源标的类型
if(his_ini.interotc_underlying_category = 'BONDS', '债券', his_ini.dw_cd_val_desc) as Src_Undrl_Type_Desc, -- 源标的类型描述
if(rtl.PRIVATE_PLACEMENT = 'Y', '1', '0') as Res_Flag, -- 限售标志
if(rtl.IPO_Type = 'Y', '1', '0') as IPO_Flag, -- IPO标志；来源ipo_type的元数据原注释为“【AI】限售类型”
if(rt.seller in ('10161','10142'), '1', '2') as Buy_Sell_Dir_Cd, -- 买卖方向代码；这里的1/2分支与期权的2/1相反，不能照搬
-- 04 人民币汇率与本金：展开10_本金与汇率.sql；持仓金额乘合约汇率。
-- @include 10_本金与汇率.sql
-- 05 生命周期：起止日、提前终止日、兑付日及状态码。
substring(rt.START_DATE, 1, 10) as Strt_Pric_Date, -- 期初定价日
substring(rt.End_Date, 1, 10) as End_Pric_Date, -- 期末定价日
substring(tocr.Actual_Settlement_Date, 1, 10) as Early_Term_Date, -- 提前终止日；原字段是合约报备中的“实际结算日”
substring(rt.Payment_Date, 1, 10) as Earn_Pymt_Date, -- 收益兑付日
rt.Time_To_Maturity as Term_Days, -- 期限天数
case when rt.contr_status in ('EFFECTIVE', 'EFFECTIVE_PENDING', 'TERMINATING', 'TERMINATING_PENDING') then '101'
         when rt.contr_status = 'TERMINATED' then '226'
         end as Agt_Stat_Cd, -- 协议状态代码
-- 06 内部关联与费用：流水号、组合、保证金及费率。
trade.key_otc_trade_id as Inr_Seri_No, -- 内部流水号
trade.key_instrument_id as Otc_Seri_No, -- 场外合约流水号
rt.bundle_id as bndl_id, -- 组合编号
rel.property_value as Rel_Agt_Id, -- 关联合约编号；当前互换的relatedOption属性值，与下方Marg_Agt_Id来源不同
mrg.Initial_Margin as Init_Marg_Prop, -- 初始保证金比例
mrg.MARGIN_BALANCE_INIT as init_Marg_Bal, -- 初始保证金
mp.deduction_pattern as Ddct_Ptrn, -- 抵扣模式
cp.commission_rate as cms_rate, -- 佣金费率
case when rtl_f.leg_type = 'FIXED_LEG_TYPE' then rtl_f.fixed_rate end as fixed_rate, -- 固定腿利率；仅FIXED_LEG_TYPE时取值
null as fee_rate, -- 实际费率
-- 07 共享目标表中的期权条款栏位：本分支没有关联期权条款，下面按原SQL填NULL。
-- 即使relatedOption有关联合约，也没有据它读取票息、敲入/敲出等条款。
null as Hedg_Type_Cd, -- 对冲类型代码
null AS Opt_Fee, -- 期权费
null as Opt_Fee_Paid_Date, -- 期权费支付日期
null as KO_Prtc_rate, -- 敲出参与率
null as KO_Yield, -- 敲出收益率
null as net_coll, -- 交易净收取
null as Coup_Rate, -- 票息
null as Min_OBS_DATE, -- 最小观察日
null as Max_OBS_DATE, -- 最大观察日
null as Up_Prtc_rate, -- 向上参与率
null as Down_Prtc_rate, -- 向下参与率
null as KI_Barr_PCT, -- 敲入障碍价
null as KO_Barr_PCT, -- 敲出障碍价
null as Strk_PCT, -- 执行价
null as DOWN_Strk_PCT, -- 下跌保护执行价格
null as UP_Strk_PCT, -- 封顶价格
-- 08 加工留痕：保留源代码与调度占位符，不在本地替换参数。
'TIT' AS Data_Src_Cd, -- 数据来源代码
UPPER('${filename}') AS Task_Name, -- 任务名
'${data_day_str}' AS Data_Etl_Date, -- 数据加载日期
'${data_day_str}' AS Data_Upt_Date, -- 数据更新日期
'${data_today}' AS Data_Time, -- 数据时间
-- 09 扩展属性：部门、估值、客户、账簿、卖方及跨币种字段。
trade.department as Book_Bel_Dept, -- 账簿所属部门
null as Bgng_Npv, -- 期初NPV
rt.contr_status as Src_Agt_Stat_Cd, -- 源合约状态
his_ini.ins_lng_desc as Undrl_Long_Name, -- 标的长名称
cp.client_qualify_review as Qual_Revw_Flag, -- 客户资质复核标志
rt.contract_code as Ext_Comp_No, -- 外部合约编号
rt.key_ctpty_id as Key_Cutp_Id, -- Titans客户编号
coalesce(his_ini.currency,'') as Undrl_Curr, -- 标的币种；初始持仓从证券表汇总，不是rt的合约币种
rtl_f.spread as Intr_Marg, -- 利差；这里直接读取已连接非结构腿的spread，未再限定腿类型
mrg.basic_margin_rate as Base_Marg_Rate, -- 基础保证金率
mr.Marg_Agt_Id, -- 保证金合约编号；有效关联关系中的期权交易键，去重后分号拼接
null as Opt_Fee_Rate, -- 期权费率
trade.book_key_book_id as Book_Agt_Id, -- 账簿协议编号
trade.Book_Name, -- 账簿名称
trade.Desk as Cntr, -- 柜台
IF(NVL(TRIM(rt.seller),'')='','',CONCAT('TIT060-',rt.seller)) as Sler_Cutp_Pty_Id, -- 销售方交易对手当事人编号
his_ini.future_type as Futr_Type, -- 期货类型
trade.business_type as Agt_Clas_Cd, -- 协议分类代码
rt.cross_currency_type as Cros_Crrc_Type_Cd, -- 跨币种类型代码
case when rtl_f.leg_type = 'FLOAT_LEG_TYPE' then rtl_f.fixed_rate end as Float_Base_Rate, -- 浮动基础利率；原字段仍叫fixed_rate，没有另查市场利率
case when rtl_f.leg_type = 'FLOAT_LEG_TYPE' then rtl_f.underlying_ins_id end as Float_Undrl_Cd, -- 浮动腿标的代码；原义“浮动利率挂钩标的”，与持仓证券分开
case when rtl_f.leg_type = 'FLOAT_LEG_TYPE' then rtl_f.floating_rate_cap end as Flot_Intrt_Ulmt, -- 浮动利率上限
rt.contract_use as Comp_Usag_Cd, -- 合约用途代码
rt.SETTLEMENT_CURRENCY as Sett_Crrc_Cd, -- 结算币种代码
rt.fx_rate_model as Ex_Rate_Model -- 汇率模式

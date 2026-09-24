-- 字段映射：这是主脚本 SELECT 的表达式清单，不是可以独立执行的SQL。
-- 落表按位置对应90个非分区字段，不能调整顺序；busi_date/grp_id 在主脚本分区子句指定。
-- 经营分类和标的属性已经在上游阶段完成；这里只排列90列，金额仍引用10模块。
-- 行末中文名取自本目录目标DDL；空串、NULL、字符串0分别沿用源表达式，不统一替换。
-- 01 身份与客户：确定合约编号及交易对手。
enriched.contract_id as Agt_Id, -- 合约编号
'OPTION' as Busi_Type, -- 业务类型
rcm.outside_ctpty_code as Cutp_Pty_Id, -- 交易对手客户编号
cp.abbreviation as Cutp_Pty_Shor_Name, -- 交易对手当事人简称
cp.corporate_name as Cutp_Pty_Full_Name, -- 交易对手当事人名称
cp.Signature_Name as Sign_Prd_Name, -- 代签产品名称
cp.industry as Indt_Cd, -- 行业代码
cp.aptitude as Corp_Qual, -- 企业资质
-- 经营分类：直接读取09阶段结果；下面另列源合约类型。
enriched.Contr_Type_Cd AS Contr_Type_Cd, -- 已由09阶段生成
 enriched.Contr_Type_Desc AS Contr_Type_Desc,
-- 02 源系统类型：保留源类型及字典描述，与经营分类并列展示。
enriched.source_contract_type as Src_Contr_Type, -- 源合约类型
enriched.source_contract_type_desc as Src_Contr_Type_Desc, -- 源合约类型描述
enriched.source_contract_sub_type as Src_Sub_Contr_Type, -- 源合约子类型
enriched.source_contract_sub_type_desc as Src_Sub_Contr_Type_Desc, -- 源合约子类型描述
-- 03 标的及方向：标的来源因分支而异，参见本分支03或07模块。
enriched.underlying_instrument_id as Undrl_Ins_Id, -- 标的ID
enriched.underlying_wind_code as Undrl_Wd_Cd, -- 标的万得代码
enriched.underlying_name as Undrl_Name, -- 标的名称
enriched.underlying_type as Undrl_Type, -- 标的类型
'' as Undrl_Type_Desc, -- 标的类型描述
enriched.source_underlying_type as Src_Undrl_Type, -- 源标的类型
enriched.source_underlying_type_desc as Src_Undrl_Type_Desc, -- 源标的类型描述
if(enriched.private_placement_flag = 'Y', '1', '0') as Res_Flag, -- 限售标志
'0' as IPO_Flag, -- IPO标志
if(enriched.seller_id in ('10161','10142'), '2', '1') as Buy_Sell_Dir_Cd, -- 买卖方向代码
-- 04 人民币汇率与本金：展开10模块的4列计算结果。
-- @include 10_本金与汇率.sql
-- 05 生命周期：起止日、提前终止日、兑付日及状态码。
substring(enriched.start_date, 1, 10) as Strt_Pric_Date, -- 期初定价日
substring(enriched.end_date, 1, 10) as End_Pric_Date, -- 期末定价日
substring(enriched.early_term_date, 1, 10) as Early_Term_Date, -- 提前终止日
substring(enriched.payment_date, 1, 10) as Earn_Pymt_Date, -- 收益兑付日
enriched.term_days as Term_Days, -- 期限天数
case when enriched.contract_status in ('EFFECTIVE', 'EFFECTIVE_PENDING', 'TERMINATING', 'TERMINATING_PENDING') then '101'
         when enriched.contract_status = 'TERMINATED' then '226'
         end as Agt_Stat_Cd, -- 协议状态代码
-- 06 内部关联与费用：流水号、组合、保证金及费率。
enriched.trade_id as Inr_Seri_No, -- 内部流水号
enriched.contract_instrument_id as Otc_Seri_No, -- 场外合约流水号
enriched.bundle_id as bndl_id, -- 组合编号
rel.property_value as Rel_Agt_Id, -- 关联合约编号
mrg.Initial_Margin as Init_Marg_Prop, -- 初始保证金比例
mrg.MARGIN_BALANCE_INIT as init_Marg_Bal, -- 初始保证金
mp.deduction_pattern as Ddct_Ptrn, -- 抵扣模式
cp.commission_rate as cms_rate, -- 佣金费率
null as fixed_rate, -- 固定腿利率
fee.fee_rate, -- 实际费率
-- 07 期权专属字段：没有来源的分支按原SQL填NULL，不代表业务值为0。
enriched.hedge_type as Hedg_Type_Cd, -- 对冲类型代码
enriched.premium AS Opt_Fee, -- 期权费
substring(enriched.premium_date, 1, 10) as Opt_Fee_Paid_Date, -- 期权费支付日期
enriched.knockout_extra_par as KO_Prtc_rate, -- 敲出参与率
    enriched.rebate_not_abs as KO_Yield, -- 敲出收益率
    ODS.NET_PNL as net_coll, -- 交易净收取
    RODC.COUPON_RATE as Coup_Rate, -- 票息
KO.Min_OBS_DATE, -- 最小观察日
KO.Max_OBS_DATE, -- 最大观察日
pr.Up_Prtc_rate, -- 向上参与率
    pr.Down_Prtc_rate, -- 向下参与率
    KI.DOWN_KI_BARRIER_PCT as KI_Barr_PCT, -- 敲入障碍价
    coalesce(KO.UP_KO_BARRIER_PCT,KO.DOWN_KO_BARRIER_PCT) as KO_Barr_PCT, -- 敲出障碍价
    STk.Strk_PCT, -- 执行价
    STk.DOWN_Strk_PCT, -- 下跌保护执行价格
    STk.UP_Strk_PCT, -- 封顶价格
-- 08 加工留痕：保留源代码与调度占位符，不在本地替换参数。
    'TIT' AS Data_Src_Cd, -- 数据来源代码
UPPER('${filename}') AS Task_Name, -- 任务名
'${data_day_str}' AS Data_Etl_Date, -- 数据加载日期
'${data_day_str}' AS Data_Upt_Date, -- 数据更新日期
'${data_today}' AS Data_Time, -- 数据时间
-- 09 扩展属性：部门、估值、客户、账簿、卖方及跨币种字段。
enriched.book_department as Book_Bel_Dept, -- 账簿所属部门
calc.initial_npv as Bgng_Npv, -- 期初NPV
enriched.contract_status as Src_Agt_Stat_Cd, -- 源合约状态
enriched.underlying_long_name as Undrl_Long_Name, -- 标的长名称
cp.client_qualify_review as Qual_Revw_Flag, -- 客户资质复核标志
enriched.external_contract_code as Ext_Comp_No, -- 外部合约编号
enriched.counterparty_key as Key_Cutp_Id, -- Titans客户编号
coalesce(enriched.underlying_currency,'') as Undrl_Curr, -- 标的币种
null as Intr_Marg, -- 利差
mrg.basic_margin_rate as Base_Marg_Rate, -- 基础保证金率
mr.Marg_Agt_Id, -- 保证金合约编号
    enriched.premium_rate as Opt_Fee_Rate, -- 期权费率
    enriched.book_id as Book_Agt_Id, -- 账簿协议编号
enriched.book_name, -- 账簿名称
enriched.book_desk as Cntr, -- 柜台
IF(NVL(TRIM(enriched.seller_id),'')='','',CONCAT('TIT060-',enriched.seller_id)) as Sler_Cutp_Pty_Id, -- 销售方交易对手当事人编号
enriched.future_type as Futr_Type, -- 期货类型
enriched.trade_business_type as Agt_Clas_Cd, -- 协议分类代码
enriched.cross_currency_type as Cros_Crrc_Type_Cd, -- 跨币种类型代码
'' as Float_Base_Rate, -- 浮动基础利率
'' as Float_Undrl_Cd, -- 浮动腿标的代码
'' as Flot_Intrt_Ulmt, -- 浮动利率上限
null as Comp_Usag_Cd, -- 合约用途代码
enriched.settlement_currency as Sett_Crrc_Cd, -- 结算币种代码
enriched.fx_rate_model as Ex_Rate_Model -- 汇率模式

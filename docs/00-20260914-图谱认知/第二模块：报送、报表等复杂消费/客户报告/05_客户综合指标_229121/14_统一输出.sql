-- 统一输出：前四项身份，随后各并列专题结果；模块之间不是串行加工。
-- 四项固定NULL：履保分级、风险压测、满意度总分/改进意见。缺数不等于零。
-- perf规模两列同式且补0；quota/fee/commission不补0；万元与亿元在此换算。
SELECT company_name,
	company_id,
	contact_sales,
	sales_login,
	cust_hold_win_rate,
	cust_win_rate,
	margin_ratio,
	margin_call_line,
	margin_grade,
	risk_test_data,
	outst_margin_amount,
	used_quota,
	approved_quota,
	approved_busi_type,
	margin_call_rate,
	cust_advance_info,
	credit_measure,
	cust_satisfaction_score,
	cust_satisfaction_feedback,
	swap_turnover_rate,
	swap_new_principal,
	swap_outst_month_end,
	swap_platform_fee,
	swap_bond_interest,
	swap_commission,
	busi_date FROM (
	 SELECT
    t0.company_name -- 公司全称：01底座
    ,t0.company_id -- USCC：01底座
    ,t0.contact_sales -- 销售姓名清单：01
    ,t0.sales_login -- 经办人登录号清单：01
    ,t1.cust_hold_win_rate -- 02结束合约创收正值占比，非客户投资收益率
    ,t2.cust_win_rate -- 03两期权类别共用分母的净收负值占比
    ,m1.margin_ratio -- 05按组合本金加权的履保比例
    ,m2.margin_call_line -- 06排除NULL追保线后重新加权
    ,null as margin_grade -- 固定NULL：履保分级未实现
    ,null as risk_test_data -- 固定NULL：风险压测未实现
    ,coalesce(perf.perf_dyna_nom_prin, 0) / 10000 as outst_margin_amount -- 08履保动态本金，缺失补0，元→万元
    ,coalesce(perf.perf_dyna_nom_prin, 0) / 10000 as used_quota -- 与上一列完全同式，不是独立额度占用计算
    ,lim.approved_limit / 10000 as approved_quota -- 07有效限额MAX，元→万元，未补0
    ,lim.approved_type as approved_busi_type -- 07原获批业务码值去重串
    ,mc.margin_call_rate -- 10按递延天数之和求比，不是按次数
    ,adv.cust_advance_info -- 11统计量填入硬编码模板
    ,cm.credit_measure -- 09对手方中文简称清单
    ,null as cust_satisfaction_score -- 固定NULL：满意度总分未实现
    ,null as cust_satisfaction_feedback -- 固定NULL：满意度改进意见未实现
    ,t3.swap_turnover_rate -- 04本月新增+平仓 / 上月末本金
    ,t3.swap_new_principal   / 10000     as swap_new_principal -- 04本月起始计提初始本金，元→万元
    ,t3.swap_outst_month_end / 100000000 as swap_outst_month_end -- 04上月末动态本金，元→亿元
    ,fee.swap_platform_fee   / 10000     as swap_platform_fee -- 12当日累计腿收益按类型归属后缩放10000；源币种未核，不等于已换成人民币
    ,fee.swap_bond_interest  / 10000     as swap_bond_interest -- 12借券类累计腿收益缩放10000；目标标签为万元，源币种见12说明
    ,com.swap_commission     / 10000     as swap_commission -- 13限定02/03的区间交易佣金，元→万元
    ,'${yyyy-MM-dd}' as busi_date -- 本次报告日，不是各源业务发生日

-- 228241：公司开仓记录为底座，并列补交易类型排名和估值统计。
-- t1=02开仓统计；t2=03类型前二；t3=04估值匹配样本，后者再引用05。
-- 最终只按公司ID和期间连接，不擅加名称条件；外层字段顺序保持原文。
SELECT company_name,
	company_id,
	time_period,
	weekly_trd_freq,
	avg_trd_amount,
	trd_win_rate,
	yield_rate,
	swap_first_trd_type,
	swap_second_trd_type,
	swap_first_trd_count,
	swap_second_trd_count,
	busi_date FROM (
	 
-- @include 01_指标输出.sql

from (
-- @include 02_开仓合约统计.sql

) t1
-- 关联：按笔数排序的前两大互换业务类型
left join (
-- @include 03_交易类型前两名.sql

) t2 on t1.company_id = t2.company_id 
     and t1.time_period = t2.time_period
-- 关联：计算交易胜率和收益率
left join (
-- @include 04_估值匹配与胜率样本.sql

) t3 on t1.company_id = t3.company_id 
     and t1.time_period = t3.time_period 
	) castTable

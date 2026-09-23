-- 六列输出：公司名称、USCC、协同栏目、说明、金额、报告日。
-- 托管说明固定NULL；研究说明检查02是否匹配；财富说明来自指标判断；商机说明来自部门集合。
-- cross_sale_amount按栏目取对应奖励汇总，未除10000、未COALESCE；不擅自标成万元或实付现金。
SELECT company_name,
	company_id,
	coop_dept,
	summary,
	cross_sale_amount,
	busi_date FROM (
SELECT
    t_base.company_name
    ,t_base.company_id
    ,d.coop_dept
    ,case d.coop_dept
        when '托管'     then null
        when '财富代销' then t_cfmx.summary
        when '研究服务' then if(t_tg_yjfw.company_name is not null, '有研究服务关系', '无研究服务关系')
        when '商机转介' then t_sjjz.summary
     end as summary
    ,case d.coop_dept
        when '托管'     then t_tg_yjfw.cross_sale_amount
        when '财富代销' then t_cfmx.cross_sale_amount
        when '研究服务' then t_tg_yjfw.cross_sale_amount
        when '商机转介' then t_sjjz.cross_sale_amount
     end    as cross_sale_amount
    ,'${yyyy-MM-dd}' as busi_date

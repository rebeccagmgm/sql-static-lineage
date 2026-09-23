-- 创收日报只提供客户范围：报告日快照、grp_id=01/02/03、上一年元旦至报告日的计提记录。
-- DISTINCT按公司全称+USCC去重，不按USCC单独统一名称，不另限Busi_Type/期初日/正创收。
-- CROSS JOIN固定展开托管/财富代销/研究服务/商机转介，先有栏目不代表实际合作发生。
-- 奖励表中有但创收客户底座没有的公司，不会反向新增到本表。
from (
    select distinct
        Cutp_Pty_Full_Name as company_name
        ,USCC as company_id
    from DM_OTC_N.OTC_REV_DAILY_RPT
    where busi_date = '${yyyy-MM-dd}'
      and grp_id in ('01','02','03')
      and Accrued_Date between '${yyyy,-1y}-01-01' and '${yyyy-MM-dd}'
) t_base
cross join (
    select '托管' as coop_dept union all
    select '财富代销' union all
    select '研究服务' union all
    select '商机转介'
) d

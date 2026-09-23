-- 两套独立判断：wei决定“有无财富代销”，t_rwd提供财富部门奖励；有代销不等于有奖励，反之亦然。
-- r：底座范围内按合约+公司全称+USCC+代签产品去重；Sign_Prd_Name关联wei的代签产品名称。
-- wei：季度指标经证券组合/营业部组合约束、产品代码→代签产品名映射，先按代签产品名SUM，再判断汇总>0。
-- 所以一个季度为正仍可能被其他季度负值抵消；index_val是判断指标，不作奖励金额/到账金额。
-- t_rwd：按公司名称汇总财富管理与经纪业务总部的Dev_Dept_Rwd，不从index_val计算奖励。
-- 子结果按名称+USCC+奖励金额分组，外层却只按USCC连接且未限栏目；同USCC异名可扩增全部四栏目。
left join (
    SELECT
        r.Cutp_Pty_Full_Name as company_name
        ,r.USCC as company_id
        ,case
            when sum(case when coalesce(wei.index_val, 0) > 0 then 1 else 0 end) > 0
             then '有财富代销'
             else '无财富代销'
         end as summary
        ,t_rwd.cross_sale_amount
    from (
        select distinct Agt_Id, Cutp_Pty_Full_Name, USCC,Sign_Prd_Name
        from DM_OTC_N.OTC_REV_DAILY_RPT
        where busi_date = '${yyyy-MM-dd}'
          and grp_id in ('01','02','03')
          and Accrued_Date between '${yyyy,-1y}-01-01' and '${yyyy-MM-dd}'
    ) r
    left join (
        select
            prd.signature_name
            ,sum(cast(idx.index_val as double)) as index_val
        from dm_index_n.index_grp2_TnrAmtProp_Season idx -- 产品×营业部&分公司&总部各部门_保有金额占比_剔除内部户&场外衍生品_季
        JOIN (
            SELECT grp_id, split(grp_val,'\\\.')[2] as prod_code
            FROM dm_index_n.grp_def WHERE grp_type_code IN ('NEWS_SECU')
        ) grp1 on idx.grp_id1 = grp1.grp_id
        JOIN (SELECT * FROM dm_index_n.grp_def WHERE grp_type_code IN ('BUSINESSOFFICE')) grp2
        on idx.grp_id2 = grp2.grp_id
        join(
            select distinct prod_code, signature_name
            from ODATA_N_OIS.O_OTC_DERIVATIVE_COUNTERPARTY
            where Busi_Date = '${yyyy-MM-dd}'
        ) prd on grp1.prod_code = prd.prod_code
        where idx.busi_quat between '${yyyy,-1y}Q1' and concat('${yyyy}Q', quarter('${yyyy-MM-dd}')) -- busi_quat=业务季度；index_val=指标值，非奖励金额
          and idx.tag_id = 'tag999999999'
        group by prd.signature_name
    ) wei
    on r.Sign_Prd_Name = wei.signature_name
    left join (
        SELECT
            Pty_Cutp_Name
            ,sum(Dev_Dept_Rwd) as cross_sale_amount
        from pdata_n.T98_OTC_DERI_UNDRL_INCOME_RWD_SUM
        where busi_date = '${yyyy-MM-dd}'
          and src_tbl = 'ODATA_N_OIS.G_CROSS_INCOME_REWARD'
          and Sett_Time between '${yyyy,-1y}01' and concat('${yyyy}0', quarter('${yyyy-MM-dd}'))
          and Bel_Inr_Org_Name = '财富管理与经纪业务总部'
        group by Pty_Cutp_Name
    ) t_rwd on r.Cutp_Pty_Full_Name = t_rwd.Pty_Cutp_Name
    group by r.Cutp_Pty_Full_Name, r.USCC, t_rwd.cross_sale_amount
) t_cfmx on t_base.company_id = t_cfmx.company_id

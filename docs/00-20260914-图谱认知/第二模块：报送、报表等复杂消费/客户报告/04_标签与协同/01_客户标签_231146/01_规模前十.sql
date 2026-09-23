-- 来源：DM_OTC_N.OTC_REV_DAILY_RPT 合约创收日报。
-- 取报告快照中的当日计提规模，按客户名称+USCC+业务类型求和；无grp_id筛选。
-- Dyna_Nom_Prin=动态本金；DENSE_RANK按规模名次，保留前十名次而非固定十个客户。
    SELECT
        Cutp_Pty_Full_Name as company_name
        ,USCC as company_id
        ,case when Busi_Type = 'OPTION' then '前十大期权客户'
              when Busi_Type = 'TRS' then '前十大互换客户'
         end as tag_name
        ,dense_rank() over(partition by Busi_Type order by sum(cast(Dyna_Nom_Prin as double)) desc) as rn
    from DM_OTC_N.OTC_REV_DAILY_RPT
    where busi_date = '${yyyy-MM-dd}'
      and Accrued_Date = '${yyyy-MM-dd}'
      and Busi_Type in ('OPTION', 'TRS')
    group by Cutp_Pty_Full_Name, USCC, Busi_Type

-- 互换佣金 com：报告日创收快照、上一年元旦至报告日的 trd_cms（交易佣金）求和。
-- grp03全取；grp02仅Agt_Clas_Cd=TRS_SAC_OTC且指定南下类型（普通南下还必须标的EQUITY）。
-- 不是所有普通互换，也未加Busi_Type过滤；逐行NULL佣金补0，无匹配公司仍保持NULL。
-- 最终统一除10000；不能将本佣金再与已含佣金的Curr_Rev相加当总创收。
    SELECT
        s.Cutp_Pty_Full_Name as company_name
        ,sum(coalesce(cast(s.trd_cms as double), 0)) as swap_commission
    from DM_OTC_N.OTC_REV_DAILY_RPT s
    where s.busi_date = '${yyyy-MM-dd}'
      and(
        s.grp_id = '03'
        or

        s.grp_id = '02'
        and s.Agt_Clas_Cd = 'TRS_SAC_OTC'
        and ((s.Src_Contr_Type = 'S_CROSS_SWAP' and s.Src_Undrl_Type = 'EQUITY') or s.Src_Contr_Type in ('S_CROSS_OPTION_SWAP','S_CROSS_FUTURE_SWAP'))
      )
      and s.Accrued_Date between '${yyyy,-1y}-01-01' and '${yyyy-MM-dd}'
    group by s.Cutp_Pty_Full_Name

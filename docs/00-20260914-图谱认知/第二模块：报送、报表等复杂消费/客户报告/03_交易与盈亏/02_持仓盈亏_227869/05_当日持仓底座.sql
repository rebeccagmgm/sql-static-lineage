-- 最终输出主体：创收日报的报告日快照，grp_id=01/02/03且计提日=报告日。
-- 按USCC+公司全称+标的代码+名称汇总动态本金；无正本金条件，零/负/NULL组也可能保留。
-- 不读取Curr_Rev来代替盈亏，亦不按业务类型分组；同公司同标的可合并期权/互换本金。
-- 同标的不同名称会分开，同名不同USCC也分开；这与06仅按公司名称计算窗口分母不同。
    SELECT
        Cutp_Pty_Full_Name          as company_name
        ,USCC                       as company_id
        ,Undrl_Wd_Cd                as underlying_code
        ,Undrl_Name                 as underlying_name
        ,sum(Dyna_Nom_Prin)  as hold_amount
    from DM_OTC_N.OTC_REV_DAILY_RPT
    where busi_date = '${yyyy-MM-dd}'
      and grp_id in ('01', '02', '03')
      and Accrued_Date = '${yyyy-MM-dd}'
    group by USCC, Cutp_Pty_Full_Name, Undrl_Wd_Cd, Undrl_Name

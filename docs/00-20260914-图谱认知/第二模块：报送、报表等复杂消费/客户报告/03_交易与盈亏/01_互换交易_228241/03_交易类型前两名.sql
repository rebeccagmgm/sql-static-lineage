-- 与02使用相同入选条件，但另按Contr_Type_Desc（合约类型描述）分组。
-- 每类型内部数不同合约，ROW_NUMBER排序后横向放成前两列。
-- 笔数相同没有第二排序键，不能声称并列业务中哪一个稳定第一。

    SELECT
        company_id
        ,company_name
        ,time_period
        ,max(case when rn = 1 then Contr_Type_Desc end) as swap_first_trd_type   -- 第一业务类型
        ,max(case when rn = 2 then Contr_Type_Desc end) as swap_second_trd_type  -- 第二业务类型
        ,max(case when rn = 1 then trd_count end) as swap_first_trd_count        -- 第一业务类型笔数
        ,max(case when rn = 2 then trd_count end) as swap_second_trd_count       -- 第二业务类型笔数
    from (
        SELECT
            USCC as company_id
            ,Cutp_Pty_Full_Name as company_name
            ,time_period
            ,Contr_Type_Desc
            ,count(distinct Agt_Id) as trd_count
            -- 按笔数降序排序，取前两名
            ,row_number() over(partition by USCC, Cutp_Pty_Full_Name, time_period 
                               order by count(distinct Agt_Id) desc) as rn
        from DM_OTC_N.OTC_REV_DAILY_RPT
        lateral view explode(array('近一年', '历史')) t as time_period
        where busi_date = '${yyyy-MM-dd}'
          and Busi_Type = 'TRS'
          and Accrued_Date = Strt_Pric_Date -- 只统计新开仓交易
          and ((time_period = '近一年' and Accrued_Date between '${yyyy,-1y}-01-01' and '${yyyy-MM-dd}')
               or (time_period = '历史' and Accrued_Date <= '${yyyy-MM-dd}'))
        group by USCC, Cutp_Pty_Full_Name, time_period, Contr_Type_Desc
    ) t
    where rn <= 2  -- 只取前两名
    group by company_id, company_name, time_period

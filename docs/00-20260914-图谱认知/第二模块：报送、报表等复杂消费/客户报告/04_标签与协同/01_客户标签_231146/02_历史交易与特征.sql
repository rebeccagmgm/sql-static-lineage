-- 来源：创收日报起始日记录；T98_OTC_DERI_COMP_SALE_INFO 合约主信息提供同名客户限售个股信号。
-- Init_Nom_Prin=初始本金，平均的是入选行；没有按Agt_Id去重，也没额外筛日期或grp_id。
-- Contr_Type_Desc=合约类型描述，原文字直接成为标签；高换手仅检查是否存在grp03，不算换手率。
-- t98_tag仅按客户名匹配，证据可以来自不同合约；金额小标签与定增/高换手可同时出现。
    SELECT
        s.company_name
       ,s.company_id
       ,t.tag_name
       ,null as rn
    from (
        SELECT
            r.Cutp_Pty_Full_Name as company_name
           ,r.USCC as company_id
           ,concat(
                -- 交易类型数组（已去重）
                collect_set(r.Contr_Type_Desc),
                -- 其他标签数组
                    array(
                        case when max(case when t98_tag.Cutp_Pty_Full_Name is not 
                                           null then 1 else 0 end) > 0 
                             then '定增客户' 
                             else null 
                        end,
                        case when avg(cast(r.Init_Nom_Prin as double)) < 1000000 
                             then '单笔交易小' 
                             else null 
                        end,
                        case when sum(case when r.grp_id = '03' then 1 else 0 end) > 0 
                             then '高换手' 
                             else null 
                        end
                    )
            ) as tag_arr
        from DM_OTC_N.OTC_REV_DAILY_RPT r
        -- 关联T98判断是否满足"定增客户"条件(个股+限售)
        left join (
            SELECT distinct Cutp_Pty_Full_Name
            from pdata_n.T98_OTC_DERI_COMP_SALE_INFO t98
            where t98.busi_date = '${yyyy-MM-dd}'
              and t98.grp_id in ('01','02','03')
              and t98.Src_Undrl_Type = 'EQUITY'
              and t98.Res_Flag = '1'
        ) t98_tag
            on r.Cutp_Pty_Full_Name = t98_tag.Cutp_Pty_Full_Name
        where r.busi_date = '${yyyy-MM-dd}'
          and r.Strt_Pric_Date = r.Accrued_Date
        group by r.Cutp_Pty_Full_Name, r.USCC
    ) s
    lateral view outer explode(s.tag_arr) t as tag_name
    where t.tag_name is not null

-- 本文件生产u标的盈亏池；上传分配x的直接查询和连接在00，不在本文件汇总。
-- u：独立从11个指定账簿汇总标的日盈亏；x：query_upload.otc_rev_allocated上传分配额。
-- 盈亏池账簿范围不等于收入领取者范围：领取者只限10016、指定5标的、INDEX_ENHANCE_SWAP。
-- 先以账簿Map_Undrl_Cd优先，空串/NULL才回退证券undrl_clas；通过交易产品关系→结构腿→腿持仓确定备用工具。
-- u按标的+历史持仓日聚合；x原样连接无聚合无去重，多条上传会扩行、改变窗口分母。
-- 后续07将u+x整体按合格合约的逐日本金占比分摊，不是把11个账簿的合约一起当分母。
-- 本文件提供u查询体；外层JOIN与ON在00主脚本，实际公式继续在收入模块。
select
        nvl(if(rb.Map_Undrl_Cd='',null,rb.Map_Undrl_Cd),ins.undrl_clas) as Map_Undrl_Cd,
        sum(b.Tdy_Yield) as Tdy_Yield,
        b.busi_date
    from (
        select * from PDATA_N.T98_OTC_BOOK_HOLD_SUM
        where src_tbl = 'ODATA_N_TIT.D_POS_POSITION_DAILY' and busi_date >= '2022-01-01'
        ) b
    inner join (
        select * from PDATA_N.T03_OTC_DERI_BOOK_ADTNL_INFO
        where src_tbl = 'ODATA_N_TIT.D_REF_BOOK' and busi_date = '${yyyy-MM-dd}'
            and Book_Agt_Id in ('10016','10015','10014','10008','10012','10162','10190','10191','10192','10193','10202')
        ) rb
    on rb.Book_Agt_Id = b.Book_Agt_Id
    left join (
        select * from PDATA_N.T03_AGT_PRD_RELA_H
        where SRC_TBL = 'ODATA_N_TIT.D_TRD_OTC_TRADE' and Agt_Prd_Rela_Type_Cd = '01'
            and strt_date <= '${yyyy-MM-dd}' and end_date > '${yyyy-MM-dd}'
        ) tot
    on b.Src_Prd_Id = tot.Src_Prd_Id
    left join (
        select *
        from PDATA_N.T03_OTC_SWAP_COMP_LEG_INFO
        where src_tbl = 'ODATA_N_TIT.D_REF_TRS_LEG' and busi_date = '${yyyy-MM-dd}' and Swap_Comp_Leg_Type_Cd = 'STRUCTURE_LEG_TYPE'
        ) leg
    on leg.Swap_Comp_Agt_Id = tot.Agt_Id 
    left join (
        select * from PDATA_N.T03_OTC_SWAP_COMP_HOLD_INFO
        where src_tbl = 'ODATA_N_TIT.D_POS_TRS_LEG_HIS_POS' and busi_date >= '2022-01-01'
        ) leg_pos
    on leg_pos.Leg_Glbl_Seq_No = leg.Leg_Glbl_Seq_No and leg_pos.busi_date = b.busi_date
    left join (
        select * from pdata_news_n.t02_tit_scr_base_info
        where src_id = 'TIT' and grp_id = '01'
        ) ins
    on ins.in_code = coalesce(leg_pos.Src_Prd_Id, b.Src_Prd_Id)
    where nvl(if(rb.Map_Undrl_Cd='',null,rb.Map_Undrl_Cd),ins.undrl_clas) in ('000905.SH','000852.SH','000016.SH','000300.SH','8841431.WI')
    group by b.busi_date, nvl(if(rb.Map_Undrl_Cd='',null,rb.Map_Undrl_Cd),ins.undrl_clas)

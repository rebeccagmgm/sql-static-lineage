-- 本文件只生产u标的盈亏池；并列的pe/pd查询直接在00主脚本，不在本模块计算。
-- pe：T98_SB_TIT_DAY_HOLD_INDX，每日持仓指标中的模拟对冲盈亏与delta。
-- pd：T98_OTC_BOOK_HOLD_SUM，合约当日持仓盈亏；pe/pd都按场外流水号+账簿+明细日匹配。
-- pe额外限制DYNAMIC_HEDGING，pd没有柜台限制，所以静态组也使用pd。
-- u：动态对冲账簿的标的日总盈亏。先用账簿映射标的，空串/NULL才回退工具undrl_clas，再按标的+日汇总。
-- u并非从pe聚合；它独立读取账簿持仓，经过交易产品关系→互换结构腿→腿持仓→证券基础资料确定备用标的。
-- info标的代码+明细日连接u；动态窗口则按pe.Undrl_Sum_Compr+pe.busi_date分组，两者键不能混称相同。
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
        where src_tbl = 'ODATA_N_TIT.D_REF_BOOK' and busi_date = '${yyyy-MM-dd}' and Cntr = 'DYNAMIC_HEDGING'
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
    group by nvl(if(rb.Map_Undrl_Cd='',null,rb.Map_Undrl_Cd),ins.undrl_clas), b.busi_date

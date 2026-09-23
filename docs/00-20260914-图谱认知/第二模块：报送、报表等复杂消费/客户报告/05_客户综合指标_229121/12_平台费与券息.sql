-- 平台费与券息 fee：当日互换腿估值接当日02销售合约，真实键是 Exp_Comp_No=Agt_Id。
-- T98_OTC_SWAP_COMP_LEG_VALU_INFO：Accum_Unrlz_Yield累计未实现收益+Accum_Rlz_Yield累计已实现收益。
-- FLOAT与FIXED两类腿都进来；由合约类型决定平台费或券息，不是按浮动/固定腿分别归属。
-- 只看当日累计估值，不是上一年元旦以来逐日求和；一项收益NULL使本行加法NULL。无币种换算/反号。
    SELECT
        s.Cutp_Pty_Full_Name as company_name

        ,sum(
            case when s.Src_Contr_Type_Desc in (
                '南下跨境','南下跨境（场内期权）','南下跨境（期货）','多头持券'
            ) then
                cast(v.Accum_Unrlz_Yield as double)
              + cast(v.Accum_Rlz_Yield as double)
            else 0 end
        ) as swap_platform_fee

        ,sum(
            case when s.Src_Contr_Type_Desc in (
                '跨境借券','借券互换'
            ) then
                cast(v.Accum_Unrlz_Yield as double)
              + cast(v.Accum_Rlz_Yield as double)
            else 0 end
        ) as swap_bond_interest
    from PDATA_N.T98_OTC_SWAP_COMP_LEG_VALU_INFO v
    inner join pdata_n.T98_OTC_DERI_COMP_SALE_INFO s
        on v.Exp_Comp_No = s.Agt_Id
        and s.busi_date = '${yyyy-MM-dd}'
        and s.grp_id = '02'
    where v.busi_date = '${yyyy-MM-dd}'
      and v.src_tbl = 'ODATA_N_TIT.D_POS_TRS_LEG_VALUATION'
      and v.Swap_Comp_Leg_Type_Cd in ('FLOAT_LEG_TYPE', 'FIXED_LEG_TYPE')
    group by s.Cutp_Pty_Full_Name

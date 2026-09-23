INSERT OVERWRITE TABLE T98_SB_OTC_DERI_TRD_EVT_SUM PARTITION(Data_Src_Cd,BUSI_DATE)
-----------------------------------------------------------------------------------------------------
--Group16: 期权开仓
-----------------------------------------------------------------------------------------------------
select
     CONCAT('TIT-',deal.Opt_Comp_Agt_Id,'-',deal.Opt_Comp_Agt_Modifr)  AS Evt_Id                   --事件编号
    ,ds.Undrl_Cd                                                       AS Fin_Inst_Cd              --金融工具代码
    ,''                                                                AS Xir_Ast_Type_Cd          --恒泰资产类型代码
    ,''                                                                AS Src_Exch_Type            --源市场类型
    ,ri.Mkt_Cd                                                         AS Exch_Type_Cd             --市场代码
    ,deal.Ext_Comp_No                                                  AS Ext_Ord_Id               --外部交易号
    ,ds.Bgng_Prcg_Date                                                 AS Trd_Date                 --交易日期
    ,deal.Cutp_Pty_Id                                                  AS Cutp_Pty_Id              --交易对手当事人编号
    ,RCP.Full_Name_Ch                                                  AS Cutp_Pty_Name            --交易对手当事人名称
    ,''                                                                AS Lvl1_Scr_Acct_Agt_Id     --一级证券账户协议编号
    ,''                                                                AS Lvl1_Scr_Acct_Agt_Modifr --一级证券账户协议修饰符
    ,trade.Rela_Agt_Id                                                 AS Lvl2_Scr_Acct_Agt_Id     --二级证券账户协议编号
    ,trade.Rela_Agt_Modifr                                             AS Lvl2_Scr_Acct_Agt_Modifr --二级证券账户协议修饰符
    ,'1'                                                               AS Src_Busi_Type_Cd         --源业务类型代码
    ,'1'                                                               AS Src_Trd_Chg_Type_Cd      --源交易变动类型代码 --1、场外期权 2、收益互换
    ,deal.Init_Nom_Prin                                                AS Chg_Amt                  --变动金额           --1、开仓 2、提前终止 3、到期终止 4、期权费收付 5、预付金收付 6. 凭证本金收付
    ,''                                                                AS Fnd_Net_Date             --资金收付日期
    ,'0'                                                               AS Fnd_Net_Amt              --资金收付金额
    ,deal.Create_User                                                  AS Trdr                     --交易员
    ,''                                                                AS Remark                   --备注
    ,'${filename}'                                                AS Task_Name                --任务名
    ,'${data_day_str}'                                            AS Data_Etl_Date            --数据加载日期
    ,'${data_today_str}'                                          AS Data_Upt_Date            --数据更新日期
    ,'${data_today}'                                              AS Data_Time                --数据时间     
    ,'TIT'                                                             AS Data_Src_Cd              --数据来源代码
    ,'${data_day_str}'                                            AS Busi_Date                --业务日期
from (select * from PDATA_N.T03_OTC_OPT_COMP_INFO where SRC_TBL='ODATA_N_TIT.D_REF_OTC_OPTION_DEAL' and BUSI_DATE='${data_day_str}') deal
left join (select * from PDATA_N.T03_OTC_OPT_COMP_STRU_ELMN_INFO where SRC_TBL='ODATA_N_TIT.D_REF_OPTION_DEAL_STRUCTURE' and BUSI_DATE='${data_day_str}') ds
on deal.Opt_Comp_Agt_Id = ds.Opt_Comp_Agt_Id
left join (SELECT * FROM PDATA_N.T03_AGT_RELA_H where Agt_Rela_Type_Cd='N04' and strt_date<='${data_day_str}' and end_date>'${data_day_str}' AND SRC_TBL='ODATA_N_TIT.D_TRD_OTC_TRADE') trade
on deal.Opt_Comp_Agt_Id = trade.Agt_Id
left join (SELECT * FROM pdata_news_n.t02_scr_base_info where Src_Id = 'TIT') ri
on ds.Prd_Id = ri.src_sys_prdno
  left join (SELECT * FROM PDATA_N.T01_PTY_NAME WHERE BUSI_DATE='${data_day_str}' and SRC_TBL='ODATA_N_TIT.D_REF_COUNTER_PARTY') RCP
on deal.Cutp_Pty_Id = rcp.Pty_Id
join (SELECT * FROM PDATA_N.T98_OTC_DERI_BOOK_INFO WHERE BUSI_DATE='${data_day_str}') rb
on trade.Rela_Agt_Id = rb.Book_Agt_Id
where 1=1
and rb.Bel_Dept = 'GFS_FICC'
and rb.Book_Full_Name not like '%虚拟%'
AND deal.Comp_Stat_Cd NOT IN ('218')


union all

-----------------------------------------------------------------------------------------------------
--Group17: 部分平仓
-----------------------------------------------------------------------------------------------------
select 
     e.Evt_Id                                                          AS Evt_Id                   --事件编号
    ,ds.Undrl_Cd                                                       AS Fin_Inst_Cd              --金融工具代码
    ,''                                                                AS Xir_Ast_Type_Cd          --恒泰资产类型代码
    ,''                                                                AS Src_Exch_Type            --源市场类型
    ,ri.Mkt_Cd                                                         AS Exch_Type_Cd             --市场代码
    ,deal.Ext_Comp_No                                                  AS Ext_Ord_Id               --外部交易号
    ,e.Evt_Date                                                        AS Trd_Date                 --交易日期
    ,deal.Cutp_Pty_Id                                                  AS Cutp_Pty_Id              --交易对手当事人编号
    ,RCP.Full_Name_Ch                                                  AS Cutp_Pty_Name            --交易对手当事人名称
    ,''                                                                AS Lvl1_Scr_Acct_Agt_Id     --一级证券账户协议编号
    ,''                                                                AS Lvl1_Scr_Acct_Agt_Modifr --一级证券账户协议修饰符
    ,trade.Rela_Agt_Id                                                 AS Lvl2_Scr_Acct_Agt_Id     --二级证券账户协议编号
    ,trade.Rela_Agt_Modifr                                             AS Lvl2_Scr_Acct_Agt_Modifr --二级证券账户协议修饰符 --1、场外期权 2、收益互换
    ,'1'                                                               AS Src_Busi_Type_Cd         --源业务类型代码         --1、开仓 2、提前终止 3、到期终止 4、期权费收付 5、预付金收付 6. 凭证本金收付
    ,'2'                                                               AS Src_Trd_Chg_Type_Cd      --源交易变动类型代码
    ,abs(e.Nom_Prin_Chg_Delta)* (-1)                                   AS Chg_Amt                  --变动金额
    ,ti.payment_date                                                   AS Fnd_Net_Date             --资金收付日期
    ,ti.amount_adjusted                                                AS Fnd_Net_Amt              --资金收付金额
    ,e.Create_User                                                     AS Trdr                     --交易员
    ,''                                                                AS Remark                   --备注
    ,'${filename}'                                                AS Task_Name                --任务名
    ,'${data_day_str}'                                            AS Data_Etl_Date            --数据加载日期
    ,'${data_today_str}'                                          AS Data_Upt_Date            --数据更新日期
    ,'${data_today}'                                              AS Data_Time                --数据时间     
    ,'TIT'                                                             AS Data_Src_Cd              --数据来源代码
    ,'${data_day_str}'                                            AS Busi_Date                --业务日期
from (select * from PDATA_N.T05_OTC_COMP_DURA_CHG_EVT where Src_Tbl='ODATA_N_TIT.D_TRD_OPTION_EVENT' ) e
join (select * from PDATA_N.T03_OTC_OPT_COMP_INFO where SRC_TBL='ODATA_N_TIT.D_REF_OTC_OPTION_DEAL' and BUSI_DATE='${data_day_str}') deal
on e.Otc_Comp_Agt_Id = deal.Opt_Comp_Agt_Id
left join (select * from PDATA_N.T03_OTC_OPT_COMP_STRU_ELMN_INFO where SRC_TBL='ODATA_N_TIT.D_REF_OPTION_DEAL_STRUCTURE' and BUSI_DATE='${data_day_str}') ds
on deal.Opt_Comp_Agt_Id = ds.Opt_Comp_Agt_Id
left join (SELECT * FROM PDATA_N.T03_AGT_RELA_H where Agt_Rela_Type_Cd='N04' and strt_date<='${data_day_str}' and end_date>'${data_day_str}' AND SRC_TBL='ODATA_N_TIT.D_TRD_OTC_TRADE') trade
on deal.Opt_Comp_Agt_Id = trade.Agt_Id
left join (SELECT * FROM pdata_news_n.t02_scr_base_info where Src_Id = 'TIT') ri
on ds.Prd_Id = ri.src_sys_prdno
  left join (SELECT * FROM PDATA_N.T01_PTY_NAME WHERE BUSI_DATE='${data_day_str}' and SRC_TBL='ODATA_N_TIT.D_REF_COUNTER_PARTY') RCP
on deal.Cutp_Pty_Id = rcp.Pty_Id
join (SELECT * FROM PDATA_N.T98_OTC_DERI_BOOK_INFO WHERE BUSI_DATE='${data_day_str}') rb
on trade.Rela_Agt_Id = rb.Book_Agt_Id
left join (
select substr(t.Paid_Date,1,10) payment_date,substr(t.Clr_Date,1,10) clearing_date,t.Trd_Id,sum(t.Aft_Adj_Amt) amount_adjusted
from PDATA_N.T05_OTC_RECV_PYMT_EVT  t
where t.Src_Prd_Type_Cd = 'OTC_OPTION_CONTRACT'
and src_tbl= 'ODATA_N_TIT.D_TRD_TRANSFER' and del_flag='0'
and t.Recv_Pymt_Stat_Cd = 'VERIFIED'
group by substr(t.Paid_Date,1,10),substr(t.Clr_Date,1,10),t.Trd_Id
)ti
on ti.Trd_Id = e.Otc_Comp_Agt_Id and ti.clearing_date = e.Evt_Date
where 1=1
AND e.Evt_Stat_Cd = '3'
and rb.Bel_Dept = 'GFS_FICC'
and rb.Book_Full_Name not like '%虚拟%'
AND deal.Comp_Stat_Cd NOT IN ('218')
and e.Evt_Type_Cd in ('PARTIAL_TERMINATION')

union all

-----------------------------------------------------------------------------------------------------
--Group18: 期权提前终止或到期终止
-----------------------------------------------------------------------------------------------------
select 
     CONCAT('TIT-',deal.Opt_Comp_Agt_Id,'-',deal.Opt_Comp_Agt_Modifr)  AS Evt_Id                   --事件编号
    ,ds.Undrl_Cd                                                       AS Fin_Inst_Cd              --金融工具代码
    ,''                                                                AS Xir_Ast_Type_Cd          --恒泰资产类型代码
    ,''                                                                AS Src_Exch_Type            --源市场类型
    ,ri.Mkt_Cd                                                         AS Exch_Type_Cd             --市场代码
    ,deal.Ext_Comp_No                                                  AS Ext_Ord_Id               --外部交易号
    ,deal.Erly_Trmt_Date                                               AS Trd_Date                 --交易日期
    ,deal.Cutp_Pty_Id                                                  AS Cutp_Pty_Id              --交易对手当事人编号
    ,RCP.Full_Name_Ch                                                  AS Cutp_Pty_Name            --交易对手当事人名称
    ,''                                                                AS Lvl1_Scr_Acct_Agt_Id     --一级证券账户协议编号
    ,''                                                                AS Lvl1_Scr_Acct_Agt_Modifr --一级证券账户协议修饰符
    ,trade.Rela_Agt_Id                                                 AS Lvl2_Scr_Acct_Agt_Id     --二级证券账户协议编号
    ,trade.Rela_Agt_Modifr                                             AS Lvl2_Scr_Acct_Agt_Modifr --二级证券账户协议修饰符
    ,'1'                                                               AS Src_Busi_Type_Cd         --源业务类型代码      --1、场外期权 2、收益互换
    ,case when substr(deal.Erly_Trmt_Date,1,10) = substr(ds.End_Prcg_Date,1,10) then '3' else '2' end 
                                                                       AS Src_Trd_Chg_Type_Cd      --源交易变动类型代码  --1、开仓 2、提前终止 3、到期终止 4、期权费收付 5、预付金收付 6. 凭证本金收付
    ,deal.Nom_Prin * (-1)                                              AS Chg_Amt                  --变动金额
    ,ti.payment_date                                                   AS Fnd_Net_Date             --资金收付日期
    ,ti.amount_adjusted                                                AS Fnd_Net_Amt              --资金收付金额
    ,deal.Create_User                                                  AS Trdr                     --交易员
    ,''                                                                AS Remark                   --备注
    ,'${filename}'                                                AS Task_Name                --任务名
    ,'${data_day_str}'                                            AS Data_Etl_Date            --数据加载日期
    ,'${data_today_str}'                                          AS Data_Upt_Date            --数据更新日期
    ,'${data_today}'                                              AS Data_Time                --数据时间     
    ,'TIT'                                                             AS Data_Src_Cd              --数据来源代码
    ,'${data_day_str}'                                            AS Busi_Date                --业务日期
from (select * from PDATA_N.T03_OTC_OPT_COMP_INFO where SRC_TBL='ODATA_N_TIT.D_REF_OTC_OPTION_DEAL' and BUSI_DATE='${data_day_str}') deal
left join (select * from PDATA_N.T03_OTC_OPT_COMP_STRU_ELMN_INFO where SRC_TBL='ODATA_N_TIT.D_REF_OPTION_DEAL_STRUCTURE' and BUSI_DATE='${data_day_str}') ds
on deal.Opt_Comp_Agt_Id = ds.Opt_Comp_Agt_Id
left join (SELECT * FROM PDATA_N.T03_AGT_RELA_H where Agt_Rela_Type_Cd='N04' and strt_date<='${data_day_str}' and end_date>'${data_day_str}' AND SRC_TBL='ODATA_N_TIT.D_TRD_OTC_TRADE') trade
on deal.Opt_Comp_Agt_Id = trade.Agt_Id
left join (SELECT * FROM pdata_news_n.t02_scr_base_info where Src_Id = 'TIT') ri
on ds.Prd_Id = ri.src_sys_prdno
  left join (SELECT * FROM PDATA_N.T01_PTY_NAME WHERE BUSI_DATE='${data_day_str}' and SRC_TBL='ODATA_N_TIT.D_REF_COUNTER_PARTY') RCP
on deal.Cutp_Pty_Id = rcp.Pty_Id
join (SELECT * FROM PDATA_N.T98_OTC_DERI_BOOK_INFO WHERE BUSI_DATE='${data_day_str}') rb
on trade.Rela_Agt_Id = rb.Book_Agt_Id
left join (
select substr(t.Paid_Date,1,10) payment_date,substr(t.Clr_Date,1,10) clearing_date,t.Trd_Id,sum(t.Aft_Adj_Amt) amount_adjusted
from PDATA_N.T05_OTC_RECV_PYMT_EVT  t
where t.Src_Prd_Type_Cd = 'OTC_OPTION_CONTRACT'
and src_tbl= 'ODATA_N_TIT.D_TRD_TRANSFER' and del_flag='0'
and t.Recv_Pymt_Stat_Cd = 'VERIFIED'
group by substr(t.Paid_Date,1,10),substr(t.Clr_Date,1,10),t.Trd_Id
) ti
on ti.Trd_Id = deal.Opt_Comp_Agt_Id and ti.clearing_date = deal.Erly_Trmt_Date

where 1=1
and rb.Bel_Dept = 'GFS_FICC'
and rb.Book_Full_Name not like '%虚拟%'
AND deal.Comp_Stat_Cd NOT IN ('218')
and deal.Erly_Trmt_Date is not null


union all

-----------------------------------------------------------------------------------------------------
--Group19: 期权费用
-----------------------------------------------------------------------------------------------------
select 
     tfps.Evt_Id                                                       AS Evt_Id                   --事件编号
    ,ds.Undrl_Cd                                                       AS Fin_Inst_Cd              --金融工具代码
    ,''                                                                AS Xir_Ast_Type_Cd          --恒泰资产类型代码
    ,''                                                                AS Src_Exch_Type            --源市场类型
    ,ri.Mkt_Cd                                                         AS Exch_Type_Cd             --市场代码
    ,deal.Ext_Comp_No                                                  AS Ext_Ord_Id               --外部交易号
    ,substr(tfps.Paid_Date,1,10)                                       AS Trd_Date                 --交易日期
    ,deal.Cutp_Pty_Id                                                  AS Cutp_Pty_Id              --交易对手当事人编号
    ,RCP.Full_Name_Ch                                                  AS Cutp_Pty_Name            --交易对手当事人名称
    ,''                                                                AS Lvl1_Scr_Acct_Agt_Id     --一级证券账户协议编号
    ,''                                                                AS Lvl1_Scr_Acct_Agt_Modifr --一级证券账户协议修饰符
    ,trade.Rela_Agt_Id                                                 AS Lvl2_Scr_Acct_Agt_Id     --二级证券账户协议编号
    ,trade.Rela_Agt_Modifr                                             AS Lvl2_Scr_Acct_Agt_Modifr --二级证券账户协议修饰符
    ,'1'                                                               AS Src_Busi_Type_Cd         --源业务类型代码      --1、场外期权 2、收益互换
    ,'4'                                                               AS Src_Trd_Chg_Type_Cd      --源交易变动类型代码  --1、开仓 2、提前终止 3、到期终止 4、期权费收付 5、预付金收付 6. 凭证本金收付
    ,'0'                                                               AS Chg_Amt                  --变动金额
    ,substr(tfps.Paid_Date,1,10)                                       AS Fnd_Net_Date             --资金收付日期
    ,tf.Fee_Amt                                                        AS Fnd_Net_Amt              --资金收付金额
    ,tf.Create_User                                                    AS Trdr                     --交易员
    ,''                                                                AS Remark                   --备注
    ,'${filename}'                                                AS Task_Name                --任务名
    ,'${data_day_str}'                                            AS Data_Etl_Date            --数据加载日期
    ,'${data_today_str}'                                          AS Data_Upt_Date            --数据更新日期
    ,'${data_today}'                                              AS Data_Time                --数据时间     
    ,'TIT'                                                             AS Data_Src_Cd              --数据来源代码
    ,'${data_day_str}'                                            AS Busi_Date                --业务日期
from (select * from PDATA_N.T03_SB_OTC_COMP_TRD_FEE where SRC_TBL='ODATA_N_TIT.D_TRD_FEE' and BUSI_DATE='${data_day_str}') tf
join (select * from PDATA_N.T05_OTC_DERI_COMP_FEE_PYMT_PLAN where SRC_TBL='ODATA_N_TIT.F_TRD_FEE_PAYMENT_SCHEDULE' )tfps
on tf.Src_Id = tfps.Trd_Fee_Src_Id
join  (select * from PDATA_N.T03_OTC_OPT_COMP_INFO where SRC_TBL='ODATA_N_TIT.D_REF_OTC_OPTION_DEAL' and BUSI_DATE='${data_day_str}') deal
on deal.Opt_Comp_Agt_Id = tf.Otc_Comp_Agt_Id
left join (select * from PDATA_N.T03_OTC_OPT_COMP_STRU_ELMN_INFO where SRC_TBL='ODATA_N_TIT.D_REF_OPTION_DEAL_STRUCTURE' and BUSI_DATE='${data_day_str}') ds
on deal.Opt_Comp_Agt_Id = ds.Opt_Comp_Agt_Id
left join (SELECT * FROM PDATA_N.T03_AGT_RELA_H where Agt_Rela_Type_Cd='N04' and strt_date<='${data_day_str}' and end_date>'${data_day_str}' AND SRC_TBL='ODATA_N_TIT.D_TRD_OTC_TRADE') trade
on deal.Opt_Comp_Agt_Id = trade.Agt_Id
left join (SELECT * FROM pdata_news_n.t02_scr_base_info where Src_Id = 'TIT') ri
on ds.Prd_Id = ri.src_sys_prdno
  left join (SELECT * FROM PDATA_N.T01_PTY_NAME WHERE BUSI_DATE='${data_day_str}' and SRC_TBL='ODATA_N_TIT.D_REF_COUNTER_PARTY') RCP
on deal.Cutp_Pty_Id = rcp.Pty_Id
join (SELECT * FROM PDATA_N.T98_OTC_DERI_BOOK_INFO WHERE BUSI_DATE='${data_day_str}') rb
on trade.Rela_Agt_Id = rb.Book_Agt_Id
where 1=1
and rb.Bel_Dept = 'GFS_FICC'
and rb.Book_Full_Name not like '%虚拟%'
AND deal.Comp_Stat_Cd NOT IN ('218')
and tf.Fee_Type_Cd = '14'

union all

-----------------------------------------------------------------------------------------------------
--Group20: 互换
-----------------------------------------------------------------------------------------------------
select 
     tte.Evt_Id                                                        AS Evt_Id                   --事件编号
    ,ri.Wind_Cd_Src                                                    AS Fin_Inst_Cd              --金融工具代码
    ,''                                                                AS Xir_Ast_Type_Cd          --恒泰资产类型代码
    ,''                                                                AS Src_Exch_Type            --源市场类型
    ,ri.Mkt_Cd                                                         AS Exch_Type_Cd             --市场代码
    ,rt.Ext_Comp_No                                                    AS Ext_Ord_Id               --外部交易号
    ,tte.Evt_Date                                                      AS Trd_Date                 --交易日期
    ,rt.Cutp_Pty_Id                                                    AS Cutp_Pty_Id              --交易对手当事人编号
    ,RCP.Full_Name_Ch                                                  AS Cutp_Pty_Name            --交易对手当事人名称
    ,''                                                                AS Lvl1_Scr_Acct_Agt_Id     --一级证券账户协议编号
    ,''                                                                AS Lvl1_Scr_Acct_Agt_Modifr --一级证券账户协议修饰符
    ,tot.Rela_Agt_Id                                                   AS Lvl2_Scr_Acct_Agt_Id     --二级证券账户协议编号
    ,tot.Rela_Agt_Modifr                                               AS Lvl2_Scr_Acct_Agt_Modifr --二级证券账户协议修饰符
    ,'2'                                                               AS Src_Busi_Type_Cd         --源业务类型代码      --1、场外期权 2、收益互换
    ,case when tte.Evt_Type_Cd = 'NEW_CONTRACT' then '1'
          when tte.Evt_Type_Cd = 'CLOSE_STOCKS' then '2'
          when tte.Evt_Type_Cd = 'EARLY_TERMINATION' then '2'
          when tte.Evt_Type_Cd = 'TERMINATION' then '3'
          when tte.Evt_Type_Cd = 'COUPON' then '6'
          end                                                          AS Src_Trd_Chg_Type_Cd      --源交易变动类型代码  --1、开仓 2、提前终止 3、到期终止 4、期权费收付 5、预付金收付 6. 凭证本金收付
    ,case when tte.Evt_Type_Cd = 'COUPON' then '0'
          else abs(round(ttesd.Occu_Qty * POS.Bgng_Pric * nvl(rt.Lcrrc_Ori_Bgng_Rate,1),2)) end
                                                                       AS Chg_Amt                  --变动金额
    ,ti.PAYMENT_DATE                                                   AS Fnd_Net_Date             --资金收付日期
    ,nvl(ti.amount_adjusted,'0')                                       AS Fnd_Net_Amt              --资金收付金额
    ,tte.Create_User                                                   AS Trdr                     --交易员
    ,''                                                                AS Remark                   --备注
    ,'${filename}'                                                AS Task_Name                --任务名
    ,'${data_day_str}'                                            AS Data_Etl_Date            --数据加载日期
    ,'${data_today_str}'                                          AS Data_Upt_Date            --数据更新日期
    ,'${data_today}'                                              AS Data_Time                --数据时间     
    ,'TIT'                                                             AS Data_Src_Cd              --数据来源代码
    ,'${data_day_str}'                                            AS Busi_Date                --业务日期
from (select * from PDATA_N.T05_OTC_SWAP_COMP_HOLD_CHG_DET where SRC_TBL='ODATA_N_TIT.D_TRD_TRS_EVENT_STRUC_DETAIL') ttesd
join (select * from PDATA_N.T05_OTC_COMP_DURA_CHG_EVT where SRC_TBL='ODATA_N_TIT.D_TRD_TRS_EVENT' ) tte
on tte.Src_Id = ttesd.Dura_Chg_Src_Id
join (SELECT * FROM PDATA_N.T03_AGT_RELA_H where Agt_Rela_Type_Cd='N03' and strt_date<='${data_day_str}' and end_date>'${data_day_str}'  AND SRC_TBL='ODATA_N_TIT.D_TRD_OTC_TRADE')tot
on tte.Otc_Comp_Agt_Id = tot.Agt_Id
join (SELECT * FROM PDATA_N.T03_OTC_SWAP_COMP_INFO WHERE BUSI_DATE='${data_day_str}' and SRC_TBL='ODATA_N_TIT.D_REF_TRS') RT
on RT.Swap_Comp_Agt_Id = tot.Agt_Id
join (SELECT * FROM PDATA_N.T98_OTC_DERI_BOOK_INFO WHERE BUSI_DATE='${data_day_str}') rb
on tot.Rela_Agt_Id = rb.Book_Agt_Id
left join (SELECT * FROM PDATA_N.T01_PTY_NAME WHERE BUSI_DATE='${data_day_str}' and SRC_TBL='ODATA_N_TIT.D_REF_COUNTER_PARTY') RCP
on rt.Cutp_Pty_Id = rcp.Pty_Id
left join (SELECT * FROM PDATA_N.T03_OTC_SWAP_COMP_HOLD_INFO WHERE SRC_TBL='ODATA_N_TIT.D_POS_TRS_LEG_HIS_POS' ) pos
on ttesd.Swap_Comp_Hold_Id = pos.Swap_Comp_Hold_Id
and substr(RT.Strt_Pric_Date,1,10)=POS.BUSI_DATE
left join (SELECT * FROM pdata_news_n.t02_tit_scr_base_info where Src_Id = 'TIT' and grp_id = '01') ri
on pos.Prd_Id = ri.src_sys_prdno
join (SELECT * FROM PDATA_N.T03_OTC_SWAP_COMP_LEG_INFO WHERE BUSI_DATE='${data_day_str}' and SRC_TBL='ODATA_N_TIT.D_REF_TRS_LEG')leg
on pos.Leg_Glbl_Seq_No = leg.Leg_Glbl_Seq_No
left join (
select substr(t.Paid_Date,1,10) payment_date,t.Swap_Dura_Evt_No,sum(t.Aft_Adj_Amt) amount_adjusted
from PDATA_N.T05_OTC_RECV_PYMT_EVT t
where t.Src_Prd_Type_Cd = 'TRS'
 and src_tbl= 'ODATA_N_TIT.D_TRD_TRANSFER' and del_flag='0' 
and t.Recv_Pymt_Stat_Cd = 'VERIFIED'
group by substr(t.Paid_Date,1,10) ,t.Swap_Dura_Evt_No
) ti
on ti.Swap_Dura_Evt_No = tte.Src_Id
where 1=1
AND tte.Evt_Stat_Cd = '3'
and rb.Bel_Dept = 'GFS_FICC'
and rb.Book_Full_Name not like '%虚拟%'
AND RT.Comp_Stat_Cd NOT IN ('218')
;
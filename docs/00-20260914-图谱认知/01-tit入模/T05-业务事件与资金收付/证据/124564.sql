INSERT OVERWRITE TABLE T05_OTC_SWAP_COMP_HOLD_CHG_DET PARTITION(SRC_TBL='ODATA_N_TIT.D_TRD_TRS_EVENT_STRUC_DETAIL')
SELECT
CONCAT('TIT215-',ID)                  AS  Evt_Id                  --事件编号
,KEY_TRS_EVENT_ID                      AS  Dura_Chg_Src_Id         --存续期变动源ID
,KEY_LEG_POSITION_ID                   AS  Swap_Comp_Hold_Id       --互换合约持仓编号
,B.KEY_OTC_TRADE_ID                    AS  Swap_Comp_Agt_Id        --互换合约协议编号
,IF(NVL(TRIM(KEY_OTC_TRADE_ID),'')='','','20206')
AS  Swap_Comp_Agt_Modifr    --互换合约协议修饰符
,A.KEY_LEG_ID                          AS  Leg_Glbl_Seq_No         --Leg全局序号
,IF(NVL(TRIM(UNDERLYING_INS_ID),'')='','',CONCAT('TIT-',UNDERLYING_INS_ID))
AS  Prd_Id                  --产品编号
,UNDERLYING_INS_ID                     AS  Src_Prd_Id              --源产品编号
,PRICE                                 AS  Pric                    --价格
,QUANTITY                              AS  Occu_Qty                --发生数量
,QUANTITY_BEFORE                       AS  Occu_Frnt_Qty           --发生前数量
,QUANTITY_AFTER                        AS  Occu_Pst_Qty            --发生后数量
,AMOUNT                                AS  Occu_Amt                --发生金额
,AMOUNT_ORG                            AS  Ocrrc_Occu_Amt          --原币发生金额
,CURRENCY                              AS  Crrc_Cd                 --币种代码
,REALIZED_PROFIT_DELTA                 AS  Rlz_Chg_Delta           --已实现变动DELTA
,COST_DELTA                            AS  Cost_Chg_Delta          --成本变动DELTA
,EXCHANGE_RATE                         AS  Rate                    --汇率
,INTEREST_INTERVAL                     AS  Intr_Strt_End_Scop_Cd   --利息起止区间代码
,CREATED_BY                            AS  Create_User             --创建人
,CREATED_DATETIME                      AS  Create_Time             --创建时间
,UPDATED_BY                            AS  Upd_User                --更新人
,UPDATED_DATETIME                      AS  Upd_Time                --更新时间
,'TIT'                 AS  Data_Src_Cd             --数据来源代码
,'PDATA_N.T05_OTC_SWAP_COMP_HOLD_CHG_DET_TIT215'                    AS  Task_Name               --任务名
,'2026-05-19'                AS  Data_Etl_Date           --数据加载日期
,'2026-05-20'              AS  Data_Upt_Date           --数据更新日期
,'2026-05-20 03:47:36'                  AS  Data_Time               --数据时间
,CLOSE_STOCK_COMMISSION                AS  Ofst_Cms                --平仓佣金
,CLOSE_STOCK_CLEAN_PRICE               AS  Ofst_Mtch_Net_Pric      --平仓成交净价
,CLOSE_AVERAGE_PRICE                   AS  Nincl_Fee_Ofst_Avg_Pric         --不含费平仓均价
,CASH_DIV_RATIO                        AS  Ofst_Prop                       --分红比例
,STOCK_DIV_RATIO                       AS  Stk_Divd_Prop                   --送股比例
,CLOSE_STOCK_PER_SHARE_COM             AS  Ofst_Per_Stk_Cms                --平仓每股佣金
,CLOSE_STOCK_COMMISSION_TYPE           AS  Ofst_Cms_Mode_Cd                --平仓佣金模式代码
,CLOSE_STOCK_AB_FUTURE_RATE            AS  Ofst_Overseas_Futr_Cms_Fee_Rate --平仓境外期货佣金费率
,CLOSE_STOCK_TRD_FEE_RATE              AS  Ofst_Trmt_Cms_Fee_Rate          --平仓终止佣金费率
,DIVIDEND_TAX_AMOUNT                   AS  Divd_Tax_Amt                    --分红税金额
,'ODATA_N_TIT.D_TRD_TRS_EVENT_STRUC_DETAIL'                   AS  Real_Src_Tbl                    --真实源表
FROM   (SELECT *  FROM ODATA_N_TIT.D_TRD_TRS_EVENT_STRUC_DETAIL WHERE  BUSI_DATE='2026-05-19' )A
LEFT JOIN (SELECT KEY_LEG_ID,KEY_OTC_TRADE_ID FROM ODATA_N_TIT.D_REF_TRS_LEG WHERE BUSI_DATE='2026-05-19' )B
ON A.KEY_LEG_ID=B.KEY_LEG_ID
;
INSERT OVERWRITE TABLE T05_OTC_DERI_COMP_FEE_PYMT_PLAN PARTITION(SRC_TBL='ODATA_N_TIT.F_TRD_FEE_PAYMENT_SCHEDULE')
SELECT
CONCAT('TIT327-',KEY_FEE_PAYMENT_ID)    AS  Evt_Id                  --事件编号
,IF(B.KEY_OTC_TRADE_ID='0' OR NVL(TRIM(B.KEY_OTC_TRADE_ID),'')='',B.ENTITY_ID,B.KEY_OTC_TRADE_ID)
AS  Otc_Comp_Agt_Id         --场外合约协议编号
,IF(B.KEY_OTC_TRADE_ID='0' OR NVL(TRIM(B.KEY_OTC_TRADE_ID),'')='','20206','20207')
AS  Otc_Comp_Agt_Modifr     --场外合约协议修饰符
,A.KEY_FEE_PAYMENT_ID                    AS  Src_Id                  --源ID
,A.KEY_FEE_ID                            AS  Trd_Fee_Src_Id          --交易费用源编号
,SUBSTR(A.PAYMENT_DATE       ,1,10)      AS  Paid_Date               --支付日期
,SUBSTR(A.ACTUAL_PAYMENT_DATE,1,10)      AS  Actl_Paid_Date          --实际支付日期
,A.PAYMENT_TYPE                          AS  Otc_Deri_Paid_Type_Cd   --场外衍生品支付类型代码
,A.AMOUNT                                AS  Lcrrc_Amt               --本币金额
,A.AMOUNT_ORG                            AS  Ocrrc_Amt               --原币金额
,A.AMOUNT_CNY                            AS  Rmb_Amt                 --人民币金额
,A.ACTUAL_PAYMENT                        AS  Actl_Paid_Amt           --实际支付金额
,A.ACTUAL_PAYMENT_ORG                    AS  Ocrrc_Actl_Paid_Amt     --原币实际支付金额
,A.FEE_RATE                              AS  Fee_Rate                --费率
,A.EXCHANGE_RATE                         AS  Rate                    --汇率
,A.EXCHANGE_RATE_CNY                     AS  Rmb_Rate                --人民币汇率
,A.SETTLE_PAIRS_EXCHANGE_RATE            AS  Disp_Rate               --展示汇率
,A.STATUS                                AS  Fee_Stat_Cd             --费用状态代码
,CASE WHEN A.TRS_FEE_ADDITIONAL = 'Y' THEN '1'
WHEN A.TRS_FEE_ADDITIONAL = 'N' THEN '0'
ELSE A.TRS_FEE_ADDITIONAL END      AS  Swap_Fee_Supp_Flag      --互换费用补录标志
,A.KEY_TRS_EVENT_ID                      AS  Dura_Chg_Evt_Src_Id     --存续变动事件源ID
,A.CREATED_BY                            AS  Create_User_Id          --创建用户编号
,A.CREATED_DATETIME                      AS  Create_Time             --创建时间
,A.UPDATED_BY                            AS  Upd_User_Id             --更新用户编号
,A.UPDATED_DATETIME                      AS  Upd_Time                --更新时间
,'TIT'                   AS  Data_Src_Cd             --数据来源代码
,'PDATA_N.T05_OTC_DERI_COMP_FEE_PYMT_PLAN_TIT327'                      AS  Task_Name               --任务名
,'2026-05-20'                  AS  Data_Etl_Date           --数据加载日期
,'2026-05-20'                  AS  Data_Upt_Date           --数据更新日期
,'2026-05-21 00:52:43'                    AS  Data_Time               --数据时间
,'ODATA_N_TIT.F_TRD_FEE_PAYMENT_SCHEDULE'                     AS  Real_Src_Tbl            --真实源表
FROM   (SELECT *  FROM ODATA_N_TIT.F_TRD_FEE_PAYMENT_SCHEDULE WHERE  BUSI_DATE='2026-05-20' )A
LEFT JOIN  (SELECT *  FROM ODATA_N_TIT.F_TRD_FEE WHERE  BUSI_DATE='2026-05-20' )B
ON  A.KEY_FEE_ID=B.KEY_FEE_ID
;
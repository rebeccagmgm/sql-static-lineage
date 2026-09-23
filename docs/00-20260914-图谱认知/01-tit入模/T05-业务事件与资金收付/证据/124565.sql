INSERT OVERWRITE TABLE T05_OTC_COMP_DURA_CHG_EVT PARTITION(SRC_TBL)
SELECT
CONCAT( 'TIT229-',SUBSTR(EVENT_DATE,1,10),'-',KEY_TRS_EVENT_ID,'-',KEY_OTC_TRADE_ID)
AS  Evt_Id                  --事件编号
,KEY_TRS_EVENT_ID                                  AS  Src_Id                  --源ID
,SUBSTR(EVENT_DATE,1,10)                           AS  Evt_Date                --事件日期
,KEY_OTC_TRADE_ID                                  AS  Otc_Comp_Agt_Id         --场外合约协议编号
,IF(NVL(TRIM(KEY_OTC_TRADE_ID),'')='','','20206')  AS  Otc_Comp_Agt_Modifr     --场外合约协议修饰符
,EVENT_TYPE                                        AS  Evt_Type_Cd             --事件类型代码
,EVENT_INPUT_TIME                                  AS  Inpt_Time               --录入时间
,EVENT_REAL_TIME                                   AS  Appr_End_Time           --审批结束时间
,NOTIONAL_BEFORE                                   AS  Adj_Frnt_Nom_Prin       --调整前名义本金
,NOTIONAL_AFTER                                    AS  Adj_Pst_Nom_Prin        --调整后名义本金
,NOTIONAL_DELTA                                    AS  Nom_Prin_Chg_Delta      --名义本金变动Delta
,''                                                AS  Adj_Frnt_Absl_Nom_Prin  --调整前绝对名义本金
,''                                                AS  Adj_Pst_Absl_Nom_Prin   --调整后绝对名义本金
,''                                                AS  Absl_Nom_Prin_Chg_Delta --绝对名义本金变动Delta
,''                                                AS  Erly_Trmt_Pric          --提前终止价格
,''                                                AS  Erly_Trmt_Intrn_Val     --提前终止内在价值
,''                                                AS  Erly_Trmt_Pv            --提前终止PV
,EVENT_FEE                                         AS  Evt_Fee                 --事件费用
,CURRENCY                                          AS  Crrc_Cd                 --币种代码
,NVL(B.DW_CD_VAL,EVENT_STATUS)                     AS  Evt_Stat_Cd             --事件状态代码
,EXCHANGE_RATE                                     AS  Rate                    --汇率
,EVENT_AMOUNT                                      AS  Evt_Amt                 --事件金额
,EVENT_AMOUNT_ORG                                  AS  Ocrrd_Evt_Amt           --原币事件金额
,TRADER                                            AS  Trdr_Id                 --交易员
,''                                                AS  Trd_Fee_Src_Id          --交易费用源编号
,''                                                AS  Bgng_Prcg_Date          --期初定价日期
,''                                                AS  Pay_Date                --兑付日期
,''                                                AS  Ex_Righ_Ex_Dvd_Date     --除权除息日期
,''                                                AS  Ex_Yest_Clos_Pric       --除权除息日昨收盘价
,''                                                AS  Righ_Shr_Vol            --配股股数
,''                                                AS  Righ_Shr_Pric           --配股价格
,''                                                AS  Per_Stk_Bns             --每股红股
,''                                                AS  Per_Stk_Covt_Add_Equi   --每股转增股本
,''                                                AS  Per_Stk_Cash_Divd       --每股现金红利
,''                                                AS  Pric_Adj_Prop           --价格调整比例
,''                                                AS  Adj_Frnt_Bgng_Pric      --调整前期初价格
,''                                                AS  Adj_Pst_Bgng_Pric       --调整后期初价格
,''                                                AS  Vld_Upd_Comp_Flag       --生效更新合约标志
,EVENT_DESC                                        AS  Remark                  --备注
,CREATED_BY                                        AS  Create_User             --创建人
,CREATED_DATETIME                                  AS  Create_Time             --创建时间
,UPDATED_BY                                        AS  Upd_User                --更新人
,UPDATED_DATETIME                                  AS  Upd_Time                --更新时间
,'TIT'                             AS  Data_Src_Cd             --数据来源代码
,'PDATA_N.T05_OTC_COMP_DURA_CHG_EVT_TIT229'                                AS  Task_Name               --任务名
,'2026-05-19'                            AS  Data_Etl_Date           --数据加载日期
,'2026-05-20'                          AS  Data_Upt_Date           --数据更新日期
,'2026-05-20 03:47:13'                              AS  Data_Time               --数据时间
,NVL(C.DW_CD_VAL,PAY_DIRECTION)                    AS  Net_Dir_Cd              --收付方向代码
,''                                                AS  Undrl_Prd_Id            --标的产品编号
,''                                                AS  Vol                     --数量
,''                                                AS  Adj_Frnt_Bgng_Fx_Pric   --调整前期初外汇价格
,''                                                AS  Adj_Pst_Bgng_Fx_Pric    --调整后期初外汇价格
,''                                                AS  Sys_Intrn_Val           --系统内在价值
,''                                                AS  Preterm_Paid_Val        --提前终止支付价值
,''                                                AS  Unpay_Fee               --未支付费用
,''                                                AS  Tax_Rate                --税率
,SUBSTR(EVENT_DATE,1,10)                           AS  Busi_Date               --业务日期
,EVENT_CHANNEL                                     AS  Evt_Lnch_Type_Cd          --事件发起类型代码
,'ODATA_N_TIT.D_TRD_TRS_EVENT'                     AS  Real_Src_Tbl              --真实源表
,''                                                AS  Exer_Pric                         --行权价格
,''                                                AS  Exer_Pric_Pct                     --行权价格百分比
,''                                                AS  Sett_Pric                         --结算价格
,''                                                AS  Dyna_Nom_Prin_Chg_Delta           --动态名义本金变动Delta
,''                                                AS  Adj_Frnt_Dyna_Nom_Prin            --调整前动态名义本金
,''                                                AS  Adj_Pst_Dyna_Nom_Prin             --调整后动态名义本金
,''                                                AS  Erly_Trmt_Pric_Fx                 --提前终止价格FX
,''                                                AS  Actl_Erly_Trmt_Fx_Rate            --实际提前终止汇率
,''                                                AS  User_Inpt_Erly_Trmt_Fx_Rate       --用户录入提前终止汇率
,''                                                AS  Erly_Trmt_Fxr_Id                  --提前终止货币对编号
,''                                                AS  Sys_Evt_Amt                       --系统事件金额
,''                                                AS  Norm_Divd_Crrc_Cd                 --普通分红币种代码
,''                                                AS  Norm_Divd_Rate                    --普通分红汇率
,''                                                AS  Norm_Divd_Sett_Amt                --普通分红结算金额
,''                                                AS  Spec_Cash_Divd                    --特殊现金红利
,''                                                AS  Spec_Divd_Crrc_Cd                 --特殊分红币种代码
,''                                                AS  Spec_Divd_Rate                    --特殊分红汇率
,''                                                AS  Spec_Divd_Sett_Amt                --特殊分红结算金额
,''                                                AS  Adj_Frnt_Daily_Trd_Vol            --调整前日交易数量
,''                                                AS  Adj_Pst_Daily_Trd_Vol             --调整后日交易数量
,''                                                AS  Adj_Frnt_Fix_Amt                  --调整前固定金额
,''                                                AS  Adj_Pst_Fix_Amt                   --调整后固定金额
,''                                                AS  Accum_Opt_Obsv_Pd_Strt_Date       --累计期权观察期开始日期
,''                                                AS  Accum_Opt_Obsv_Pd_End_Date        --累计期权观察期结束日期
,''                                                AS  Curpd_Accum_Qty                   --当期累计数量
,''                                                AS  Curpd_Accum_Coup_Rate             --当期累计票息
,''                                                AS  Sett_Crrc_Line_Pal                --结算币种线性损益
,''                                                AS  Adv_Lock_Pric_Flag                --提前锁定价格标志
,''                                                AS  Adv_Lock_Yield_Evt_Erly_Term_Date --提前锁定收益事件提前终止日期
,''                                                AS  Otc_Comp_Prd_Id                   ---场外合约产品编号
,''                                                AS  Cutp_Pty_Id                       ---交易对手当事人编号
,''                                                AS  Leg_Glbl_Seq_No                   ---Leg全局序号
,''                                                AS  Scr_Src_Pool_Id                   ---券源池编号
,''                                                AS  Perf_Marg_Plan_Id                 ---履保方案编号
,''                                                AS  Long_Shor_Clas                    ---多空分类
,''                                                AS  Src_Trd_Dir_Cd                    ---源交易方向代码
,''                                                AS  Mtch_Full_Pric                    ---成交全价
,''                                                AS  Posi_Sett_Rate                    ---正向结算汇率
,''                                                AS  Divd_Tax_Rate                     ---分红税率
,''                                                AS  Bgng_Pric                         ---期初价格
,''                                                AS  Bef_Adj_Bgng_Rate                 ---调整前期初汇率
,''                                                AS  Posi_Bef_Adj_Bgng_Rate            ---正向调整前期初汇率
,''                                                AS  Undrl_Crrc_Cd                     ---标的币种代码
,''                                                AS  Chg_Vol                           ---变动数量
,''                                                AS  Idx_Term                          ---指数期限
,''                                                AS  Trd_Date                          ---成交日期
,''                                                AS  Clr_Date                          ---清算日期
,''                                                AS  Equi_Reg_Date                     ---股权登记日期
,''                                                AS  Cms_Fee_Rate                      ---佣金费率
,''                                                AS  Intr_Rate                         ---券息
,''                                                AS  Co_Behav_Prop                     ---公司行为比例
,''                                                AS  Stk_Divd_Mode_Cd                  ---送股模式代码
,''                                                AS  Inta_Date_Delay_Days              ---计息日延期天数
,''                                                AS  Bef_Stk_Divd_Qty                  ---送股前数量
,''                                                AS  Bef_Stk_Divd_Bgng_Pric            ---送股前期初价格
,'ODATA_N_TIT.D_TRD_TRS_EVENT'                     AS  Src_Tbl                 --源表
FROM   (SELECT *  FROM ODATA_N_TIT.D_TRD_TRS_EVENT WHERE  BUSI_DATE='2026-05-19' )A
LEFT JOIN (
SELECT SRC_CD_VAL,DW_CD_VAL
FROM PDATA_N.REF_CD_CVT_MAP
WHERE TGT_TAB_NAME = 'T05_OTC_COMP_DURA_CHG_EVT'
AND TGT_TAB_FLD  = 'Evt_Stat_Cd'
AND SRC_TAB_NAME = 'TRD_TRS_EVENT'
AND SRC_FLD_NAME = 'EVENT_STATUS'
AND SRC_SYS_NAME='TIT')B
ON      A.EVENT_STATUS =B.SRC_CD_VAL                  --EVENT_STATUS 转码
LEFT JOIN (
SELECT SRC_CD_VAL,DW_CD_VAL
FROM PDATA_N.REF_CD_CVT_MAP
WHERE TGT_TAB_NAME = 'T05_OTC_COMP_DURA_CHG_EVT'
AND TGT_TAB_FLD  = 'Net_Dir_Cd'
AND SRC_TAB_NAME = 'TRD_TRS_EVENT'
AND SRC_FLD_NAME = 'PAY_DIRECTION'
AND SRC_SYS_NAME='TIT')C
ON      A.PAY_DIRECTION =C.SRC_CD_VAL                  --PAY_DIRECTION 转码
;
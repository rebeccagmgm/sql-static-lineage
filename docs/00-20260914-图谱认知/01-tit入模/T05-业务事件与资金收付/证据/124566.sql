INSERT OVERWRITE TABLE T05_OTC_COMP_DURA_CHG_EVT PARTITION(SRC_TBL)
SELECT
CONCAT('TIT230-',SUBSTR(EVENT_DATE,1,10),'-',KEY_OPTION_EVENT_ID,'-',KEY_OPTION_DEAL_ID)
AS  Evt_Id                  --事件编号
,KEY_OPTION_EVENT_ID                               AS  Src_Id                  --源ID
,SUBSTR(EVENT_DATE,1,10)                           AS  Evt_Date                --事件日期
,KEY_OPTION_DEAL_ID                                AS  Otc_Comp_Agt_Id         --场外合约协议编号
,IF(NVL(TRIM(KEY_OPTION_DEAL_ID),'')='','','20207') AS  Otc_Comp_Agt_Modifr     --场外合约协议修饰符
,EVENT_TYPE                                        AS  Evt_Type_Cd             --事件类型代码
,EVENT_INPUT_TIME                                  AS  Inpt_Time               --录入时间
,EVENT_REAL_TIME                                   AS  Appr_End_Time           --审批结束时间
,NOTIONAL_BEFORE                                   AS  Adj_Frnt_Nom_Prin       --调整前名义本金
,NOTIONAL_AFTER                                    AS  Adj_Pst_Nom_Prin        --调整后名义本金
,NOTIONAL_DELTA                                    AS  Nom_Prin_Chg_Delta      --名义本金变动Delta
,ABS_NOTIONAL_BEFORE                               AS  Adj_Frnt_Absl_Nom_Prin  --调整前绝对名义本金
,ABS_NOTIONAL_AFTER                                AS  Adj_Pst_Absl_Nom_Prin   --调整后绝对名义本金
,ABS_NOTIONAL_DELTA                                AS  Absl_Nom_Prin_Chg_Delta --绝对名义本金变动Delta
,EARLY_TERMINATION_PRICE                           AS  Erly_Trmt_Pric          --提前终止价格
,EARLY_TERM_INTRINSIC_VALUE                         AS  Erly_Trmt_Intrn_Val     --提前终止内在价值
,EARLY_TERM_PRESENT_VALUE                          AS  Erly_Trmt_Pv            --提前终止PV
,''                                                AS  Evt_Fee                 --事件费用
,''                                                AS  Crrc_Cd                 --币种代码
,NVL(DW_CD_VAL,EVENT_STATUS)                       AS  Evt_Stat_Cd             --交易状态代码
,''                                                AS  Rate                    --汇率
,EVENT_FEE                                         AS  Evt_Amt                 --事件金额
,''                                                AS  Ocrrd_Evt_Amt           --原币事件金额
,TRADER                                            AS  Trdr_Id                 --交易员
,FEE_ID                                            AS  Trd_Fee_Src_Id          --交易费用源编号
,SUBSTR(EFFECTIVE_DATE,1,10)                       AS  Bgng_Prcg_Date          --期初定价日期
,SUBSTR(PAYMENT_DATE,1,10)                         AS  Pay_Date                --兑付日期
,SUBSTR(EX_DATE,1,10)                              AS  Ex_Righ_Ex_Dvd_Date     --除权除息日期
,PRE_EX_DATE_CLOSE                                 AS  Ex_Yest_Clos_Pric       --除权除息日昨收盘价
,RATIONED_SHARES_QUANTITY                          AS  Righ_Shr_Vol            --配股股数
,RATIONED_SHARES_PRICE                             AS  Righ_Shr_Pric           --配股价格
,BONUS_RATIO                                       AS  Per_Stk_Bns             --每股红股
,CONVERSED_RATIO                                   AS  Per_Stk_Covt_Add_Equi   --每股转增股本
,CASH_RATIO                                        AS  Per_Stk_Cash_Divd       --每股现金红利
,PRICE_RESET_RATE                                  AS  Pric_Adj_Prop           --价格调整比例
,INITIAL_PRICE_BEFORE_RESET                        AS  Adj_Frnt_Bgng_Pric      --调整前期初价格
,INITIAL_PRICE_AFTER_RESET                          AS  Adj_Pst_Bgng_Pric       --调整后期初价格
,CASE WHEN IS_TASK_FINISH_FLAG = 'Y' THEN '1'
WHEN IS_TASK_FINISH_FLAG = 'N' THEN '0'
ELSE IS_TASK_FINISH_FLAG END                 AS  Vld_Upd_Comp_Flag       --生效更新合约标志
,EVENT_DESC                                        AS  Remark                  --备注
,CREATED_BY                                        AS  Create_User             --创建人
,CREATED_DATETIME                                  AS  Create_Time             --创建时间
,UPDATED_BY                                        AS  Upd_User                --更新人
,UPDATED_DATETIME                                  AS  Upd_Time                --更新时间
,'TIT'                             AS  Data_Src_Cd             --数据来源代码
,'PDATA_N.T05_OTC_COMP_DURA_CHG_EVT_TIT230'                                AS  Task_Name               --任务名
,'2026-06-11'                            AS  Data_Etl_Date           --数据加载日期
,'2026-06-12'                          AS  Data_Upt_Date           --数据更新日期
,'2026-06-12 16:38:32'                              AS  Data_Time               --数据时间
,''                                                AS  Net_Dir_Cd              --收付方向代码
,IF(NVL(TRIM(CA_UNDERLYING_INS_ID),'')='','',CONCAT('TIT-',CA_UNDERLYING_INS_ID))
AS  Undrl_Prd_Id            --标的产品编号
,QUANTITY                                          AS  Vol                     --数量
,INITIAL_PRICE_FX_BEFORE_RESET                     AS  Adj_Frnt_Bgng_Fx_Pric   --调整前期初外汇价格
,INITIAL_PRICE_FX_AFTER_RESET                      AS  Adj_Pst_Bgng_Fx_Pric    --调整后期初外汇价格
,ORI_EARLY_TERM_INTRINSIC_VALUE                    AS  Sys_Intrn_Val           --系统内在价值
,TIME_VALUE                                        AS  Preterm_Paid_Val        --提前终止支付价值
,NON_PAYMENT                                       AS  Unpay_Fee               --未支付费用
,TAX_RATIO                                         AS  Tax_Rate                --税率
,SUBSTR(EVENT_DATE,1,10)                           AS  Busi_Date               --业务日期
,''                                                AS  Evt_Lnch_Type_Cd          --事件发起类型代码
,'ODATA_N_TIT.D_TRD_OPTION_EVENT'                  AS  Real_Src_Tbl              --真实源表
,STRIKE_PRICE                                      AS  Exer_Pric                         --行权价格
,STRIKE_PCT                                        AS  Exer_Pric_Pct                     --行权价格百分比
,SETTLEMENT_PRICE                                  AS  Sett_Pric                         --结算价格
,DYNAMIC_NOTIONAL_DELTA                            AS  Dyna_Nom_Prin_Chg_Delta           --动态名义本金变动Delta
,DYNAMIC_NOTIONAL_BEFORE                           AS  Adj_Frnt_Dyna_Nom_Prin            --调整前动态名义本金
,DYNAMIC_NOTIONAL_AFTER                            AS  Adj_Pst_Dyna_Nom_Prin             --调整后动态名义本金
,EARLY_TERMINATION_PRICE_FX                        AS  Erly_Trmt_Pric_Fx                 --提前终止价格FX
,EARLY_TERMINATION_FX_RATE                         AS  Actl_Erly_Trmt_Fx_Rate            --实际提前终止汇率
,EARLY_TERMINATION_FX_ORG                          AS  User_Inpt_Erly_Trmt_Fx_Rate       --用户录入提前终止汇率
,IF(NVL(TRIM(EARLY_TERM_FX_INS_ID),'')='','',CONCAT('TIT-',EARLY_TERM_FX_INS_ID))
AS  Erly_Trmt_Fxr_Id                  --提前终止货币对编号
,ORIGIN_EVENT_FEE                                  AS  Sys_Evt_Amt                       --系统事件金额
,CASH_CURRENCY                                     AS  Norm_Divd_Crrc_Cd                 --普通分红币种代码
,CASH_FX                                           AS  Norm_Divd_Rate                    --普通分红汇率
,CASH_EVENT_FEE                                    AS  Norm_Divd_Sett_Amt                --普通分红结算金额
,SP_CASH_RATIO                                     AS  Spec_Cash_Divd                    --特殊现金红利
,SP_CASH_CURRENCY                                  AS  Spec_Divd_Crrc_Cd                 --特殊分红币种代码
,SP_CASH_FX                                        AS  Spec_Divd_Rate                    --特殊分红汇率
,SP_CASH_EVENT_FEE                                 AS  Spec_Divd_Sett_Amt                --特殊分红结算金额
,DAILY_QTY_BEFORE                                  AS  Adj_Frnt_Daily_Trd_Vol            --调整前日交易数量
,DAILY_QTY_AFTER                                   AS  Adj_Pst_Daily_Trd_Vol             --调整后日交易数量
,FIXED_PAYMENT_BEFORE                              AS  Adj_Frnt_Fix_Amt                  --调整前固定金额
,FIXED_PAYMENT_AFTER                               AS  Adj_Pst_Fix_Amt                   --调整后固定金额
,SUBSTR(CUMULATOR_START_DATE,1,10)                 AS  Accum_Opt_Obsv_Pd_Strt_Date       --累计期权观察期开始日期
,SUBSTR(CUMULATOR_END_DATE,1,10)                   AS  Accum_Opt_Obsv_Pd_End_Date        --累计期权观察期结束日期
,CUMULATE_QTY                                      AS  Curpd_Accum_Qty                   --当期累计数量
,CUMULATE_COUPON                                   AS  Curpd_Accum_Coup_Rate             --当期累计票息
,LINEAR_PNL                                        AS  Sett_Crrc_Line_Pal                --结算币种线性损益
,CASE WHEN USE_EARLY_LOCK_PRICE = 'Y' THEN '1'
WHEN USE_EARLY_LOCK_PRICE = 'N' THEN '0'
ELSE USE_EARLY_LOCK_PRICE END                AS  Adv_Lock_Pric_Flag                --提前锁定价格标志
,SUBSTR(EARLY_TERM_DATESTRING,1,10)                AS  Adv_Lock_Yield_Evt_Erly_Term_Date --提前锁定收益事件提前终止日期
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
,''                                                AS  Bond_Sett_Flag                    --债券结算标志
,''                                                AS  Sett_Crrc_Rate                    --结算币种汇率
,''                                                AS  Rset_Intrt                        --重置利率
,''                                                AS  Stru_Leg_Clr_Spd_Cd               --结构化腿清算速度代码
,''                                                AS  Stru_Leg_Actl_Vld_Date            --结构化腿实际生效日期
,''                                                AS  Intr_Leg_Clr_Spd_Cd               --利息腿清算速度代码
,''                                                AS  Intr_Leg_Actl_Vld_Date            --利息腿实际生效日期
,''                                                AS  Src_Divd_Rate_Undrl_Id            --源分红汇率标的编号
,''                                                AS  Src_Valu_Rate_Src_Prd_Id          --源估值汇率来源产品编号
,'ODATA_N_TIT.D_TRD_OPTION_EVENT'                  AS  Src_Tbl                 --源表
FROM   (SELECT *  FROM ODATA_N_TIT.D_TRD_OPTION_EVENT WHERE  BUSI_DATE='2026-06-11' )A
LEFT JOIN (
SELECT SRC_CD_VAL,DW_CD_VAL
FROM PDATA_N.REF_CD_CVT_MAP
WHERE TGT_TAB_NAME = 'T05_OTC_COMP_DURA_CHG_EVT'
AND TGT_TAB_FLD  = 'Evt_Stat_Cd'
AND SRC_TAB_NAME = 'TRD_OPTION_EVENT'
AND SRC_FLD_NAME = 'EVENT_STATUS'
AND SRC_SYS_NAME='TIT')B
ON      A.EVENT_STATUS =B.SRC_CD_VAL                  --EVENT_STATUS 转码
;
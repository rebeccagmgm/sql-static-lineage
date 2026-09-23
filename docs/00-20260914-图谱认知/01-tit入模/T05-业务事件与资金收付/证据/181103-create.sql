CREATE TABLE IF NOT EXISTS T05_OTC_DERI_COMP_SETT_NTFC_SEND_EVT(
Evt_Id                     STRING COMMENT '事件编号'
,Sett_Ntfc_Id               STRING COMMENT '结算通知编号'
,Sett_Date                  STRING COMMENT '结算日期'
,Sett_Ntfc_Stat_Cd          STRING COMMENT '结算通知状态代码'
,Otc_Comp_Agt_Id            STRING COMMENT '场外合约协议编号'
,Otc_Comp_Agt_Modifr        STRING COMMENT '场外合约协议修饰符'
,Bask_Type_Cd               STRING COMMENT '篮子类型代码'
,Bel_Dept_Name              STRING COMMENT '所属部门名称'
,Ast_Acct_Agt_Id            STRING COMMENT '资金账户协议编号'
,Ast_Acct_Agt_Modifr        STRING COMMENT '资金账户协议修饰符'
,Ast_Acct                   STRING COMMENT '资金账户编号'
,Pty_Id                     STRING COMMENT '当事人编号'
,Co_Name                    STRING COMMENT '公司名称'
,Sler_Name                  STRING COMMENT '卖方名称'
,Email_Sender               STRING COMMENT '邮箱发件人'
,Email_Recvr                STRING COMMENT '邮箱收件人'
,Email_Cc                   STRING COMMENT '邮箱抄送人'
,Src_Agt_Sub_Type_Cd        STRING COMMENT '源协议子类型代码'
,Bgng_Prcg_Date             STRING COMMENT '期初定价日期'
,End_Prcg_Date              STRING COMMENT '期末定价日期'
,Pay_Date                   STRING COMMENT '兑付日期'
,Flot_Yield_Amt             STRING COMMENT '浮动收益金额'
,Fix_Yield_Amt              STRING COMMENT '固定收益金额'
,Ofst_Fee                   STRING COMMENT '平仓费用'
,Cash_Divd                  STRING COMMENT '现金分红'
,Oth_Fnd                    STRING COMMENT '其他资金'
,Retu_Marg_Amt              STRING COMMENT '返还保证金'
,Tot_Sett_Amt               STRING COMMENT '总结算金额'
,Tot_Amt                    STRING COMMENT '总金额'
,Tot_Nom_Prin               STRING COMMENT '总名义本金'
,Remn_Nom_Prin              STRING COMMENT '剩余名义本金'
,Exer_Yield                 STRING COMMENT '行权收益'
,Opt_Fee                    STRING COMMENT '期权费'
,Appr_Date                  STRING COMMENT '审批日期'
,Create_Time                STRING COMMENT '创建时间'
,Create_User_Id             STRING COMMENT '创建用户编号'
,Upd_Time                   STRING COMMENT '修改时间'
,Upd_User_Id                STRING COMMENT '修改用户编号'
,Del_Flag                   STRING COMMENT '删除标志'
,Del_Date                   STRING COMMENT '删除日期'
,Data_Src_Cd                STRING COMMENT '数据来源代码'
,Task_Name                  STRING COMMENT '任务名'
,Data_Etl_Date              STRING COMMENT '数据加载日期'
,Data_Upt_Date              STRING COMMENT '数据更新日期'
,Data_Time                  STRING COMMENT '数据时间'
,Real_Src_Tbl               STRING COMMENT '真实源表'
)COMMENT '场外衍生品合约结算通知发送事件'
PARTITIONED BY (SRC_TBL STRING COMMENT '源表')
STORED AS ORC;

CREATE TABLE IF NOT EXISTS TEMP.T05_OTC_DERI_COMP_SETT_NTFC_SEND_EVT_TEMP_TIT292
AS
SELECT
CONCAT('TIT292-',ID)                     AS  Evt_Id                  --事件编号
,ID                                       AS  Sett_Ntfc_Id            --结算通知编号
,SUBSTR(CLEARING_DATE,1,10)               AS  Sett_Date               --结算日期
,STATUS                                   AS  Sett_Ntfc_Stat_Cd       --结算通知状态代码
,KEY_OTC_TRADE_ID                         AS  Otc_Comp_Agt_Id         --场外合约协议编号
,CASE WHEN CONTRACT_TYPE='TRS'    THEN '20206'
WHEN CONTRACT_TYPE='OPTION' THEN '20207'
ELSE CONTRACT_TYPE END
AS  Otc_Comp_Agt_Modifr     --场外合约协议修饰符
,BASKET_TYPE                              AS  Bask_Type_Cd            --篮子类型代码
,DEPARTMENT                               AS  Bel_Dept_Name           --所属部门名称
,KEY_CAPITAL_ACCT_ID                      AS  Ast_Acct_Agt_Id         --资金账户协议编号
,'10220'                                  AS  Ast_Acct_Agt_Modifr     --资金账户协议修饰符
,CAP_ACCT_CODE                            AS  Ast_Acct                --资金账户编号
,IF(NVL(TRIM(KEY_CTPTY_ID),'')='','',CONCAT('TIT060-',KEY_CTPTY_ID))
AS  Pty_Id                  --当事人编号
,DEPT_NAME                                AS  Co_Name                 --公司名称
,SELLER                                   AS  Sler_Name               --卖方名称
,FROM_EMAIL                               AS  Email_Sender            --邮箱发件人
,RECIPIENTS                               AS  Email_Recvr             --邮箱收件人
,CC                                       AS  Email_Cc                --邮箱抄送人
,SUB_TYPE                                 AS  Src_Agt_Sub_Type_Cd     --源协议子类型代码
,START_DATE                               AS  Bgng_Prcg_Date          --期初定价日期
,SUBSTR(END_DATE,1,10)                    AS  End_Prcg_Date           --期末定价日期
,SUBSTR(PAYMENT_DATE,1,10)                AS  Pay_Date                --兑付日期
,FLOATING_PNL                             AS  Flot_Yield_Amt          --浮动收益金额
,FIX_PNL                                  AS  Fix_Yield_Amt           --固定收益金额
,CLOSE_FEE                                AS  Ofst_Fee                --平仓费用
,CASH_DIVIDEND                            AS  Cash_Divd               --现金分红
,OTHER_FUNDS                              AS  Oth_Fnd                 --其他资金
,RETURN_MARGIN                            AS  Retu_Marg_Amt           --返还保证金
,TOTAL_SETTLEMENT_AMOUNT                  AS  Tot_Sett_Amt            --总结算金额
,TOTAL_AMOUNT                             AS  Tot_Amt                 --总金额
,TOTAL_NOTIONAL                           AS  Tot_Nom_Prin            --总名义本金
,REMAIN_NOTIONAL                          AS  Remn_Nom_Prin           --剩余名义本金
,STRIKE_PNL                               AS  Exer_Yield              --行权收益
,OPTION_PNL                               AS  Opt_Fee                 --期权费
,SUBSTR(APPROVAL_DATE,1,10)               AS  Appr_Date               --审批日期
,CREATED_DATETIME                         AS  Create_Time             --创建时间
,CREATED_BY                               AS  Create_User_Id          --创建用户编号
,UPDATED_DATETIME                         AS  Upd_Time                --修改时间
,UPDATED_BY                               AS  Upd_User_Id             --修改用户编号
,'TIT'                    AS  Data_Src_Cd             --数据来源代码
,'ODATA_N_TIT.N_OPE_SETTLE_NOTICE'                      AS  Src_Tbl                 --源表
,'PDATA_N.T05_OTC_DERI_COMP_SETT_NTFC_SEND_EVT_TIT292'                       AS  Task_Name               --任务名
,'2026-05-20'                   AS  Data_Etl_Date           --数据加载日期
,'2026-05-20'                   AS  Data_Upt_Date           --数据更新日期
,'ODATA_N_TIT.N_OPE_SETTLE_NOTICE'                      AS  Real_Src_Tbl            --真实源表
FROM  (SELECT * FROM ODATA_N_TIT.N_OPE_SETTLE_NOTICE  WHERE BUSI_DATE='2026-05-20' )A
;

CREATE TABLE IF NOT EXISTS TEMP.T05_OTC_DERI_COMP_SETT_NTFC_SEND_EVT_MID_TIT292
AS
SELECT
A.*
,B.Evt_Id                     AS Evt_Id1                   --事件编号
,B.Sett_Ntfc_Id               AS Sett_Ntfc_Id1             --结算通知编号
,B.Sett_Date                  AS Sett_Date1                --结算日期
,B.Sett_Ntfc_Stat_Cd          AS Sett_Ntfc_Stat_Cd1        --结算通知状态代码
,B.Otc_Comp_Agt_Id            AS Otc_Comp_Agt_Id1          --场外合约协议编号
,B.Otc_Comp_Agt_Modifr        AS Otc_Comp_Agt_Modifr1      --场外合约协议修饰符
,B.Bask_Type_Cd               AS Bask_Type_Cd1             --篮子类型代码
,B.Bel_Dept_Name              AS Bel_Dept_Name1            --所属部门名称
,B.Ast_Acct_Agt_Id            AS Ast_Acct_Agt_Id1          --资金账户协议编号
,B.Ast_Acct_Agt_Modifr        AS Ast_Acct_Agt_Modifr1      --资金账户协议修饰符
,B.Ast_Acct                   AS Ast_Acct1                 --资金账户编号
,B.Pty_Id                     AS Pty_Id1                   --当事人编号
,B.Co_Name                    AS Co_Name1                  --公司名称
,B.Sler_Name                  AS Sler_Name1                --卖方名称
,B.Email_Sender               AS Email_Sender1             --邮箱发件人
,B.Email_Recvr                AS Email_Recvr1              --邮箱收件人
,B.Email_Cc                   AS Email_Cc1                 --邮箱抄送人
,B.Src_Agt_Sub_Type_Cd        AS Src_Agt_Sub_Type_Cd1      --源协议子类型代码
,B.Bgng_Prcg_Date             AS Bgng_Prcg_Date1           --期初定价日期
,B.End_Prcg_Date              AS End_Prcg_Date1            --期末定价日期
,B.Pay_Date                   AS Pay_Date1                 --兑付日期
,B.Flot_Yield_Amt             AS Flot_Yield_Amt1           --浮动收益金额
,B.Fix_Yield_Amt              AS Fix_Yield_Amt1            --固定收益金额
,B.Ofst_Fee                   AS Ofst_Fee1                 --平仓费用
,B.Cash_Divd                  AS Cash_Divd1                --现金分红
,B.Oth_Fnd                    AS Oth_Fnd1                  --其他资金
,B.Retu_Marg_Amt              AS Retu_Marg_Amt1            --返还保证金
,B.Tot_Sett_Amt               AS Tot_Sett_Amt1             --总结算金额
,B.Tot_Amt                    AS Tot_Amt1                  --总金额
,B.Tot_Nom_Prin               AS Tot_Nom_Prin1             --总名义本金
,B.Remn_Nom_Prin              AS Remn_Nom_Prin1            --剩余名义本金
,B.Exer_Yield                 AS Exer_Yield1               --行权收益
,B.Opt_Fee                    AS Opt_Fee1                  --期权费
,B.Appr_Date                  AS Appr_Date1                --审批日期
,B.Create_Time                AS Create_Time1              --创建时间
,B.Create_User_Id             AS Create_User_Id1           --创建用户编号
,B.Upd_Time                   AS Upd_Time1                 --修改时间
,B.Upd_User_Id                AS Upd_User_Id1              --修改用户编号
,B.DATA_SRC_CD                AS DATA_SRC_CD1              --数据来源代码
,B.SRC_TBL                    AS SRC_TBL1                  --源表
,B.TASK_NAME                  AS TASK_NAME1                --任务名
,B.DATA_ETL_DATE              AS DATA_ETL_DATE1            --数据加载日期
,B.DATA_UPT_DATE              AS DATA_UPT_DATE1            --数据更新日期
,B.Real_Src_Tbl               AS Real_Src_Tbl1             --真实源表
,CASE WHEN A.Evt_Id IS NULL     AND B.Evt_Id IS NOT NULL THEN 'I' --新增
WHEN A.Evt_Id IS NOT NULL AND B.Evt_Id IS NULL THEN 'D' --删除
WHEN A.Evt_Id IS NOT NULL AND B.Evt_Id IS NOT NULL AND (
COALESCE(A.Sett_Ntfc_Id            ,'') <> COALESCE(B.Sett_Ntfc_Id            ,'')
OR COALESCE(A.Sett_Date               ,'') <> COALESCE(B.Sett_Date               ,'')
OR COALESCE(A.Sett_Ntfc_Stat_Cd       ,'') <> COALESCE(B.Sett_Ntfc_Stat_Cd       ,'')
OR COALESCE(A.Otc_Comp_Agt_Id         ,'') <> COALESCE(B.Otc_Comp_Agt_Id         ,'')
OR COALESCE(A.Otc_Comp_Agt_Modifr     ,'') <> COALESCE(B.Otc_Comp_Agt_Modifr     ,'')
OR COALESCE(A.Bask_Type_Cd            ,'') <> COALESCE(B.Bask_Type_Cd            ,'')
OR COALESCE(A.Bel_Dept_Name           ,'') <> COALESCE(B.Bel_Dept_Name           ,'')
OR COALESCE(A.Ast_Acct_Agt_Id         ,'') <> COALESCE(B.Ast_Acct_Agt_Id         ,'')
OR COALESCE(A.Ast_Acct_Agt_Modifr     ,'') <> COALESCE(B.Ast_Acct_Agt_Modifr     ,'')
OR COALESCE(A.Ast_Acct                ,'') <> COALESCE(B.Ast_Acct                ,'')
OR COALESCE(A.Pty_Id                  ,'') <> COALESCE(B.Pty_Id                  ,'')
OR COALESCE(A.Co_Name                 ,'') <> COALESCE(B.Co_Name                 ,'')
OR COALESCE(A.Sler_Name               ,'') <> COALESCE(B.Sler_Name               ,'')
OR COALESCE(A.Email_Sender            ,'') <> COALESCE(B.Email_Sender            ,'')
OR COALESCE(A.Email_Recvr             ,'') <> COALESCE(B.Email_Recvr             ,'')
OR COALESCE(A.Email_Cc                ,'') <> COALESCE(B.Email_Cc                ,'')
OR COALESCE(A.Src_Agt_Sub_Type_Cd     ,'') <> COALESCE(B.Src_Agt_Sub_Type_Cd     ,'')
OR COALESCE(A.Bgng_Prcg_Date          ,'') <> COALESCE(B.Bgng_Prcg_Date          ,'')
OR COALESCE(A.End_Prcg_Date           ,'') <> COALESCE(B.End_Prcg_Date           ,'')
OR COALESCE(A.Pay_Date                ,'') <> COALESCE(B.Pay_Date                ,'')
OR COALESCE(A.Flot_Yield_Amt          ,'') <> COALESCE(B.Flot_Yield_Amt          ,'')
OR COALESCE(A.Fix_Yield_Amt           ,'') <> COALESCE(B.Fix_Yield_Amt           ,'')
OR COALESCE(A.Ofst_Fee                ,'') <> COALESCE(B.Ofst_Fee                ,'')
OR COALESCE(A.Cash_Divd               ,'') <> COALESCE(B.Cash_Divd               ,'')
OR COALESCE(A.Oth_Fnd                 ,'') <> COALESCE(B.Oth_Fnd                 ,'')
OR COALESCE(A.Retu_Marg_Amt           ,'') <> COALESCE(B.Retu_Marg_Amt           ,'')
OR COALESCE(A.Tot_Sett_Amt            ,'') <> COALESCE(B.Tot_Sett_Amt            ,'')
OR COALESCE(A.Tot_Amt                 ,'') <> COALESCE(B.Tot_Amt                 ,'')
OR COALESCE(A.Tot_Nom_Prin            ,'') <> COALESCE(B.Tot_Nom_Prin            ,'')
OR COALESCE(A.Remn_Nom_Prin           ,'') <> COALESCE(B.Remn_Nom_Prin           ,'')
OR COALESCE(A.Exer_Yield              ,'') <> COALESCE(B.Exer_Yield              ,'')
OR COALESCE(A.Opt_Fee                 ,'') <> COALESCE(B.Opt_Fee                 ,'')
OR COALESCE(A.Appr_Date               ,'') <> COALESCE(B.Appr_Date               ,'')
OR COALESCE(A.Create_Time             ,'') <> COALESCE(B.Create_Time             ,'')
OR COALESCE(A.Create_User_Id          ,'') <> COALESCE(B.Create_User_Id          ,'')
OR COALESCE(A.Upd_Time                ,'') <> COALESCE(B.Upd_Time                ,'')
OR COALESCE(A.Upd_User_Id             ,'') <> COALESCE(B.Upd_User_Id             ,'')
) THEN 'U' --变更
ELSE 'S' --无变更
END                 AS DATA_TYPE              --数据类型
FROM  (SELECT * FROM T05_OTC_DERI_COMP_SETT_NTFC_SEND_EVT
WHERE SRC_TBL='ODATA_N_TIT.N_OPE_SETTLE_NOTICE')A
FULL OUTER JOIN TEMP.T05_OTC_DERI_COMP_SETT_NTFC_SEND_EVT_TEMP_TIT292 B
ON    A.Evt_Id=B.Evt_Id
;
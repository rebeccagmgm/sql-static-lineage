INSERT OVERWRITE TABLE T05_OTC_DERI_COMP_SETT_NTFC_SEND_EVT PARTITION(SRC_TBL)
SELECT DISTINCT
Evt_Id                                        --事件编号
,Sett_Ntfc_Id                                  --结算通知编号
,Sett_Date                                     --结算日期
,Sett_Ntfc_Stat_Cd                             --结算通知状态代码
,Otc_Comp_Agt_Id                               --场外合约协议编号
,Otc_Comp_Agt_Modifr                           --场外合约协议修饰符
,Bask_Type_Cd                                  --篮子类型代码
,Bel_Dept_Name                                 --所属部门名称
,Ast_Acct_Agt_Id                               --资金账户协议编号
,Ast_Acct_Agt_Modifr                           --资金账户协议修饰符
,Ast_Acct                                      --资金账户编号
,Pty_Id                                        --当事人编号
,Co_Name                                       --公司名称
,Sler_Name                                     --卖方名称
,Email_Sender                                  --邮箱发件人
,Email_Recvr                                   --邮箱收件人
,Email_Cc                                      --邮箱抄送人
,Src_Agt_Sub_Type_Cd                           --源协议子类型代码
,Bgng_Prcg_Date                                --期初定价日期
,End_Prcg_Date                                 --期末定价日期
,Pay_Date                                      --兑付日期
,Flot_Yield_Amt                                --浮动收益金额
,Fix_Yield_Amt                                 --固定收益金额
,Ofst_Fee                                      --平仓费用
,Cash_Divd                                     --现金分红
,Oth_Fnd                                       --其他资金
,Retu_Marg_Amt                                 --返还保证金
,Tot_Sett_Amt                                  --总结算金额
,Tot_Amt                                       --总金额
,Tot_Nom_Prin                                  --总名义本金
,Remn_Nom_Prin                                 --剩余名义本金
,Exer_Yield                                    --行权收益
,Opt_Fee                                       --期权费
,Appr_Date                                     --审批日期
,Create_Time                                   --创建时间
,Create_User_Id                                --创建用户编号
,Upd_Time                                      --修改时间
,Upd_User_Id                                   --修改用户编号
,Del_Flag                                      --删除标志
,Del_Date                                      --删除日期
,Data_Src_Cd                                   --数据来源代码
,Task_Name                                     --任务名
,Data_Etl_Date                                 --数据加载日期
,Data_Upt_Date                                 --数据更新日期
,Data_Time                                     --数据时间
,Real_Src_Tbl                                  --真实源表
,Src_Tbl                                       --源表
FROM T05_OTC_DERI_COMP_SETT_NTFC_SEND_EVT
WHERE DATA_ETL_DATE !='2026-05-20'
AND SRC_TBL = 'ODATA_N_TIT.N_OPE_SETTLE_NOTICE'
;

DROP TABLE IF EXISTS TEMP.T05_OTC_DERI_COMP_SETT_NTFC_SEND_EVT_TEMP_TIT292;

DROP TABLE IF EXISTS TEMP.T05_OTC_DERI_COMP_SETT_NTFC_SEND_EVT_MID_TIT292;

INSERT OVERWRITE TABLE T05_OTC_DERI_COMP_SETT_NTFC_SEND_EVT PARTITION(SRC_TBL)
SELECT
Evt_Id                                        --事件编号
,Sett_Ntfc_Id                                  --结算通知编号
,Sett_Date                                     --结算日期
,Sett_Ntfc_Stat_Cd                             --结算通知状态代码
,Otc_Comp_Agt_Id                               --场外合约协议编号
,Otc_Comp_Agt_Modifr                           --场外合约协议修饰符
,Bask_Type_Cd                                  --篮子类型代码
,Bel_Dept_Name                                 --所属部门名称
,Ast_Acct_Agt_Id                               --资金账户协议编号
,Ast_Acct_Agt_Modifr                           --资金账户协议修饰符
,Ast_Acct                                      --资金账户编号
,Pty_Id                                        --当事人编号
,Co_Name                                       --公司名称
,Sler_Name                                     --卖方名称
,Email_Sender                                  --邮箱发件人
,Email_Recvr                                   --邮箱收件人
,Email_Cc                                      --邮箱抄送人
,Src_Agt_Sub_Type_Cd                           --源协议子类型代码
,Bgng_Prcg_Date                                --期初定价日期
,End_Prcg_Date                                 --期末定价日期
,Pay_Date                                      --兑付日期
,Flot_Yield_Amt                                --浮动收益金额
,Fix_Yield_Amt                                 --固定收益金额
,Ofst_Fee                                      --平仓费用
,Cash_Divd                                     --现金分红
,Oth_Fnd                                       --其他资金
,Retu_Marg_Amt                                 --返还保证金
,Tot_Sett_Amt                                  --总结算金额
,Tot_Amt                                       --总金额
,Tot_Nom_Prin                                  --总名义本金
,Remn_Nom_Prin                                 --剩余名义本金
,Exer_Yield                                    --行权收益
,Opt_Fee                                       --期权费
,Appr_Date                                     --审批日期
,Create_Time                                   --创建时间
,Create_User_Id                                --创建用户编号
,Upd_Time                                      --修改时间
,Upd_User_Id                                   --修改用户编号
,'0'                     AS Del_Flag           --删除标志
,''                      AS Del_Date           --删除日期
,Data_Src_Cd                                   --数据来源代码
,Task_Name                                     --任务名
,Data_Etl_Date                                 --数据加载日期
,Data_Upt_Date                                 --数据更新日期
,Data_Time                                     --数据时间
,Real_Src_Tbl                                  --真实源表
,Src_Tbl                                       --源表
FROM TEMP.T05_OTC_DERI_COMP_SETT_NTFC_SEND_EVT_MID_TIT292 WHERE DATA_TYPE='S'  --插入无变化的数据
UNION ALL
SELECT
Evt_Id1                                      AS Evt_Id                   --事件编号
,Sett_Ntfc_Id1                                AS Sett_Ntfc_Id             --结算通知编号
,Sett_Date1                                   AS Sett_Date                --结算日期
,Sett_Ntfc_Stat_Cd1                           AS Sett_Ntfc_Stat_Cd        --结算通知状态代码
,Otc_Comp_Agt_Id1                             AS Otc_Comp_Agt_Id          --场外合约协议编号
,Otc_Comp_Agt_Modifr1                         AS Otc_Comp_Agt_Modifr      --场外合约协议修饰符
,Bask_Type_Cd1                                AS Bask_Type_Cd             --篮子类型代码
,Bel_Dept_Name1                               AS Bel_Dept_Name            --所属部门名称
,Ast_Acct_Agt_Id1                             AS Ast_Acct_Agt_Id          --资金账户协议编号
,Ast_Acct_Agt_Modifr1                         AS Ast_Acct_Agt_Modifr      --资金账户协议修饰符
,Ast_Acct1                                    AS Ast_Acct                 --资金账户编号
,Pty_Id1                                      AS Pty_Id                   --当事人编号
,Co_Name1                                     AS Co_Name                  --公司名称
,Sler_Name1                                   AS Sler_Name                --卖方名称
,Email_Sender1                                AS Email_Sender             --邮箱发件人
,Email_Recvr1                                 AS Email_Recvr              --邮箱收件人
,Email_Cc1                                    AS Email_Cc                 --邮箱抄送人
,Src_Agt_Sub_Type_Cd1                         AS Src_Agt_Sub_Type_Cd      --源协议子类型代码
,Bgng_Prcg_Date1                              AS Bgng_Prcg_Date           --期初定价日期
,End_Prcg_Date1                               AS End_Prcg_Date            --期末定价日期
,Pay_Date1                                    AS Pay_Date                 --兑付日期
,Flot_Yield_Amt1                              AS Flot_Yield_Amt           --浮动收益金额
,Fix_Yield_Amt1                               AS Fix_Yield_Amt            --固定收益金额
,Ofst_Fee1                                    AS Ofst_Fee                 --平仓费用
,Cash_Divd1                                   AS Cash_Divd                --现金分红
,Oth_Fnd1                                     AS Oth_Fnd                  --其他资金
,Retu_Marg_Amt1                               AS Retu_Marg_Amt            --返还保证金
,Tot_Sett_Amt1                                AS Tot_Sett_Amt             --总结算金额
,Tot_Amt1                                     AS Tot_Amt                  --总金额
,Tot_Nom_Prin1                                AS Tot_Nom_Prin             --总名义本金
,Remn_Nom_Prin1                               AS Remn_Nom_Prin            --剩余名义本金
,Exer_Yield1                                  AS Exer_Yield               --行权收益
,Opt_Fee1                                     AS Opt_Fee                  --期权费
,Appr_Date1                                   AS Appr_Date                --审批日期
,Create_Time1                                 AS Create_Time              --创建时间
,Create_User_Id1                              AS Create_User_Id           --创建用户编号
,Upd_Time1                                    AS Upd_Time                 --修改时间
,Upd_User_Id1                                 AS Upd_User_Id              --修改用户编号
,'0'                                          AS Del_Flag                 --删除标志
,''                                           AS Del_Date                 --删除日期
,Data_Src_Cd1                                 AS Data_Src_Cd              --数据来源代码
,Task_Name1                                   AS Task_Name                --任务名
,Data_Etl_Date                                AS Data_Etl_Date            --数据加载日期
,Data_Upt_Date1                               AS Data_Upt_Date            --数据更新日期
,'2026-05-21 02:01:20'                         AS Data_Time                --数据时间
,Real_Src_Tbl1                                AS Real_Src_Tbl             --真实源表
,Src_Tbl1                                     AS Src_Tbl                  --源表
FROM TEMP.T05_OTC_DERI_COMP_SETT_NTFC_SEND_EVT_MID_TIT292  WHERE DATA_TYPE='U'   --有变更的数据取变更的值
UNION ALL
SELECT
Evt_Id1                                      AS Evt_Id                   --事件编号
,Sett_Ntfc_Id1                                AS Sett_Ntfc_Id             --结算通知编号
,Sett_Date1                                   AS Sett_Date                --结算日期
,Sett_Ntfc_Stat_Cd1                           AS Sett_Ntfc_Stat_Cd        --结算通知状态代码
,Otc_Comp_Agt_Id1                             AS Otc_Comp_Agt_Id          --场外合约协议编号
,Otc_Comp_Agt_Modifr1                         AS Otc_Comp_Agt_Modifr      --场外合约协议修饰符
,Bask_Type_Cd1                                AS Bask_Type_Cd             --篮子类型代码
,Bel_Dept_Name1                               AS Bel_Dept_Name            --所属部门名称
,Ast_Acct_Agt_Id1                             AS Ast_Acct_Agt_Id          --资金账户协议编号
,Ast_Acct_Agt_Modifr1                         AS Ast_Acct_Agt_Modifr      --资金账户协议修饰符
,Ast_Acct1                                    AS Ast_Acct                 --资金账户编号
,Pty_Id1                                      AS Pty_Id                   --当事人编号
,Co_Name1                                     AS Co_Name                  --公司名称
,Sler_Name1                                   AS Sler_Name                --卖方名称
,Email_Sender1                                AS Email_Sender             --邮箱发件人
,Email_Recvr1                                 AS Email_Recvr              --邮箱收件人
,Email_Cc1                                    AS Email_Cc                 --邮箱抄送人
,Src_Agt_Sub_Type_Cd1                         AS Src_Agt_Sub_Type_Cd      --源协议子类型代码
,Bgng_Prcg_Date1                              AS Bgng_Prcg_Date           --期初定价日期
,End_Prcg_Date1                               AS End_Prcg_Date            --期末定价日期
,Pay_Date1                                    AS Pay_Date                 --兑付日期
,Flot_Yield_Amt1                              AS Flot_Yield_Amt           --浮动收益金额
,Fix_Yield_Amt1                               AS Fix_Yield_Amt            --固定收益金额
,Ofst_Fee1                                    AS Ofst_Fee                 --平仓费用
,Cash_Divd1                                   AS Cash_Divd                --现金分红
,Oth_Fnd1                                     AS Oth_Fnd                  --其他资金
,Retu_Marg_Amt1                               AS Retu_Marg_Amt            --返还保证金
,Tot_Sett_Amt1                                AS Tot_Sett_Amt             --总结算金额
,Tot_Amt1                                     AS Tot_Amt                  --总金额
,Tot_Nom_Prin1                                AS Tot_Nom_Prin             --总名义本金
,Remn_Nom_Prin1                               AS Remn_Nom_Prin            --剩余名义本金
,Exer_Yield1                                  AS Exer_Yield               --行权收益
,Opt_Fee1                                     AS Opt_Fee                  --期权费
,Appr_Date1                                   AS Appr_Date                --审批日期
,Create_Time1                                 AS Create_Time              --创建时间
,Create_User_Id1                              AS Create_User_Id           --创建用户编号
,Upd_Time1                                    AS Upd_Time                 --修改时间
,Upd_User_Id1                                 AS Upd_User_Id              --修改用户编号
,'0'                                          AS Del_Flag                 --删除标志
,''                                           AS Del_Date                 --删除日期
,Data_Src_Cd1                                 As Data_Src_Cd              --数据来源代码
,Task_Name1                                   As Task_Name                --任务名
,Data_Etl_Date1                               As Data_Etl_Date            --数据加载日期
,Data_Upt_Date1                               AS Data_Upt_Date            --数据更新日期
,'2026-05-21 02:01:20'                         AS Data_Time                --数据时间
,Real_Src_Tbl1                                AS Real_Src_Tbl             --真实源表
,Src_Tbl1                                     AS Src_Tbl                  --源表
FROM TEMP.T05_OTC_DERI_COMP_SETT_NTFC_SEND_EVT_MID_TIT292  WHERE DATA_TYPE='I'   --插入新增的数据
UNION ALL
SELECT
Evt_Id                                                  --事件编号
,Sett_Ntfc_Id                                            --结算通知编号
,Sett_Date                                               --结算日期
,Sett_Ntfc_Stat_Cd                                       --结算通知状态代码
,Otc_Comp_Agt_Id                                         --场外合约协议编号
,Otc_Comp_Agt_Modifr                                     --场外合约协议修饰符
,Bask_Type_Cd                                            --篮子类型代码
,Bel_Dept_Name                                           --所属部门名称
,Ast_Acct_Agt_Id                                         --资金账户协议编号
,Ast_Acct_Agt_Modifr                                     --资金账户协议修饰符
,Ast_Acct                                                --资金账户编号
,Pty_Id                                                  --当事人编号
,Co_Name                                                 --公司名称
,Sler_Name                                               --卖方名称
,Email_Sender                                            --邮箱发件人
,Email_Recvr                                             --邮箱收件人
,Email_Cc                                                --邮箱抄送人
,Src_Agt_Sub_Type_Cd                                     --源协议子类型代码
,Bgng_Prcg_Date                                          --期初定价日期
,End_Prcg_Date                                           --期末定价日期
,Pay_Date                                                --兑付日期
,Flot_Yield_Amt                                          --浮动收益金额
,Fix_Yield_Amt                                           --固定收益金额
,Ofst_Fee                                                --平仓费用
,Cash_Divd                                               --现金分红
,Oth_Fnd                                                 --其他资金
,Retu_Marg_Amt                                           --返还保证金
,Tot_Sett_Amt                                            --总结算金额
,Tot_Amt                                                 --总金额
,Tot_Nom_Prin                                            --总名义本金
,Remn_Nom_Prin                                           --剩余名义本金
,Exer_Yield                                              --行权收益
,Opt_Fee                                                 --期权费
,Appr_Date                                               --审批日期
,Create_Time                                             --创建时间
,Create_User_Id                                          --创建用户编号
,Upd_Time                                                --修改时间
,Upd_User_Id                                             --修改用户编号
,'1'                              AS Del_Flag            --删除标志
,CASE WHEN Del_Date !=''
THEN Del_Date
ELSE '2026-05-20'
END                         AS Del_Date            --删除日期
,Data_Src_Cd                                            --数据来源代码
,Task_Name                                              --任务名
,Data_Etl_Date                                          --数据加载日期
,CASE WHEN Del_Date !=''
THEN Data_Upt_Date
ELSE '2026-05-20'
END                         AS Data_Upt_Date       --数据更新日期
,CASE WHEN Del_Date !=''
THEN Data_Time
ELSE '2026-05-21 02:01:20'
END                         AS Data_Time           --数据时间
,Real_Src_Tbl                                            --真实源表
,Src_Tbl                                                 --源表
FROM TEMP.T05_OTC_DERI_COMP_SETT_NTFC_SEND_EVT_MID_TIT292 WHERE DATA_TYPE='D'  --插入删除的数据
;
INSERT OVERWRITE TABLE T05_OTC_RECV_PYMT_EVT PARTITION(SRC_TBL)
SELECT
*
FROM T05_OTC_RECV_PYMT_EVT
WHERE DATA_ETL_DATE !='2026-06-11'
AND SRC_TBL = 'ODATA_N_TIT.D_TRD_TRANSFER'
;

DROP TABLE IF EXISTS TEMP.T05_OTC_RECV_PYMT_EVT_TEMP_TIT157;

DROP TABLE IF EXISTS TEMP.T05_OTC_RECV_PYMT_EVT_MID_TIT157;

INSERT OVERWRITE TABLE T05_OTC_RECV_PYMT_EVT PARTITION(SRC_TBL)
SELECT
Evt_Id                                        --事件编号
,Recv_Pymt_No                                  --收付款编号
,Trd_Id                                        --交易编号
,Comp_No                                       --合约编号
,Paid_Date                                     --支付日期
,Recv_Pymt_Type_Cd                             --收付款类型代码
,Crrc_Cd                                       --币种代码
,Recv_Pymt_Dir_Cd                              --收付款方向代码
,Recv_Pymt_Stat_Cd                             --收付款状态代码
,Book_Agt_Id                                   --账簿协议编号
,Book_Agt_Modifr                               --账簿协议修饰符
,Begn_Date                                     --起始日期
,End_Date                                      --结束日期
,Pty_Id                                        --当事人编号
,Prd_Id                                        --产品编号
,Src_Prd_Id                                    --源产品编号
,Clr_Date                                      --清算日期
,Fee_Type_Cd                                   --费用类型代码
,Swap_Hold_Id                                  --互换持仓编号
,Swap_Hold_Undrl_Cd                            --互换持仓标的代码
,Src_Prd_Type_Cd                               --源产品类型代码
,Rate                                          --汇率
,Undrl_Qty                                     --标的数量
,Pric                                          --价格
,Leg_Glbl_Seq_No                               --Leg全局序号
,Prft_Type_Cd                                  --收益类型代码
,Swap_Dura_Evt_No                              --互换存续期事件编号
,Swap_Dura_Evt_Type_Cd                         --互换存续期事件类型代码
,Actl_Paid_Date                                --实际支付日期
,Amt                                           --金额
,Our_Payb_Amt                                  --我司应付金额
,Our_Rcvb_Amt                                  --我司应收金额
,Ocrrc_Amt                                     --原币种金额
,Our_Payb_Ocrrc_Amt                            --我司应付原币种金额
,Our_Rcvb_Ocrrc_Amt                            --我司应收原币种金额
,Aft_Adj_Amt                                   --调整后金额
,Aft_Adj_Our_Payb_Amt                          --调整后我司应付金额
,Aft_Adj_Our_Rcvb_Amt                          --调整后我司应收金额
,Aft_Adj_Ocrrc_Amt                             --调整后原币种金额
,Aft_Adj_Our_Payb_Ocrrc_Amt                    --调整后我司应付原币种金额
,Aft_Adj_Our_Rcvb_Ocrrc_Amt                    --调整后我司应收原币种金额
,Clr_Type_Cd                                   --清算类型代码
,Paid_Date_Id                                  --支付日期编号
,Create_Time                                   --创建时间
,Creator                                       --创建人
,Upd_Time                                      --更新时间
,Upd_User                                      --更新人
,Ver_No                                        --版本号
,'0'                     AS Del_Flag           --删除标志
,''                      AS Del_Date           --删除日期
,Data_Src_Cd                                   --数据来源代码
,Task_Name                                     --任务名
,Data_Etl_Date                                 --数据加载日期
,Data_Upt_Date                                 --数据更新日期
,Data_Time                                     --数据时间
,Src_Tbl                                       --源表
FROM TEMP.T05_OTC_RECV_PYMT_EVT_MID_TIT157 WHERE DATA_TYPE='S'  --插入无变化的数据
UNION ALL
SELECT
Evt_Id1                                      AS Evt_Id                   --事件编号
,Recv_Pymt_No1                                AS Recv_Pymt_No             --收付款编号
,Trd_Id1                                      AS Trd_Id                   --交易编号
,Comp_No1                                     AS Comp_No                  --合约编号
,Paid_Date1                                   AS Paid_Date                --支付日期
,Recv_Pymt_Type_Cd1                           AS Recv_Pymt_Type_Cd        --收付款类型代码
,Crrc_Cd1                                     AS Crrc_Cd                  --币种代码
,Recv_Pymt_Dir_Cd1                            AS Recv_Pymt_Dir_Cd         --收付款方向代码
,Recv_Pymt_Stat_Cd1                           AS Recv_Pymt_Stat_Cd        --收付款状态代码
,Book_Agt_Id1                                 AS Book_Agt_Id              --账簿协议编号
,Book_Agt_Modifr1                             AS Book_Agt_Modifr          --账簿协议修饰符
,Begn_Date1                                   AS Begn_Date                --起始日期
,End_Date1                                    AS End_Date                 --结束日期
,Pty_Id1                                      AS Pty_Id                   --当事人编号
,Prd_Id1                                      AS Prd_Id                   --产品编号
,Src_Prd_Id1                                  AS Src_Prd_Id               --源产品编号
,Clr_Date1                                    AS Clr_Date                 --清算日期
,Fee_Type_Cd1                                 AS Fee_Type_Cd              --费用类型代码
,Swap_Hold_Id1                                AS Swap_Hold_Id             --互换持仓编号
,Swap_Hold_Undrl_Cd1                          AS Swap_Hold_Undrl_Cd       --互换持仓标的代码
,Src_Prd_Type_Cd1                             AS Src_Prd_Type_Cd          --源产品类型代码
,Rate1                                        AS Rate                     --汇率
,Undrl_Qty1                                   AS Undrl_Qty                --标的数量
,Pric1                                        AS Pric                     --价格
,Leg_Glbl_Seq_No1                             AS Leg_Glbl_Seq_No          --Leg全局序号
,Prft_Type_Cd1                                AS Prft_Type_Cd             --收益类型代码
,Swap_Dura_Evt_No1                            AS Swap_Dura_Evt_No         --互换存续期事件编号
,Swap_Dura_Evt_Type_Cd1                       AS Swap_Dura_Evt_Type_Cd    --互换存续期事件类型代码
,Actl_Paid_Date1                              AS Actl_Paid_Date           --实际支付日期
,Amt1                                         AS Amt                      --金额
,Our_Payb_Amt1                                AS Our_Payb_Amt             --我司应付金额
,Our_Rcvb_Amt1                                AS Our_Rcvb_Amt             --我司应收金额
,Ocrrc_Amt1                                   AS Ocrrc_Amt                --原币种金额
,Our_Payb_Ocrrc_Amt1                          AS Our_Payb_Ocrrc_Amt       --我司应付原币种金额
,Our_Rcvb_Ocrrc_Amt1                          AS Our_Rcvb_Ocrrc_Amt       --我司应收原币种金额
,Aft_Adj_Amt1                                 AS Aft_Adj_Amt              --调整后金额
,Aft_Adj_Our_Payb_Amt1                        AS Aft_Adj_Our_Payb_Amt     --调整后我司应付金额
,Aft_Adj_Our_Rcvb_Amt1                        AS Aft_Adj_Our_Rcvb_Amt     --调整后我司应收金额
,Aft_Adj_Ocrrc_Amt1                           AS Aft_Adj_Ocrrc_Amt        --调整后原币种金额
,Aft_Adj_Our_Payb_Ocrrc_Amt1                  AS Aft_Adj_Our_Payb_Ocrrc_Amt --调整后我司应付原币种金额
,Aft_Adj_Our_Rcvb_Ocrrc_Amt1                  AS Aft_Adj_Our_Rcvb_Ocrrc_Amt --调整后我司应收原币种金额
,Clr_Type_Cd1                                 AS Clr_Type_Cd              --清算类型代码
,Paid_Date_Id1                                AS Paid_Date_Id             --支付日期编号
,Create_Time1                                 AS Create_Time              --创建时间
,Creator1                                     AS Creator                  --创建人
,Upd_Time1                                    AS Upd_Time                 --更新时间
,Upd_User1                                    AS Upd_User                 --更新人
,Ver_No1                                      AS Ver_No                   --版本号
,'0'                                          AS Del_Flag                 --删除标志
,''                                           AS Del_Date                 --删除日期
,Data_Src_Cd1                                 AS Data_Src_Cd              --数据来源代码
,Task_Name1                                   AS Task_Name                --任务名
,Data_Etl_Date                                AS Data_Etl_Date            --数据加载日期
,Data_Upt_Date1                               AS Data_Upt_Date            --数据更新日期
,'2026-06-12 16:39:24'                         AS Data_Time                --数据时间
,Src_Tbl1                                     AS Src_Tbl                  --源表
FROM TEMP.T05_OTC_RECV_PYMT_EVT_MID_TIT157  WHERE DATA_TYPE='U'   --有变更的数据取变更的值
UNION ALL
SELECT
Evt_Id1                                      AS Evt_Id                   --事件编号
,Recv_Pymt_No1                                AS Recv_Pymt_No             --收付款编号
,Trd_Id1                                      AS Trd_Id                   --交易编号
,Comp_No1                                     AS Comp_No                  --合约编号
,Paid_Date1                                   AS Paid_Date                --支付日期
,Recv_Pymt_Type_Cd1                           AS Recv_Pymt_Type_Cd        --收付款类型代码
,Crrc_Cd1                                     AS Crrc_Cd                  --币种代码
,Recv_Pymt_Dir_Cd1                            AS Recv_Pymt_Dir_Cd         --收付款方向代码
,Recv_Pymt_Stat_Cd1                           AS Recv_Pymt_Stat_Cd        --收付款状态代码
,Book_Agt_Id1                                 AS Book_Agt_Id              --账簿协议编号
,Book_Agt_Modifr1                             AS Book_Agt_Modifr          --账簿协议修饰符
,Begn_Date1                                   AS Begn_Date                --起始日期
,End_Date1                                    AS End_Date                 --结束日期
,Pty_Id1                                      AS Pty_Id                   --当事人编号
,Prd_Id1                                      AS Prd_Id                   --产品编号
,Src_Prd_Id1                                  AS Src_Prd_Id               --源产品编号
,Clr_Date1                                    AS Clr_Date                 --清算日期
,Fee_Type_Cd1                                 AS Fee_Type_Cd              --费用类型代码
,Swap_Hold_Id1                                AS Swap_Hold_Id             --互换持仓编号
,Swap_Hold_Undrl_Cd1                          AS Swap_Hold_Undrl_Cd       --互换持仓标的代码
,Src_Prd_Type_Cd1                             AS Src_Prd_Type_Cd          --源产品类型代码
,Rate1                                        AS Rate                     --汇率
,Undrl_Qty1                                   AS Undrl_Qty                --标的数量
,Pric1                                        AS Pric                     --价格
,Leg_Glbl_Seq_No1                             AS Leg_Glbl_Seq_No          --Leg全局序号
,Prft_Type_Cd1                                AS Prft_Type_Cd             --收益类型代码
,Swap_Dura_Evt_No1                            AS Swap_Dura_Evt_No         --互换存续期事件编号
,Swap_Dura_Evt_Type_Cd1                       AS Swap_Dura_Evt_Type_Cd    --互换存续期事件类型代码
,Actl_Paid_Date1                              AS Actl_Paid_Date           --实际支付日期
,Amt1                                         AS Amt                      --金额
,Our_Payb_Amt1                                AS Our_Payb_Amt             --我司应付金额
,Our_Rcvb_Amt1                                AS Our_Rcvb_Amt             --我司应收金额
,Ocrrc_Amt1                                   AS Ocrrc_Amt                --原币种金额
,Our_Payb_Ocrrc_Amt1                          AS Our_Payb_Ocrrc_Amt       --我司应付原币种金额
,Our_Rcvb_Ocrrc_Amt1                          AS Our_Rcvb_Ocrrc_Amt       --我司应收原币种金额
,Aft_Adj_Amt1                                 AS Aft_Adj_Amt              --调整后金额
,Aft_Adj_Our_Payb_Amt1                        AS Aft_Adj_Our_Payb_Amt     --调整后我司应付金额
,Aft_Adj_Our_Rcvb_Amt1                        AS Aft_Adj_Our_Rcvb_Amt     --调整后我司应收金额
,Aft_Adj_Ocrrc_Amt1                           AS Aft_Adj_Ocrrc_Amt        --调整后原币种金额
,Aft_Adj_Our_Payb_Ocrrc_Amt1                  AS Aft_Adj_Our_Payb_Ocrrc_Amt --调整后我司应付原币种金额
,Aft_Adj_Our_Rcvb_Ocrrc_Amt1                  AS Aft_Adj_Our_Rcvb_Ocrrc_Amt --调整后我司应收原币种金额
,Clr_Type_Cd1                                 AS Clr_Type_Cd              --清算类型代码
,Paid_Date_Id1                                AS Paid_Date_Id             --支付日期编号
,Create_Time1                                 AS Create_Time              --创建时间
,Creator1                                     AS Creator                  --创建人
,Upd_Time1                                    AS Upd_Time                 --更新时间
,Upd_User1                                    AS Upd_User                 --更新人
,Ver_No1                                      AS Ver_No                   --版本号
,'0'                                          AS Del_Flag                 --删除标志
,''                                           AS Del_Date                 --删除日期
,Data_Src_Cd1                                 As Data_Src_Cd              --数据来源代码
,Task_Name1                                   As Task_Name                --任务名
,Data_Etl_Date1                               As Data_Etl_Date            --数据加载日期
,Data_Upt_Date1                               AS Data_Upt_Date            --数据更新日期
,'2026-06-12 16:39:24'                         AS Data_Time                --数据时间
,Src_Tbl1                                     AS Src_Tbl                  --源表
FROM TEMP.T05_OTC_RECV_PYMT_EVT_MID_TIT157  WHERE DATA_TYPE='I'   --插入新增的数据
UNION ALL
SELECT
Evt_Id                                                  --事件编号
,Recv_Pymt_No                                            --收付款编号
,Trd_Id                                                  --交易编号
,Comp_No                                                 --合约编号
,Paid_Date                                               --支付日期
,Recv_Pymt_Type_Cd                                       --收付款类型代码
,Crrc_Cd                                                 --币种代码
,Recv_Pymt_Dir_Cd                                        --收付款方向代码
,Recv_Pymt_Stat_Cd                                       --收付款状态代码
,Book_Agt_Id                                             --账簿协议编号
,Book_Agt_Modifr                                         --账簿协议修饰符
,Begn_Date                                               --起始日期
,End_Date                                                --结束日期
,Pty_Id                                                  --当事人编号
,Prd_Id                                                  --产品编号
,Src_Prd_Id                                              --源产品编号
,Clr_Date                                                --清算日期
,Fee_Type_Cd                                             --费用类型代码
,Swap_Hold_Id                                            --互换持仓编号
,Swap_Hold_Undrl_Cd                                      --互换持仓标的代码
,Src_Prd_Type_Cd                                         --源产品类型代码
,Rate                                                    --汇率
,Undrl_Qty                                               --标的数量
,Pric                                                    --价格
,Leg_Glbl_Seq_No                                         --Leg全局序号
,Prft_Type_Cd                                            --收益类型代码
,Swap_Dura_Evt_No                                        --互换存续期事件编号
,Swap_Dura_Evt_Type_Cd                                   --互换存续期事件类型代码
,Actl_Paid_Date                                          --实际支付日期
,Amt                                                     --金额
,Our_Payb_Amt                                            --我司应付金额
,Our_Rcvb_Amt                                            --我司应收金额
,Ocrrc_Amt                                               --原币种金额
,Our_Payb_Ocrrc_Amt                                      --我司应付原币种金额
,Our_Rcvb_Ocrrc_Amt                                      --我司应收原币种金额
,Aft_Adj_Amt                                             --调整后金额
,Aft_Adj_Our_Payb_Amt                                    --调整后我司应付金额
,Aft_Adj_Our_Rcvb_Amt                                    --调整后我司应收金额
,Aft_Adj_Ocrrc_Amt                                       --调整后原币种金额
,Aft_Adj_Our_Payb_Ocrrc_Amt                                --调整后我司应付原币种金额
,Aft_Adj_Our_Rcvb_Ocrrc_Amt                                --调整后我司应收原币种金额
,Clr_Type_Cd                                             --清算类型代码
,Paid_Date_Id                                            --支付日期编号
,Create_Time                                             --创建时间
,Creator                                                 --创建人
,Upd_Time                                                --更新时间
,Upd_User                                                --更新人
,Ver_No                                                  --版本号
,'1'                              AS Del_Flag            --删除标志
,CASE WHEN Del_Date !=''
THEN Del_Date
ELSE '2026-06-11'
END                         AS Del_Date            --删除日期
,Data_Src_Cd                                            --数据来源代码
,Task_Name                                              --任务名
,Data_Etl_Date                                          --数据加载日期
,CASE WHEN Del_Date !=''
THEN Data_Upt_Date
ELSE '2026-06-11'
END                         AS Data_Upt_Date       --数据更新日期
,CASE WHEN Del_Date !=''
THEN Data_Time
ELSE '2026-06-12 16:39:24'
END                         AS Data_Time           --数据时间
,Src_Tbl                                                 --源表
FROM TEMP.T05_OTC_RECV_PYMT_EVT_MID_TIT157 WHERE DATA_TYPE='D'  --插入删除的数据
;
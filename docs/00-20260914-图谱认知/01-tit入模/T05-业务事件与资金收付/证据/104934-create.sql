CREATE TABLE IF NOT EXISTS T05_OTC_RECV_PYMT_EVT(
Evt_Id                     STRING COMMENT '事件编号'
,Recv_Pymt_No               STRING COMMENT '收付款编号'
,Trd_Id                     STRING COMMENT '交易编号'
,Comp_No                    STRING COMMENT '合约编号'
,Paid_Date                  STRING COMMENT '支付日期'
,Recv_Pymt_Type_Cd          STRING COMMENT '收付款类型代码'
,Crrc_Cd                    STRING COMMENT '币种代码'
,Recv_Pymt_Dir_Cd           STRING COMMENT '收付款方向代码'
,Recv_Pymt_Stat_Cd          STRING COMMENT '收付款状态代码'
,Book_Agt_Id                STRING COMMENT '账簿协议编号'
,Book_Agt_Modifr            STRING COMMENT '账簿协议修饰符'
,Begn_Date                  STRING COMMENT '起始日期'
,End_Date                   STRING COMMENT '结束日期'
,Pty_Id                     STRING COMMENT '当事人编号'
,Prd_Id                     STRING COMMENT '产品编号'
,Src_Prd_Id                 STRING COMMENT '源产品编号'
,Clr_Date                   STRING COMMENT '清算日期'
,Fee_Type_Cd                STRING COMMENT '费用类型代码'
,Swap_Hold_Id               STRING COMMENT '互换持仓编号'
,Swap_Hold_Undrl_Cd         STRING COMMENT '互换持仓标的代码'
,Src_Prd_Type_Cd            STRING COMMENT '源产品类型代码'
,Rate                       STRING COMMENT '汇率'
,Undrl_Qty                  STRING COMMENT '标的数量'
,Pric                       STRING COMMENT '价格'
,Leg_Glbl_Seq_No            STRING COMMENT 'Leg全局序号'
,Prft_Type_Cd               STRING COMMENT '收益类型代码'
,Swap_Dura_Evt_No           STRING COMMENT '互换存续期事件编号'
,Swap_Dura_Evt_Type_Cd      STRING COMMENT '互换存续期事件类型代码'
,Actl_Paid_Date             STRING COMMENT '实际支付日期'
,Amt                        STRING COMMENT '金额'
,Our_Payb_Amt               STRING COMMENT '我司应付金额'
,Our_Rcvb_Amt               STRING COMMENT '我司应收金额'
,Ocrrc_Amt                  STRING COMMENT '原币种金额'
,Our_Payb_Ocrrc_Amt         STRING COMMENT '我司应付原币种金额'
,Our_Rcvb_Ocrrc_Amt         STRING COMMENT '我司应收原币种金额'
,Aft_Adj_Amt                STRING COMMENT '调整后金额'
,Aft_Adj_Our_Payb_Amt       STRING COMMENT '调整后我司应付金额'
,Aft_Adj_Our_Rcvb_Amt       STRING COMMENT '调整后我司应收金额'
,Aft_Adj_Ocrrc_Amt          STRING COMMENT '调整后原币种金额'
,Aft_Adj_Our_Payb_Ocrrc_Amt   STRING COMMENT '调整后我司应付原币种金额'
,Aft_Adj_Our_Rcvb_Ocrrc_Amt   STRING COMMENT '调整后我司应收原币种金额'
,Clr_Type_Cd                STRING COMMENT '清算类型代码'
,Paid_Date_Id               STRING COMMENT '支付日期编号'
,Create_Time                STRING COMMENT '创建时间'
,Creator                    STRING COMMENT '创建人'
,Upd_Time                   STRING COMMENT '更新时间'
,Upd_User                   STRING COMMENT '更新人'
,Ver_No                     STRING COMMENT '版本号'
,Del_Flag                   STRING COMMENT '删除标志'
,Del_Date                   STRING COMMENT '删除日期'
,Data_Src_Cd                STRING COMMENT '数据来源代码'
,Task_Name                  STRING COMMENT '任务名'
,Data_Etl_Date              STRING COMMENT '数据加载日期'
,Data_Upt_Date              STRING COMMENT '数据更新日期'
,Data_Time                  STRING COMMENT '数据时间'
)COMMENT '场外衍生品收付款事件'
PARTITIONED BY (SRC_TBL STRING COMMENT '源表')
STORED AS ORC;

CREATE TABLE IF NOT EXISTS TEMP.T05_OTC_RECV_PYMT_EVT_TEMP_TIT157
AS
SELECT
CONCAT('TIT157-',TRANSFER_ID)            AS  Evt_Id                  --事件编号
,TRANSFER_ID                              AS  Recv_Pymt_No            --收付款编号
,TRADE_ID                                 AS  Trd_Id                  --交易编号
,KEY_CONTRACT_ID                          AS  Comp_No                 --合约编号
,SUBSTR(PAYMENT_DATE,1,10)                AS  Paid_Date               --支付日期
,TRANSFER_TYPE                            AS  Recv_Pymt_Type_Cd       --收付款类型代码
,CURRENCY                                 AS  Crrc_Cd                 --币种代码
,PAYRECEIVE_TYPE                          AS  Recv_Pymt_Dir_Cd        --收付款方向代码
,TRANSFER_STATUS                          AS  Recv_Pymt_Stat_Cd       --收付款状态代码
,BOOK_ID                                  AS  Book_Agt_Id             --账簿协议编号
,'20411'                                  AS  Book_Agt_Modifr         --账簿协议修饰符
,SUBSTR(START_DATE,1,10)                  AS  Begn_Date               --起始日期
,SUBSTR(END_DATE,1,10)                    AS  End_Date                --结束日期
,IF(NVL(TRIM(KEY_CTPTY_ID),'')='','',CONCAT('TIT060-',KEY_CTPTY_ID))
AS  Pty_Id                  --当事人编号
,CONCAT('TIT-',KEY_INSTRUMENT_ID)         AS  Prd_Id                  --产品编号
,KEY_INSTRUMENT_ID                        AS  Src_Prd_Id              --源产品编号
,SUBSTR(CLEARING_DATE,1,10)               AS  Clr_Date                --清算日期
,TRANSFER_FEE_TYPE                        AS  Fee_Type_Cd             --费用类型代码
,TRS_LEG_POSITION_ID                      AS  Swap_Hold_Id            --互换持仓编号
,UNDERLYING_WIND_CODE                     AS  Swap_Hold_Undrl_Cd      --互换持仓标的代码
,INS_FAMILY                               AS  Src_Prd_Type_Cd         --源产品类型代码
,EXCHANGE_RATE                            AS  Rate                    --汇率
,UNDERLYING_QUANTITY                      AS  Undrl_Qty               --标的数量
,PRICE                                    AS  Pric                    --价格
,KEY_LEG_ID                               AS  Leg_Glbl_Seq_No         --Leg全局序号
,PROFIT_TYPE                              AS  Prft_Type_Cd            --收益类型代码
,KEY_TRS_EVENT_ID                         AS  Swap_Dura_Evt_No        --互换存续期事件编号
,TRS_EVENT_TYPE                           AS  Swap_Dura_Evt_Type_Cd   --互换存续期事件类型代码
,SUBSTR(ACTUAL_PAYMENT_DATE,1,10)         AS  Actl_Paid_Date          --实际支付日期
,AMOUNT                                   AS  Amt                     --金额
,PAYABLE                                  AS  Our_Payb_Amt            --我司应付金额
,RECEIVALBE                               AS  Our_Rcvb_Amt            --我司应收金额
,AMOUNT_ORG                               AS  Ocrrc_Amt               --原币种金额
,PAYABLE_ORG                              AS  Our_Payb_Ocrrc_Amt      --我司应付原币种金额
,RECEIVALBE_ORG                           AS  Our_Rcvb_Ocrrc_Amt      --我司应收原币种金额
,AMOUNT_ADJUSTED                          AS  Aft_Adj_Amt             --调整后金额
,AMOUNT_RECEIVALBE                        AS  Aft_Adj_Our_Payb_Amt    --调整后我司应付金额
,AMOUNT_PAYABLE                           AS  Aft_Adj_Our_Rcvb_Amt    --调整后我司应收金额
,AMOUNT_ADJUSTED_ORG                      AS  Aft_Adj_Ocrrc_Amt       --调整后原币种金额
,AMOUNT_RECEIVALBE_ORG                    AS  Aft_Adj_Our_Payb_Ocrrc_Amt--调整后我司应付原币种金额
,AMOUNT_PAYABLE_ORG                       AS  Aft_Adj_Our_Rcvb_Ocrrc_Amt--调整后我司应收原币种金额
,CLEARING_TYPE                            AS  Clr_Type_Cd             --清算类型代码
,KEY_FEE_PAYMENT_ID                       AS  Paid_Date_Id            --支付日期编号
,CREATED_DATETIME                         AS  Create_Time             --创建时间
,CREATED_BY                               AS  Creator                 --创建人
,UPDATED_DATETIME                         AS  Upd_Time                --更新时间
,UPDATED_BY                               AS  Upd_User                --更新人
,VERSION                                  AS  Ver_No                  --版本号
,'TIT'                    AS  Data_Src_Cd             --数据来源代码
,'ODATA_N_TIT.D_TRD_TRANSFER'                      AS  Src_Tbl                 --源表
,'PDATA_N.T05_OTC_RECV_PYMT_EVT_TIT157'                       AS  Task_Name               --任务名
,'2026-06-11'                   AS  Data_Etl_Date           --数据加载日期
,'2026-06-11'                   AS  Data_Upt_Date           --数据更新日期
FROM  ODATA_N_TIT.D_TRD_TRANSFER A
;

CREATE TABLE IF NOT EXISTS TEMP.T05_OTC_RECV_PYMT_EVT_MID_TIT157
AS
SELECT
A.*
,B.Evt_Id                     AS Evt_Id1                   --事件编号
,B.Recv_Pymt_No               AS Recv_Pymt_No1             --收付款编号
,B.Trd_Id                     AS Trd_Id1                   --交易编号
,B.Comp_No                    AS Comp_No1                  --合约编号
,B.Paid_Date                  AS Paid_Date1                --支付日期
,B.Recv_Pymt_Type_Cd          AS Recv_Pymt_Type_Cd1        --收付款类型代码
,B.Crrc_Cd                    AS Crrc_Cd1                  --币种代码
,B.Recv_Pymt_Dir_Cd           AS Recv_Pymt_Dir_Cd1         --收付款方向代码
,B.Recv_Pymt_Stat_Cd          AS Recv_Pymt_Stat_Cd1        --收付款状态代码
,B.Book_Agt_Id                AS Book_Agt_Id1              --账簿协议编号
,B.Book_Agt_Modifr            AS Book_Agt_Modifr1          --账簿协议修饰符
,B.Begn_Date                  AS Begn_Date1                --起始日期
,B.End_Date                   AS End_Date1                 --结束日期
,B.Pty_Id                     AS Pty_Id1                   --当事人编号
,B.Prd_Id                     AS Prd_Id1                   --产品编号
,B.Src_Prd_Id                 AS Src_Prd_Id1               --源产品编号
,B.Clr_Date                   AS Clr_Date1                 --清算日期
,B.Fee_Type_Cd                AS Fee_Type_Cd1              --费用类型代码
,B.Swap_Hold_Id               AS Swap_Hold_Id1             --互换持仓编号
,B.Swap_Hold_Undrl_Cd         AS Swap_Hold_Undrl_Cd1       --互换持仓标的代码
,B.Src_Prd_Type_Cd            AS Src_Prd_Type_Cd1          --源产品类型代码
,B.Rate                       AS Rate1                     --汇率
,B.Undrl_Qty                  AS Undrl_Qty1                --标的数量
,B.Pric                       AS Pric1                     --价格
,B.Leg_Glbl_Seq_No            AS Leg_Glbl_Seq_No1          --Leg全局序号
,B.Prft_Type_Cd               AS Prft_Type_Cd1             --收益类型代码
,B.Swap_Dura_Evt_No           AS Swap_Dura_Evt_No1         --互换存续期事件编号
,B.Swap_Dura_Evt_Type_Cd      AS Swap_Dura_Evt_Type_Cd1    --互换存续期事件类型代码
,B.Actl_Paid_Date             AS Actl_Paid_Date1           --实际支付日期
,B.Amt                        AS Amt1                      --金额
,B.Our_Payb_Amt               AS Our_Payb_Amt1             --我司应付金额
,B.Our_Rcvb_Amt               AS Our_Rcvb_Amt1             --我司应收金额
,B.Ocrrc_Amt                  AS Ocrrc_Amt1                --原币种金额
,B.Our_Payb_Ocrrc_Amt         AS Our_Payb_Ocrrc_Amt1       --我司应付原币种金额
,B.Our_Rcvb_Ocrrc_Amt         AS Our_Rcvb_Ocrrc_Amt1       --我司应收原币种金额
,B.Aft_Adj_Amt                AS Aft_Adj_Amt1              --调整后金额
,B.Aft_Adj_Our_Payb_Amt       AS Aft_Adj_Our_Payb_Amt1     --调整后我司应付金额
,B.Aft_Adj_Our_Rcvb_Amt       AS Aft_Adj_Our_Rcvb_Amt1     --调整后我司应收金额
,B.Aft_Adj_Ocrrc_Amt          AS Aft_Adj_Ocrrc_Amt1        --调整后原币种金额
,B.Aft_Adj_Our_Payb_Ocrrc_Amt   AS Aft_Adj_Our_Payb_Ocrrc_Amt1  --调整后我司应付原币种金额
,B.Aft_Adj_Our_Rcvb_Ocrrc_Amt   AS Aft_Adj_Our_Rcvb_Ocrrc_Amt1  --调整后我司应收原币种金额
,B.Clr_Type_Cd                AS Clr_Type_Cd1              --清算类型代码
,B.Paid_Date_Id               AS Paid_Date_Id1             --支付日期编号
,B.Create_Time                AS Create_Time1              --创建时间
,B.Creator                    AS Creator1                  --创建人
,B.Upd_Time                   AS Upd_Time1                 --更新时间
,B.Upd_User                   AS Upd_User1                 --更新人
,B.Ver_No                     AS Ver_No1                   --版本号
,B.DATA_SRC_CD                AS DATA_SRC_CD1              --数据来源代码
,B.SRC_TBL                    AS SRC_TBL1                  --源表
,B.TASK_NAME                  AS TASK_NAME1                --任务名
,B.DATA_ETL_DATE              AS DATA_ETL_DATE1            --数据加载日期
,B.DATA_UPT_DATE              AS DATA_UPT_DATE1            --数据更新日期
,CASE WHEN A.Evt_Id IS NULL     AND B.Evt_Id IS NOT NULL THEN 'I' --新增
WHEN A.Evt_Id IS NOT NULL AND B.Evt_Id IS NULL THEN 'D' --删除
WHEN A.Evt_Id IS NOT NULL AND B.Evt_Id IS NOT NULL AND (
COALESCE(A.Recv_Pymt_No            ,'') <> COALESCE(B.Recv_Pymt_No            ,'')
OR COALESCE(A.Trd_Id                  ,'') <> COALESCE(B.Trd_Id                  ,'')
OR COALESCE(A.Comp_No                 ,'') <> COALESCE(B.Comp_No                 ,'')
OR COALESCE(A.Paid_Date               ,'') <> COALESCE(B.Paid_Date               ,'')
OR COALESCE(A.Recv_Pymt_Type_Cd       ,'') <> COALESCE(B.Recv_Pymt_Type_Cd       ,'')
OR COALESCE(A.Crrc_Cd                 ,'') <> COALESCE(B.Crrc_Cd                 ,'')
OR COALESCE(A.Recv_Pymt_Dir_Cd        ,'') <> COALESCE(B.Recv_Pymt_Dir_Cd        ,'')
OR COALESCE(A.Recv_Pymt_Stat_Cd       ,'') <> COALESCE(B.Recv_Pymt_Stat_Cd       ,'')
OR COALESCE(A.Book_Agt_Id             ,'') <> COALESCE(B.Book_Agt_Id             ,'')
OR COALESCE(A.Book_Agt_Modifr         ,'') <> COALESCE(B.Book_Agt_Modifr         ,'')
OR COALESCE(A.Begn_Date               ,'') <> COALESCE(B.Begn_Date               ,'')
OR COALESCE(A.End_Date                ,'') <> COALESCE(B.End_Date                ,'')
OR COALESCE(A.Pty_Id                  ,'') <> COALESCE(B.Pty_Id                  ,'')
OR COALESCE(A.Prd_Id                  ,'') <> COALESCE(B.Prd_Id                  ,'')
OR COALESCE(A.Src_Prd_Id              ,'') <> COALESCE(B.Src_Prd_Id              ,'')
OR COALESCE(A.Clr_Date                ,'') <> COALESCE(B.Clr_Date                ,'')
OR COALESCE(A.Fee_Type_Cd             ,'') <> COALESCE(B.Fee_Type_Cd             ,'')
OR COALESCE(A.Swap_Hold_Id            ,'') <> COALESCE(B.Swap_Hold_Id            ,'')
OR COALESCE(A.Swap_Hold_Undrl_Cd      ,'') <> COALESCE(B.Swap_Hold_Undrl_Cd      ,'')
OR COALESCE(A.Src_Prd_Type_Cd         ,'') <> COALESCE(B.Src_Prd_Type_Cd         ,'')
OR COALESCE(A.Rate                    ,'') <> COALESCE(B.Rate                    ,'')
OR COALESCE(A.Undrl_Qty               ,'') <> COALESCE(B.Undrl_Qty               ,'')
OR COALESCE(A.Pric                    ,'') <> COALESCE(B.Pric                    ,'')
OR COALESCE(A.Leg_Glbl_Seq_No         ,'') <> COALESCE(B.Leg_Glbl_Seq_No         ,'')
OR COALESCE(A.Prft_Type_Cd            ,'') <> COALESCE(B.Prft_Type_Cd            ,'')
OR COALESCE(A.Swap_Dura_Evt_No        ,'') <> COALESCE(B.Swap_Dura_Evt_No        ,'')
OR COALESCE(A.Swap_Dura_Evt_Type_Cd   ,'') <> COALESCE(B.Swap_Dura_Evt_Type_Cd   ,'')
OR COALESCE(A.Actl_Paid_Date          ,'') <> COALESCE(B.Actl_Paid_Date          ,'')
OR COALESCE(A.Amt                     ,'') <> COALESCE(B.Amt                     ,'')
OR COALESCE(A.Our_Payb_Amt            ,'') <> COALESCE(B.Our_Payb_Amt            ,'')
OR COALESCE(A.Our_Rcvb_Amt            ,'') <> COALESCE(B.Our_Rcvb_Amt            ,'')
OR COALESCE(A.Ocrrc_Amt               ,'') <> COALESCE(B.Ocrrc_Amt               ,'')
OR COALESCE(A.Our_Payb_Ocrrc_Amt      ,'') <> COALESCE(B.Our_Payb_Ocrrc_Amt      ,'')
OR COALESCE(A.Our_Rcvb_Ocrrc_Amt      ,'') <> COALESCE(B.Our_Rcvb_Ocrrc_Amt      ,'')
OR COALESCE(A.Aft_Adj_Amt             ,'') <> COALESCE(B.Aft_Adj_Amt             ,'')
OR COALESCE(A.Aft_Adj_Our_Payb_Amt    ,'') <> COALESCE(B.Aft_Adj_Our_Payb_Amt    ,'')
OR COALESCE(A.Aft_Adj_Our_Rcvb_Amt    ,'') <> COALESCE(B.Aft_Adj_Our_Rcvb_Amt    ,'')
OR COALESCE(A.Aft_Adj_Ocrrc_Amt       ,'') <> COALESCE(B.Aft_Adj_Ocrrc_Amt       ,'')
OR COALESCE(A.Aft_Adj_Our_Payb_Ocrrc_Amt,'') <> COALESCE(B.Aft_Adj_Our_Payb_Ocrrc_Amt,'')
OR COALESCE(A.Aft_Adj_Our_Rcvb_Ocrrc_Amt,'') <> COALESCE(B.Aft_Adj_Our_Rcvb_Ocrrc_Amt,'')
OR COALESCE(A.Clr_Type_Cd             ,'') <> COALESCE(B.Clr_Type_Cd             ,'')
OR COALESCE(A.Paid_Date_Id            ,'') <> COALESCE(B.Paid_Date_Id            ,'')
OR COALESCE(A.Create_Time             ,'') <> COALESCE(B.Create_Time             ,'')
OR COALESCE(A.Creator                 ,'') <> COALESCE(B.Creator                 ,'')
OR COALESCE(A.Upd_Time                ,'') <> COALESCE(B.Upd_Time                ,'')
OR COALESCE(A.Upd_User                ,'') <> COALESCE(B.Upd_User                ,'')
OR COALESCE(A.Ver_No                  ,'') <> COALESCE(B.Ver_No                  ,'')
) THEN 'U' --变更
ELSE 'S' --无变更
END                 AS DATA_TYPE              --数据类型
FROM  (SELECT * FROM T05_OTC_RECV_PYMT_EVT
WHERE SRC_TBL='ODATA_N_TIT.D_TRD_TRANSFER')A
FULL OUTER JOIN TEMP.T05_OTC_RECV_PYMT_EVT_TEMP_TIT157 B
ON    A.Evt_Id=B.Evt_Id
;
-- task_id: 73828
-- hiveDb: pdata_n
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-GF_FDM_N/EVT/PDATA_N.T05_ACCT_CTRL_CHG_EVT_RCC230.py
-- observed_at: 2026-09-05T01:06:32.303Z

-- createSql
CREATE TABLE IF NOT EXISTS T05_ACCT_CTRL_CHG_EVT(
     Evt_Id                     STRING COMMENT '事件编号'
    ,Trd_Date                   STRING COMMENT '交易日期'
    ,Seri_No                    STRING COMMENT '流水序号'
    ,Curr_Date                  STRING COMMENT '当前日期'
    ,Curr_Time                  STRING COMMENT '当前时间'
    ,Oper_Inr_Org_Id            STRING COMMENT '操作内部机构编号'
    ,Oper_Id                    STRING COMMENT '操作员编号'
    ,Sta_Addr                   STRING COMMENT '站点地址'
    ,Entr_Method_Cd             STRING COMMENT '委托方式代码'
    ,Inr_Org_Id                 STRING COMMENT '内部机构编号'
    ,Ast_Acct_Agt_Id            STRING COMMENT '资产账户协议编号'
    ,Ast_Acct_Agt_Modifr        STRING COMMENT '资产账户协议修饰符'
    ,Pty_Id                     STRING COMMENT '当事人编号'
    ,Ctrl_Oper_Type_Cd          STRING COMMENT '控制操作类型代码'
    ,File_Sub_Type_Cd           STRING COMMENT '文件子类代码'
    ,Rev_Trt_Flag               STRING COMMENT '反向处理标志'
    ,Clr_Date                   STRING COMMENT '清算日期'
    ,Ctrl_Rsn_Cd                STRING COMMENT '控制原因代码'
    ,Vld_Date                   STRING COMMENT '有效日期'
    ,Remark                     STRING COMMENT '备注'
    ,Pos_Str                    STRING COMMENT '定位串'
    ,Data_Src_Cd                STRING COMMENT '数据来源代码'
    ,Task_Name                  STRING COMMENT '任务名'
    ,Data_Etl_Date              STRING COMMENT '数据加载日期'
    ,Data_Upt_Date              STRING COMMENT '数据更新日期'
    ,Data_Time                  STRING COMMENT '数据时间'
    ,Real_Src_Tbl               STRING COMMENT '真实源表'
    ,Evt_Type_Cd                STRING COMMENT '事件类型代码'
    ,Chg_Acct_Agt_Id            STRING COMMENT '变动账户协议编号'
    ,Chg_Acct_Agt_Modifr        STRING COMMENT '变动账户协议修饰符'
    ,Chg_Acct                   STRING COMMENT '变动账户'
    ,Exch_Type_Cd               STRING COMMENT '市场代码'
    ,Src_Trd_Type_Cd            STRING COMMENT '源交易类型代码'
)COMMENT '账户控制变动事件'
PARTITIONED BY (Src_Tbl  STRING COMMENT'源表',Busi_Date  STRING COMMENT '业务日期')
STORED AS ORC;

-- querySql
INSERT OVERWRITE TABLE T05_ACCT_CTRL_CHG_EVT PARTITION(Src_Tbl,Busi_Date)
-----------------------------------------------------------------------------------------------------
--Group1.: Source Table:[ODATA_N_RCC.H_HIS_FUNDACCOUNTCONTROLJOUR:资产账户控制流水表] 
-----------------------------------------------------------------------------------------------------
SELECT
     CONCAT('RCC230-',POSITION_STR)                    AS  Evt_Id                  --事件编号
    ,INIT_DATE                                         AS  Trd_Date                --交易日期
    ,SERIAL_NO                                         AS  Seri_No                 --流水序号
    ,CURR_DATE                                         AS  Curr_Date               --当前日
    ,CURR_TIME                                         AS  Curr_Time               --当前时间
    ,LPAD(OP_BRANCH_NO,4,'0')                          AS  Oper_Inr_Org_Id         --操作内部机构编号
    ,OPERATOR_NO                                       AS  Oper_Id                 --操作员编号
    ,OP_STATION                                        AS  Sta_Addr                --站点地址
    ,OP_ENTRUST_WAY                                    AS  Entr_Method_Cd          --委托方式代码
    ,LPAD(BRANCH_NO,4,'0')                             AS  Inr_Org_Id              --内部机构编号
    ,FUND_ACCOUNT                                      AS  Ast_Acct_Agt_Id         --资产账户协议编号
    ,IF(NVL(TRIM(FUND_ACCOUNT),'')='','','10201')      AS  Ast_Acct_Agt_Modifr     --资产账户协议修饰符
    ,TRIM(CLIENT_ID)                                   AS  Pty_Id                  --当事人编号
    ,OPER_KIND                                         AS  Ctrl_Oper_Type_Cd       --控制操作类型代码
    ,SUB_KIND                                          AS  File_Sub_Type_Cd        --文件子类代码
    ,HANDLE_FLAG                                       AS  Rev_Trt_Flag            --反向处理标志
    ,DATE_CLEAR                                        AS  Clr_Date                --清算日期
    ,CONTROL_REASON                                    AS  Ctrl_Rsn_Cd             --控制原因
    ,VALID_DATE                                        AS  Vld_Date                --有效日期
    ,REMARK                                            AS  Remark                  --备注
    ,POSITION_STR                                      AS  Pos_Str                 --定位串
    ,'${data_src_cd}'                             AS  Data_Src_Cd             --数据来源代码
    ,'${filename}'                                AS  Task_Name               --任务名
    ,'${data_day_str}'                            AS  Data_Etl_Date           --数据加载日期
    ,'${data_today_str}'                          AS  Data_Upt_Date           --数据更新日期
    ,'${data_today}'                              AS  Data_Time               --数据时间
    ,'ODATA_N_RCC.H_HIS_FUNDACCOUNTCONTROLJOUR'        AS  Real_Src_Tbl            --真实源表
    ,'ast_acct_ctrl_chg'                               AS  Evt_Type_Cd             --事件类型代码 --资产账户控制变动
    ,FUND_ACCOUNT                                      AS  Chg_Acct_Agt_Id         --变动账户协议编号
    ,IF(NVL(TRIM(FUND_ACCOUNT),'')='','','10201')      AS  Chg_Acct_Agt_Modifr     --变动账户协议修饰符
    ,FUND_ACCOUNT                                      AS  Chg_Acct                --变动账户
    ,''                                                AS  Exch_Type_Cd            --市场代码
    ,''                                                AS  Src_Trd_Type_Cd         --源交易类型代码
    ,'ODATA_N_RCC.H_HIS_FUNDACCOUNTCONTROLJOUR'        AS  Src_Tbl                 --源表
    ,'${data_day_str}'                            AS  Busi_Date               --业务日期
FROM  ODATA_N_RCC.H_HIS_FUNDACCOUNTCONTROLJOUR
WHERE BUSI_DATE='${data_day_str}' 

UNION ALL

-----------------------------------------------------------------------------------------------------
--Group1.: Source Table:[ODATA_N_RCC.A_FUNDACCOUNTCONTROLJOUR:资产账户控制当前表表] 
-----------------------------------------------------------------------------------------------------
SELECT
     CONCAT('RCC230-',POSITION_STR)                    AS  Evt_Id                  --事件编号
    ,INIT_DATE                                         AS  Trd_Date                --交易日期
    ,SERIAL_NO                                         AS  Seri_No                 --流水序号
    ,CURR_DATE                                         AS  Curr_Date               --当前日
    ,CURR_TIME                                         AS  Curr_Time               --当前时间
    ,LPAD(OP_BRANCH_NO,4,'0')                          AS  Oper_Inr_Org_Id         --操作内部机构编号
    ,OPERATOR_NO                                       AS  Oper_Id                 --操作员编号
    ,OP_STATION                                        AS  Sta_Addr                --站点地址
    ,OP_ENTRUST_WAY                                    AS  Entr_Method_Cd          --委托方式代码
    ,LPAD(BRANCH_NO,4,'0')                             AS  Inr_Org_Id              --内部机构编号
    ,FUND_ACCOUNT                                      AS  Ast_Acct_Agt_Id         --资产账户协议编号
    ,IF(NVL(TRIM(FUND_ACCOUNT),'')='','','10201')      AS  Ast_Acct_Agt_Modifr     --资产账户协议修饰符
    ,TRIM(CLIENT_ID)                                   AS  Pty_Id                  --当事人编号
    ,OPER_KIND                                         AS  Ctrl_Oper_Type_Cd       --控制操作类型代码
    ,SUB_KIND                                          AS  File_Sub_Type_Cd        --文件子类代码
    ,HANDLE_FLAG                                       AS  Rev_Trt_Flag            --反向处理标志
    ,DATE_CLEAR                                        AS  Clr_Date                --清算日期
    ,CONTROL_REASON                                    AS  Ctrl_Rsn_Cd             --控制原因代码
    ,VALID_DATE                                        AS  Vld_Date                --有效日期
    ,REMARK                                            AS  Remark                  --备注
    ,POSITION_STR                                      AS  Pos_Str                 --定位串
    ,'${data_src_cd}'                             AS  Data_Src_Cd             --数据来源代码
    ,'${filename}'                                AS  Task_Name               --任务名
    ,'${data_day_str}'                            AS  Data_Etl_Date           --数据加载日期
    ,'${data_today_str}'                          AS  Data_Upt_Date           --数据更新日期
    ,'${data_today}'                              AS  Data_Time               --数据时间
    ,'ODATA_N_RCC.A_FUNDACCOUNTCONTROLJOUR'            AS  Real_Src_Tbl            --真实源表
    ,'ast_acct_ctrl_chg'                               AS  Evt_Type_Cd             --事件类型代码 --资产账户控制变动
    ,FUND_ACCOUNT                                      AS  Chg_Acct_Agt_Id         --变动账户协议编号
    ,IF(NVL(TRIM(FUND_ACCOUNT),'')='','','10201')      AS  Chg_Acct_Agt_Modifr     --变动账户协议修饰符
    ,FUND_ACCOUNT                                      AS  Chg_Acct                --变动账户
    ,''                                                AS  Exch_Type_Cd            --市场代码
    ,''                                                AS  Src_Trd_Type_Cd         --源交易类型代码
    ,'ODATA_N_RCC.A_FUNDACCOUNTCONTROLJOUR'            AS  Src_Tbl                 --源表
    ,'${data_day_str}'                            AS  Busi_Date               --业务日期
FROM  ODATA_N_RCC.A_FUNDACCOUNTCONTROLJOUR
WHERE BUSI_DATE='${data_day_str}' 

;

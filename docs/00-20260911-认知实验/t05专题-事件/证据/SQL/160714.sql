-- task_id: 160714
-- hiveDb: pdata_n
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-GF_FDM_N/EVT/PDATA_N.T05_OTC_DERI_BOOK_MTCH_EVT_TIT274.py
-- observed_at: 2026-09-05T01:07:04.725Z

-- createSql
CREATE TABLE IF NOT EXISTS T05_OTC_DERI_BOOK_MTCH_EVT(
   Evt_Id                 STRING COMMENT '事件编号'
  ,Deal_No                STRING COMMENT '交易编号'
  ,Trd_Date               STRING COMMENT '交易日期'
  ,Cutp_Pty_Id            STRING COMMENT '交易对手当事人编号'
  ,Book_Agt_Id            STRING COMMENT '账薄协议编号'
  ,Book_Agt_Modifr        STRING COMMENT '账薄协议修饰符'
  ,Otc_Deri_Trd_Stat_Cd   STRING COMMENT '场外衍生品交易状态代码'
  ,Ivst_Type_Cd           STRING COMMENT '投资类型代码'
  ,Ext_Deal_Cd            STRING COMMENT '外部交易代码'
  ,Src_Deal_Src_Cd        STRING COMMENT '源交易来源代码'
  ,Crrc_Cd                STRING COMMENT '币种代码'
  ,Exch_Type_Cd           STRING COMMENT '市场代码'
  ,Prd_Id                 STRING COMMENT '产品编号'
  ,Src_Scr_Inr_Cd         STRING COMMENT '源证券内部代码'
  ,Buy_Sell_Dir_Cd        STRING COMMENT '买卖方向代码'
  ,Src_Trd_Dir_Cd         STRING COMMENT '源交易方向代码'
  ,Mtch_Vol               STRING COMMENT '成交数量'
  ,Mtch_Pric              STRING COMMENT '成交价格'
  ,Mtch_Amt               STRING COMMENT '成交金额'
  ,Mtch_Time              STRING COMMENT '成交时间'
  ,Deal_Tot_Fee           STRING COMMENT '交易总费用'
  ,Sett_Date              STRING COMMENT '交收日期'
  ,Sett_Amt               STRING COMMENT '交收金额'
  ,Deal_Fee_Remark        STRING COMMENT '交易费用备注'
  ,Trdr_Name              STRING COMMENT '交易员名称'
  ,Upd_Time               STRING COMMENT '更新时间'
  ,Deal_Rec_Estb_Time     STRING COMMENT '交易记录创建时间'
  ,Creator_Name           STRING COMMENT '创建人名称'
  ,Upd_Prsn_Name          STRING COMMENT '更新人名称'
  ,Abn_Deal_Flag          STRING COMMENT '异常交易标志'
  ,Del_Deal_Flag          STRING COMMENT '删除交易标志'
  ,Sb_Busi_Clas_Cd        STRING COMMENT '自营业务分类代码'
  ,Remark                 STRING COMMENT '备注'
  ,Data_Src_Cd            STRING COMMENT '数据来源代码'
  ,Task_Name              STRING COMMENT '任务名'
  ,Data_Etl_Date          STRING COMMENT '数据加载日期'
  ,Data_Upt_Date          STRING COMMENT '数据更新日期'
  ,Data_Time              STRING COMMENT '数据时间'
  ,Real_Src_Tbl           STRING COMMENT '真实源表'
  ,Otc_Deri_Evt_Type_Cd   STRING COMMENT '场外衍生品事件类型代码'
  ,Isin                   STRING COMMENT 'Isin'
  ,Prd_Par_Val            STRING COMMENT '产品面值'
)COMMENT '场外衍生品账簿成交事件'
PARTITIONED BY (SRC_TBL STRING COMMENT '源表',BUSI_DATE STRING COMMENT '业务日期')
STORED AS ORC;

-- querySql
INSERT OVERWRITE TABLE T05_OTC_DERI_BOOK_MTCH_EVT PARTITION(SRC_TBL,BUSI_DATE)
-----------------------------------------------------------------------------------------------------
--Group2.: Source Table:[ODATA_N_TIT.P_PRD_NOTES_TRADE_RECORD:票据交易流水] 
-----------------------------------------------------------------------------------------------------
SELECT
   CONCAT('TIT274-',ID)                           AS Evt_Id                     --事件编号
  ,KEY_INSTRUMENT_ID                              AS Deal_No                    --交易编号
  ,SUBSTR(TRADE_DATE,1,10)                        AS Trd_Date                   --交易日期
  ,IF(NVL(TRIM(KEY_CTPTY_ID),'')='','',CONCAT('TIT060-',KEY_CTPTY_ID))
                                                  AS Cutp_Pty_Id                --交易对手当事人编号
  ,KEY_BOOK_ID                                    AS Book_Agt_Id                --账薄协议编号
  ,IF(NVL(TRIM(KEY_BOOK_ID),'')='','','20411' )   AS Book_Agt_Modifr            --账薄协议修饰符
  ,''                                             AS Otc_Deri_Trd_Stat_Cd       --场外衍生品交易状态代码
  ,''                                             AS Ivst_Type_Cd               --投资类型代码
  ,''                                             AS Ext_Deal_Cd                --外部交易代码
  ,''                                             AS Src_Deal_Src_Cd            --源交易来源代码
  ,CURRENCY                                       AS Crrc_Cd                    --币种代码
  ,''                                             AS Exch_Type_Cd               --市场代码
  ,KEY_PROD_ID                                    AS Prd_Id                     --产品编号  --刘鹏飞回复KEY_PROD_ID并非真实产品代码
  ,INNER_CODE                                     AS Src_Scr_Inr_Cd             --源证券内部代码
  ,NVL(DW_CD_VAL,TRADE_DIRECTION)                 AS Buy_Sell_Dir_Cd            --买卖方向代码
  ,TRADE_DIRECTION                                AS Src_Trd_Dir_Cd             --源交易方向代码
  ,QUANTITY                                       AS Mtch_Vol                   --成交数量
  ,PRICE                                          AS Mtch_Pric                  --成交价格
  ,TRADE_AMOUNT                                   AS Mtch_Amt                   --成交金额
  ,''                                             AS Mtch_Time                  --成交时间
  ,''                                             AS Deal_Tot_Fee               --交易总费用
  ,''                                             AS Sett_Date                  --交收日期
  ,''                                             AS Sett_Amt                   --交收金额
  ,''                                             AS Deal_Fee_Remark            --交易费用备注
  ,''                                             AS Trdr_Name                  --交易员名称
  ,UPDATED_DATETIME                               AS Upd_Time                   --更新时间
  ,CREATED_DATETIME                               AS Deal_Rec_Estb_Time         --交易记录创建时间
  ,CREATED_BY                                     AS Creator_Name               --创建人名称
  ,UPDATED_BY                                     AS Upd_Prsn_Name              --更新人名称
  ,''                                             AS Abn_Deal_Flag              --异常交易标志
  ,''                                             AS Del_Deal_Flag              --删除交易标志
  ,''                                             AS Sb_Busi_Clas_Cd            --自营业务分类代码
  ,''                                             AS Remark                     --备注
  ,'${data_src_cd}'                          AS Data_Src_Cd                --数据来源代码
  ,'${filename}'                             AS Task_Name                  --任务名
  ,'${data_day_str}'                         AS Data_Etl_Date              --数据加载日期
  ,'${data_day_str}'                         AS Data_Upt_Date              --数据更新日期
  ,'${data_today}'                           AS Data_Time                  --数据时间
  ,'${src_table}'                            AS Real_Src_Tbl               --真实源表
  ,'OTC_DERI_NOTE_TRD'                            AS Otc_Deri_Evt_Type_Cd       --场外衍生品事件类型代码
  ,ISIN                                           AS Isin                       --Isin
  ,DENOMINATION                                   AS Prd_Par_Val                --产品面值
  ,'${src_table}'                            AS Src_Tbl                    --源表
  ,SUBSTR(TRADE_DATE,1,10)                        AS Busi_Date                  --业务日期
FROM (SELECT * FROM ${src_table} WHERE BUSI_DATE = '${data_day_str}') A
INNER JOIN P_PRD_NOTES_TRADE_RECORD_TEMP TEMP  ON TEMP.BDATE= SUBSTR(A.TRADE_DATE,1,10)
LEFT JOIN (
  SELECT SRC_CD_VAL,DW_CD_VAL
    FROM PDATA_N.REF_CD_CVT_MAP
   WHERE TGT_TAB_NAME = 'T05_OTC_DERI_BOOK_MTCH_EVT'
     AND TGT_TAB_FLD  = 'Buy_Sell_Dir_Cd'
     AND SRC_TAB_NAME = 'PRD_NOTES_TRADE_RECORD'
     AND SRC_FLD_NAME = 'TRADE_DIRECTION'
     AND SRC_SYS_NAME = 'TIT' ) B
ON UPPER(A.TRADE_DIRECTION) = B.SRC_CD_VAL    --TRADE_DIRECTION 转码

;

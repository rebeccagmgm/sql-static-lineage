-- task_id: 159419
-- hiveDb: PDATA_N
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-GF_FDM_N/EVT/PDATA_N.T05_OTC_DERI_BOOK_MTCH_EVT_TIT105.py
-- observed_at: 2026-09-05T01:07:04.387Z

-- createSql
CREATE TABLE IF NOT EXISTS T05_OTC_DERI_BOOK_MTCH_EVT(
        Evt_Id                 STRING COMMENT '事件编号'
      , Deal_No                STRING COMMENT '交易编号'
      , Trd_Date               STRING COMMENT '交易日期'
      , Cutp_Pty_Id            STRING COMMENT '交易对手当事人编号'
      , Book_Agt_Id            STRING COMMENT '账薄协议编号'
      , Book_Agt_Modifr        STRING COMMENT '账薄协议修饰符'
      , Otc_Deri_Trd_Stat_Cd   STRING COMMENT '场外衍生品交易状态代码'
      , Ivst_Type_Cd           STRING COMMENT '投资类型代码'
      , Ext_Deal_Cd            STRING COMMENT '外部交易代码'
      , Src_Deal_Src_Cd        STRING COMMENT '源交易来源代码'
      , Crrc_Cd                STRING COMMENT '币种代码'
      , Exch_Type_Cd           STRING COMMENT '市场代码'
      , Prd_Id                 STRING COMMENT '产品编号'
      , Src_Scr_Inr_Cd         STRING COMMENT '源证券内部代码'
      , Buy_Sell_Dir_Cd        STRING COMMENT '买卖方向代码'
      , Src_Trd_Dir_Cd         STRING COMMENT '源交易方向代码'
      , Mtch_Vol               STRING COMMENT '成交数量'
      , Mtch_Pric              STRING COMMENT '成交价格'
      , Mtch_Amt               STRING COMMENT '成交金额'
      , Mtch_Time              STRING COMMENT '成交时间'
      , Deal_Tot_Fee           STRING COMMENT '交易总费用'
      , Sett_Date              STRING COMMENT '交收日期'
      , Sett_Amt               STRING COMMENT '交收金额'
      , Deal_Fee_Remark        STRING COMMENT '交易费用备注'
      , Trdr_Name              STRING COMMENT '交易员名称'
      , Upd_Time               STRING COMMENT '更新时间'
      , Deal_Rec_Estb_Time     STRING COMMENT '交易记录创建时间'
      , Creator_Name           STRING COMMENT '创建人名称'
      , Upd_Prsn_Name          STRING COMMENT '更新人名称'
      , Abn_Deal_Flag          STRING COMMENT '异常交易标志'
      , Del_Deal_Flag          STRING COMMENT '删除交易标志'
      , Sb_Busi_Clas_Cd        STRING COMMENT '自营业务分类代码'
      , Remark                 STRING COMMENT '备注'
      , Data_Src_Cd            STRING COMMENT '数据来源代码'
      , Task_Name              STRING COMMENT '任务名'
      , Data_Etl_Date          STRING COMMENT '数据加载日期'
      , Data_Upt_Date          STRING COMMENT '数据更新日期'
      , Data_Time              STRING COMMENT '数据时间'
      , Real_Src_Tbl           STRING COMMENT '真实源表'
      , Otc_Deri_Evt_Type_Cd   STRING COMMENT '场外衍生品事件类型代码'
      , Isin                   STRING COMMENT 'Isin'
      , Prd_Par_Val            STRING COMMENT '产品面值'
    )COMMENT '场外衍生品账簿成交事件'
    PARTITIONED BY (SRC_TBL STRING COMMENT '源表',BUSI_DATE STRING COMMENT '业务日期')
    STORED AS ORC;

-- querySql
INSERT OVERWRITE TABLE T05_OTC_DERI_BOOK_MTCH_EVT PARTITION(SRC_TBL,BUSI_DATE)
    -----------------------------------------------------------------------------------------------------
    --Group1.: Source Table:[ODATA_N_TIT.B_TRD_DEAL:交易-场内交易成交表] 
    -----------------------------------------------------------------------------------------------------
    SELECT
        CONCAT('TIT105-',KEY_TRADE_ID,KEY_BOOK_ID)     AS Evt_Id                     --事件编号
      , KEY_TRADE_ID                                   AS Deal_No                    --交易编号
      , DATE_FORMAT(TRADE_DATE,'yyyy-MM-dd')           AS Trd_Date                   --交易日期
      , CONCAT('TIT060-',KEY_CTPTY_ID)                 AS Cutp_Pty_Id                --交易对手当事人编号
      , KEY_BOOK_ID                                    AS Book_Agt_Id                --账薄协议编号
      , '20411'                                        AS Book_Agt_Modifr            --账薄协议修饰符
      , NVL(B.DW_CD_VAL,A.TRADE_STATUS)                AS Otc_Deri_Trd_Stat_Cd       --场外衍生品交易状态代码
      , NVL(C.DW_CD_VAL,A.INVEST_TYPE)                 AS Ivst_Type_Cd               --投资类型代码
      , EXTERNAL_TRADE_ID                              AS Ext_Deal_Cd                --外部交易代码
      , TRADE_SOURCE                                   AS Src_Deal_Src_Cd            --源交易来源代码
      , CURRENCY                                       AS Crrc_Cd                    --币种代码
      , NVL(D.DW_CD_VAL,A.MARKET)                      AS Exch_Type_Cd               --市场代码
      , CONCAT('TIT-',KEY_INSTRUMENT_ID)               AS Prd_Id                     --产品编号
      , KEY_INSTRUMENT_ID                              AS Src_Scr_Inr_Cd             --源证券内部代码
      , E.DW_CD_VAL                                    AS Buy_Sell_Dir_Cd            --买卖方向代码
      , TRADE_DIRECTION                                AS Src_Trd_Dir_Cd             --源交易方向代码
      , QUANTITY                                       AS Mtch_Vol                   --成交数量
      , PRICE                                          AS Mtch_Pric                  --成交价格
      , TRADE_AMOUNT                                   AS Mtch_Amt                   --成交金额
      , TRADE_REAL_TIME                                AS Mtch_Time                  --成交时间
      , TRADE_TOTAL_FEE                                AS Deal_Tot_Fee               --交易总费用
      , DATE_FORMAT(SETTLEMENT_DATE,'yyyy-MM-dd')      AS Sett_Date                  --交收日期
      , SETTLEMENT_AMOUNT                              AS Sett_Amt                   --交收金额
      , TRADE_FEE_DESC                                 AS Deal_Fee_Remark            --交易费用备注
      , TRADER                                         AS Trdr_Name                  --交易员名称
      , UPDATED_DATETIME                               AS Upd_Time                   --更新时间
      , CREATED_DATETIME                               AS Deal_Rec_Estb_Time         --交易记录创建时间
      , CREATED_BY                                     AS Creator_Name               --创建人名称
      , UPDATED_BY                                     AS Upd_Prsn_Name              --更新人名称
      , CASE IS_ABNORMAL WHEN 'Y' 
                          THEN '1' 
                         WHEN 'N' 
                          THEN '0' 
                         ELSE IS_ABNORMAL 
        END                                            AS Abn_Deal_Flag              --异常交易标志
      , CASE IS_DELETED WHEN 'Y' 
                         THEN '1' 
                        WHEN 'N' 
                         THEN '0' 
                        ELSE IS_DELETED 
        END                                            AS Del_Deal_Flag              --删除交易标志
      , NVL(F.DW_CD_VAL,A.BUSINESS_CLASS)              AS Sb_Busi_Clas_Cd            --自营业务分类代码
      , COMMENTS                                       AS Remark                     --备注
      , '${data_src_cd}'                          AS Data_Src_Cd                --数据来源代码
      , '${filename}'                             AS Task_Name                  --任务名
      , '${data_day_str}'                         AS Data_Etl_Date              --数据加载日期
      , '${data_today_str}'                       AS Data_Upt_Date              --数据更新日期
      , '${data_today}'                           AS Data_Time                  --数据时间
      , '${src_table}'                            AS Real_Src_Tbl               --真实源表
      ,'OTC_DERI_OST_TRD'                              AS Otc_Deri_Evt_Type_Cd       ---场外衍生品场内交易
      ,''                                              AS Isin                       --Isin
      ,''                                              AS Prd_Par_Val                --产品面值
      , '${src_table}'                            AS Src_Tbl                    --源表
      , DATE_FORMAT(TRADE_DATE,'yyyy-MM-dd')           AS Busi_Date                  --业务日期
    FROM (SELECT *,ROW_NUMBER()OVER(PARTITION BY KEY_TRADE_ID ORDER BY UPDATED_DATETIME DESC) AS RN
            FROM ${src_table} 
           WHERE BUSI_DATE = '${data_day_str}') A
    LEFT JOIN (
      SELECT SRC_CD_VAL,DW_CD_VAL
        FROM PDATA_N.REF_CD_CVT_MAP
       WHERE TGT_TAB_NAME = 'T05_OTC_DERI_BOOK_MTCH_EVT'
         AND TGT_TAB_FLD  = 'Otc_Deri_Trd_Stat_Cd'
         AND SRC_TAB_NAME = 'TRD_DEAL'
         AND SRC_FLD_NAME = 'TRADE_STATUS'
         AND SRC_SYS_NAME = 'TIT' ) B
    ON A.TRADE_STATUS = B.SRC_CD_VAL           --TRADE_STATUS 转码
    LEFT JOIN (
      SELECT SRC_CD_VAL,DW_CD_VAL
        FROM PDATA_N.REF_CD_CVT_MAP
       WHERE TGT_TAB_NAME = 'T05_OTC_DERI_BOOK_MTCH_EVT'
         AND TGT_TAB_FLD  = 'Ivst_Type_Cd'
         AND SRC_TAB_NAME = 'TRD_DEAL'
         AND SRC_FLD_NAME = 'INVEST_TYPE'
         AND SRC_SYS_NAME = 'TIT' ) C
    ON A.INVEST_TYPE = C.SRC_CD_VAL           --INVEST_TYPE 转码
    LEFT JOIN (
      SELECT SRC_CD_VAL,DW_CD_VAL
        FROM PDATA_N.REF_CD_CVT_MAP
       WHERE TGT_TAB_NAME = 'T05_OTC_DERI_BOOK_MTCH_EVT'
         AND TGT_TAB_FLD  = 'Exch_Type_Cd'
         AND SRC_TAB_NAME = 'TRD_DEAL'
         AND SRC_FLD_NAME = 'MARKET'
         AND SRC_SYS_NAME = 'TIT' ) D
    ON A.MARKET = D.SRC_CD_VAL           --MARKET 转码
    LEFT JOIN (
      SELECT SRC_CD_VAL,DW_CD_VAL
        FROM PDATA_N.REF_CD_CVT_MAP
       WHERE TGT_TAB_NAME = 'T05_OTC_DERI_BOOK_MTCH_EVT'
         AND TGT_TAB_FLD  = 'Buy_Sell_Dir_Cd'
         AND SRC_TAB_NAME = 'TRD_DEAL'
         AND SRC_FLD_NAME = 'TRADE_DIRECTION'
         AND SRC_SYS_NAME = 'TIT' ) E
    ON UPPER(A.TRADE_DIRECTION) = E.SRC_CD_VAL    --TRADE_DIRECTION 转码
    LEFT JOIN (
      SELECT SRC_CD_VAL,DW_CD_VAL
        FROM PDATA_N.REF_CD_CVT_MAP
       WHERE TGT_TAB_NAME = 'T05_OTC_DERI_BOOK_MTCH_EVT'
         AND TGT_TAB_FLD  = 'Sb_Busi_Clas_Cd'
         AND SRC_TAB_NAME = 'TRD_DEAL'
         AND SRC_FLD_NAME = 'BUSINESS_CLASS'
         AND SRC_SYS_NAME = 'TIT' ) F
    ON A.BUSINESS_CLASS = F.SRC_CD_VAL           --BUSINESS_CLASS 转码
    WHERE A.RN = 1
    
    UNION ALL
    
    SELECT 
        Evt_Id                 --事件编号
      , Deal_No                --交易编号
      , Trd_Date               --交易日期
      , Cutp_Pty_Id            --交易对手当事人编号
      , Book_Agt_Id            --账薄协议编号
      , Book_Agt_Modifr        --账薄协议修饰符
      , Otc_Deri_Trd_Stat_Cd   --场外衍生品交易状态代码
      , Ivst_Type_Cd           --投资类型代码
      , Ext_Deal_Cd            --外部交易代码
      , Src_Deal_Src_Cd        --源交易来源代码
      , Crrc_Cd                --币种代码
      , Exch_Type_Cd           --市场代码
      , Prd_Id                 --产品编号
      , Src_Scr_Inr_Cd         --源证券内部代码
      , Buy_Sell_Dir_Cd        --买卖方向代码
      , Src_Trd_Dir_Cd         --源交易方向代码
      , Mtch_Vol               --成交数量
      , Mtch_Pric              --成交价格
      , Mtch_Amt               --成交金额
      , Mtch_Time              --成交时间
      , Deal_Tot_Fee           --交易总费用
      , Sett_Date              --交收日期
      , Sett_Amt               --交收金额
      , Deal_Fee_Remark        --交易费用备注
      , Trdr_Name              --交易员名称
      , Upd_Time               --更新时间
      , Deal_Rec_Estb_Time     --交易记录创建时间
      , Creator_Name           --创建人名称
      , Upd_Prsn_Name          --更新人名称
      , Abn_Deal_Flag          --异常交易标志
      , Del_Deal_Flag          --删除交易标志
      , Sb_Busi_Clas_Cd        --自营业务分类代码
      , Remark                 --备注
      , Data_Src_Cd            --数据来源代码
      , Task_Name              --任务名
      , Data_Etl_Date          --数据加载日期
      , Data_Upt_Date          --数据更新日期
      , Data_Time              --数据时间
      , Real_Src_Tbl           --真实源表
      , Otc_Deri_Evt_Type_Cd   --场外衍生品事件类型代码
      , Isin                   --sin
      , Prd_Par_Val            --产品面值
      , SRC_TBL                --源表
      , BUSI_DATE              --业务日期    
    FROM T05_OTC_DERI_BOOK_MTCH_EVT A
    LEFT SEMI JOIN B_TRD_DEAL_TEMP C
    ON A.BUSI_DATE = C.BDATE
    WHERE SRC_TBL = '${src_table}'
    AND NOT EXISTS (SELECT 1
                    FROM ${src_table} B
                    WHERE BUSI_DATE = '${data_day_str}'
                    AND A.Deal_No = B.KEY_TRADE_ID)
    ;

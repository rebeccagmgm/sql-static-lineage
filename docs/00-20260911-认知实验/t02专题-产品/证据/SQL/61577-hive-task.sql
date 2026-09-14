-- task_id: 61577
-- hiveDb: pdata_news_n
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-pdata_news_n/news_dm/pdata_news_n.t02_scr_base_info_PRD
-- observed_at: 2026-09-05T01:06:19.314Z

-- createSql
CREATE TABLE IF NOT EXISTS T02_SCR_BASE_INFO(
    Busi_Date            STRING  COMMENT  '数据日期'
   ,Rec_Id               STRING  COMMENT  '记录编号'
   ,Secu_Id              STRING  COMMENT  '统一证券编码'
   ,Src_Sys_Prdno        STRING  COMMENT  '源系统产品编号'
   ,Crrc_Cd              STRING  COMMENT  '货币代码'
   ,Crrc_Name            STRING  COMMENT  '货币名称'
   ,CTY_Cd               STRING  COMMENT  '国家代码'
   ,Cty_Name             STRING  COMMENT  '国家名称'
   ,Corp_Id              STRING  COMMENT  '公司Id'
   ,Scr_Stat             STRING  COMMENT  '当前状态'
   ,Min_Pric_Chg_Unit    STRING  COMMENT  '最小价格变动单位'
   ,Peru                 STRING  COMMENT  '每手数量'
   ,Scr_Type             STRING  COMMENT  '证券类别'
   ,Ch_Abbr              STRING  COMMENT  '证券简称'
   ,Scr_Cd               STRING  COMMENT  '证券代码'
   ,Ch_Abbr_Pinyin       STRING  COMMENT  '中文拼音简称'
   ,Ch_Name              STRING  COMMENT  '证券中文名称'
   ,En_Name              STRING  COMMENT  '证券英文名称'
   ,Ch_Abbr_L            STRING  COMMENT  '证券简称(长)'
   ,En_Abbr              STRING  COMMENT  '英文简称'
   ,Mkt_Cd               STRING  COMMENT  '交易市场代码'
   ,Mkt_Ch_Name          STRING  COMMENT  '交易市场中文名称'
   ,In_Code              STRING  COMMENT  '源内部编码'
   ,Ramark               STRING  COMMENT  '备注'    
   ,Src_Tbl              STRING  COMMENT  '来源表'
   ,Src_Rec_Id           STRING  COMMENT  '来源记录'
   ,Rec_Upd_Time         STRING  COMMENT  '数据更新时间'
   ,Rec_Down_Time        STRING  COMMENT  '数据进表时间'
)PARTITIONED BY (Src_Id  STRING  COMMENT  '数据来源')
STORED AS ORC;

-- querySql
set hive.merge.mapfiles = true ;
set hive.merge.mapredfiles = true;
set hive.merge.size.per.task=1073741824;
set hive.merge.smallfiles.avgsize=1073741824;
set hive.merge.orcfile.stripe.level=false;
set hive.exec.dynamic.partition=true;
set hive.exec.dynamic.partition.mode=nonstrict;
set hive.exec.max.created.files=10000;
set hive.exec.max.dynamic.partitions.pernode=10000;
set hive.exec.max.dynamic.partitions=10000;
set hive.auto.convert.join=false;
set hive.support.concurrency=false;

WITH DC_REC_DOWN_TM AS (
     SELECT 
         Secu_Id
        ,Src_Sys_Prdno
        ,Rec_Down_Time
     FROM T02_SCR_BASE_INFO WHERE Src_Id = 'PRD' --取落地时间
)

INSERT OVERWRITE TABLE T02_SCR_BASE_INFO PARTITION (Src_Id = 'PRD')
SELECT   
      '${data_day_str}'                                                AS Busi_Date,           --数据日期
      ID                                                                    AS Rec_Id,
      DEFAULT.GET_RCC_SECUID(
               CASE WHEN SECUTYPE < 6000 THEN 'AM'                                                           --资管
               WHEN SECUTYPE = 6010 THEN 'AM'                                                           --收益凭证
               WHEN 6000 < SECUTYPE AND SECUTYPE < 7000 THEN 'OC'                                       --OTC，归类OT(其他) 
               WHEN 7000 < SECUTYPE AND SECUTYPE < 8000 THEN 'PF'                                       --私募
               WHEN SECUTYPE IN ('9001','9002','9999') THEN 'FD' 
               WHEN SECUTYPE = 9997 THEN 'RE'                                                          --金快线，国债回购
               ELSE  'OT'  END
           , SECUCODE, CASE WHEN PRODTA_NO = '1' THEN 'SSE'
                            WHEN PRODTA_NO = '2' THEN 'SZSE'
                            ELSE '99' END)                                  AS Secu_Id,             --统一证券编号
      CONCAT('PRD', '-', SECUCODE)                                          AS Src_Sys_Prdno,       --源系统产品编号
      ''                                                                    AS Crrc_Cd,             --币种代码
      ''                                                                    AS Crrc_Name,           --币种名称
      ''                                                                    AS Cty_Cd,              --国家代码
      ''                                                                    AS Cty_Name,            --国家名称
      ''                                                                    AS Corp_Id,             --公司ID
      CASE WHEN DATASTATUS = '1'         THEN '1'                                                   --上市交易
           WHEN DATASTATUS IN ('0', '3') THEN '3'                                                   --终止上市
           WHEN DATASTATUS = '2'         THEN '5'                                                   --已发行未上市
           ELSE '9'                                                                                 --其他   --@ApiModelProperty(value = "产品状态", allowableValues = "[[\"禁用\",0],[\"启用/上架\",1],[\"评审中\",2],[\"下架\",3]]")
           END                                                              AS Scr_Stat,            --当前状态
      ''                                                                    AS Min_Pric_Chg_Unit,   --最小变动价格单位
      ''                                                                    AS Peru,                --每手数量
      CASE WHEN SECUTYPE < 6000 THEN 'AM'                                                           --资管
           WHEN SECUTYPE = 6010 THEN 'AM'                                                           --收益凭证
           WHEN 6000 < SECUTYPE AND SECUTYPE < 7000 THEN 'OC'                                       --OTC，归类OT(其他) 
           WHEN 7000 < SECUTYPE AND SECUTYPE < 8000 THEN 'PF'                                       --私募
           WHEN SECUTYPE IN ('9001','9002','9999') THEN 'FD' 
           WHEN SECUTYPE = 9997 THEN 'RE'                                                          --金快线，国债回购
           ELSE  'OT'  END                                                  AS Scr_Type,
      chinameabbr                                                               AS Ch_Abbr,
      SECUCODE                                                              AS Scr_Cd,
      CHISPELLING                                                           AS Ch_Abbr_Pinyin,
      CHINAME                                                               AS Ch_Name,
      ''                                                                    AS En_Name,
      ''                                                                    AS Ch_Abbr_L,
      ''                                                                    AS En_Abbr, 
      CASE WHEN PRODTA_NO = '1' THEN 'SSE'
           WHEN PRODTA_NO = '2' THEN 'SZSE'
           ELSE '99' END                                                    AS Mkt_Cd,
      CASE WHEN PRODTA_NO = '1' THEN '上海证券交易所'
           WHEN PRODTA_NO = '2' THEN '深圳证券交易所'
           ELSE '其他' END                                                  AS Mkt_Ch_Name,
      SECUCODE                                                              AS In_Code,                                    --源内部编码
      ''                                                                    AS Remark,      
      'odata_prd.prd_p_basicproduct'                                        AS Src_Tbl,
      Id                                                                    AS Src_Rec_Id ,
      FROM_UNIXTIME(UNIX_TIMESTAMP(), 'yyyy-MM-dd HH:mm:ss')                         AS Rec_Upd_Time, --记录最新更新时间
      NVL(S.Rec_Down_Time, FROM_UNIXTIME(UNIX_TIMESTAMP(), 'yyyy-MM-dd HH:mm:ss'))   AS Rec_Down_Time --记录落地时间，取原来的
FROM (
     SELECT * FROM ODATA_N_PRD.P_BASICPRODUCT WHERE Busi_Date = '${data_day_str}' AND SECUCODE <> '8088' AND SECUCODE IS NOT NULL
) PRD
LEFT OUTER JOIN DC_REC_DOWN_TM S 
ON CONCAT('PRD', '-', PRD.SECUCODE) = S.Src_Sys_Prdno;

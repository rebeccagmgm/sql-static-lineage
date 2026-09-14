-- task_id: 212999
-- hiveDb: 
-- source: SQL_MCP
-- sqlStatus: AVAILABLE
-- scriptPath: 
-- observed_at: 2026-09-05T07:06:43.860Z

-- createSql
CREATE TABLE IF NOT EXISTS T00_ZAPP_PLANT_TOPI_ADTNL_INFO (
  Cont_Set_Id STRING COMMENT '内容集合编号',
  Plant_List_Time_Mode_Cd STRING COMMENT '星球上架时间模式代码',
  Manu_Setp_Strt_Time STRING COMMENT '手工设置开始时间',
  Manu_Setp_End_Time STRING COMMENT '手工设置结束时间',
  Plant_Icon STRING COMMENT '星球图标',
  Det_Page_Bkgd_Img STRING COMMENT '详情页背景图',
  Det_Page_Bkgd_Img_Widt STRING COMMENT '详情页背景图宽',
  Det_Page_Bkgd_Img_High STRING COMMENT '详情页背景图高',
  Det_Page_Plac_Bann_Flag STRING COMMENT '详情页配置横幅标志',
  Dark_Plant_Icon STRING COMMENT '暗色星球图标',
  Dark_Det_Page_Lbl_Bkgd STRING COMMENT '暗色详情页标签背景',
  Ligh_Det_Page_Lbl_Bkgd STRING COMMENT '亮色详情页标签背景',
  Dark_Plant_Lbl_Bkgd STRING COMMENT '暗色星球标签背景',
  Ligh_Plant_Lbl_Bkgd STRING COMMENT '亮色星球标签背景',
  Act_Flag STRING COMMENT '活动标志',
  Act_Strt_Time STRING COMMENT '活动开始时间',
  Act_End_Time STRING COMMENT '活动结束时间',
  Plant_Oth_Info STRING COMMENT '星球其他信息',
  Seq STRING COMMENT '序号',
  Data_Src_Cd STRING COMMENT '数据来源代码',
  Task_Name STRING COMMENT '任务名',
  Data_Etl_Date STRING COMMENT '数据加载日期',
  Data_Upt_Date STRING COMMENT '数据更新日期',
  Data_Time STRING COMMENT '数据时间',
  Real_Src_Tbl STRING COMMENT '真实源表'
)
COMMENT '元始股星球主题附加信息'
PARTITIONED BY (SRC_TBL STRING COMMENT'源表')
STORED AS ORC;

-- querySql
INSERT OVERWRITE TABLE T00_ZAPP_PLANT_TOPI_ADTNL_INFO PARTITION(SRC_TBL='ODATA_N_ESS.E_PLANET')
SELECT
CONCAT('ESS016-',A.PK_ID)             AS  Cont_Set_Id             --内容集合编号
,ONLINE_MODEL                          AS  Plant_List_Time_Mode_Cd --星球上架时间模式代码
,IF(NVL(TRIM(ONLINE_START_AT),'')='' OR NVL(TRIM(ONLINE_START_AT),'')='0' ,''
, CONCAT(from_unixtime(CAST(ONLINE_START_AT/ 1000 AS BIGINT), 'yyyy-MM-dd HH:mm:ss'),'.', SUBSTR(ONLINE_START_AT,-3))
)                                    AS  Manu_Setp_Strt_Time     --手工设置开始时间
,CASE WHEN NVL(TRIM(ONLINE_END_AT),'')='' OR NVL(TRIM(ONLINE_END_AT),'')='0' THEN ''
WHEN LENGTH(ONLINE_END_AT)= 14 THEN CONCAT(from_unixtime(CAST(ONLINE_END_AT/ 1000 AS BIGINT), 'yyyy-MM-dd HH:mm:ss'),'.', '000')
ELSE CONCAT(from_unixtime(CAST(ONLINE_END_AT/ 1000 AS BIGINT), 'yyyy-MM-dd HH:mm:ss'),'.', SUBSTR(ONLINE_END_AT,-3)) END
AS  Manu_Setp_End_Time      --手工设置结束时间
,ICON                                  AS  Plant_Icon              --星球图标
,BACKGROUND_IMAGE                      AS  Det_Page_Bkgd_Img       --详情页背景图
,BACKGROUND_IMAGE_WIDTH                AS  Det_Page_Bkgd_Img_Widt  --详情页背景图宽
,BACKGROUND_IMAGE_HEIGHT               AS  Det_Page_Bkgd_Img_High  --详情页背景图高
,HAS_BANNER                            AS  Det_Page_Plac_Bann_Flag --详情页配置横幅标志
,ICON_DARK                             AS  Dark_Plant_Icon         --暗色星球图标
,DETAIL_LABEL_DARK                     AS  Dark_Det_Page_Lbl_Bkgd  --暗色详情页标签背景
,DETAIL_LABEL_LIGHT                    AS  Ligh_Det_Page_Lbl_Bkgd  --亮色详情页标签背景
,FOLLOW_LABEL_DARK                     AS  Dark_Plant_Lbl_Bkgd     --暗色星球标签背景
,FOLLOW_LABEL_LIGHT                    AS  Ligh_Plant_Lbl_Bkgd     --亮色星球标签背景
,ACTIVITY                              AS  Act_Flag                --活动标志
,IF(NVL(TRIM(ACTIVITY_START_AT),'')='' OR NVL(TRIM(ACTIVITY_START_AT),'')='0' ,''
, CONCAT(from_unixtime(CAST(ACTIVITY_START_AT/ 1000 AS BIGINT), 'yyyy-MM-dd HH:mm:ss'),'.', SUBSTR(ACTIVITY_START_AT,-3))
)                                    AS  Act_Strt_Time           --活动开始时间
,CASE WHEN NVL(TRIM(ACTIVITY_END_AT),'')='' OR NVL(TRIM(ACTIVITY_END_AT),'')='0' THEN ''
WHEN LENGTH(ACTIVITY_END_AT)= 14 THEN CONCAT(from_unixtime(CAST(ACTIVITY_END_AT/ 1000 AS BIGINT), 'yyyy-MM-dd HH:mm:ss'),'.', '000')
ELSE CONCAT(from_unixtime(CAST(ACTIVITY_END_AT/ 1000 AS BIGINT), 'yyyy-MM-dd HH:mm:ss'),'.', SUBSTR(ACTIVITY_END_AT,-3)) END
AS  Act_End_Time            --活动结束时间
,JSON_INFO                             AS  Plant_Oth_Info          --星球其他信息
,SORT                                  AS  Seq                     --序号
,'ESS'                 AS  Data_Src_Cd             --数据来源代码
,'PDATA_N.T00_ZAPP_PLANT_TOPI_ADTNL_INFO_ESS016'                    AS  Task_Name               --任务名
,'2026-05-21'                AS  Data_Etl_Date           --数据加载日期
,'2026-05-21'                AS  Data_Upt_Date           --数据更新日期
,'2026-05-22 06:49:53'                  AS  Data_Time               --数据时间
,'ODATA_N_ESS.E_PLANET'                   AS  Real_Src_Tbl            --真实源表
FROM   (SELECT *  FROM ODATA_N_ESS.E_PLANET WHERE  BUSI_DATE='2026-05-21' )A
;

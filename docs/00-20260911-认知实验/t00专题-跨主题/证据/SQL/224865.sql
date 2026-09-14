-- task_id: 224865
-- hiveDb: 
-- source: SQL_MCP
-- sqlStatus: AVAILABLE
-- scriptPath: 
-- observed_at: 2026-09-05T07:16:45.101Z

-- createSql
CREATE TABLE IF NOT EXISTS T00_LMS_COL_ADTNL_INFO (
  Cont_Set_Id STRING COMMENT '内容集合编号',
  Covr_Name STRING COMMENT '封面名称',
  Covr_Wbst STRING COMMENT '封面网址',
  Cont_Set_Desc STRING COMMENT '内容集合描述',
  Cont_Set_Intro_Disp_Flag STRING COMMENT '内容集合简介展示标志',
  Chld_Clas_Nav_Disp_Flag STRING COMMENT '子分类导航展示标志',
  Chld_Clas_Name_Disp_Flag STRING COMMENT '子分类名称展示标志',
  Chld_Clas_Intro_Disp_Flag STRING COMMENT '子分类简介展示标志',
  Cont_Set_Rank STRING COMMENT '内容集合排序',
  Read_Righ_Cd STRING COMMENT '阅读权限代码',
  Crse_Srh_List_Disp_Flag STRING COMMENT '课程搜索列表展示标志',
  Crse_Qty STRING COMMENT '课程数量',
  Crse_Cred_Tot STRING COMMENT '课程学分合计',
  Del_Flag STRING COMMENT '删除标志',
  Create_Time STRING COMMENT '创建时间',
  Upd_Time STRING COMMENT '更新时间',
  Upd_User_Id STRING COMMENT '更新用户编号',
  Data_Src_Cd STRING COMMENT '数据来源代码',
  Task_Name STRING COMMENT '任务名',
  Data_Etl_Date STRING COMMENT '数据加载日期',
  Data_Upt_Date STRING COMMENT '数据更新日期',
  Data_Time STRING COMMENT '数据时间',
  Real_Src_Tbl STRING COMMENT '真实源表'
)
COMMENT '爱学专栏附加信息'
PARTITIONED BY (SRC_TBL STRING COMMENT'源表')
STORED AS ORC;

-- querySql
INSERT OVERWRITE TABLE T00_LMS_COL_ADTNL_INFO PARTITION(SRC_TBL='ODATA_N_LMS.I_LMS_SUBJECT')
SELECT
CONCAT('LMS040-',SUBJECT_ID)          AS  Cont_Set_Id             --内容集合编号
,IMAGE_NAME                            AS  Covr_Name               --封面名称
,IMAGE_URL                             AS  Covr_Wbst               --封面网址
,INFO                                  AS  Cont_Set_Desc           --内容集合描述
,SHOW_INFO                             AS  Cont_Set_Intro_Disp_Flag--内容集合简介展示标志
,SHOW_TYPE_MENU                        AS  Chld_Clas_Nav_Disp_Flag --子分类导航展示标志
,SHOW_TYPE_NAME                        AS  Chld_Clas_Name_Disp_Flag--子分类名称展示标志
,SHOW_TYPE_INFO                        AS  Chld_Clas_Intro_Disp_Flag--子分类简介展示标志
,SORT                                  AS  Cont_Set_Rank           --内容集合排序
,PUBLIC_FLAG                           AS  Read_Righ_Cd            --阅读权限代码
,PUBLIC_SHOW                           AS  Crse_Srh_List_Disp_Flag --课程搜索列表展示标志
,LESSON_COUNT                          AS  Crse_Qty                --课程数量
,SCORE_COUNT                           AS  Crse_Cred_Tot           --课程学分合计
,ISDEL                                 AS  Del_Flag                --删除标志
,CREATE_TIME                           AS  Create_Time             --创建时间
,LAST_UPDATE_TIME                      AS  Upd_Time                --更新时间
,LAST_UPDATE_USER                      AS  Upd_User_Id             --更新用户编号
,'LMS'                 AS  Data_Src_Cd             --数据来源代码
,'PDATA_N.T00_LMS_COL_ADTNL_INFO_LMS040'                    AS  Task_Name               --任务名
,'2026-05-23'                AS  Data_Etl_Date           --数据加载日期
,'2026-05-23'                AS  Data_Upt_Date           --数据更新日期
,'2026-05-24 07:27:43'                  AS  Data_Time               --数据时间
,'ODATA_N_LMS.I_LMS_SUBJECT'                   AS  Real_Src_Tbl            --真实源表
FROM   (SELECT *  FROM ODATA_N_LMS.I_LMS_SUBJECT WHERE  BUSI_DATE='2026-05-23' )A
;

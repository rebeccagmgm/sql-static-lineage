-- task_id: 242368
-- hiveDb: 
-- source: SQL_MCP
-- sqlStatus: AVAILABLE
-- scriptPath: 
-- observed_at: 2026-09-05T07:39:12.641Z

-- createSql
CREATE TABLE IF NOT EXISTS T00_SYS_FUNC_INFO (
  Sys_Id STRING COMMENT '系统编号',
  Func_Id STRING COMMENT '功能编号',
  Func_Name STRING COMMENT '功能名称',
  Func_Cd STRING COMMENT '功能代码',
  Func_Desc STRING COMMENT '功能描述',
  Func_Module_Stat_Cd STRING COMMENT '功能模块状态代码',
  Func_Lvl STRING COMMENT '功能层级',
  Prnt_Func_Id STRING COMMENT '父级功能编号',
  Prnt_Func_Cd STRING COMMENT '父级功能代码',
  Func_Url STRING COMMENT '功能URL',
  Func_Loc STRING COMMENT '功能位置',
  Func_Way STRING COMMENT '功能方法',
  Wl_Flag STRING COMMENT '白名单标志',
  Ms_Name STRING COMMENT '微服务名称',
  Open_Intfc_Flag STRING COMMENT '开放接口标志',
  Func_Cate_Cd STRING COMMENT '功能类别代码',
  Func_Node_Type_Cd STRING COMMENT '功能节点类型代码',
  Func_Busi_Type_Cd STRING COMMENT '功能业务类型代码',
  Func_Busi_Prop_Cd STRING COMMENT '功能业务性质代码',
  Seq STRING COMMENT '序号',
  Icon_Path STRING COMMENT '图标路径',
  Page_Open_Way_Cd STRING COMMENT '页面打开方式代码',
  Tplt_Page_Id STRING COMMENT '模版页面编号',
  Multc_Func_Cd STRING COMMENT '多选功能编码',
  Multc_Excl_Func_Cd STRING COMMENT '多选排除功能编码',
  Pwd_Type_Cd STRING COMMENT '密码类型代码',
  Acs_Lvl_Cd STRING COMMENT '存取级别代码',
  Func_Busi_Flag_Str STRING COMMENT '功能业务标志串',
  Restr_Strt_Time STRING COMMENT '限制开始时间',
  Restr_End_Time STRING COMMENT '限制结束时间',
  Perm_Sys_Stat_Str STRING COMMENT '允许系统状态串',
  Module_Setp_Type_Cd STRING COMMENT '模块设置类型代码',
  Vsb_Type_Cd STRING COMMENT '可见类型代码',
  Read_Flag STRING COMMENT '只读标志',
  Built_In_Data_Flag STRING COMMENT '内置数据标志',
  Shotc_Key STRING COMMENT '快捷键',
  Create_Time STRING COMMENT '创建时间',
  Creator STRING COMMENT '创建人',
  Upd_Time STRING COMMENT '更新时间',
  Upd_Prsn STRING COMMENT '更新人',
  Data_Src_Cd STRING COMMENT '数据来源代码',
  Task_Name STRING COMMENT '任务名',
  Data_Etl_Date STRING COMMENT '数据加载日期',
  Data_Upt_Date STRING COMMENT '数据更新日期',
  Data_Time STRING COMMENT '数据时间',
  Real_Src_Tbl STRING COMMENT '真实源表'
)
COMMENT '系统功能信息'
PARTITIONED BY (SRC_TBL STRING COMMENT'源表')
STORED AS ORC;

-- querySql
INSERT OVERWRITE TABLE T00_SYS_FUNC_INFO PARTITION(SRC_TBL)
SELECT
'5c064d5206a9e'                       AS  Sys_Id                  --系统编号                 '5c064d5206a9e' --资管直销系统
,CONCAT('ADS019',FUNCTION_ID)          AS  Func_Id                 --功能编号
,FUNCTION_NAME                         AS  Func_Name               --功能名称
,''                                    AS  Func_Cd                 --功能代码
,''                                    AS  Func_Desc               --功能描述
,''                                    AS  Func_Module_Stat_Cd     --功能模块状态代码
,''                                    AS  Func_Lvl                --功能层级
,''                                    AS  Prnt_Func_Id            --父级功能编号
,''                                    AS  Prnt_Func_Cd            --父级功能代码
,''                                    AS  Func_Url                --功能URL
,''                                    AS  Func_Loc                --功能位置
,''                                    AS  Func_Way                --功能方法
,''                                    AS  Wl_Flag                 --白名单标志
,''                                    AS  Ms_Name                 --微服务名称
,''                                    AS  Open_Intfc_Flag         --开放接口标志
,''                                    AS  Func_Cate_Cd            --功能类别代码
,''                                    AS  Func_Node_Type_Cd       --功能节点类型代码
,FUNC_BUSI_TYPE                        AS  Func_Busi_Type_Cd       --功能业务类型代码
,FUNC_BUSI_PROP                        AS  Func_Busi_Prop_Cd       --功能业务性质代码
,''                                    AS  Seq                     --序号
,''                                    AS  Icon_Path               --图标路径
,''                                    AS  Page_Open_Way_Cd        --页面打开方式代码
,''                                    AS  Tplt_Page_Id            --模版页面编号
,''                                    AS  Multc_Func_Cd           --多选功能编码
,''                                    AS  Multc_Excl_Func_Cd      --多选排除功能编码
,PASSWORD_TYPE                         AS  Pwd_Type_Cd             --密码类型代码
,ACCESS_LEVEL                          AS  Acs_Lvl_Cd              --存取级别代码
,FUNC_FLAG_STR                         AS  Func_Busi_Flag_Str      --功能业务标志串
,RESTSTART_TIME                        AS  Restr_Strt_Time         --限制开始时间
,RESTEND_TIME                          AS  Restr_End_Time          --限制结束时间
,EN_SYS_STATUS                         AS  Perm_Sys_Stat_Str       --允许系统状态串
,''                                    AS  Module_Setp_Type_Cd     --模块设置类型代码
,''                                    AS  Vsb_Type_Cd             --可见类型代码
,''                                    AS  Read_Flag               --只读标志
,''                                    AS  Built_In_Data_Flag      --内置数据标志
,''                                    AS  Shotc_Key               --快捷键
,''                                    AS  Create_Time             --创建时间
,''                                    AS  Creator                 --创建人
,''                                    AS  Upd_Time                --更新时间
,''                                    AS  Upd_Prsn                --更新人
,'ADS'                 AS  Data_Src_Cd             --数据来源代码
,'SPDATA_N.T00_SYS_FUNC_INFO_ADS019'                    AS  Task_Name               --任务名
,'2026-07-16'                AS  Data_Etl_Date           --数据加载日期
,'2026-07-16'                AS  Data_Upt_Date           --数据更新日期
,'2026-07-17 16:12:09'                  AS  Data_Time               --数据时间
,'ODATA_N_ADS.U_HSFUNCTION'                   AS  Real_Src_Tbl            --真实源表
,'ODATA_N_ADS.U_HSFUNCTION'                   AS  Src_Tbl                 --源表
FROM   (SELECT *  FROM ODATA_N_ADS.U_HSFUNCTION WHERE  BUSI_DATE='2026-07-16' )A
;

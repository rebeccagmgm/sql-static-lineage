-- task_id: 242362
-- hiveDb: pdata_n
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-GF_FDM_N/CSA/PDATA_N.T00_SYS_FUNC_INFO_TIT004.py
-- observed_at: 2026-09-05T01:07:30.829Z

-- createSql
CREATE TABLE IF NOT EXISTS T00_SYS_FUNC_INFO(
     Sys_Id                     STRING COMMENT '系统编号'
    ,Func_Id                    STRING COMMENT '功能编号'
    ,Func_Name                  STRING COMMENT '功能名称'
    ,Func_Cd                    STRING COMMENT '功能代码'
    ,Func_Desc                  STRING COMMENT '功能描述'
    ,Func_Module_Stat_Cd        STRING COMMENT '功能模块状态代码'
    ,Func_Lvl                   STRING COMMENT '功能层级'
    ,Prnt_Func_Id               STRING COMMENT '父级功能编号'
    ,Prnt_Func_Cd               STRING COMMENT '父级功能代码'
    ,Func_Url                   STRING COMMENT '功能URL'
    ,Func_Loc                   STRING COMMENT '功能位置'
    ,Func_Way                   STRING COMMENT '功能方法'
    ,Wl_Flag                    STRING COMMENT '白名单标志'
    ,Ms_Name                    STRING COMMENT '微服务名称'
    ,Open_Intfc_Flag            STRING COMMENT '开放接口标志'
    ,Func_Cate_Cd               STRING COMMENT '功能类别代码'
    ,Func_Node_Type_Cd          STRING COMMENT '功能节点类型代码'
    ,Func_Busi_Type_Cd          STRING COMMENT '功能业务类型代码'
    ,Func_Busi_Prop_Cd          STRING COMMENT '功能业务性质代码'
    ,Seq                        STRING COMMENT '序号'
    ,Icon_Path                  STRING COMMENT '图标路径'
    ,Page_Open_Way_Cd           STRING COMMENT '页面打开方式代码'
    ,Tplt_Page_Id               STRING COMMENT '模版页面编号'
    ,Multc_Func_Cd              STRING COMMENT '多选功能编码'
    ,Multc_Excl_Func_Cd         STRING COMMENT '多选排除功能编码'
    ,Pwd_Type_Cd                STRING COMMENT '密码类型代码'
    ,Acs_Lvl_Cd                 STRING COMMENT '存取级别代码'
    ,Func_Busi_Flag_Str         STRING COMMENT '功能业务标志串'
    ,Restr_Strt_Time            STRING COMMENT '限制开始时间'
    ,Restr_End_Time             STRING COMMENT '限制结束时间'
    ,Perm_Sys_Stat_Str          STRING COMMENT '允许系统状态串'
    ,Module_Setp_Type_Cd        STRING COMMENT '模块设置类型代码'
    ,Vsb_Type_Cd                STRING COMMENT '可见类型代码'
    ,Read_Flag                  STRING COMMENT '只读标志'
    ,Built_In_Data_Flag         STRING COMMENT '内置数据标志'
    ,Shotc_Key                  STRING COMMENT '快捷键'
    ,Create_Time                STRING COMMENT '创建时间'
    ,Creator                    STRING COMMENT '创建人'
    ,Upd_Time                   STRING COMMENT '更新时间'
    ,Upd_Prsn                   STRING COMMENT '更新人'
    ,Data_Src_Cd                STRING COMMENT '数据来源代码'
    ,Task_Name                  STRING COMMENT '任务名'
    ,Data_Etl_Date              STRING COMMENT '数据加载日期'
    ,Data_Upt_Date              STRING COMMENT '数据更新日期'
    ,Data_Time                  STRING COMMENT '数据时间'
    ,Real_Src_Tbl               STRING COMMENT '真实源表'
)COMMENT '系统功能信息'
PARTITIONED BY (SRC_TBL  STRING COMMENT'源表')
STORED AS ORC;

-- querySql
INSERT OVERWRITE TABLE T00_SYS_FUNC_INFO PARTITION(SRC_TBL)
-----------------------------------------------------------------------------------------------------
--Group1: Source Table:[ODATA_N_TIT.A_ADM_FUNCTION:系统管理-功能清单表] 
-----------------------------------------------------------------------------------------------------
SELECT
     '5ae39f326866f'                       AS  Sys_Id                  --系统编号                 '5ae39f326866f' --场外衍生品投资管理系统
    ,KEY_FUNCTION_ID                       AS  Func_Id                 --功能编号         
    ,FUNCTION_NAME                         AS  Func_Name               --功能名称         
    ,FUNCTION_NUMBER                       AS  Func_Cd                 --功能代码         
    ,''                                    AS  Func_Desc               --功能描述         
    ,''                                    AS  Func_Module_Stat_Cd     --功能模块状态代码 
    ,''                                    AS  Func_Lvl                --功能层级         
    ,''                                    AS  Prnt_Func_Id            --父级功能编号     
    ,''                                    AS  Prnt_Func_Cd            --父级功能代码     
    ,FUNCTION_URL                          AS  Func_Url                --功能URL          
    ,FUNCTION_POSITION                     AS  Func_Loc                --功能位置         
    ,FUNCTION_METHOD                       AS  Func_Way                --功能方法         
    ,CASE WHEN IS_WHITELIST ='Y' THEN '1'
          WHEN IS_WHITELIST ='N' THEN '0'
          ELSE IS_WHITELIST END            AS  Wl_Flag                 --白名单标志       
    ,MICROSERVICE_NAME                     AS  Ms_Name                 --微服务名称       
    ,IS_OPEN                               AS  Open_Intfc_Flag         --开放接口标志     
    ,''                                    AS  Func_Cate_Cd            --功能类别代码     
    ,''                                    AS  Func_Node_Type_Cd       --功能节点类型代码 
    ,''                                    AS  Func_Busi_Type_Cd       --功能业务类型代码 
    ,''                                    AS  Func_Busi_Prop_Cd       --功能业务性质代码 
    ,''                                    AS  Seq                     --序号             
    ,''                                    AS  Icon_Path               --图标路径         
    ,''                                    AS  Page_Open_Way_Cd        --页面打开方式代码 
    ,''                                    AS  Tplt_Page_Id            --模版页面编号     
    ,''                                    AS  Multc_Func_Cd           --多选功能编码     
    ,''                                    AS  Multc_Excl_Func_Cd      --多选排除功能编码 
    ,''                                    AS  Pwd_Type_Cd             --密码类型代码     
    ,''                                    AS  Acs_Lvl_Cd              --存取级别代码     
    ,''                                    AS  Func_Busi_Flag_Str      --功能业务标志串   
    ,''                                    AS  Restr_Strt_Time         --限制开始时间     
    ,''                                    AS  Restr_End_Time          --限制结束时间     
    ,''                                    AS  Perm_Sys_Stat_Str       --允许系统状态串   
    ,''                                    AS  Module_Setp_Type_Cd     --模块设置类型代码 
    ,''                                    AS  Vsb_Type_Cd             --可见类型代码     
    ,''                                    AS  Read_Flag               --只读标志         
    ,''                                    AS  Built_In_Data_Flag      --内置数据标志     
    ,''                                    AS  Shotc_Key               --快捷键           
    ,CREATED_DATETIME                      AS  Create_Time             --创建时间         
    ,CREATED_BY                            AS  Creator                 --创建人           
    ,''                                    AS  Upd_Time                --更新时间         
    ,''                                    AS  Upd_Prsn                --更新人           
    ,'${data_src_cd}'                 AS  Data_Src_Cd             --数据来源代码
    ,'${filename}'                    AS  Task_Name               --任务名
    ,'${data_day_str}'                AS  Data_Etl_Date           --数据加载日期
    ,'${data_day_str}'                AS  Data_Upt_Date           --数据更新日期
    ,'${data_today}'                  AS  Data_Time               --数据时间
    ,'${src_table}'                   AS  Real_Src_Tbl            --真实源表
    ,'${src_table}'                   AS  Src_Tbl                 --源表
FROM   (SELECT *  FROM ${src_table} WHERE  BUSI_DATE='${data_day_str}' )A

;

-- task_id: 143524
-- hiveDb: pdata_n
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-GF_FDM_N/CSA/PDATA_N.T00_API_INFO_BDP055.py
-- observed_at: 2026-09-05T01:06:57.557Z

-- createSql
CREATE TABLE IF NOT EXISTS T00_API_INFO(
         Api_Id                     STRING COMMENT 'API编号'
        ,Api_Meta_Id                STRING COMMENT 'API元数据编号'
        ,Api_Init_Id                STRING COMMENT 'API原始编号'
        ,Api_Jnt_Id                 STRING COMMENT 'API联合编号'
        ,Api_Meta_Stat              STRING COMMENT 'API元数据状态'
        ,Api_Name                   STRING COMMENT 'API名称'
        ,Api_Desc                   STRING COMMENT 'API描述'
        ,Api_Desc_Det               STRING COMMENT 'API描述详情'
        ,Api_Path                   STRING COMMENT 'API路径'
        ,Api_Type                   STRING COMMENT 'API类型'
        ,Http_Method                STRING COMMENT 'HTTP请求方式'
        ,Resp_Form                  STRING COMMENT '返回形式'
        ,Resp_Cont_Type             STRING COMMENT '返回内容类型'
        ,Auth_Way                   STRING COMMENT '认证方式'
        ,Sign_Algo                  STRING COMMENT '签名算法'
        ,Sprt_Page_Flag             STRING COMMENT '分页标志'
        ,Rtn_Tot_Line_Cnt_Flag      STRING COMMENT '返回总条数标志'
        ,Api_Grp_Id                 STRING COMMENT 'API组编号'
        ,Api_File_Id                STRING COMMENT 'API文件夹编号'
        ,Ver_No                     STRING COMMENT '版本号'
        ,Serv_Lvl                   STRING COMMENT '服务级别'
        ,Ver_Actv_Flag              STRING COMMENT '版本激活标志'
        ,Appr_Stat                  STRING COMMENT '审核状态'
        ,Pub_Flag                   STRING COMMENT '发布标志'
        ,Pub_User_Id                STRING COMMENT '发布用户编号'
        ,Pub_Time                   STRING COMMENT '发布时间'
        ,Open_Flag                  STRING COMMENT '开放标志'
        ,Ofc_Net_Logn_Flag          STRING COMMENT '办公网访问标志'
        ,Open_Stat_Modif_User_Id    STRING COMMENT '开放状态修改用户编号'
        ,Clos_Flag                  STRING COMMENT '销毁标志'
        ,Api_7_Flag                 STRING COMMENT 'API7标志'
        ,Clos_User_Id               STRING COMMENT '销毁人用户编号'
        ,Clos_Time                  STRING COMMENT '销毁时间'
        ,Visb_Stat                  STRING COMMENT '可见状态'
        ,In_Charg_User_Id           STRING COMMENT '授权负责人'
        ,Api_Meta_Data_Src          STRING COMMENT 'API元数据来源'
        ,Busi_Stat                  STRING COMMENT '业务状态'
        ,Cls_Name                   STRING COMMENT '分类分级名称'
        ,Sql_Deflt_Data_Src         STRING COMMENT 'SQL默认数据源'
        ,Sql_Deflt_Schema           STRING COMMENT 'SQL默认schema'
        ,Sql_Scrp                   STRING COMMENT 'SQL语句'
        ,Sql_Use_Db_Tbl             STRING COMMENT 'SQL使用库表'
        ,Src_Data_Src_Cd            STRING COMMENT '源数据来源代码'
        ,Del_Flag                   STRING COMMENT '删除标志'
        ,Del_Date                   STRING COMMENT '删除日期'
        ,Data_Src_Cd                STRING COMMENT '数据来源代码'
        ,Task_Name                  STRING COMMENT '任务名'
        ,Data_Etl_Date              STRING COMMENT '数据加载日期'
        ,Data_Upt_Date              STRING COMMENT '数据更新日期'
        ,Data_Time                  STRING COMMENT '数据时间'
        ,Real_Src_Tbl               STRING COMMENT '真实源表'
        ,Auth_Flag                  STRING COMMENT '认证标志'
        ,Busi_Prin_User_Id          STRING COMMENT '业务负责人用户编号'
        ,Upprc_Enty_Id              STRING COMMENT '上游实体编号'
        ,Lowrc_Enty_Id              STRING COMMENT '下游实体编号'
        ,Main_Busi_Dept_Name        STRING COMMENT '主业务部门名称'
        ,Scd_Busi_Dept_Name         STRING COMMENT '次业务部门名称'
        ,Meta_Clas_Id               STRING COMMENT '元数据分类代码'
        ,Safe_Lvl_Cd                STRING COMMENT '安全等级代码'
        ,Meta_Lbl_Id                STRING COMMENT '元数据标签编号'
        ,Meta_Estb_Time             STRING COMMENT '元数据创建时间'
    )COMMENT 'API信息'
    PARTITIONED BY (SRC_TBL STRING COMMENT '源表')
    STORED AS ORC;

DROP TABLE IF EXISTS ${DB_TEMP}.T00_API_INFO_TEMP_BDP055;
    CREATE TABLE IF NOT EXISTS ${DB_TEMP}.T00_API_INFO_TEMP_BDP055
    AS
    -----------------------------------------------------------------------------------------------------
    --GROUP1: SOURCE TABLE:[ODATA_N_BDP.N_DS_API_BASE_INFO: API基础信息]
    -----------------------------------------------------------------------------------------------------
    SELECT
         CONCAT('BDP055-',A.Api_Id)              AS  Api_Id                  --API编号         
        ,B.GUID                                  AS  Api_Meta_Id             --API元数据编号   
        ,A.API_CODE                              AS  Api_Init_Id             --API原始编号     
        ,A.API_UNION_ID                          AS  Api_Jnt_Id              --API联合编号     
        ,B.STATUS                                AS  Api_Meta_Stat           --API元数据状态   
        ,A.API_NAME                              AS  Api_Name                --API名称         
        ,A.API_DESC                              AS  Api_Desc                --API描述         
        ,A.API_DESC_DETAIL                       AS  Api_Desc_Det            --API描述详情              
        ,A.API_PATH                              AS  Api_Path                --API路径                
        ,A.API_TYPE                              AS  Api_Type                --API类型                
        ,A.HTTP_METHOD                           AS  Http_Method             --HTTP请求方式             
        ,A.RESPONSE_TARGET                       AS  Resp_Form               --返回形式                 
        ,A.RESPONSE_TYPE                         AS  Resp_Cont_Type          --返回内容类型               
        ,A.AUTH_TYPE                             AS  Auth_Way                --认证方式                 
        ,A.SIGN_ALGORITHM                        AS  Sign_Algo               --签名算法                 
        ,CASE WHEN A.IS_PAGINATION = 'Y' THEN '1'
              WHEN A.IS_PAGINATION = 'N' THEN '0'
              ELSE '' END                        AS  Sprt_Page_Flag          --分页标志         
        ,CASE WHEN A.IS_RETURN_COUNT = 'Y' THEN '1'
              WHEN A.IS_RETURN_COUNT = 'N' THEN '0'
              ELSE '' END                        AS  Rtn_Tot_Line_Cnt_Flag   --返回总条数标志   
        ,A.GROUP_ID                              AS  Api_Grp_Id              --API组编号        
        ,A.FOLDER_ID                             AS  Api_File_Id             --API文件夹编号    
        ,A.VERSION_CODE                          AS  Ver_No                  --版本号           
        ,A.SERVE_LEVEL                           AS  Serv_Lvl                --服务级别         
        ,CASE WHEN A.IS_VERSION_ACTIVE = 'Y' THEN '1'
              WHEN A.IS_VERSION_ACTIVE = 'N' THEN '0'
              ELSE '' END                        AS  Ver_Actv_Flag           --版本激活标志     
        ,A.AUDIT_STATUS                          AS  Appr_Stat               --审核状态         
        ,CASE WHEN A.IS_PUBLISH = 'Y' THEN '1'
              WHEN A.IS_PUBLISH = 'N' THEN '0'
              ELSE '' END                        AS  Pub_Flag                --发布标志         
       --,B.PUBLISHUSER                          AS  Pub_User_Id             --发布用户编号              先留空，用户主数据待入仓
        ,''                                      AS  Pub_User_Id             --发布用户编号          
        ,A.PUBLISH_TIME                          AS  Pub_Time                --发布时间                 
        ,CASE WHEN A.IS_OPEN = 'Y' THEN '1'
              WHEN A.IS_OPEN = 'N' THEN '0'
              ELSE '' END                        AS  Open_Flag               --开放标志    
        ,CASE WHEN A.ALLOW_OFFICE_NETWORK = 'Y' THEN '1'
              WHEN A.ALLOW_OFFICE_NETWORK = 'N' THEN '0'
              ELSE '' END                        AS  Ofc_Net_Logn_Flag       --办公网访问标志    
        --,B.OPENUSER                            AS  Open_Stat_Modif_User_Id --开放状态修改用户编号          先留空，用户主数据待入仓
        ,''                                      AS  Open_Stat_Modif_User_Id --开放状态修改用户编号   
        ,CASE WHEN A.IS_DESTROY = 'Y' THEN '1'
              WHEN A.IS_DESTROY = 'N' THEN '0'
              ELSE '' END                        AS  Clos_Flag               --销毁标志               
        ,CASE WHEN A.IS_API7 = 'Y' THEN '1'
              WHEN A.IS_API7 = 'N' THEN '0'
              ELSE '' END                        AS  Api_7_Flag              --API7标志            
        --,A.DESTROY_BY                          AS  Clos_User_Id            --销毁人用户编号             先留空，用户主数据待入仓
        ,''                                      AS  Clos_User_Id            --销毁人用户编号           
        ,A.DESTROY_TIME                          AS  Clos_Time               --销毁时间                 
        ,A.VISIBILITY                            AS  Visb_Stat               --可见状态     
        ,A.AUTH_PRINCIPAL                        AS  In_Charg_User_Id        --授权负责人   
        ,B.SOURCE                                AS  Api_Meta_Data_Src       --API元数据来源
        ,B.BUSINESS_STATUS                       AS  Busi_Stat               --业务状态     
        ,D.CLASSIFICATIONS                       AS  Cls_Name                --分类分级名称 
        ,UPPER(C.DEFAULT_DATASOURCE)             AS  Sql_Deflt_Data_Src      --SQL默认数据源
        ,UPPER(C.DEFAULT_SCHEMA)                 AS  Sql_Deflt_Schema        --SQL默认schema
        ,C.SQL_SCRIPT                            AS  Sql_Scrp                --SQL语句      
        ,IF(SUBSTR(UPPER(C.USE_SCHEMA_TABLE),LENGTH(USE_SCHEMA_TABLE))=',',SUBSTR(UPPER(C.USE_SCHEMA_TABLE),1,LENGTH(USE_SCHEMA_TABLE)-1),UPPER(C.USE_SCHEMA_TABLE))
                                                 AS  Sql_Use_Db_Tbl          --SQL使用库表             转大写，最后一个字符是逗号的话去掉逗号。
        ,'DSP'                                   AS  Src_Data_Src_Cd         --源数据来源代码   
        ,'${data_src_cd}'                   AS  Data_Src_Cd             --数据来源代码
        ,'${src_table}'                     AS  Src_Tbl                 --源表
        ,'${filename}'                      AS  Task_Name               --任务名
        ,'${data_day_str}'                  AS  Data_Etl_Date           --数据加载日期
        ,'${data_day_str}'                  AS  Data_Upt_Date           --数据更新日期
        ,'${src_table}'                     AS  Real_Src_Tbl              --真实源表
        ,B.BUSINESS_ISCERTIFIED                  AS  Auth_Flag                 --认证标志
        ,B.BUSINESS_MANAGER                      AS  Busi_Prin_User_Id         --业务负责人用户编号
        ,B.UPSTREAMS                             AS  Upprc_Enty_Id             --上游实体编
        ,B.DOWNSTREAMS                           AS  Lowrc_Enty_Id             --下游实体编号
        ,B.BUSINESS_PRIMARYASSETOWNER            AS  Main_Busi_Dept_Name       --主业务部门名称
        ,B.BUSINESS_SECONDARYASSETOWNER          AS  Scd_Busi_Dept_Name        --次业务部门名称
        ,B.CLASSIFICATION                        AS  Meta_Clas_Id              --元数据分类代码
        ,B.GRADE                                 AS  Safe_Lvl_Cd               --安全等级代码
        ,B.TAG                                   AS  Meta_Lbl_Id               --元数据标签编号
        ,CAST(B.CREATE_TIME AS STRING)           AS  Meta_Estb_Time            --元数据创建时间
    FROM   (SELECT *  FROM ODATA_N_BDP.N_DS_API_BASE_INFO WHERE  BUSI_DATE='${data_day_str}' )A
    LEFT JOIN  (SELECT *  FROM  ODATA_N_BDP.FILE_ATLAS_EXPORT_GF_API WHERE lower(trim(SOURCE))='dsp') B
           ON A.API_ID=B.APIID
    LEFT JOIN  (SELECT *  FROM ODATA_N_BDP.N_DS_API_SQL WHERE BUSI_DATE='${data_day_str}' ) C
           ON A.API_ID=C.API_ID
    LEFT JOIN(
            select guid,concat_ws(',',collect_set(CLASSIFICATIONS_NEW)) as CLASSIFICATIONS  --然后根据GUID 将(1)(2)(3)得的内容合并，用逗号,分割。顺序最好按照分类分级标签。
            from (select *
                  from (select a.guid,concat_ws(',',collect_set(b.label)) as CLASSIFICATIONS_NEW,'1' as flag
                      from (select *
                            from (select guid,CLASSIFICATION_1,CLASSIFICATIONS
                                  from odata_n_bdp.FILE_ATLAS_EXPORT_GF_API
                                  LATERAL VIEW EXPLODE(SPLIT(NVL(CLASSIFICATION,''),',')) T AS CLASSIFICATION_1
                                  ) s
                            where nvl(CLASSIFICATION_1,'')<>''  
                           ) a 
                      join (select id,label from odata_n_bdp.p_t_meta_classification 
                            where busi_date='${data_day_str}'
                           ) b on a.CLASSIFICATION_1=b.id
                      group by guid   --(1)分类:将CLASSIFICATION 逗号,分隔的内容打散，然后非空数据关联ODATA_N_BDP.P_T_META_CLASSIFICATION.ID获取到LABEL字段。
                      union all
                      select a.guid,concat_ws(',',collect_set(b.label)) as CLASSIFICATIONS_NEW,'3' as flag
                      from (select *
                            from (select guid,TAG_1,CLASSIFICATIONS
                                  from odata_n_bdp.FILE_ATLAS_EXPORT_GF_API
                                  LATERAL VIEW EXPLODE(SPLIT(NVL(TAG,''),',')) T AS TAG_1
                                  ) s
                            where nvl(TAG_1,'')<>''    
                           ) a 
                      join (select id,label 
                            from odata_n_bdp.p_t_meta_tag
                            where busi_date='${data_day_str}'
                           ) b on a.TAG_1=b.id
                      group by guid    --(2)标签:将TAG 逗号,分隔的内容打散，然后非空数据关联ODATA_N_BDP.P_T_META_TAG.ID获取到LABEL字段。
                      union all
                      select guid,concat_ws(',',collect_set(concat('分级_',GRADE))) as CLASSIFICATIONS_NEW,'2' as flag
                      from odata_n_bdp.FILE_ATLAS_EXPORT_GF_API
                      where  nvl(GRADE,'')<>'' 
                      group by guid   --(3)分级:将GRADE非空数据按照 '分级_'||GRADE 拼接。
                      ) m
                order by guid,flag
                ) n
            group by guid
            )D
      ON B.guid =D.guid
    ;

DROP TABLE IF EXISTS ${DB_TEMP}.T00_API_INFO_MID_BDP055;
    CREATE TABLE IF NOT EXISTS ${DB_TEMP}.T00_API_INFO_MID_BDP055
    AS
    SELECT
             A.*
            ,B.Api_Id                     AS Api_Id1                   --API编号
            ,B.Api_Meta_Id                AS Api_Meta_Id1              --API元数据编号
            ,B.Api_Init_Id                AS Api_Init_Id1              --API原始编号
            ,B.Api_Jnt_Id                 AS Api_Jnt_Id1               --API联合编号
            ,B.Api_Meta_Stat              AS Api_Meta_Stat1            --API元数据状态
            ,B.Api_Name                   AS Api_Name1                 --API名称
            ,B.Api_Desc                   AS Api_Desc1                 --API描述
            ,B.Api_Desc_Det               AS Api_Desc_Det1             --API描述详情
            ,B.Api_Path                   AS Api_Path1                 --API路径
            ,B.Api_Type                   AS Api_Type1                 --API类型
            ,B.Http_Method                AS Http_Method1              --HTTP请求方式
            ,B.Resp_Form                  AS Resp_Form1                --返回形式
            ,B.Resp_Cont_Type             AS Resp_Cont_Type1           --返回内容类型
            ,B.Auth_Way                   AS Auth_Way1                 --认证方式
            ,B.Sign_Algo                  AS Sign_Algo1                --签名算法
            ,B.Sprt_Page_Flag             AS Sprt_Page_Flag1           --分页标志
            ,B.Rtn_Tot_Line_Cnt_Flag      AS Rtn_Tot_Line_Cnt_Flag1    --返回总条数标志
            ,B.Api_Grp_Id                 AS Api_Grp_Id1               --API组编号
            ,B.Api_File_Id                AS Api_File_Id1              --API文件夹编号
            ,B.Ver_No                     AS Ver_No1                   --版本号
            ,B.Serv_Lvl                   AS Serv_Lvl1                 --服务级别
            ,B.Ver_Actv_Flag              AS Ver_Actv_Flag1            --版本激活标志
            ,B.Appr_Stat                  AS Appr_Stat1                --审核状态
            ,B.Pub_Flag                   AS Pub_Flag1                 --发布标志
            ,B.Pub_User_Id                AS Pub_User_Id1              --发布用户编号
            ,B.Pub_Time                   AS Pub_Time1                 --发布时间
            ,B.Open_Flag                  AS Open_Flag1                --开放标志
            ,B.Ofc_Net_Logn_Flag          AS Ofc_Net_Logn_Flag1        --办公网访问标志
            ,B.Open_Stat_Modif_User_Id    AS Open_Stat_Modif_User_Id1  --开放状态修改用户编号
            ,B.Clos_Flag                  AS Clos_Flag1                --销毁标志
            ,B.Api_7_Flag                 AS Api_7_Flag1               --API7标志
            ,B.Clos_User_Id               AS Clos_User_Id1             --销毁人用户编号
            ,B.Clos_Time                  AS Clos_Time1                --销毁时间
            ,B.Visb_Stat                  AS Visb_Stat1                --可见状态
            ,B.In_Charg_User_Id           AS In_Charg_User_Id1         --授权负责人
            ,B.Api_Meta_Data_Src          AS Api_Meta_Data_Src1        --API元数据来源
            ,B.Busi_Stat                  AS Busi_Stat1                --业务状态
            ,B.Cls_Name                   AS Cls_Name1                 --分类分级名称
            ,B.Sql_Deflt_Data_Src         AS Sql_Deflt_Data_Src1       --SQL默认数据源
            ,B.Sql_Deflt_Schema           AS Sql_Deflt_Schema1         --SQL默认schema
            ,B.Sql_Scrp                   AS Sql_Scrp1                 --SQL语句
            ,B.Sql_Use_Db_Tbl             AS Sql_Use_Db_Tbl1           --SQL使用库表
            ,B.Src_Data_Src_Cd            AS Src_Data_Src_Cd1          --源数据来源代码
            ,B.DATA_SRC_CD                AS DATA_SRC_CD1              --数据来源代码
            ,B.SRC_TBL                    AS SRC_TBL1                  --源表
            ,B.TASK_NAME                  AS TASK_NAME1                --任务名
            ,B.DATA_ETL_DATE              AS DATA_ETL_DATE1            --数据加载日期
            ,B.DATA_UPT_DATE              AS DATA_UPT_DATE1            --数据更新日期
            ,B.Real_Src_Tbl               AS Real_Src_Tbl1             --真实源表
            ,B.Auth_Flag                  AS Auth_Flag1                --认证标志
            ,B.Busi_Prin_User_Id          AS Busi_Prin_User_Id1        --业务负责人用户编号
            ,B.Upprc_Enty_Id              AS Upprc_Enty_Id1            --上游实体编
            ,B.Lowrc_Enty_Id              AS Lowrc_Enty_Id1            --下游实体编号
            ,B.Main_Busi_Dept_Name        AS Main_Busi_Dept_Name1      --主业务部门名称
            ,B.Scd_Busi_Dept_Name         AS Scd_Busi_Dept_Name1       --次业务部门名称
            ,B.Meta_Clas_Id               AS Meta_Clas_Id1             --元数据分类代码
            ,B.Safe_Lvl_Cd                AS Safe_Lvl_Cd1              --安全等级代码
            ,B.Meta_Lbl_Id                AS Meta_Lbl_Id1              --元数据标签编号
            ,B.Meta_Estb_Time             AS Meta_Estb_Time1           --元数据创建时间
            ,CASE WHEN A.Api_Id IS NULL     AND B.Api_Id IS NOT NULL THEN 'I' --新增
                  WHEN A.Api_Id IS NOT NULL AND B.Api_Id IS NULL THEN 'D' --删除
                  WHEN A.Api_Id IS NOT NULL AND B.Api_Id IS NOT NULL AND (
                         COALESCE(A.Api_Meta_Id             ,'') <> COALESCE(B.Api_Meta_Id             ,'')
                      OR COALESCE(A.Api_Init_Id             ,'') <> COALESCE(B.Api_Init_Id             ,'')
                      OR COALESCE(A.Api_Jnt_Id              ,'') <> COALESCE(B.Api_Jnt_Id              ,'')
                      OR COALESCE(A.Api_Meta_Stat           ,'') <> COALESCE(B.Api_Meta_Stat           ,'')
                      OR COALESCE(A.Api_Name                ,'') <> COALESCE(B.Api_Name                ,'')
                      OR COALESCE(A.Api_Desc                ,'') <> COALESCE(B.Api_Desc                ,'')
                      OR COALESCE(A.Api_Desc_Det            ,'') <> COALESCE(B.Api_Desc_Det            ,'')
                      OR COALESCE(A.Api_Path                ,'') <> COALESCE(B.Api_Path                ,'')
                      OR COALESCE(A.Api_Type                ,'') <> COALESCE(B.Api_Type                ,'')
                      OR COALESCE(A.Http_Method             ,'') <> COALESCE(B.Http_Method             ,'')
                      OR COALESCE(A.Resp_Form               ,'') <> COALESCE(B.Resp_Form               ,'')
                      OR COALESCE(A.Resp_Cont_Type          ,'') <> COALESCE(B.Resp_Cont_Type          ,'')
                      OR COALESCE(A.Auth_Way                ,'') <> COALESCE(B.Auth_Way                ,'')
                      OR COALESCE(A.Sign_Algo               ,'') <> COALESCE(B.Sign_Algo               ,'')
                      OR COALESCE(A.Sprt_Page_Flag          ,'') <> COALESCE(B.Sprt_Page_Flag          ,'')
                      OR COALESCE(A.Rtn_Tot_Line_Cnt_Flag   ,'') <> COALESCE(B.Rtn_Tot_Line_Cnt_Flag   ,'')
                      OR COALESCE(A.Api_Grp_Id              ,'') <> COALESCE(B.Api_Grp_Id              ,'')
                      OR COALESCE(A.Api_File_Id             ,'') <> COALESCE(B.Api_File_Id             ,'')
                      OR COALESCE(A.Ver_No                  ,'') <> COALESCE(B.Ver_No                  ,'')
                      OR COALESCE(A.Serv_Lvl                ,'') <> COALESCE(B.Serv_Lvl                ,'')
                      OR COALESCE(A.Ver_Actv_Flag           ,'') <> COALESCE(B.Ver_Actv_Flag           ,'')
                      OR COALESCE(A.Appr_Stat               ,'') <> COALESCE(B.Appr_Stat               ,'')
                      OR COALESCE(A.Pub_Flag                ,'') <> COALESCE(B.Pub_Flag                ,'')
                      OR COALESCE(A.Pub_User_Id             ,'') <> COALESCE(B.Pub_User_Id             ,'')
                      OR COALESCE(A.Pub_Time                ,'') <> COALESCE(B.Pub_Time                ,'')
                      OR COALESCE(A.Open_Flag               ,'') <> COALESCE(B.Open_Flag               ,'')
                      OR COALESCE(A.Ofc_Net_Logn_Flag       ,'') <> COALESCE(B.Ofc_Net_Logn_Flag       ,'')
                      OR COALESCE(A.Open_Stat_Modif_User_Id ,'') <> COALESCE(B.Open_Stat_Modif_User_Id ,'')
                      OR COALESCE(A.Clos_Flag               ,'') <> COALESCE(B.Clos_Flag               ,'')
                      OR COALESCE(A.Api_7_Flag              ,'') <> COALESCE(B.Api_7_Flag              ,'')
                      OR COALESCE(A.Clos_User_Id            ,'') <> COALESCE(B.Clos_User_Id            ,'')
                      OR COALESCE(A.Clos_Time               ,'') <> COALESCE(B.Clos_Time               ,'')
                      OR COALESCE(A.Visb_Stat               ,'') <> COALESCE(B.Visb_Stat               ,'')
                      OR COALESCE(A.In_Charg_User_Id        ,'') <> COALESCE(B.In_Charg_User_Id        ,'')
                      OR COALESCE(A.Api_Meta_Data_Src       ,'') <> COALESCE(B.Api_Meta_Data_Src       ,'')
                      OR COALESCE(A.Busi_Stat               ,'') <> COALESCE(B.Busi_Stat               ,'')
                      OR COALESCE(A.Cls_Name                ,'') <> COALESCE(B.Cls_Name                ,'')
                      OR COALESCE(A.Sql_Deflt_Data_Src      ,'') <> COALESCE(B.Sql_Deflt_Data_Src      ,'')
                      OR COALESCE(A.Sql_Deflt_Schema        ,'') <> COALESCE(B.Sql_Deflt_Schema        ,'')
                      OR COALESCE(A.Sql_Scrp                ,'') <> COALESCE(B.Sql_Scrp                ,'')
                      OR COALESCE(A.Sql_Use_Db_Tbl          ,'') <> COALESCE(B.Sql_Use_Db_Tbl          ,'')
                      OR COALESCE(A.Src_Data_Src_Cd         ,'') <> COALESCE(B.Src_Data_Src_Cd         ,'')
                      OR COALESCE(A.Auth_Flag               ,'') <> COALESCE(B.Auth_Flag               ,'')
                      OR COALESCE(A.Busi_Prin_User_Id       ,'') <> COALESCE(B.Busi_Prin_User_Id       ,'')
                      OR COALESCE(A.Upprc_Enty_Id           ,'') <> COALESCE(B.Upprc_Enty_Id           ,'')
                      OR COALESCE(A.Lowrc_Enty_Id           ,'') <> COALESCE(B.Lowrc_Enty_Id           ,'')
                      OR COALESCE(A.Main_Busi_Dept_Name     ,'') <> COALESCE(B.Main_Busi_Dept_Name     ,'')
                      OR COALESCE(A.Scd_Busi_Dept_Name      ,'') <> COALESCE(B.Scd_Busi_Dept_Name      ,'')
                      OR COALESCE(A.Meta_Clas_Id            ,'') <> COALESCE(B.Meta_Clas_Id            ,'')
                      OR COALESCE(A.Safe_Lvl_Cd             ,'') <> COALESCE(B.Safe_Lvl_Cd             ,'')
                      OR COALESCE(A.Meta_Lbl_Id             ,'') <> COALESCE(B.Meta_Lbl_Id             ,'')
                      OR COALESCE(A.Meta_Estb_Time          ,'') <> COALESCE(B.Meta_Estb_Time          ,'')
                 ) THEN 'U' --变更
                 ELSE 'S' --无变更
                 END                 AS DATA_TYPE              --数据类型
    FROM  (SELECT * FROM T00_API_INFO 
                    WHERE SRC_TBL='ODATA_N_BDP.N_DS_API_BASE_INFO')A
    FULL OUTER JOIN ${DB_TEMP}.T00_API_INFO_TEMP_BDP055 B
    ON    A.Api_Id=B.Api_Id
    ;

-- querySql
INSERT OVERWRITE TABLE T00_API_INFO PARTITION(SRC_TBL)
     --剔除当日新增的数据
    SELECT
          *
      FROM T00_API_INFO
      WHERE DATA_ETL_DATE !='${data_day_str}' 
        AND SRC_TBL = 'ODATA_N_BDP.N_DS_API_BASE_INFO'
    ;

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
    
    INSERT OVERWRITE TABLE T00_API_INFO PARTITION(SRC_TBL)
    SELECT
         Api_Id                                        --API编号
        ,Api_Meta_Id                                   --API元数据编号
        ,Api_Init_Id                                   --API原始编号
        ,Api_Jnt_Id                                    --API联合编号
        ,Api_Meta_Stat                                 --API元数据状态
        ,Api_Name                                      --API名称
        ,Api_Desc                                      --API描述
        ,Api_Desc_Det                                  --API描述详情
        ,Api_Path                                      --API路径
        ,Api_Type                                      --API类型
        ,Http_Method                                   --HTTP请求方式
        ,Resp_Form                                     --返回形式
        ,Resp_Cont_Type                                --返回内容类型
        ,Auth_Way                                      --认证方式
        ,Sign_Algo                                     --签名算法
        ,Sprt_Page_Flag                                --分页标志
        ,Rtn_Tot_Line_Cnt_Flag                         --返回总条数标志
        ,Api_Grp_Id                                    --API组编号
        ,Api_File_Id                                   --API文件夹编号
        ,Ver_No                                        --版本号
        ,Serv_Lvl                                      --服务级别
        ,Ver_Actv_Flag                                 --版本激活标志
        ,Appr_Stat                                     --审核状态
        ,Pub_Flag                                      --发布标志
        ,Pub_User_Id                                   --发布用户编号
        ,Pub_Time                                      --发布时间
        ,Open_Flag                                     --开放标志
        ,Ofc_Net_Logn_Flag                             --办公网访问标志
        ,Open_Stat_Modif_User_Id                       --开放状态修改用户编号
        ,Clos_Flag                                     --销毁标志
        ,Api_7_Flag                                    --API7标志
        ,Clos_User_Id                                  --销毁人用户编号
        ,Clos_Time                                     --销毁时间
        ,Visb_Stat                                     --可见状态
        ,In_Charg_User_Id                              --授权负责人
        ,Api_Meta_Data_Src                             --API元数据来源
        ,Busi_Stat                                     --业务状态
        ,Cls_Name                                      --分类分级名称
        ,Sql_Deflt_Data_Src                            --SQL默认数据源
        ,Sql_Deflt_Schema                              --SQL默认schema
        ,Sql_Scrp                                      --SQL语句
        ,Sql_Use_Db_Tbl                                --SQL使用库表
        ,Src_Data_Src_Cd                               --源数据来源代码
        ,'0'                     AS Del_Flag           --删除标志
        ,''                      AS Del_Date           --删除日期
        ,Data_Src_Cd                                   --数据来源代码
        ,Task_Name                                     --任务名
        ,Data_Etl_Date                                 --数据加载日期
        ,Data_Upt_Date                                 --数据更新日期
        ,Data_Time                                     --数据时间
        ,Real_Src_Tbl                                  --真实源表
        ,Auth_Flag                                     --认证标志
        ,Busi_Prin_User_Id                             --业务负责人用户编号
        ,Upprc_Enty_Id                                 --上游实体编
        ,Lowrc_Enty_Id                                 --下游实体编号
        ,Main_Busi_Dept_Name                           --主业务部门名称
        ,Scd_Busi_Dept_Name                            --次业务部门名称
        ,Meta_Clas_Id                                  --元数据分类代码
        ,Safe_Lvl_Cd                                   --安全等级代码
        ,Meta_Lbl_Id                                   --元数据标签编号
        ,Meta_Estb_Time                                --元数据创建时间
        ,Src_Tbl                                       --源表
    FROM ${DB_TEMP}.T00_API_INFO_MID_BDP055 WHERE DATA_TYPE='S'  --插入无变化的数据
    UNION ALL
    SELECT
         Api_Id1                                      AS Api_Id                   --API编号
        ,Api_Meta_Id1                                 AS Api_Meta_Id              --API元数据编号
        ,Api_Init_Id1                                 AS Api_Init_Id              --API原始编号
        ,Api_Jnt_Id1                                  AS Api_Jnt_Id               --API联合编号
        ,Api_Meta_Stat1                               AS Api_Meta_Stat            --API元数据状态
        ,Api_Name1                                    AS Api_Name                 --API名称
        ,Api_Desc1                                    AS Api_Desc                 --API描述
        ,Api_Desc_Det1                                AS Api_Desc_Det             --API描述详情
        ,Api_Path1                                    AS Api_Path                 --API路径
        ,Api_Type1                                    AS Api_Type                 --API类型
        ,Http_Method1                                 AS Http_Method              --HTTP请求方式
        ,Resp_Form1                                   AS Resp_Form                --返回形式
        ,Resp_Cont_Type1                              AS Resp_Cont_Type           --返回内容类型
        ,Auth_Way1                                    AS Auth_Way                 --认证方式
        ,Sign_Algo1                                   AS Sign_Algo                --签名算法
        ,Sprt_Page_Flag1                              AS Sprt_Page_Flag           --分页标志
        ,Rtn_Tot_Line_Cnt_Flag1                       AS Rtn_Tot_Line_Cnt_Flag    --返回总条数标志
        ,Api_Grp_Id1                                  AS Api_Grp_Id               --API组编号
        ,Api_File_Id1                                 AS Api_File_Id              --API文件夹编号
        ,Ver_No1                                      AS Ver_No                   --版本号
        ,Serv_Lvl1                                    AS Serv_Lvl                 --服务级别
        ,Ver_Actv_Flag1                               AS Ver_Actv_Flag            --版本激活标志
        ,Appr_Stat1                                   AS Appr_Stat                --审核状态
        ,Pub_Flag1                                    AS Pub_Flag                 --发布标志
        ,Pub_User_Id1                                 AS Pub_User_Id              --发布用户编号
        ,Pub_Time1                                    AS Pub_Time                 --发布时间
        ,Open_Flag1                                   AS Open_Flag                --开放标志
        ,Ofc_Net_Logn_Flag1                           AS Ofc_Net_Logn_Flag        --办公网访问标志
        ,Open_Stat_Modif_User_Id1                     AS Open_Stat_Modif_User_Id  --开放状态修改用户编号
        ,Clos_Flag1                                   AS Clos_Flag                --销毁标志
        ,Api_7_Flag1                                  AS Api_7_Flag               --API7标志
        ,Clos_User_Id1                                AS Clos_User_Id             --销毁人用户编号
        ,Clos_Time1                                   AS Clos_Time                --销毁时间
        ,Visb_Stat1                                   AS Visb_Stat                --可见状态
        ,In_Charg_User_Id1                            AS In_Charg_User_Id         --授权负责人
        ,Api_Meta_Data_Src1                           AS Api_Meta_Data_Src        --API元数据来源
        ,Busi_Stat1                                   AS Busi_Stat                --业务状态
        ,Cls_Name1                                    AS Cls_Name                 --分类分级名称
        ,Sql_Deflt_Data_Src1                          AS Sql_Deflt_Data_Src       --SQL默认数据源
        ,Sql_Deflt_Schema1                            AS Sql_Deflt_Schema         --SQL默认schema
        ,Sql_Scrp1                                    AS Sql_Scrp                 --SQL语句
        ,Sql_Use_Db_Tbl1                              AS Sql_Use_Db_Tbl           --SQL使用库表
        ,Src_Data_Src_Cd1                             AS Src_Data_Src_Cd          --源数据来源代码
        ,'0'                                          AS Del_Flag                 --删除标志
        ,''                                           AS Del_Date                 --删除日期
        ,Data_Src_Cd1                                 AS Data_Src_Cd              --数据来源代码
        ,Task_Name1                                   AS Task_Name                --任务名
        ,Data_Etl_Date                                AS Data_Etl_Date            --数据加载日期
        ,Data_Upt_Date1                               AS Data_Upt_Date            --数据更新日期
        ,'${data_today}'                         AS Data_Time                --数据时间
        ,Real_Src_Tbl1                                AS Real_Src_Tbl             --真实源表
        ,Auth_Flag1                                   AS Auth_Flag                --认证标志
        ,Busi_Prin_User_Id1                           AS Busi_Prin_User_Id        --业务负责人用户编号
        ,Upprc_Enty_Id1                               AS Upprc_Enty_Id            --上游实体编
        ,Lowrc_Enty_Id1                               AS Lowrc_Enty_Id            --下游实体编号
        ,Main_Busi_Dept_Name1                         AS Main_Busi_Dept_Name      --主业务部门名称
        ,Scd_Busi_Dept_Name1                          AS Scd_Busi_Dept_Name       --次业务部门名称
        ,Meta_Clas_Id1                                AS Meta_Clas_Id             --元数据分类代码
        ,Safe_Lvl_Cd1                                 AS Safe_Lvl_Cd              --安全等级代码
        ,Meta_Lbl_Id1                                 AS Meta_Lbl_Id              --元数据标签编号
        ,Meta_Estb_Time1                              AS Meta_Estb_Time           --元数据创建时间
        ,Src_Tbl1                                     AS Src_Tbl                  --源表
    FROM ${DB_TEMP}.T00_API_INFO_MID_BDP055  WHERE DATA_TYPE='U'   --有变更的数据取变更的值
    UNION ALL
    SELECT
         Api_Id1                                      AS Api_Id                   --API编号
        ,Api_Meta_Id1                                 AS Api_Meta_Id              --API元数据编号
        ,Api_Init_Id1                                 AS Api_Init_Id              --API原始编号
        ,Api_Jnt_Id1                                  AS Api_Jnt_Id               --API联合编号
        ,Api_Meta_Stat1                               AS Api_Meta_Stat            --API元数据状态
        ,Api_Name1                                    AS Api_Name                 --API名称
        ,Api_Desc1                                    AS Api_Desc                 --API描述
        ,Api_Desc_Det1                                AS Api_Desc_Det             --API描述详情
        ,Api_Path1                                    AS Api_Path                 --API路径
        ,Api_Type1                                    AS Api_Type                 --API类型
        ,Http_Method1                                 AS Http_Method              --HTTP请求方式
        ,Resp_Form1                                   AS Resp_Form                --返回形式
        ,Resp_Cont_Type1                              AS Resp_Cont_Type           --返回内容类型
        ,Auth_Way1                                    AS Auth_Way                 --认证方式
        ,Sign_Algo1                                   AS Sign_Algo                --签名算法
        ,Sprt_Page_Flag1                              AS Sprt_Page_Flag           --分页标志
        ,Rtn_Tot_Line_Cnt_Flag1                       AS Rtn_Tot_Line_Cnt_Flag    --返回总条数标志
        ,Api_Grp_Id1                                  AS Api_Grp_Id               --API组编号
        ,Api_File_Id1                                 AS Api_File_Id              --API文件夹编号
        ,Ver_No1                                      AS Ver_No                   --版本号
        ,Serv_Lvl1                                    AS Serv_Lvl                 --服务级别
        ,Ver_Actv_Flag1                               AS Ver_Actv_Flag            --版本激活标志
        ,Appr_Stat1                                   AS Appr_Stat                --审核状态
        ,Pub_Flag1                                    AS Pub_Flag                 --发布标志
        ,Pub_User_Id1                                 AS Pub_User_Id              --发布用户编号
        ,Pub_Time1                                    AS Pub_Time                 --发布时间
        ,Open_Flag1                                   AS Open_Flag                --开放标志
        ,Ofc_Net_Logn_Flag1                           AS Ofc_Net_Logn_Flag        --办公网访问标志
        ,Open_Stat_Modif_User_Id1                     AS Open_Stat_Modif_User_Id  --开放状态修改用户编号
        ,Clos_Flag1                                   AS Clos_Flag                --销毁标志
        ,Api_7_Flag1                                  AS Api_7_Flag               --API7标志
        ,Clos_User_Id1                                AS Clos_User_Id             --销毁人用户编号
        ,Clos_Time1                                   AS Clos_Time                --销毁时间
        ,Visb_Stat1                                   AS Visb_Stat                --可见状态
        ,In_Charg_User_Id1                            AS In_Charg_User_Id         --授权负责人
        ,Api_Meta_Data_Src1                           AS Api_Meta_Data_Src        --API元数据来源
        ,Busi_Stat1                                   AS Busi_Stat                --业务状态
        ,Cls_Name1                                    AS Cls_Name                 --分类分级名称
        ,Sql_Deflt_Data_Src1                          AS Sql_Deflt_Data_Src       --SQL默认数据源
        ,Sql_Deflt_Schema1                            AS Sql_Deflt_Schema         --SQL默认schema
        ,Sql_Scrp1                                    AS Sql_Scrp                 --SQL语句
        ,Sql_Use_Db_Tbl1                              AS Sql_Use_Db_Tbl           --SQL使用库表
        ,Src_Data_Src_Cd1                             AS Src_Data_Src_Cd          --源数据来源代码
        ,'0'                                          AS Del_Flag                 --删除标志
        ,''                                           AS Del_Date                 --删除日期
        ,Data_Src_Cd1                                 As Data_Src_Cd              --数据来源代码
        ,Task_Name1                                   As Task_Name                --任务名
        ,Data_Etl_Date1                               As Data_Etl_Date            --数据加载日期
        ,Data_Upt_Date1                               AS Data_Upt_Date            --数据更新日期
        ,'${data_today}'                         AS Data_Time                --数据时间
        ,Real_Src_Tbl1                                AS Real_Src_Tbl             --真实源表
        ,Auth_Flag1                                   AS Auth_Flag                --认证标志
        ,Busi_Prin_User_Id1                           AS Busi_Prin_User_Id        --业务负责人用户编号
        ,Upprc_Enty_Id1                               AS Upprc_Enty_Id            --上游实体编
        ,Lowrc_Enty_Id1                               AS Lowrc_Enty_Id            --下游实体编号
        ,Main_Busi_Dept_Name1                         AS Main_Busi_Dept_Name      --主业务部门名称
        ,Scd_Busi_Dept_Name1                          AS Scd_Busi_Dept_Name       --次业务部门名称
        ,Meta_Clas_Id1                                AS Meta_Clas_Id             --元数据分类代码
        ,Safe_Lvl_Cd1                                 AS Safe_Lvl_Cd              --安全等级代码
        ,Meta_Lbl_Id1                                 AS Meta_Lbl_Id              --元数据标签编号
        ,Meta_Estb_Time1                              AS Meta_Estb_Time           --元数据创建时间
        ,Src_Tbl1                                     AS Src_Tbl                  --源表
    FROM ${DB_TEMP}.T00_API_INFO_MID_BDP055  WHERE DATA_TYPE='I'   --插入新增的数据
    UNION ALL
    SELECT
         Api_Id                                                  --API编号
        ,Api_Meta_Id                                             --API元数据编号
        ,Api_Init_Id                                             --API原始编号
        ,Api_Jnt_Id                                              --API联合编号
        ,Api_Meta_Stat                                           --API元数据状态
        ,Api_Name                                                --API名称
        ,Api_Desc                                                --API描述
        ,Api_Desc_Det                                            --API描述详情
        ,Api_Path                                                --API路径
        ,Api_Type                                                --API类型
        ,Http_Method                                             --HTTP请求方式
        ,Resp_Form                                               --返回形式
        ,Resp_Cont_Type                                          --返回内容类型
        ,Auth_Way                                                --认证方式
        ,Sign_Algo                                               --签名算法
        ,Sprt_Page_Flag                                          --分页标志
        ,Rtn_Tot_Line_Cnt_Flag                                   --返回总条数标志
        ,Api_Grp_Id                                              --API组编号
        ,Api_File_Id                                             --API文件夹编号
        ,Ver_No                                                  --版本号
        ,Serv_Lvl                                                --服务级别
        ,Ver_Actv_Flag                                           --版本激活标志
        ,Appr_Stat                                               --审核状态
        ,Pub_Flag                                                --发布标志
        ,Pub_User_Id                                             --发布用户编号
        ,Pub_Time                                                --发布时间
        ,Open_Flag                                               --开放标志
        ,Ofc_Net_Logn_Flag                                       --办公网访问标志
        ,Open_Stat_Modif_User_Id                                 --开放状态修改用户编号
        ,Clos_Flag                                               --销毁标志
        ,Api_7_Flag                                              --API7标志
        ,Clos_User_Id                                            --销毁人用户编号
        ,Clos_Time                                               --销毁时间
        ,Visb_Stat                                               --可见状态
        ,In_Charg_User_Id                                        --授权负责人
        ,Api_Meta_Data_Src                                       --API元数据来源
        ,Busi_Stat                                               --业务状态
        ,Cls_Name                                                --分类分级名称
        ,Sql_Deflt_Data_Src                                      --SQL默认数据源
        ,Sql_Deflt_Schema                                        --SQL默认schema
        ,Sql_Scrp                                                --SQL语句
        ,Sql_Use_Db_Tbl                                          --SQL使用库表
        ,Src_Data_Src_Cd                                         --源数据来源代码
        ,'1'                              AS Del_Flag            --删除标志
        ,CASE WHEN Del_Date !=''
                THEN Del_Date
              ELSE '${data_day_str}'
              END                         AS Del_Date            --删除日期
         ,Data_Src_Cd                                            --数据来源代码
         ,Task_Name                                              --任务名
         ,Data_Etl_Date                                          --数据加载日期
         ,CASE WHEN Del_Date !=''
               THEN Data_Upt_Date
               ELSE '${data_day_str}'
              END                         AS Data_Upt_Date       --数据更新日期
        ,CASE WHEN Del_Date !=''
                THEN Data_Time
              ELSE '${data_today}'
              END                         AS Data_Time           --数据时间
        ,Real_Src_Tbl                                            --真实源表
        ,Auth_Flag                                               --认证标志
        ,Busi_Prin_User_Id                                       --业务负责人用户编号
        ,Upprc_Enty_Id                                           --上游实体编
        ,Lowrc_Enty_Id                                           --下游实体编号
        ,Main_Busi_Dept_Name                                     --主业务部门名称
        ,Scd_Busi_Dept_Name                                      --次业务部门名称
        ,Meta_Clas_Id                                            --元数据分类代码
        ,Safe_Lvl_Cd                                             --安全等级代码
        ,Meta_Lbl_Id                                             --元数据标签编号
        ,Meta_Estb_Time                                          --元数据创建时间
        ,Src_Tbl                                                 --源表
    FROM ${DB_TEMP}.T00_API_INFO_MID_BDP055 WHERE DATA_TYPE='D'  --插入删除的数据
    ;

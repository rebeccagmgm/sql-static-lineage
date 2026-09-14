-- task_id: 37439
-- hiveDb: PDATA_N
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-GF_FDM_N/SUM/PDATA_N.T98_ORG_INR_ORG_BASE_INFO.py
-- observed_at: 2026-09-05T01:06:11.794Z

-- createSql
CREATE TABLE IF NOT EXISTS T98_ORG_INR_ORG_BASE_INFO(
      Inr_Org_Id                STRING COMMENT '内部机构编号'
     ,Inr_Org_Shor_Name         STRING COMMENT '内部机构简称'
     ,Inr_Org_Full_Name         STRING COMMENT '内部机构全称'
     ,Inr_Org_Cate_Cd           STRING COMMENT '内部机构类别代码'
     ,Inr_Org_Type_Cd           STRING COMMENT '内部机构类型代码'
     ,Inr_Org_Stat_Cd           STRING COMMENT '内部机构状态代码'
     ,Setp_Date                 STRING COMMENT '成立日期'
     ,Canc_Date                 STRING COMMENT '注销日期'
     ,Loc_Cd                    STRING COMMENT '区域代码'
     ,Prov_Cd                   STRING COMMENT '省份代码'
     ,City_Cd                   STRING COMMENT '市代码'
     ,Addr_Det_Info             STRING COMMENT '地址详细信息'
     ,Zip_Cd                    STRING COMMENT '邮政编码'
     ,Lkman                     STRING COMMENT '联系人'
     ,Cont_No                   STRING COMMENT '联系电话'
     ,Cont_Addr                 STRING COMMENT '联系地址'
     ,Upper_Inr_Org_Id          STRING COMMENT '上级内部机构编号'
     ,Upper_Org_Full_Name       STRING COMMENT '上级内部机构全称'
     ,Brch_Bel_Div_Org_ID       STRING COMMENT '营业部所属分公司编号'
     ,Brch_Bel_Div_Org_Name     STRING COMMENT '营业部所属分公司名称'
     ,Co_Seg                    STRING COMMENT '公司段'
     ,Dept_Seg                  STRING COMMENT '部门段'
     ,Loc_Cate                  STRING COMMENT '机构区域分类'
     ,Busi_Grp_Id               STRING COMMENT '业务组编号'
     ,Busi_Grp_Name             STRING COMMENT '业务组名称'
     ,Busi_Enty_Id              STRING COMMENT '业务实体编号'
     ,Busi_Enty_Name            STRING COMMENT '业务实体名称'
     ,Ast_Book                  STRING COMMENT '资产账簿'
     ,Trdr_No                   STRING COMMENT '券商编号'
     ,Csrc_No                   STRING COMMENT '证监局编号'
     ,Sys_Node_No               STRING COMMENT '系统节点编号'
     ,Brch_Kind_Cd              STRING COMMENT '分支机构种类代码'
     ,Data_Time                 STRING COMMENT '数据时间'
     ,Lgtd                      STRING COMMENT '经度'
     ,Lat                       STRING COMMENT '纬度'
     ,Dept_Prin_Emp_Id          STRING COMMENT '部门负责人员工编号(发薪)'
     ,Dept_Prin_Emp_Name        STRING COMMENT '部门负责人员工名称(发薪)'
     ,Erp_Org_Cd                STRING COMMENT 'ERP机构号'
     ,Upper_Erp_Org_Cd          STRING COMMENT '上级ERP机构号'
     ,Inr_Org_Full_Path         STRING COMMENT '内部机构全路径'
     ,Inr_Org_Full_Path_Name    STRING COMMENT '内部机构全路径全称'
     ,Foml_Dept_Prin_Emp_Id     STRING COMMENT '部门负责人员工编号(发文)'
     ,Foml_Dept_Prin_Emp_Name   STRING COMMENT '部门负责人员工名称(发文)'
     ,Cmpl_Emp_Id               STRING COMMENT '合规岗员工编号'
     ,Cmpl_Emp_Name             STRING COMMENT '合规岗员工名称'
     ,Aml_Emp_Id                STRING COMMENT '反洗钱岗员工编号'
     ,Aml_Emp_Name              STRING COMMENT '反洗钱岗员工名称'
     ,One_Dept_Inr_Org_Id       STRING COMMENT '一级部门内部机构编号'
     ,One_Dept_Inr_Org_Name     STRING COMMENT '一级部门内部机构名称'
     ,Inr_Org_Cate_Desc         STRING COMMENT '内部机构类别描述'
     ,Inr_Org_Type_Desc         STRING COMMENT '内部机构类型描述'
     ,Inr_Org_Stat_Desc         STRING COMMENT '内部机构状态描述'
     ,One_Org_Flag              STRING COMMENT '一级机构标志'
     ,Erp_Dept_Type_Cd          STRING COMMENT 'ERP部门类型代码'
     ,Erp_Dept_Type_Desc        STRING COMMENT 'ERP部门类型描述'
)
COMMENT 'T98_内部机构基本信息'
PARTITIONED BY (BUSI_DATE  STRING COMMENT '业务日期')
STORED AS ORC;

-- querySql
INSERT OVERWRITE TABLE T98_ORG_INR_ORG_BASE_INFO PARTITION(BUSI_DATE)
SELECT
       A.Inr_Org_Id                       AS Inr_Org_Id                  --内部机构编号
      ,B.Inr_Org_Shor_Name                AS Inr_Org_Shor_Name           --内部机构简称
      ,B.Inr_Org_Full_Name                AS Inr_Org_Full_Name           --内部机构全称
      ,A.Inr_Org_Cate_Cd                  AS Inr_Org_Cate_Cd             --内部机构类别代码
      ,A.Inr_Org_Type_Cd                  AS Inr_Org_Type_Cd             --内部机构类型代码
      ,c.Inr_Org_Stat_Cd                  AS Inr_Org_Stat_Cd             --内部机构状态代码
      ,IF(A.Setp_Date='0','',A.Setp_DatE) AS Setp_Date                   --成立日期
      ,IF(A.Canc_Date='0','',A.Canc_Date) AS Canc_Date                   --注销日期
      ,D.Area_Cd                          AS Loc_Cd                      --区域代码
      ,D.Prov_Cd                          AS Prov_Cd                     --省份代码
      ,D.City_Cd                          AS City_Cd                     --市代码
      ,D.Addr_Det_Info                    AS Addr_Det_Info               --地址详细信息
      ,D.Zip_Cd                           AS Zip_Cd                      --邮政编码
      ,E.Lkman                            AS Lkman                       --联系人
      ,E.Cont_No                          AS Cont_No                     --联系电话
      ,E.Cont_Addr                        AS Cont_Addr                   --联系地址
      ,F.Upper_Inr_Org_Id                 AS Upper_Inr_Org_Id            --上级内部机构编号
      ,F.Upper_Org_Full_Name              AS Upper_Org_Full_Name         --上级内部机构全称
      ,F.Brch_Bel_Div_Org_ID              AS Brch_Bel_Div_Org_ID         --营业部所属分公司编号
      ,F.Brch_Bel_Div_Org_Name            AS Brch_Bel_Div_Org_Name       --营业部所属分公司名称
      ,G.Co_Seg                           AS Co_Seg                      --公司段
      ,G.Dept_Seg                         AS Dept_Seg                    --部门段
      ,G.Loc_Cate                         AS Loc_Cate                    --机构区域分类
      ,G.Busi_Grp_Id                      AS Busi_Grp_Id                 --业务组编号
      ,G.Busi_Grp_Name                    AS Busi_Grp_Name               --业务组名称
      ,G.Busi_Enty_Id                     AS Busi_Enty_Id                --业务实体编号
      ,G.Busi_Enty_Name                   AS Busi_Enty_Name              --业务实体名称
      ,G.Ast_Book                         AS Ast_Book                    --资产账簿
      ,H.Trdr_No                          AS Trdr_No                     --券商编号
      ,H.Csrc_No                          AS Csrc_No                     --证监局编号
      ,H.Sys_Node_No                      AS Sys_Node_No                 --系统节点编号
      ,H.Brch_Kind_Cd                     AS Brch_Kind_Cd                --分支机构种类代码
      ,'${data_today}'               AS Data_Time                   --数据时间
      ,D.Lgtd                             AS Lgtd                        --经度
      ,D.Lat                              AS lAT                         --纬度
      ,NVL(FX.EMP_ID,ERPBMFZR.EMP_ID)     AS Dept_Prin_Emp_Id            --部门负责人员工编号(发薪)
      ,NVL(FXn.EMP_NAME,ERPBMFZR.EMP_NAME)   AS Dept_Prin_Emp_Name          --部门负责人员工名称(发薪)
      ,G.Org_Cd                           AS Erp_Org_Cd                  --ERP机构号
      ,L.Org_Cd                           AS Upper_Erp_Org_Cd            --上级ERP机构号
     ,CASE WHEN A.data_src_cd='OAS' THEN N.Dept_Cd 
      ELSE M.ORG_HRCH_ID end              AS Inr_Org_Full_Path             --内部机构全路径
     ,CASE WHEN A.data_src_cd='OAS' THEN N.Inr_Org_Full_Path_Name 
      ELSE M.ORG_HRCH_NAME end            AS Inr_Org_Full_Path_Name      --内部机构全路径全称
     ,fw.EMP_ID                           AS Foml_Dept_Prin_Emp_Id       --部门负责人员工编号(发文)
     ,fwn.EMP_NAME                        AS Foml_Dept_Prin_Emp_Name     --部门负责人员工名称(发文)
     ,HG.EMP_ID                           AS Cmpl_Emp_Id                 --合规岗员工编号
     ,HG.EMP_NAME                        AS Cmpl_Emp_Name               --合规岗员工名称
     ,FXQ.EMP_ID                          AS Aml_Emp_Id                  --反洗钱岗员工编号
     ,FXQ.EMP_NAME                       AS Aml_Emp_Name                --反洗钱岗员工名称
     ,F.One_Dept                          AS One_Dept_Inr_Org_Id         --一级部门内部机构编号
     ,F.One_Dept_Name                     AS One_Dept_Inr_Org_Name       --一级部门内部机构名称 
     ,H1.DW_CD_VAL_DESC                   AS Inr_Org_Cate_Desc           --内部机构类别描述
     ,H2.DW_CD_VAL_DESC                   AS Inr_Org_Type_Desc           --内部机构类型描述
     ,H3.DW_CD_VAL_DESC                   AS Inr_Org_Stat_Desc           --内部机构状态描述
     ,G1.One_Org_Flag                      AS One_Org_Flag                --一级机构标志
     ,''                                   AS Erp_Dept_Type_Cd            --ERP部门类型代码
     ,''                                   AS Erp_Dept_Type_Desc          --ERP部门类型描述
     ,'${data_day_str}'              AS Busi_Date                   --业务日期
from (SELECT Inr_Org_Id,Inr_Org_Cate_Cd,Inr_Org_Type_Cd,Setp_Date,Canc_Date,data_src_cd FROM PDATA_N.T04_INR_ORG WHERE DEL_FLAG='0' AND SRC_TBL IN ('ODATA_N_FMS.K_BD_DEPTDOC'
                                                                          ,'ODATA_N_ERP.A_FND_FLEX_VALUES_VL'
                                                                          ,'ODATA_N_RCC.U_ALLBRANCH'
                                                                          ,'ODATA_N_OAS.P_GF_DEPARTMENT'
                                                                          ,'ODATA_N_LIA.W_TBL_ORGANIZATION'
                                                                          ,'ODATA_N_LPS.P_SYS_SETTLE_DEPT'
                                                                          ,'ODATA_N_FCT.A_V_T_DEPARTMENT'
                                                                          ,'ODATA_N_ERP.A_GF_ORGANIZATION_UNITS_V'
                                                                          )
                      )A

LEFT JOIN (SELECT Inr_Org_Id,Inr_Org_Shor_Name,Inr_Org_Full_Name FROM PDATA_N.T04_INR_ORG_NAME_H WHERE STRT_DATE<='${data_day_str}' AND END_DATE >'${data_day_str}'
          AND SRC_TBL NOT IN ('ODATA_N_ERP.A_GF_ORGANIZATION_UNITS_V' ,'ODATA_ERP.ERP_H_HR_ALL_ORGANIZATION_UNITS')
          union all  
          SELECT Inr_Org_Id,Inr_Org_Shor_Name,Inr_Org_Full_Name FROM (SELECT *,ROW_NUMBER() OVER(PARTITION BY INR_ORG_ID ORDER BY end_date desc) AS n FROM PDATA_N.T04_INR_ORG_NAME_H WHERE SRC_TBL ='ODATA_N_ERP.A_GF_ORGANIZATION_UNITS_V' )A WHERE N=1           
)B
ON         A.Inr_Org_Id   =B.Inr_Org_Id

LEFT JOIN (SELECT Inr_Org_Id,Inr_Org_Stat_Cd FROM PDATA_N.T04_INR_ORG_STAT_H WHERE STRT_DATE<='${data_day_str}' AND END_DATE >'${data_day_str}' 
)C
ON         A.Inr_Org_Id   =C.Inr_Org_Id

LEFT JOIN (SELECT * FROM PDATA_N.T04_INR_ORG_PHYS_ADDR_H WHERE STRT_DATE<='${data_day_str}' AND END_DATE >'${data_day_str}' ) D
ON         A.Inr_Org_Id   =D.Inr_Org_Id

LEFT JOIN (SELECT * FROM PDATA_N.T04_INR_ORG_CONT_INFO_H WHERE STRT_DATE<='${data_day_str}' AND END_DATE >'${data_day_str}' AND  SRC_TBL='ODATA_N_RCC.U_ALLBRANCH' ) E
ON         A.Inr_Org_Id   =E.Inr_Org_Id


LEFT JOIN (SELECT T1.Inr_Org_Id
                 ,MAX(CASE WHEN T1.Inr_Org_Rela_Type_Cd='10' THEN T1.Rela_Inr_Org_Id    ELSE '' END ) AS Upper_Inr_Org_Id        --上级内部机构编号
                 ,MAX(CASE WHEN T1.Inr_Org_Rela_Type_Cd='10' THEN T2.Inr_Org_Full_Name  ELSE '' END ) AS Upper_Org_Full_Name     --上级内部机构全称
                 ,MAX(CASE WHEN T1.Inr_Org_Rela_Type_Cd='18' THEN T1.Rela_Inr_Org_Id    ELSE '' END ) AS One_Dept          --一级内部机构编号
                 ,MAX(CASE WHEN T1.Inr_Org_Rela_Type_Cd='18' THEN T2.Inr_Org_Full_Name  ELSE '' END ) AS One_Dept_Name     --一级内部机构全称
                 ,MAX(CASE WHEN T3.INR_ORG_TYPE_CD= '104' AND T1.Inr_Org_Rela_Type_Cd='10'  THEN T1.Rela_Inr_Org_Id  --柜台营业部直接取分公司
                               WHEN T1.Inr_Org_Rela_Type_Cd='14' THEN T1.Rela_Inr_Org_Id     --其他取营业部分公司所属关系
                                 ELSE '' END ) AS Brch_Bel_Div_Org_ID     --营业部所属分公司编号  
                 ,MAX(CASE WHEN T3.INR_ORG_TYPE_CD= '104' AND T1.Inr_Org_Rela_Type_Cd='10'  THEN T2.Inr_Org_Full_Name  ----柜台营业部直接取分公司
                               WHEN T1.Inr_Org_Rela_Type_Cd='14' THEN T2.Inr_Org_Full_Name  ELSE '' END ) AS Brch_Bel_Div_Org_Name   --其他取营业部分公司所属关系
           FROM (SELECT Inr_Org_Id,Inr_Org_Rela_Type_Cd,Rela_Inr_Org_Id,STRT_DATE,END_DATE FROM PDATA_N.T04_INR_ORG_RELA_H WHERE SRC_TBL NOT IN ('ODATA_N_ERP.A_GF_ORGANIZATION_UNITS_V','ODATA_N_ERP.A_GF_ORG_LEVEL_NOW' )and STRT_DATE<='${data_day_str}' AND END_DATE >'${data_day_str}'
                 UNION ALL
                 SELECT Inr_Org_Id,Inr_Org_Rela_Type_Cd,Rela_Inr_Org_Id,STRT_DATE,END_DATE FROM (SELECT * ,ROW_NUMBER() OVER(PARTITION BY INR_ORG_ID,Inr_Org_Rela_Type_Cd ORDER BY end_date desc) AS n from PDATA_N.T04_INR_ORG_RELA_H
                 WHERE SRC_TBL IN ('ODATA_N_ERP.A_GF_ORGANIZATION_UNITS_V','ODATA_N_ERP.A_GF_ORG_LEVEL_NOW','ODATA_N_PAS.J_HSSORG_ORG_VER' ) AND  STRT_DATE<='${data_day_str}' )a where n=1
           )T1
           LEFT JOIN (SELECT Inr_Org_Id,Inr_Org_Shor_Name,Inr_Org_Full_Name FROM PDATA_N.T04_INR_ORG_NAME_H WHERE STRT_DATE<='${data_day_str}' AND END_DATE >'${data_day_str}'
                      AND SRC_TBL NOT IN ('ODATA_N_ERP.A_GF_ORGANIZATION_UNITS_V','ODATA_ERP.ERP_H_HR_ALL_ORGANIZATION_UNITS')
                      union all  
                       SELECT Inr_Org_Id,Inr_Org_Shor_Name,Inr_Org_Full_Name FROM (SELECT *,ROW_NUMBER() OVER(PARTITION BY INR_ORG_ID ORDER BY end_date desc) AS n FROM PDATA_N.T04_INR_ORG_NAME_H WHERE SRC_TBL ='ODATA_N_ERP.A_GF_ORGANIZATION_UNITS_V' )A WHERE N=1

           )T2
           ON  T1.Rela_Inr_Org_Id=T2.Inr_Org_Id
           LEFT JOIN  PDATA_N.T04_INR_ORG T3
             ON T1.Inr_Org_Id=T3.Inr_Org_Id
           
           GROUP BY T1.Inr_Org_Id
           ) F
ON         A.Inr_Org_Id   =F.Inr_Org_Id

LEFT JOIN  PDATA_N.T04_ERP_INR_ORG  G
ON         A.Inr_Org_Id   =G.Inr_Org_Id

LEFT JOIN  (SELECT * FROM PDATA_N.T04_ERP_INR_ORG WHERE SRC_TBL = 'ODATA_N_ERP.A_GF_ORGANIZATION_UNITS_V') G1
ON         A.Inr_Org_Id   =G1.Inr_Org_Id

LEFT JOIN PDATA_N.T04_RCC_INR_ORG H
ON         A.Inr_Org_Id   =H.Inr_Org_Id

LEFT JOIN (SELECT INR_ORG_ID,USER_ID   --一个部门会有多个负责人的情况，取其中一条记录
             FROM (SELECT  INR_ORG_ID,MAX(USER_ID) AS USER_ID
                    FROM PDATA_N.T04_USER_ROLE_DEPT 
                   WHERE BUSI_DATE='${data_day_str}'
                     AND ROLE_ID='IOA001-29'  --角色：部门负责人
                   GROUP BY INR_ORG_ID  --柜台营业部
                   UNION ALL
                   SELECT  SRC_DEPT_ID AS INR_ORG_ID,MAX(USER_ID) AS USER_ID
                    FROM PDATA_N.T04_USER_ROLE_DEPT   
                   WHERE BUSI_DATE='${data_day_str}'
                     AND ROLE_ID='IOA001-29'  --角色：部门负责人
                   GROUP BY SRC_DEPT_ID  --OA组部门数据
          )I )fff 
ON          A.Inr_Org_Id   =fff.Inr_Org_Id
LEFT JOIN (SELECT USER_ID,EMP_ID
             FROM PDATA_N.T04_USER_EMP_RELA_H 
            WHERE DEL_FLAG='0'
              AND USER_EMP_RELA_TYPE_CD='10'
               )fx  --发薪部门负责人暂时引用旧逻辑
ON          fff.USER_ID   =fx.USER_ID


LEFT JOIN (SELECT EMP_ID,EMP_NAME
             FROM PDATA_N.T04_EMP   
               )fxn
ON          fx.EMP_ID   =fxn.EMP_ID

LEFT JOIN  PDATA_N.T04_ERP_INR_ORG  L
ON         F.Upper_Inr_Org_Id   =L.Inr_Org_Id

LEFT JOIN  (SELECT A.Inr_Org_Id
                  ,concat_ws('>',inr_org_id_lvl1,inr_org_id_lvl2,inr_org_id_lvl3,inr_org_id_lvl4,inr_org_id_lvl5,inr_org_id_lvl6,inr_org_id_lvl7,A.inr_org_id)  AS ORG_HRCH_ID
                  ,concat_ws('>',Inr_Org_Name_Lvl1,Inr_Org_Name_Lvl2,Inr_Org_Name_Lvl3,Inr_Org_Name_Lvl4,Inr_Org_Name_Lvl5,Inr_Org_Name_Lvl6,Inr_Org_Name_Lvl7,A.Inr_Org_Name) ORG_HRCH_NAME
                FROM (SELECT * FROM PDATA_N.T04_INR_ORG_HRCH_RELA WHERE   DATA_SRC_CD='PAS'  )A
                )  M
ON         A.Inr_Org_Id   =M.Inr_Org_Id

LEFT JOIN (SELECT * FROM PDATA_N.T04_OAS_INR_ORG WHERE DEL_FLAG='0' AND SRC_TBL='ODATA_N_OAS.P_GF_DEPARTMENT')N
ON         A.Inr_Org_Id   =N.Inr_Org_Id

LEFT JOIN (SELECT * FROM(SELECT * ,ROW_NUMBER() OVER(PARTITION BY INR_ORG_ID ORDER BY end_date desc) AS n 
          FROM PDATA_N.T04_EMP_INR_ORG_RELA_H WHERE  Emp_Inr_Org_Rela_Type_Cd='17')a where n=1 )fw --部门负责人发文
ON         A.Inr_Org_Id   =fw.Inr_Org_Id


LEFT JOIN (SELECT EMP_ID,EMP_NAME
             FROM PDATA_N.T04_EMP   
               )fwn
ON          fw.EMP_ID   =fwn.EMP_ID

LEFT JOIN (SELECT inr_org_id,CONCAT_WS(',',COLLECT_SET(A.emp_id)) AS EMP_ID,CONCAT_WS(',',COLLECT_SET(B.EMP_NAME)) AS EMP_NAME 
            FROM (SELECT * FROM PDATA_N.T04_EMP_INR_ORG_RELA_H
                     WHERE STRT_DATE<='${data_day_str}' AND END_DATE >'${data_day_str}' and Emp_Inr_Org_Rela_Type_Cd='18')A
            LEFT JOIN (SELECT EMP_ID,EMP_NAME FROM PDATA_N.T04_EMP     )B
            ON    A.EMP_ID   =B.EMP_ID
            GROUP BY inr_org_id
)HG --合规岗
ON         A.Inr_Org_Id   =hg.Inr_Org_Id


LEFT JOIN (SELECT inr_org_id,CONCAT_WS(',',COLLECT_SET(A.emp_id)) AS EMP_ID,CONCAT_WS(',',COLLECT_SET(B.EMP_NAME)) AS EMP_NAME 
            FROM (SELECT * FROM PDATA_N.T04_EMP_INR_ORG_RELA_H 
                     WHERE STRT_DATE<='${data_day_str}' AND END_DATE >'${data_day_str}' and Emp_Inr_Org_Rela_Type_Cd='19')A --反洗钱岗
            LEFT JOIN (SELECT EMP_ID,EMP_NAME FROM PDATA_N.T04_EMP     )B
            ON    A.EMP_ID   =B.EMP_ID
            GROUP BY inr_org_id
)FXQ--反洗钱岗
ON         A.Inr_Org_Id   =fxq.Inr_Org_Id

LEFT JOIN (
               SELECT  A.INR_ORG_ID,A.EMP_ID,B.EMP_NAME FROM   (SELECT INR_ORG_ID,max(Emp_Id) Emp_Id FROM PDATA_N.T04_EMP_INR_ORG_RELA_H
                   WHERE Emp_Inr_Org_Rela_Type_Cd='15' 
                   AND Strt_Date <='${data_day_str}' 
                   AND End_Date >'${data_day_str}'  --erp组部门数据
                   group by INR_ORG_ID
                   )a
                LEFT JOIN PDATA_N.T04_EMP B 
                ON A.Emp_Id=B.Emp_Id
          )ERPBMFZR
ON A.Inr_Org_Id   =ERPBMFZR.INR_ORG_ID
LEFT JOIN (SELECT * FROM PDATA_N.REF_DW_CD_VAL WHERE DW_CD_ID = 'CD014') H1
ON A.Inr_Org_Cate_Cd= H1.DW_CD_VAL
LEFT JOIN (SELECT * FROM PDATA_N.REF_DW_CD_VAL WHERE DW_CD_ID = 'CD015') H2
ON A.Inr_Org_Type_Cd= H2.DW_CD_VAL
LEFT JOIN (SELECT * FROM PDATA_N.REF_DW_CD_VAL WHERE DW_CD_ID = 'CD017') H3
ON C.Inr_Org_Stat_Cd= H3.DW_CD_VAL
;

-- task_id: 239503
-- hiveDb: pdata_n
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-GF_FDM_N/FIN/PDATA_N.T09_ACCTNT_SUBJ_FAC010.py
-- observed_at: 2026-09-05T01:07:30.355Z

-- createSql
CREATE TABLE IF NOT EXISTS T09_ACCTNT_SUBJ(
     Sob_Plan_Id                STRING COMMENT '账套方案编号'
    ,Subj_Id                    STRING COMMENT '科目编号'
    ,Subj_Name                  STRING COMMENT '科目名称'
    ,Subj_Lvl                   STRING COMMENT '科目层级'
    ,Upper_Subj_Id              STRING COMMENT '上级科目编号'
    ,Upper_Subj_Name            STRING COMMENT '上级科目名称'
    ,Crrc_Cd                    STRING COMMENT '币种'
    ,Subj_Type_Cd               STRING COMMENT '科目类型代码'
    ,Subj_Bal_Dir_Cd            STRING COMMENT '科目余额方向代码'
    ,Out_Subj_Flag              STRING COMMENT '表外科目标志'
    ,Ivst_Cls_Cd                STRING COMMENT '投资分类代码'
    ,Sub_Sob_Id                 STRING COMMENT '子账簿编号'
    ,Trd_Attr_Cd                STRING COMMENT '交易属性代码'
    ,Acctng_Proj                STRING COMMENT '核算项目'
    ,Fare_Cd                    STRING COMMENT '费用代码'
    ,Exch_Type_Cd               STRING COMMENT '市场代码'
    ,Scr_Cd                     STRING COMMENT '证券代码'
    ,Scr_Var                    STRING COMMENT '证券品种'
    ,Det_Flag                   STRING COMMENT '明细项标志'
    ,Acctng_Stru                STRING COMMENT '核算结构'
    ,Iss_Method_Cd              STRING COMMENT '发行方式代码'
    ,Acct_No                    STRING COMMENT '账户'
    ,Acct_Var                   STRING COMMENT '账户品种'
    ,Fare_Type_Cd               STRING COMMENT '费用类型代码'
    ,Sale_Method_Cd             STRING COMMENT '销售方式代码'
    ,Qty_Acctng_Ind             STRING COMMENT '数量核算标识'
    ,Use_Flag                   STRING COMMENT '使用标志'
    ,Desc_Info                  STRING COMMENT '描述信息'
    ,Subj_Appr_Stat_Cd          STRING COMMENT '科目审核状态代码'
    ,Assis_Acctng_Ind           STRING COMMENT '辅助核算标识'
    ,Data_Src_Cd                STRING COMMENT '数据来源代码'
    ,Task_Name                  STRING COMMENT '任务名'
    ,Data_Etl_Date              STRING COMMENT '数据加载日期'
    ,Data_Time                  STRING COMMENT '数据时间'
    ,End_Subj_Flag              STRING COMMENT '末级科目标志'
    ,End_Subj_No                STRING COMMENT '末级科目号'
    ,Real_Src_Tbl               STRING COMMENT '真实源表'
    ,Vld_Date                   STRING COMMENT '生效日期'
    ,Invld_Date                 STRING COMMENT '失效日期'
    ,Enable_Stat_Cd             STRING COMMENT '启用状态代码'
    ,Subj_Cash_Clas_Cd          STRING COMMENT '科目现金分类代码'
    ,Use_Desc                   STRING COMMENT '使用说明'
    ,Matn_Desc                  STRING COMMENT '维护备注'
    ,Req_Acct_Age_Date_Flag     STRING COMMENT '需要账龄日期标志'
    ,Sub_Sys_Ctrl_Subj_Flag     STRING COMMENT '子系统控制科目标志'
    ,Mth_End_Clos_Flag          STRING COMMENT '月末结平标志'
    ,Ast_Module_Ctrl_Subj_Flag  STRING COMMENT '资产模块控制科目标志'
    ,Inr_Crpd_Subj_Flag         STRING COMMENT '内部往来科目标志'
    ,Sob_Id                     STRING COMMENT '账套编号'
    ,Subj_Plan_Id               STRING COMMENT '科目方案编号'
    ,Subj_Full_Name             STRING COMMENT '科目全称'
    ,Acctnt_Type_Cd             STRING COMMENT '会计类型代码'
    ,Ldg_Elmn_Regu              STRING COMMENT '台账要素规则'
    ,Lvl_Regu                   STRING COMMENT '级次规则'
    ,Assis_Item_Regu            STRING COMMENT '辅助项规则'
    ,Inpt_Time                  STRING COMMENT '录入时间'
)COMMENT '会计科目'
PARTITIONED BY (SRC_TBL  STRING COMMENT'源表',BUSI_DATE  STRING COMMENT '业务日期')
STORED AS ORC;

-- querySql
INSERT OVERWRITE TABLE T09_ACCTNT_SUBJ PARTITION(SRC_TBL='${src_table}',BUSI_DATE='${data_day_str}')
-----------------------------------------------------------------------------------------------------
--Group12.: Source Table:[ODATA_N_FAC.P_BD_ACCOUNT:会计科目基本信息表] 
-----------------------------------------------------------------------------------------------------
SELECT
     ''                                                AS  Sob_Plan_Id             --账套方案编号     
    ,B.CODE                                            AS  Subj_Id                 --科目编号         
    ,A.NAME                                            AS  Subj_Name               --科目名称         
    ,B.ACCLEV                                          AS  Subj_Lvl                --科目层级         
    ,NVL(C.CODE ,'')                                   AS  Upper_Subj_Id           --上级科目编号     
    ,NVL(D.NAME ,'')                                   AS  Upper_Subj_Name         --上级科目名称     
    ,''                                                AS  Crrc_Cd                 --币种             
    ,NVL(E.DW_CD_VAL,B.PK_ACCTYPE )                    AS  Subj_Type_Cd            --科目类型代码     
    ,NVL(F.DW_CD_VAL,B.BALANORIENT)                    AS  Subj_Bal_Dir_Cd         --科目余额方向代码 
    ,''                                                AS  Out_Subj_Flag           --表外科目标志     
    ,''                                                AS  Ivst_Cls_Cd             --投资分类代码     
    ,''                                                AS  Sub_Sob_Id              --子账簿编号       
    ,''                                                AS  Trd_Attr_Cd             --交易属性代码     
    ,''                                                AS  Acctng_Proj             --核算项目         
    ,''                                                AS  Fare_Cd                 --费用代码         
    ,''                                                AS  Exch_Type_Cd            --市场代码         
    ,''                                                AS  Scr_Cd                  --证券代码         
    ,''                                                AS  Scr_Var                 --证券品种         
    ,''                                                AS  Det_Flag                --明细项标志       
    ,''                                                AS  Acctng_Stru             --核算结构         
    ,''                                                AS  Iss_Method_Cd           --发行方式代码     
    ,''                                                AS  Acct_No                 --账户             
    ,''                                                AS  Acct_Var                --账户品种         
    ,''                                                AS  Fare_Type_Cd            --费用类型代码     
    ,''                                                AS  Sale_Method_Cd          --销售方式代码     
    ,''                                                AS  Qty_Acctng_Ind          --数量核算标识     
    ,''                                                AS  Use_Flag                --使用标志         
    ,B.DEF26                                           AS  Desc_Info               --描述信息         
    ,''                                                AS  Subj_Appr_Stat_Cd       --科目审核状态代码 
    ,CASE WHEN B.DEF23= 'Y' THEN '1'
          WHEN B.DEF23= 'N' THEN '0'
          ELSE B.DEF23 END                             AS  Assis_Acctng_Ind        --辅助核算标识     
    ,'${data_src_cd}'                             AS  Data_Src_Cd             --数据来源代码
    ,'${filename}'                                AS  Task_Name               --任务名
    ,'${data_day_str}'                            AS  Data_Etl_Date           --数据加载日期
    ,'${data_today}'                              AS  Data_Time               --数据时间
    ,''                                                AS  End_Subj_Flag           --末级科目标志     
    ,''                                                AS  End_Subj_No             --末级科目号 
    ,'${src_table}'                               AS  Real_Src_Tbl              --真实源表
    ,SUBSTR(B.DEF24 ,1,10)                             AS  Vld_Date                  --生效日期
    ,SUBSTR(B.DEF25 ,1,10)                             AS  Invld_Date                --失效日期
    ,B.ENABLESTATE                                     AS  Enable_Stat_Cd            --启用状态代码
    ,B.CASHTYPE                                        AS  Subj_Cash_Clas_Cd         --科目现金分类代码
    ,B.DEF27                                           AS  Use_Desc                  --使用说明
    ,B.DEF28                                           AS  Matn_Desc                 --维护备注
    ,CASE WHEN B.DEF10= 'Y' THEN '1'
          WHEN B.DEF10= 'N' THEN '0'
          ELSE B.DEF10 END                             AS  Req_Acct_Age_Date_Flag    --需要账龄日期标志
    ,CASE WHEN B.DEF14= 'Y' THEN '1'
          WHEN B.DEF14= 'N' THEN '0'
          ELSE B.DEF14 END                             AS  Sub_Sys_Ctrl_Subj_Flag    --子系统控制科目标志
    ,CASE WHEN B.DEF17= 'Y' THEN '1'
          WHEN B.DEF17= 'N' THEN '0'
          ELSE B.DEF17 END                             AS  Mth_End_Clos_Flag         --月末结平标志
    ,CASE WHEN B.DEF20= 'Y' THEN '1'
          WHEN B.DEF20= 'N' THEN '0'
          ELSE B.DEF20 END                             AS  Ast_Module_Ctrl_Subj_Flag --资产模块控制科目标志
    ,CASE WHEN B.DEF22= 'Y' THEN '1'
          WHEN B.DEF22= 'N' THEN '0'
          ELSE B.DEF22 END                             AS  Inr_Crpd_Subj_Flag        --内部往来科目标志
    ,''                                                AS  Sob_Id                    --账套编号
    ,''                                                AS  Subj_Plan_Id              --科目方案编号
    ,''                                                AS  Subj_Full_Name            --科目全称
    ,''                                                AS  Acctnt_Type_Cd            --会计类型代码
    ,''                                                AS  Ldg_Elmn_Regu             --台账要素规则
    ,''                                                AS  Lvl_Regu                  --级次规则
    ,''                                                AS  Assis_Item_Regu           --辅助项规则
    ,''                                                AS  Inpt_Time                 --录入时间
FROM (SELECT * FROM ODATA_N_FAC.P_BD_ACCASOA WHERE BUSI_DATE = '${data_day_str}' AND DR='0' AND PK_ACCCHART='1001A11000000000055T') A --广发科目体系
JOIN (SELECT * FROM ODATA_N_FAC.P_BD_ACCOUNT WHERE BUSI_DATE = '${data_day_str}' AND DR='0') B
       ON A.PK_ACCOUNT = B.PK_ACCOUNT
LEFT JOIN (SELECT * FROM ODATA_N_FAC.P_BD_ACCOUNT WHERE BUSI_DATE = '${data_day_str}' AND DR ='0') C
       ON B.PID=C.PK_ACCOUNT
LEFT JOIN  (SELECT * FROM ODATA_N_FAC.P_BD_ACCASOA WHERE BUSI_DATE = '${data_day_str}' AND DR='0') D --广发科目体系
       ON C.PK_ACCOUNT = D.PK_ACCOUNT
LEFT JOIN (
         SELECT SRC_CD_VAL,DW_CD_VAL
           FROM PDATA_N.REF_CD_CVT_MAP
         WHERE TGT_TAB_NAME = 'T09_ACCTNT_SUBJ'
            AND TGT_TAB_FLD  = 'Subj_Type_Cd'
            AND SRC_TAB_NAME = 'BD_ACCOUNT'
            AND SRC_FLD_NAME = 'PK_ACCTYPE'
            AND SRC_SYS_NAME='FAC')E
   ON      B.PK_ACCTYPE =E.SRC_CD_VAL                  --PK_ACCTYPE 转码
LEFT JOIN (
         SELECT SRC_CD_VAL,DW_CD_VAL
           FROM PDATA_N.REF_CD_CVT_MAP
         WHERE TGT_TAB_NAME = 'T09_ACCTNT_SUBJ'
            AND TGT_TAB_FLD  = 'Subj_Bal_Dir_Cd'
            AND SRC_TAB_NAME = 'BD_ACCOUNT'
            AND SRC_FLD_NAME = 'BALANORIENT'
            AND SRC_SYS_NAME='FAC')F
   ON      B.BALANORIENT =F.SRC_CD_VAL                  --BALANORIENT 转码
;

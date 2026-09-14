-- task_id: 62913
-- hiveDb: pdata_n
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-GF_FDM_N/FIN/PDATA_N.T09_PMS_PROJ_INTVB_INFO_PMS010.py
-- observed_at: 2026-09-05T01:06:20.478Z

-- createSql
CREATE TABLE IF NOT EXISTS T09_PMS_PROJ_INTVB_INFO(
     Intvb_Proj_Id              STRING COMMENT '招标项目编号'
    ,Intvb_Comn_Cd              STRING COMMENT '招标项目字面编号'
    ,Proj_Name                  STRING COMMENT '项目名称'
    ,Purch_Method_Cd            STRING COMMENT '采购方式代码'
    ,Crrc_Cd                    STRING COMMENT '币种代码'
    ,Src_Crrc_Cd                STRING COMMENT '源币种代码'
    ,Purch_Bdgt_Amt             STRING COMMENT '采购预算金额'
    ,Ntce_Time                  STRING COMMENT '公告时间'
    ,Invtb_Cont                 STRING COMMENT '招标内容'
    ,Lkman_Emp_Name             STRING COMMENT '联系人'
    ,Lkman_Phone                STRING COMMENT '联系电话'
    ,Lkman_Ofc_Phone            STRING COMMENT '联系人办公电话'
    ,Fax                        STRING COMMENT '传真'
    ,Zip_Cd                     STRING COMMENT '邮政编码'
    ,Cont_Addr                  STRING COMMENT '联系地址'
    ,Invtb_File_Lnch_Time       STRING COMMENT '招标文件发布时间'
    ,Bid_Open_Time              STRING COMMENT '开标时间'
    ,Bid_Open_Addr              STRING COMMENT '开标地点'
    ,Evalb_Time                 STRING COMMENT '评标时间'
    ,Evalb_Addr                 STRING COMMENT '评标地点'
    ,Sale_Bid_Addr              STRING COMMENT '售标地点'
    ,Tndr_Stat_Time             STRING COMMENT '投标起始时间'
    ,Tndr_End_Time              STRING COMMENT '投标截止时间'
    ,Ntfc_Send_Time             STRING COMMENT '通知书发送时间'
    ,Dept_Org_Id                STRING COMMENT '部门编号'
    ,Unit_Org_Id                STRING COMMENT '单位编号'
    ,Qual_Appr_Stat_Cd          STRING COMMENT '资审状态代码'
    ,Org_Purch_Type_Cd          STRING COMMENT '组织采购类型代码'
    ,Proj_Src_Type_Cd           STRING COMMENT '项目来源类型代码'
    ,Proj_Create_Time           STRING COMMENT '项目创建时间'
    ,Proj_Exp_Time              STRING COMMENT '项目到期时间'
    ,Purch_Step_Cd              STRING COMMENT '采购步骤代码'
    ,Qstn_Rsol_Time             STRING COMMENT '答疑澄清时间'
    ,Own_Unit_Name              STRING COMMENT '业主单位名称'
    ,Adtnl_File_Id              STRING COMMENT '附件编号'
    ,Proj_Oper_Emp_Id           STRING COMMENT '项目经办员工编号'
    ,Proj_Oper_Oa_Id            STRING COMMENT '项目经办人OA编号'
    ,Purch_File_Appr_Stat_Cd    STRING COMMENT '采购文件审批状态代码'
    ,Two_Stg_Bid_Open_Flag      STRING COMMENT '两阶段开标标志'
    ,Pd_Tplt_Id                 STRING COMMENT '时效模板编号'
    ,Pd_Tplt_Name               STRING COMMENT '时效模板名称'
    ,Enrl_End_Time              STRING COMMENT '报名结束时间'
    ,Proj_Proc_Id               STRING COMMENT '项目流程编号'
    ,Lkman_Email                STRING COMMENT '联系人邮箱'
    ,Aprs_Flag                  STRING COMMENT '评价标志'
    ,Purch_Proj_Type_Cd         STRING COMMENT '采购项目类型代码'
    ,Scontr_Flag                STRING COMMENT '分包标志'
    ,Contr_Sign_Flag            STRING COMMENT '合同签订标志'
    ,Prnt_Intvb_Proj_Id         STRING COMMENT '父级招标项目编号'
    ,Invtb_Cond                 STRING COMMENT '招标条件'
    ,Proj_Desc                  STRING COMMENT '项目描述'
    ,Ec_Info_Flag               STRING COMMENT '需要商务信息标志'
    ,Purch_Appr_Stat_Cd         STRING COMMENT '采购审批状态代码'
    ,Purch_Org_Flag             STRING COMMENT '请购部门标志'
    ,Req_Inr_Org_Id             STRING COMMENT '需求部门机构编号'
    ,Purch_Inr_Org_Id           STRING COMMENT '请购部门机构编号'
    ,Bpm_Appr_Stat_Cd           STRING COMMENT 'BPM审批状态代码'
    ,Quot_File_Disp_Flag        STRING COMMENT '报价文件展示标志'
    ,Proj_Setp_Appr_Id          STRING COMMENT '项目立项审批编号'
    ,Data_Src_Cd                STRING COMMENT '数据来源代码'
    ,Task_Name                  STRING COMMENT '任务名'
    ,Data_Etl_Date              STRING COMMENT '数据加载日期'
    ,Data_Upt_Date              STRING COMMENT '数据更新日期'
    ,Data_Time                  STRING COMMENT '数据时间'
    ,Real_Src_Tbl               STRING COMMENT '真实源表'
    ,Cent_Purch_Flag            STRING COMMENT '集采标志'
)COMMENT '采购招标项目信息'
PARTITIONED BY (SRC_TBL  STRING COMMENT'源表',BUSI_DATE  STRING COMMENT '业务日期')
STORED AS ORC;

-- querySql
INSERT OVERWRITE TABLE T09_PMS_PROJ_INTVB_INFO PARTITION(SRC_TBL='${src_table}',BUSI_DATE='${data_day_str}')
-----------------------------------------------------------------------------------------------------
--Group1.: Source Table:[ODATA_N_PMS.G_XM_ZBXM:招标项目] 
-----------------------------------------------------------------------------------------------------
SELECT
     CONCAT('PMS010-',ID)                              AS  Intvb_Proj_Id           --招标项目编号
    ,ZBBH                                              AS  Intvb_Comn_Cd           --招标项目字面编号
    ,XMMC                                              AS  Proj_Name               --项目名称
    ,CGFS                                              AS  Purch_Method_Cd         --采购方式代码
    ,'CNY'                                             AS  Crrc_Cd                 --币种代码
    ,BZ                                                AS  Src_Crrc_Cd             --源币种代码
    ,CGYS                                              AS  Purch_Bdgt_Amt          --采购预算金额
    ,from_unixtime(unix_timestamp(GGRQ,'yyyyMMddHHmmss'),'yyyy-MM-dd HH:mm:ss')
                                                       AS  Ntce_Time               --公告时间
    ,ZBNR                                              AS  Invtb_Cont              --招标内容
    ,LXR                                               AS  Lkman_Emp_Name          --联系人
    ,LXDH                                              AS  Lkman_Phone             --联系电话
    ,GDDH                                              AS  Lkman_Ofc_Phone         --联系人办公电话
    ,CZ                                                AS  Fax                     --传真
    ,YZBM                                              AS  Zip_Cd                  --邮政编码
    ,LXDZ                                              AS  Cont_Addr               --联系地址
    ,from_unixtime(unix_timestamp(FBSJ,'yyyyMMddHHmm'),'yyyy-MM-dd HH:mm')
                                                       AS  Invtb_File_Lnch_Time    --招标文件发布时间
    ,from_unixtime(unix_timestamp(KBSJ,'yyyyMMddHHmm'),'yyyy-MM-dd HH:mm')
                                                       AS  Bid_Open_Time           --开标时间
    ,KBDD                                              AS  Bid_Open_Addr           --开标地点
    ,from_unixtime(unix_timestamp(PBSJ,'yyyyMMddHHmm'),'yyyy-MM-dd HH:mm')
                                                       AS  Evalb_Time              --评标时间
    ,PBDD                                              AS  Evalb_Addr              --评标地点
    ,SBDD                                              AS  Sale_Bid_Addr           --售标地点
    ,DJKSSJ                                            AS  Tndr_Stat_Time          --投标起始时间
    ,from_unixtime(unix_timestamp(DJJSSJ,'yyyyMMddHHmm'),'yyyy-MM-dd HH:mm')
                                                       AS  Tndr_End_Time           --投标截止时间
    ,TZSSJ                                             AS  Ntfc_Send_Time          --通知书发送时间
    ,BMBH                                              AS  Dept_Org_Id             --部门编号
    ,DWBH                                              AS  Unit_Org_Id             --单位编号
    ,SFZGYS                                            AS  Qual_Appr_Stat_Cd       --资审状态代码
    ,ZZXS                                              AS  Org_Purch_Type_Cd       --组织采购类型代码
    ,XMLY                                              AS  Proj_Src_Type_Cd        --项目来源类型代码
    ,from_unixtime(unix_timestamp(CJSJ,'yyyyMMddHHmmss'),'yyyy-MM-dd HH:mm:ss')
                                                       AS  Proj_Create_Time        --项目创建时间
    ,from_unixtime(unix_timestamp(JSSJ,'yyyyMMddHHmmss'),'yyyy-MM-dd HH:mm:ss')
                                                       AS  Proj_Exp_Time           --项目到期时间
    ,SYBZ                                              AS  Purch_Step_Cd           --采购步骤代码
    ,from_unixtime(unix_timestamp(DYCQSJ,'yyyyMMddHHmm'),'yyyy-MM-dd HH:mm')
                                                       AS  Qstn_Rsol_Time          --答疑澄清时间
    ,YZDWMC                                            AS  Own_Unit_Name           --业主单位名称
    ,FJ                                                AS  Adtnl_File_Id           --附件编号
    ,B.ERP_ID                                           AS  Proj_Oper_Emp_Id        --项目经办员工编号
    ,XMJBR                                             AS  Proj_Oper_Oa_Id         --项目经办人OA编号
    ,CGWJSPZT                                          AS  Purch_File_Appr_Stat_Cd --采购文件审批状态代码
    ,IF(SFLJDKB='2',0,SFLJDKB)                         AS  Two_Stg_Bid_Open_Flag   --两阶段开标标志
    ,SXMBBH                                            AS  Pd_Tplt_Id              --时效模板编号
    ,SXMBMC                                            AS  Pd_Tplt_Name            --时效模板名称
    ,from_unixtime(unix_timestamp(BMJSSJ,'yyyyMMddHHmm'),'yyyy-MM-dd HH:mm')
                                                       AS  Enrl_End_Time           --报名结束时间
    ,XMLCDYBH                                          AS  Proj_Proc_Id            --项目流程编号
    ,LXRDZYJ                                           AS  Lkman_Email             --联系人邮箱
    ,CASE WHEN PJZT = '2' THEN '1' 
          WHEN PJZT = '1' THEN '0' ELSE NVL(PJZT,'') END 
                                                       AS  Aprs_Flag               --评价标志
    ,XMLX                                              AS  Purch_Proj_Type_Cd      --采购项目类型代码
    ,IF(NVL(TRIM(SFFB),'')='',0,SFFB)                  AS  Scontr_Flag             --分包标志
    ,IF(NVL(TRIM(SFQDHT),'')='',0,SFQDHT)              AS  Contr_Sign_Flag         --合同签订标志
    ,IF(NVL(TRIM(FJXMID),'')='','',CONCAT('PMS010-',FJXMID))
                                                       AS  Prnt_Intvb_Proj_Id      --父级招标项目编号
    ,ZBTJ                                              AS  Invtb_Cond              --招标条件
    ,GS                                                AS  Proj_Desc               --项目描述
    ,SFXYSWXX                                          AS  Ec_Info_Flag            --需要商务信息标志
    ,CGJGSPZT                                          AS  Purch_Appr_Stat_Cd      --采购审批状态代码
    ,SFYQGBM                                           AS  Purch_Org_Flag          --请购部门标志
    ,XQBMBH                                            AS  Req_Inr_Org_Id          --需求部门机构编号
    ,QGBMBH                                            AS  Purch_Inr_Org_Id        --请购部门机构编号
    ,FAQSSPZT                                          AS  Bpm_Appr_Stat_Cd        --BPM审批状态代码
    ,JSWJSFKJ                                          AS  Quot_File_Disp_Flag     --报价文件展示标志
    ,CONCAT('PMS013-',LXXMXH)                          AS  Proj_Setp_Appr_Id       --项目立项审批编号
    ,'${data_src_cd}'                             AS  Data_Src_Cd             --数据来源代码
    ,'${filename}'                                AS  Task_Name               --任务名
    ,'${data_day_str}'                            AS  Data_Etl_Date           --数据加载日期
    ,'${data_today_str}'                          AS  Data_Upt_Date           --数据更新日期
    ,'${data_today}'                              AS  Data_Time               --数据时间
    ,'${src_table}'                               AS  Real_Src_Tbl            --真实源表
    ,SFJC                                              AS  Cent_Purch_Flag         --集采标志
FROM   (SELECT *  FROM ${src_table} WHERE  BUSI_DATE='${data_day_str}' )A
LEFT JOIN
(SELECT DISTINCT OA_ID,ERP_ID FROM 
     (SELECT OA_ID,ERP_ID FROM ODATA_N_IOA.I_GF_USER WHERE BUSI_DATE = '${data_day_str}'  AND MAIN_DEPARTMENT='true' AND ERP_ID IS NOT NULL 
         UNION ALL
      SELECT OA_ID,ERP_ID FROM ODATA_N_IOA.I_GF_USER_DEL WHERE BUSI_DATE = '${data_day_str}' AND MAIN_DEPARTMENT='true' AND ERP_ID IS NOT NULL 
   ) T) B
ON A.XMJBR=B.OA_ID
;

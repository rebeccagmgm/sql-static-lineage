-- task_id: 61573
-- hiveDb: PDATA_N
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-GF_FDM_N/SUM/PDATA_N.T98_ORG_EMP_BASE_INFO_KXC.py
-- observed_at: 2026-09-05T01:06:19.287Z

-- createSql
CREATE TABLE IF NOT EXISTS T98_ORG_EMP_BASE_INFO(
    Emp_Id                             STRING COMMENT '员工编号        '
    ,Oa_User_Id                        STRING COMMENT 'OA用户编号      '
    ,Emp_Name                          STRING COMMENT '员工姓名        '
    ,Emp_Cate_Cd                       STRING COMMENT '员工类别代码    '
    ,Emp_Type_Cd                       STRING COMMENT '员工类型代码    '
    ,Cert_Type_Cd                      STRING COMMENT '证件类型代码    '
    ,Cert_No                           STRING COMMENT '证件号码        '
    ,Sex                               STRING COMMENT '性别            '
    ,Birt_Date                         STRING COMMENT '出生日期        '
    ,Nationality                       STRING COMMENT '国籍            '
    ,Nat_Place                         STRING COMMENT '籍贯            '
    ,Ethnic_Cd                         STRING COMMENT '民族代码        '
    ,Dgre_Cd                           STRING COMMENT '学历代码        '
    ,Edu_Dgre_Cd                       STRING COMMENT '学位代码        '
    ,Marr_Stat_Cd                      STRING COMMENT '婚姻状态代码    '
    ,Poli_Stat_Cd                      STRING COMMENT '政治面貌代码    '
    ,Emp_Stat_Cd                       STRING COMMENT '员工状态代码    '
    ,Entr_Date                         STRING COMMENT '入职日期        '
    ,Leav_Date                         STRING COMMENT '离职日期        '
    ,Mngr_Flag                         STRING COMMENT '管理级员工标志  '
    ,Bel_Inr_Org_Id                    STRING COMMENT '所属内部机构编号'
    ,Bel_Inr_Org_Name                  STRING COMMENT '所属内部机构名称'
    ,Ofc_Fix_Phone                     STRING COMMENT '办公电话分机    '
    ,Ofc_Dir_Phone                     STRING COMMENT '直拨办公电话    '
    ,Mobile                            STRING COMMENT '手机            '
    ,Emrg_Cont_Phone                   STRING COMMENT '紧急联系电话    '
    ,Fax                               STRING COMMENT '传真            '
    ,Email                             STRING COMMENT '邮箱            '
    ,Qq                                STRING COMMENT 'QQ              '
    ,Msn                               STRING COMMENT 'MSN             '
    ,Wechat                            STRING COMMENT '微信号          '
    ,Ofc_Addr                          STRING COMMENT '工作地址        '
    ,Home_Addr                         STRING COMMENT '家庭住址        '
    ,Perm_Addr                         STRING COMMENT '户籍地址        '
    ,Mail_Addr                         STRING COMMENT '邮寄地址        '
    ,Del_Flag                          STRING COMMENT '删除标志        '
    ,Data_Time                         STRING COMMENT '数据时间        '
    ,Emp_Grad                          STRING COMMENT '员工级别        '
    ,Oas_Prsn_Sign                     STRING COMMENT 'OA用户附加信息  '
    ,Brok_Flag                         STRING COMMENT '经纪人标志      '
    ,Fee_Org_Seg                       STRING COMMENT '费用机构段      '
    ,Fee_Cost_Center_Seg               STRING COMMENT '费用成本中心段  '
    ,Dept_Prin_Flag                    STRING COMMENT '发薪部门负责人标志  '
    ,Pos_Desc                          STRING COMMENT '岗位            '    
    ,Fir_Entr_Co_Date                  STRING COMMENT '首次入司日期    '  
    ,Work_Strt_Date                    STRING COMMENT '参加工作日期    ' 
    ,Scr_Work_Strt_Date                STRING COMMENT '证券从业日期    ' 
    ,Bel_Inr_Org_Id_Len4               STRING COMMENT '所属内部机构编号_4位长度' 
    ,Brch_Bel_Div_Org_Id_Len4          STRING COMMENT '营业部所属分公司编号_4位长度'  
    ,Brch_Bel_Div_Org_Name             STRING COMMENT '营业部所属分公司名称' 
    ,Emp_Cate_Desc                     STRING COMMENT '员工类别描述' 
    ,Emp_Type_Desc                     STRING COMMENT '员工类型描述'  
    ,Cert_Type_Desc                    STRING COMMENT '证件类型描述' 
    ,Psnl_Email                        STRING COMMENT '个人邮箱' 
    ,Prtc_Exam_Flag                    STRING COMMENT '参与考核标志' 
    ,Main_Flag                         STRING COMMENT '主账号标志'  
    ,Main_Emp_Id                       STRING COMMENT '主员工编号(只有营销有)' 
    ,Emp_Idty_Uniq_Id                  STRING COMMENT '员工识别唯一编号'  
    ,Upper_Emp_Id                      STRING COMMENT '上级员工编号' 
    ,Upper_Emp_Name                    STRING COMMENT '上级员工姓名'
    ,Oth_Phone                         STRING COMMENT '其他手机' 
    ,Foml_Dept_Prin_Flag               STRING COMMENT '发文部门负责人标志'
    ,Emp_En_Name                       STRING COMMENT '员工英文姓名'
    ,Nationality_Desc                  STRING COMMENT '国籍描述'
    ,Ethnic_Desc                       STRING COMMENT '民族描述'
    ,Dgre_Desc                         STRING COMMENT '学历描述'
    ,Edu_Dgre_Desc                     STRING COMMENT '学位描述'
    ,Marr_Stat_Desc                    STRING COMMENT '婚姻状态描述'
    ,Poli_Stat_Desc                    STRING COMMENT '政治面貌描述'
    ,Emp_Stat_Desc                     STRING COMMENT '员工状态描述'
    ,Leav_Rsn_desc                     STRING COMMENT '离职原因描述'
    ,Psnl_Hobb                         STRING COMMENT '个人兴趣爱好'
    ,Psnl_Spec                         STRING COMMENT '个人特长'
    ,Prob_Pass_Date                    STRING COMMENT '转正日期'
    ,Csrc_Ent_Work_Exp_Flag            STRING COMMENT '证监会系统单位工作经历标志'
    ,Pst_Respon                        STRING COMMENT '岗位职责'
    ,New_Emp_Idty_Uniq_Id              STRING COMMENT '新员工识别唯一编号'
    ,Oa_Disp_Pos_Desc                  STRING COMMENT 'OA展示岗位描述'
    ,Erly_Reti_Date                    STRING COMMENT '内退日期'
        ) COMMENT 'T98_员工基本信息'
PARTITIONED BY(Busi_Date String comment '业务日期')
STORED AS ORC
;

-- querySql
#    
#    INSERT OVERWRITE TABLE T98_ORG_EMP_BASE_INFO PARTITION(BUSI_DATE)
#    SELECT
#          EMP_ID                     AS EMP_ID                 --员工编号
#         ,OA_USER_ID                 AS OA_USER_ID             --OA用户编号
#         ,EMP_NAME                   AS EMP_NAME               --员工姓名
#         ,EMP_CATE_CD                AS EMP_CATE_CD            --员工类别代码
#         ,EMP_TYPE_CD                AS EMP_TYPE_CD            --员工类型代码
#         ,CERT_TYPE_CD               AS CERT_TYPE_CD           --证件类型代码
#         ,CERT_NO                    AS CERT_NO                --证件号码
#         ,SEX                        AS SEX                    --性别
#         ,BIRT_DATE                  AS BIRT_DATE              --出生日期
#         ,NATIONALITY                AS NATIONALITY            --国籍
#         ,NAT_PLACE                  AS NAT_PLACE              --籍贯
#         ,ETHNIC_CD                  AS ETHNIC_CD              --民族代码
#         ,DGRE_CD                    AS DGRE_CD                --学历代码
#         ,EDU_DGRE_CD                AS EDU_DGRE_CD            --学位代码
#         ,MARR_STAT_CD               AS MARR_STAT_CD           --婚姻状态代码
#         ,POLI_STAT_CD               AS POLI_STAT_CD           --政治面貌代码
#         ,EMP_STAT_CD                AS EMP_STAT_CD            --员工状态代码
#         ,ENTR_DATE                  AS ENTR_DATE              --入职日期
#         ,LEAV_DATE                  AS LEAV_DATE              --离职日期
#         ,MNGR_FLAG                  AS MNGR_FLAG              --管理级员工标志
#         ,BEL_INR_ORG_ID             AS BEL_INR_ORG_ID         --所属内部机构编号
#         ,BEL_INR_ORG_NAME           AS BEL_INR_ORG_NAME       --所属内部机构名称
#         ,OFC_FIX_PHONE              AS OFC_FIX_PHONE          --办公电话分机
#         ,OFC_DIR_PHONE              AS OFC_DIR_PHONE          --直拨办公电话
#         ,MOBILE                     AS MOBILE                 --手机
#         ,EMRG_CONT_PHONE            AS EMRG_CONT_PHONE        --紧急联系电话
#         ,FAX                        AS FAX                    --传真
#         ,EMAIL                      AS EMAIL                  --邮箱
#         ,QQ                         AS QQ                     --QQ
#         ,MSN                        AS MSN                    --MSN
#         ,WECHAT                     AS WECHAT                 --微信号
#         ,OFC_ADDR                   AS OFC_ADDR               --工作地址
#         ,HOME_ADDR                  AS HOME_ADDR              --家庭住址
#         ,PERM_ADDR                  AS PERM_ADDR              --户籍地址
#         ,MAIL_ADDR                  AS MAIL_ADDR              --邮寄地址
#         ,DEL_FLAG                   AS DEL_FLAG               --删除标志
#         ,'${data_today}'       AS Data_Time              --数据时间
#         ,Emp_Grad                   AS Emp_Grad               --员工级别
#         ,Oas_Prsn_Sign              AS Oas_Prsn_Sign          --OA用户附加信息
#         ,Brok_Flag                  AS Brok_Flag              --经纪人标志
#         ,Ret_Emp_Flag               AS Ret_Emp_Flag           --零售员工标志
#         ,Fee_Org_Seg                AS Fee_Org_Seg            --费用机构段
#         ,Fee_Cost_Center_Seg        AS Fee_Cost_Center_Seg    --费用成本中心段
#         ,Dept_Prin_Flag             AS Dept_Prin_Flag         --发薪部门负责人标志
#         ,Pos_Desc                   AS Pos_Desc                --岗位 
#         ,Fir_Entr_Co_Date           AS Fir_Entr_Co_Date        --首次入司日期
#         ,Work_Strt_Date             AS Work_Strt_Date          --参加工作日期
#         ,Scr_Work_Strt_Date         AS Scr_Work_Strt_Date      --证券从业日期
#         ,Bel_Inr_Org_Id_Len4        AS Bel_Inr_Org_Id_Len4     --所属内部机构编号_4位长度 
#         ,Brch_Bel_Div_Org_Id_Len4   AS Brch_Bel_Div_Org_Id_Len4--营业部所属分公司编号_4位长度
#         ,Brch_Bel_Div_Org_Name      AS Brch_Bel_Div_Org_Name   --营业部所属分公司名称
#         ,Emp_Cate_Desc              AS Emp_Cate_Desc           --员工类别描述 
#         ,Emp_Type_Desc              AS Emp_Type_Desc           --员工类型描述  
#         ,Cert_Type_Desc             AS Cert_Type_Desc          --证件类型描述 
#         ,Psnl_Email                 AS Psnl_Email              --个人邮箱
#         ,Prtc_Exam_Flag             AS Prtc_Exam_Flag          --参与考核标志
#         ,Main_Flag                  AS Main_Flag               --主账号标志 
#         ,Main_Emp_Id                AS Main_Emp_Id             --主员工编号(只有营销有)  
#         ,Emp_Idty_Uniq_Id           AS Emp_Idty_Uniq_Id         --员工识别唯一编号
#         ,Upper_Emp_Id               AS Upper_Emp_Id            --上级员工编号
#         ,Upper_Emp_Name             AS Upper_Emp_Name          --上级员工姓名
#         ,Oth_Phone                  AS Oth_Phone               --其他手机
#         ,Foml_Dept_Prin_Flag        AS Foml_Dept_Prin_Flag     --发文部门负责人标志
#         ,Emp_En_Name                AS Emp_En_Name             --员工英文姓名
#         ,Nationality_Desc           AS Nationality_Desc        --国籍描述
#         ,Ethnic_Desc                AS Ethnic_Desc             --民族描述
#         ,Dgre_Desc                  AS Dgre_Desc               --学历描述
#         ,Edu_Dgre_Desc              AS Edu_Dgre_Desc           --学位描述
#         ,Marr_Stat_Desc             AS Marr_Stat_Desc          --婚姻状态描述
#         ,Poli_Stat_Desc             AS Poli_Stat_Desc          --政治面貌描述
#         ,Emp_Stat_Desc              AS Emp_Stat_Desc           --员工状态描述
#         ,Leav_Rsn_desc              AS Leav_Rsn_desc           --离职原因描述
#         ,Psnl_Hobb                  AS Psnl_Hobb               --个人兴趣爱好
#         ,Psnl_Spec                  AS Psnl_Spec               --个人特长
#         ,Prob_Pass_Date             AS Prob_Pass_Date               --转正日期
#         ,Csrc_Ent_Work_Exp_Flag     AS Csrc_Ent_Work_Exp_Flag  --证监会系统单位工作经历标志
#         ,Pst_Respon                 AS Pst_Respon              --岗位职责
#         ,New_Emp_Idty_Uniq_Id       AS New_Emp_Idty_Uniq_Id    --新员工识别唯一编号
#         ,Oa_Disp_Pos_Desc           AS Oa_Disp_Pos_Desc        --OA展示岗位描述
#         ,Erly_Reti_Date             AS Erly_Reti_Date          --内退日期
#         ,'${data_day_str}'     AS Busi_Date               --业务日期
#    FROM T98_ORG_EMP_BASE_INFO
#    WHERE BUSI_DATE=default.pretradedate('${data_day_str}',1)  --取上个交易日数据插入当天分区
#    ;
#    
#

WITH T04_INR_ORG_RELA_H_1 AS (
SELECT * FROM (SELECT *,ROW_NUMBER() OVER(PARTITION BY INR_ORG_ID,INR_ORG_RELA_TYPE_CD ORDER BY END_DATE DESC ) RN
                FROM PDATA_N.T04_INR_ORG_RELA_H  WHERE STRT_DATE<='${data_day_str}' AND INR_ORG_RELA_TYPE_CD<>'11' --机构数据从erp取数没有做闭链，切换智慧人力后取的智慧人力的有效日期，最新数据无历史停用或撤销机构，按strt_date排序取最新一条
                 AND SRC_TBL IN ('ODATA_N_ERP.A_GF_ORGANIZATION_UNITS_V','ODATA_N_PAS.J_HSSORG_ORG_VER')
                UNION ALL 
                SELECT *,ROW_NUMBER() OVER(PARTITION BY RELA_INR_ORG_ID ORDER BY END_DATE DESC ) RN
                FROM PDATA_N.T04_INR_ORG_RELA_H  WHERE STRT_DATE<='${data_day_str}' AND INR_ORG_RELA_TYPE_CD='11'  --历史数据原因，一个org_cd对应多个org_id
                 AND SRC_TBL IN ('ODATA_N_ERP.A_GF_ORGANIZATION_UNITS_V')
        )T WHERE RN=1
            ),
T04_INR_ORG_NAME_H_1 AS (
SELECT * FROM (SELECT *,ROW_NUMBER() OVER(PARTITION BY INR_ORG_ID ORDER BY END_DATE DESC ) RN 
FROM PDATA_N.T04_INR_ORG_NAME_H WHERE STRT_DATE<='${data_day_str}'
AND SRC_TBL IN ('ODATA_N_ERP.A_GF_ORGANIZATION_UNITS_V')
    )T WHERE RN=1
),
t04_emp_inr_org_rela_h_1 as (
           select * from (select *,row_number() over(partition by emp_id,Emp_Inr_Org_Rela_Type_Cd order by end_date desc ) rn
               from PDATA_N.t04_emp_inr_org_rela_h where (
                   (strt_Date<='${data_day_str}' and data_src_Cd='PAS')  --因智慧人力员工分配表员工离职后就没有数据，按员工倒叙取最新一条
                   or 
                   (strt_Date<='${data_day_str}' and end_date>'${data_day_str}' and data_src_Cd<>'PAS')   --非智慧人力正常取数
                   )
                 AND SRC_TBL IN ('ODATA_N_ERP.A_GF_FORMER_EMP_INFO_V','ODATA_N_ERP.A_GF_EMP_INFO_V')
               )t where rn=1
),
T04_EMP_STATI_INFO_H_1 as (
           select * from (select *,row_number() over(partition by emp_id,Emp_Stati_Info_Type_Cd order by end_date desc ) rn
           	from PDATA_N.T04_EMP_STATI_INFO_H where (
           		(strt_Date<='${data_day_str}' and data_src_Cd='PAS')  --因智慧人力员工分配表员工离职后就没有数据，按员工倒叙取最新一条
           		or 
           		(strt_Date<='${data_day_str}' and end_date>'${data_day_str}' and data_src_Cd<>'PAS')   --非智慧人力正常取数
                )
                AND SRC_TBL IN ('ODATA_N_PAS.J_HSSEMP_EMPLOYEE_POST_VER')
           	)t where rn=1
),
T04_EMP_IMP_DATE_H_1 as (
           select * from (select *,row_number() over(partition by emp_id,Emp_Imp_Date_Type_Cd order by end_date desc ) rn
           	from PDATA_N.T04_EMP_IMP_DATE_H where (
           		(strt_Date<='${data_day_str}' and data_src_Cd='PAS')  --因智慧人力员工分配表员工离职后就没有数据，按员工倒叙取最新一条
           		or 
           		(strt_Date<='${data_day_str}' and end_date>'${data_day_str}' and data_src_Cd<>'PAS')   --非智慧人力正常取数
                )
                AND SRC_TBL IN ('ODATA_N_ERP.A_GF_EMP_INFO_V')
           	)t where rn=1
),
RELA_OLD_NEW_TEMP as (
     SELECT EMP_ID
           ,Rela_Emp_Id
       FROM(
          SELECT *
               ,ROW_NUMBER()OVER(PARTITION BY EMP_ID ORDER BY Emp_Stat_Flag DESC,Leav_Date DESC) RN
           FROM 
               (
               SELECT  
                      A.EMP_ID
                     ,NVL(B.Emp_Id,A.EMP_ID)        AS Rela_Emp_Id    --新工号
                     ,IF(C.Emp_Stat_cd = '0','1','0') AS Emp_Stat_Flag --新工号在职标志
                     ,IF(NVL(TRIM(C.Leav_Date),'')='','1000-01-01',C.Leav_Date) AS Leav_Date     --新工号离职日期
                FROM PDATA_N.T04_EMP A
                LEFT JOIN (SELECT  Emp_Id,Rela_Emp_Id FROM PDATA_N.T04_EMP_RELA_H WHERE Emp_Rela_Type_Cd='07' AND Strt_Date <='${data_day_str}' and End_Date >'${data_day_str}')B
                       ON A.EMP_ID = B.Rela_Emp_Id
                LEFT JOIN PDATA_N.T04_EMP C
                       ON NVL(B.Emp_Id,A.EMP_ID)= C.EMP_ID
                )A
              )T
     WHERE T.RN=1
)
INSERT OVERWRITE TABLE T98_ORG_EMP_BASE_INFO PARTITION(Busi_Date)
SELECT  distinct
     A.Emp_Id                          AS Emp_Id                 --员工编号
    ,CASE WHEN A.EMP_STAT_CD='0' THEN F.USER_ID2 ELSE F.USER_ID END     AS Oa_User_Id             --用户编号
    ,NVL(G.Name_Ch,A.Emp_Name)        AS Emp_Name               --中文名称
    ,A.Emp_Cate_Cd                    AS Emp_Cate_Cd            --员工类别代码
    ,A.Emp_Type_Cd                    AS Emp_Type_Cd            --员工类型代码
    ,B.Idty_Info_Type_Cd              AS Cert_Type_Cd           --鉴别信息类型代码
    ,B.Idty_Info_Cont                 AS Cert_No                --鉴别信息内容
    ,A.Sex                            AS Sex                    --性别
    ,IF(A.Birt_Date='0','',A.Birt_Date)  AS Birt_Date           --出生日期
    ,A.Nationality                    AS Nationality            --国籍
    ,A.Nat_Place                      AS Nat_Place              --籍贯
    ,A.Ethnic_Cd                      AS Ethnic_Cd              --民族代码
    ,A.Dgre_Cd                        AS Dgre_Cd                --学历代码
    ,A.Edu_Dgre_Cd                    AS Edu_Dgre_Cd            --学位代码
    ,A.Marr_Stat_Cd                   AS Marr_Stat_Cd           --婚姻状态代码
    ,A.Poli_Stat_Cd                   AS Poli_Stat_Cd           --政治面貌代码
    ,A.Emp_Stat_Cd                    AS Emp_Stat_Cd            --员工状态代码
    ,IF(A.Entr_Date='0','',A.Entr_Date)  AS Entr_Date           --入职日期
    ,IF(A.Leav_Date='0','',A.Leav_Date)  AS Leav_Date           --离职日期
    ,A.Mngr_Flag                      AS Mngr_Flag              --管理级员工标志
    ,BEL_ORG.Bel_Inr_Org_Id           AS Bel_Inr_Org_Id         --内部机构编号
    ,BEL_ORG.Bel_Inr_Org_Name         AS Bel_Inr_Org_Name       --内部机构名称
    ,E.Ofc_Fix_Phone                  AS Ofc_Fix_Phone          --办公电话分机
    ,E.Ofc_Dir_Phone                  AS Ofc_Dir_Phone          --直拨办公电话
    ,E.Mobile                         AS Mobile                 --手机
    ,E.Emrg_Cont_Phone                AS Emrg_Cont_Phone        --紧急联系电话
    ,E.Fax                            AS Fax                    --传真
    ,NVL(User_Addr.Email,E.Email)     AS Email                  --邮箱
    ,E.Qq                             AS Qq                     --QQ
    ,E.Msn                            AS Msn                    --MSN
    ,E.Wechat                         AS Wechat                 --微信号
    ,E.Ofc_Addr                       AS Ofc_Addr               --工作地址
    ,E.Home_Addr1                     AS Home_Addr              --家庭住址
    ,E.Perm_Addr1                     AS Perm_Addr              --户籍地址
    ,E.Mail_Addr                      AS Mail_Addr              --邮寄地址
    ,A.Del_Flag                          AS Del_Flag                --删除标志
    ,'${data_today}'             AS Data_Time              --数据时间
    ,NVL(K.Grad,'')                   AS Emp_Grad               --员工级别(目前只有营销人员的级别)
    ,OA.PRSN_SIGN                     AS Oas_Prsn_Sign          --OA用户附加信息
    ,CASE WHEN A.Emp_Cate_Cd='2' AND A.Emp_Type_Cd IN ('219','242','243','244','245','110')  --add by hzh 20250410 110:营销系统经纪人，其他几类为切换前营销的几类，已无用到
        THEN 1
        ELSE 0 END                  AS Brok_Flag              --经纪人标志
    ,CASE WHEN TRIM(COALESCE(L.INR_ORG_ID,''))!='' THEN 1 ELSE 0 END AS Ret_Emp_Flag           --零售员工标志
    ,N.Inr_Org_Id                      AS Fee_Org_Seg            --费用机构段
    ,O.Inr_Org_Id                      AS Fee_Cost_Center_Seg    --费用成本中心段
    ,CASE WHEN TRIM(NVL(P.EMP_ID,'')) !='' THEN 1 ELSE 0 END                      AS Dept_Prin_Flag         --发薪部门负责人标志
    ,nvl(posd.pos_name,A.Pos_Desc)            AS Pos_Desc                         --岗位          
    ,Q.\`Date\`                               AS Fir_Entr_Co_Date                 --首次入司日期
    ,R.\`Date\`                               AS Work_Strt_Date                   --参加工作日期
    ,S.\`Date\`                               AS Scr_Work_Strt_Date               --证券从业日期
    ,T1.Rela_Inr_Org_Id                       AS Bel_Inr_Org_Id_Len4              --所属内部机构编号_4位长度 
    ,CASE WHEN One_Dept_LEN4 IS NOT NULL THEN One_Dept_LEN4    
          WHEN BEL_ORG.Bel_Inr_Org_Name LIKE '%分公司'  AND trim(nvl(T1.Rela_Inr_Org_Id,''))<>'' THEN T1.Rela_Inr_Org_Id ELSE '' END AS Brch_Bel_Div_Org_Id_Len4         --营业部所属分公司编号_4位长度
    ,CASE WHEN  One_Dept_Name IS NOT NULL THEN One_Dept_Name 
          WHEN BEL_ORG.Bel_Inr_Org_Name LIKE '%分公司'  AND trim(nvl(T1.Rela_Inr_Org_Id,''))<>'' THEN BEL_ORG.Bel_Inr_Org_Name ELSE '' END AS Brch_Bel_Div_Org_Name            --营业部所属分公司名称
    ,Emp_Cate_Desc.DW_CD_VAL_DESC             AS Emp_Cate_Desc          --员工类别描述 
    ,Emp_Type_Desc.DW_CD_VAL_DESC             AS Emp_Type_Desc          --员工类型描述  
    ,Cert_Type_Desc.DW_CD_VAL_DESC            AS Cert_Type_Desc         --证件类型描述 
    ,E.Psnl_Email                             AS Psnl_Email              --个人邮箱
    ,U.Stati_Subdv_Cd                         AS Prtc_Exam_Flag          --参与考核标志
    ,A.Main_Flag                              AS Main_Flag               --主账号标志 
    ,''                                       AS Main_Emp_Id             --主员工编号(只有营销有)  --del by hzh 20250410 该字段原来营销平台存的是sfzzh=0的工号的对应sfzzh=1的工号的关系，切换到智慧人力后，没有该层关系
    ,W.Stati_Qty_Info                         AS Emp_Idty_Uniq_Id        --员工识别唯一编号
    ,Y.Rela_Emp_Id                            AS Upper_Emp_Id            --上级员工编号
    ,NVL(Z.Name_Ch,Z1.EMP_NAME)               AS Upper_Emp_Name          --上级员工姓名
    ,REGEXP_REPLACE(Phone_Str.Phone_Str,'#',',')   AS Oth_Phone               --其他手机
    ,CASE WHEN TRIM(NVL(P1.EMP_ID,'')) !='' THEN 1 ELSE 0 END                              AS Foml_Dept_Prin_Flag
    ,G.Name_En                                AS Emp_En_Name         --员工英文姓名
    ,Nationality_Desc.Dw_Cd_Val_Desc          AS Nationality_Desc    --国籍描述
    ,Ethnic_Desc.Dw_Cd_Val_Desc               AS Ethnic_Desc         --民族描述
    ,Dgre_Desc.Dw_Cd_Val_Desc                 AS Dgre_Desc           --学历描述
    ,Edu_Dgre_Desc.Dw_Cd_Val_Desc             AS Edu_Dgre_Desc       --学位描述
    ,Marr_Stat_Desc.Dw_Cd_Val_Desc            AS Marr_Stat_Desc      --婚姻状态描述
    ,Poli_Stat_Desc.Dw_Cd_Val_Desc            AS Poli_Stat_Desc      --政治面貌描述
    ,Emp_Stat_Desc.Dw_Cd_Val_Desc             AS Emp_Stat_Desc       --员工状态描述
    ,A.Leav_Rsn_desc                          AS Leav_Rsn_desc       --离职原因描述
    ,Psnl_Hobb.Stati_Cont_Desc                AS Psnl_Hobb           --个人兴趣爱好
    ,Psnl_Spec.Stati_Cont_Desc                AS Psnl_Spec           --个人特长
    ,RD.\`Date\`                              AS Prob_Pass_Date         --转正日期
    ,CEW.Stati_Subdv_Cd                       AS Csrc_Ent_Work_Exp_Flag --证监会系统单位工作经历标志
    ,PR.Stati_Cont_Desc                       AS Pst_Respon             --岗位职责
    ,W2.Stati_Qty_Info                        AS New_Emp_Idty_Uniq_Id   --新员工识别唯一编号
    ,coalesce(ODPD1.Stati_Cont_Desc,ODPD2.Stati_Cont_Desc,A.pos_desc)
                                              AS Oa_Disp_Pos_Desc       --OA展示岗位描述
    ,NTRQ.\`Date\`                             AS Erly_Reti_Date                --内退日期
    ,'${data_day_str}'                   AS Busi_Date              --业务日期
FROM PDATA_N.T04_EMP A
LEFT JOIN
(
SELECT Emp_Id
    ,Idty_Info_Type_Cd
    ,Idty_Info_Cont
FROM (
    SELECT  A.Emp_Id AS Emp_Id
        ,B.Idty_Info_Type_Cd AS Idty_Info_Type_Cd
        ,B.Idty_Info_Cont AS Idty_Info_Cont
        ,ROW_NUMBER()OVER(PARTITION BY A.Emp_Id ORDER BY B.DATA_TYPE DESC,B.Idty_Info_Type_Cd Asc) AS ROWNUMBER
    FROM PDATA_N.T04_EMP A
    LEFT JOIN (SELECT *
                    ,CASE WHEN SRC_TBL IN ('ODATA_N_ERP.H_PER_ALL_PEOPLE_F','ODATA_N_MMS.K_T_YG') THEN 1 ELSE 0 END DATA_TYPE  --优先取这两个分区的证件、存的个人证件，其他分区可能存的职业资格证之类的
                FROM PDATA_N.T04_EMP_IDTY_INFO_H 
                WHERE strt_Date<='${data_day_str}' and end_date>'${data_day_str}' 
                  AND SRC_TBL IN ('ODATA_N_ERP.H_PER_ALL_PEOPLE_F')
                )B
    ON A.Emp_Id=B.Emp_Id 
    )T
WHERE ROWNUMBER=1
)  B
ON A.Emp_Id=B.Emp_Id

LEFT JOIN PDATA_N.T04_EMP_STAT_H H
ON A.Emp_Id=H.Emp_Id AND H.Emp_Stat_Type_Cd='10'
AND H.Strt_Date <='${data_day_str}'  AND H.End_Date >'${data_day_str}'

LEFT JOIN (
        SELECT 
             A.EMP_ID
            ,CASE WHEN SUBSTR(C.Inr_Org_Id,1,3)<>'ERP' THEN   I.Inr_Org_Id
                ELSE C.Inr_Org_Id END       AS Bel_Inr_Org_Id         --内部机构编号
            ,CASE WHEN SUBSTR(C.Inr_Org_Id,1,3)<>'ERP' THEN J.Inr_Org_Full_Name
            ELSE C.Inr_Org_Full_Name END  AS Bel_Inr_Org_Name     --内部机构名称
      FROM PDATA_N.T04_EMP A
      LEFT JOIN (
            SELECT 
                        ER.Emp_Id
                    ,IF(    D.Inr_Org_Full_Name LIKE '%分公司%' 
                        and Substr(ER.Inr_Org_Id,1,1) ='9' 
                        and Length(ER.Inr_Org_Id)=4 , Concat('7',Substr(ER.Inr_Org_Id,2)),ER.Inr_Org_Id) 
                        as Inr_Org_Id
                    ,D.Inr_Org_Full_Name
                FROM  t04_emp_inr_org_rela_h_1 ER
            LEFT JOIN  T04_INR_ORG_NAME_H_1 D
                ON  ER.Inr_Org_Id=D.Inr_Org_Id 
                WHERE ER.Emp_Inr_Org_Rela_Type_Cd='10'
           )C
         ON A.Emp_Id=C.Emp_Id  
       LEFT JOIN T04_INR_ORG_RELA_H_1 I
       ON C.Inr_org_Id=I.Rela_Inr_Org_Id and I.Inr_Org_Rela_Type_Cd IN('11','15') 
       LEFT JOIN  T04_INR_ORG_NAME_H_1 J
       ON I.Inr_Org_Id=J.Inr_Org_Id 
       )BEL_ORG 
ON A.EMP_ID=BEL_ORG.EMP_ID

LEFT JOIN (    SELECT 
                a.* 
                ,CONCAT(nvl(b.ADMIN_AREA_NAME,''),nvl(c.ADMIN_AREA_NAME,''),nvl(d.ADMIN_AREA_NAME,''),nvl(a.home_addr,'')) home_addr1
                ,CONCAT(nvl(e.ADMIN_AREA_NAME,''),nvl(f.ADMIN_AREA_NAME,''),nvl(a.perm_addr,'')) perm_addr1
            FROM PDATA_N.T04_EMP_ADDR_H A  
            LEFT JOIN PDATA_N.T06_ADMIN_AREA  B 
            ON A.home_addr_prov=B.ADDR_ID
            LEFT JOIN PDATA_N.T06_ADMIN_AREA  C 
            ON A.home_addr_city=C.ADDR_ID
                            LEFT JOIN PDATA_N.T06_ADMIN_AREA  D 
            ON A.home_addr_cnty=D.ADDR_ID
                            LEFT JOIN PDATA_N.T06_ADMIN_AREA  E
            ON A.perm_addr_city=E.ADDR_ID
                            LEFT JOIN PDATA_N.T06_ADMIN_AREA  F 
            ON A.perm_addr_cnty=F.ADDR_ID
WHERE A.Strt_Date <='${data_day_str}'  and A.End_Date >'${data_day_str}'
  AND A.SRC_TBL IN ('ODATA_N_MMS.K_T_YG','ODATA_N_PPM.P_PERSON_BASE_INFO','ODATA_N_ERP.H_PER_ALL_PEOPLE_F')
 )E
ON A.Emp_Id=E.Emp_Id 

LEFT JOIN (SELECT A.EMP_ID
                 ,A.User_Id
                 ,CASE WHEN B.USER_STAT_CD='101' THEN A.USER_ID END AS USER_ID2
            FROM (SELECT * FROM PDATA_N.T04_USER_EMP_RELA_H WHERE User_Emp_Rela_Type_Cd='10' AND Del_Flag='0' AND data_src_cd='OAS' AND  SRC_TBL='ODATA_N_OAS.P_GF_USER') A
            LEFT JOIN (SELECT * FROM PDATA_N.T04_USER_STAT_H WHERE Strt_Date <='${data_day_str}'  and End_Date >'${data_day_str}' AND USER_STAT_TYPE_CD='01' AND SRC_TBL='ODATA_N_OAS.P_GF_USER' ) B 
                   ON A.USER_ID=B.USER_ID 
           )F
ON A.EMP_ID=F.EMP_ID

LEFT JOIN (SELECT * FROM PDATA_N.T04_USER_ADDR_H WHERE Strt_Date <='${data_day_str}'  and End_Date >'${data_day_str}' AND SRC_TBL='ODATA_N_OAS.P_GF_USER') User_Addr
ON F.User_Id=User_Addr.User_Id 

LEFT JOIN(SELECT * FROM  PDATA_N.T04_EMP_NAME_H WHERE Strt_Date <='${data_day_str}'  and End_Date >'${data_day_str}' AND SRC_TBL IN ('ODATA_N_ERP.A_GF_EMP_INFO_V','ODATA_N_PPM.P_PERSON_BASE_INFO','ODATA_N_CRM.C_TRYXX')) G
ON A.Emp_Id=G.Emp_Id 

LEFT JOIN (SELECT * FROM PDATA_N.T04_EMP_GRAD_H WHERE Grad_Type_Cd='01' AND Strt_Date <='${data_day_str}' and End_Date >'${data_day_str}' AND SRC_tbl='ODATA_N_MMS.K_T_YG') K
ON A.Emp_Id=K.Emp_Id

LEFT JOIN (SELECT USER_ID
                ,PRSN_SIGN 
                ,ROW_NUMBER() OVER(PARTITION BY USER_ID ORDER BY PRSN_SIGN DESC ) AS RN 
            FROM PDATA_N.T04_OAS_USER_ADTNL_INFO
            WHERE  SRC_TBL IN ('ODATA_N_OAS.P_GF_USER_DEL','ODATA_N_OAS.P_GF_USER')
        )OA ON OA.USER_ID=F.USER_ID AND OA.RN=1
LEFT JOIN (SELECT INR_ORG_ID FROM PDATA_N.T04_INR_ORG_HRCH_RELA WHERE DATA_SRC_CD='PAS' AND SRC_TBL='ODATA_N_ERP.A_GF_ORG_LEVEL_NOW'
AND (INR_ORG_ID_LVL2='ERP-414' OR INR_ORG_ID IN ('ERP-414','ERP-507')) ) L -- 414:零售总部，507:特殊处理，“总公司机构客户部”，“广州马场路广发证券大厦营业部”的前生
ON BEL_ORG.Bel_Inr_Org_Id=L.INR_ORG_ID

LEFT JOIN (SELECT * FROM t04_emp_inr_org_rela_h_1 WHERE Emp_Inr_Org_Rela_Type_Cd='13' ) N --13:员工费用公司段
ON A.Emp_Id=N.Emp_Id 
LEFT JOIN (SELECT * FROM t04_emp_inr_org_rela_h_1 WHERE Emp_Inr_Org_Rela_Type_Cd='14' ) O --14:员工费用部门段
ON A.Emp_Id=O.Emp_Id 
    
LEFT JOIN (SELECT distinct Emp_Id FROM PDATA_N.T04_EMP_INR_ORG_RELA_H WHERE Emp_Inr_Org_Rela_Type_Cd='15' AND Strt_Date <='${data_day_str}' and End_Date >'${data_day_str}' AND SRC_TBL='ODATA_N_IOA.I_GF_ROLE_USER') P --15:部门负责人
ON A.Emp_Id=P.Emp_Id 
    
LEFT JOIN (SELECT * FROM T04_EMP_IMP_DATE_H_1 WHERE Emp_Imp_Date_Type_Cd='02' ) Q --首次入司日期
ON A.Emp_Id=Q.Emp_Id
    
LEFT JOIN (SELECT * FROM T04_EMP_IMP_DATE_H_1 WHERE Emp_Imp_Date_Type_Cd='03' ) R --参加工作日期
ON A.Emp_Id=R.Emp_Id
    
LEFT JOIN (SELECT * FROM T04_EMP_IMP_DATE_H_1 WHERE Emp_Imp_Date_Type_Cd='04' ) S --证券从业日期
ON A.Emp_Id=S.Emp_Id
    
LEFT JOIN (SELECT *,ROW_NUMBER() OVER(PARTITION BY Inr_Org_Id ORDER BY END_DATE DESC ) RN FROM PDATA_N.T04_INR_ORG_RELA_H WHERE Inr_Org_Rela_Type_Cd='11' AND SRC_TBL IN ('ODATA_N_ERP.A_GF_ORGANIZATION_UNITS_V')) T1  --取组织机构的4位柜台机构编号
ON BEL_ORG.Bel_Inr_Org_Id=T1.Inr_Org_Id 
AND T1.RN=1
--注释 by hzh 20241220 原来是取组织机构的所属分公司，现在改取组织类型为“分支机构”的一级机构
--LEFT JOIN (SELECT INR_ORG_ID,BRCH_BEL_DIV_ORG_ID,BRCH_BEL_DIV_ORG_NAME FROM PDATA_N.T98_ORG_BRCH_DIV_INFO WHERE BUSI_DATE = '${data_day_str}') T2
--ON T1.Rela_Inr_Org_Id=T2.Inr_Org_Id
LEFT JOIN (SELECT DISTINCT DW_CD_VAL,DW_CD_VAL_DESC FROM  PDATA_N.REF_DW_CD_VAL WHERE DW_CD_ID='CD012' AND SRC_TBL='MANU_MATN') Emp_Cate_Desc  
    ON A.Emp_Cate_Cd=Emp_Cate_Desc.DW_CD_VAL
LEFT JOIN (SELECT DISTINCT DW_CD_VAL,DW_CD_VAL_DESC FROM  PDATA_N.REF_DW_CD_VAL WHERE DW_CD_ID='CD013' AND SRC_TBL='MANU_MATN') Emp_Type_Desc  
    ON A.Emp_Type_Cd=Emp_Type_Desc.DW_CD_VAL
LEFT JOIN (SELECT DISTINCT DW_CD_VAL,DW_CD_VAL_DESC FROM  PDATA_N.REF_DW_CD_VAL WHERE DW_CD_ID='CD006' AND SRC_TBL='MANU_MATN') Cert_Type_Desc  
    ON B.Idty_Info_Type_Cd=Cert_Type_Desc.DW_CD_VAL
LEFT JOIN (SELECT * FROM T04_EMP_STATI_INFO_H_1 WHERE Emp_Stati_Info_Type_Cd='22') U
ON A.Emp_Id=U.Emp_Id
LEFT JOIN (SELECT * FROM PDATA_N.T04_EMP_RELA_H WHERE Emp_Rela_Type_Cd='06' AND Strt_Date <='${data_day_str}' and End_Date >'${data_day_str}' AND SRC_TBL='ODATA_N_MMS.K_T_YG') V
ON A.Emp_Id=V.Emp_Id
--ADD BY HZH 20241220 优化Brch_Bel_Div_Org_Id_Len4、Brch_Bel_Div_Org_Name取值逻辑，因后续智慧人力新增分公司部门，分支机构部分改取一级部门
LEFT JOIN (SELECT T1.Inr_Org_Id
            ,T1.Rela_Inr_Org_Id    AS One_Dept          --一级内部机构编号
            ,T2.Inr_Org_Full_Name  AS One_Dept_Name     --一级内部机构全称
            ,T4.Rela_Inr_Org_Id    AS One_Dept_LEN4     --一级内部机构编号_4位
    FROM (SELECT * FROM T04_INR_ORG_RELA_H_1 WHERE Inr_Org_Rela_Type_Cd='18' )T1
    LEFT JOIN T04_INR_ORG_NAME_H_1 T2
    ON  T1.Rela_Inr_Org_Id=T2.Inr_Org_Id
    JOIN  (SELECT *,ROW_NUMBER() OVER(PARTITION BY Inr_Org_Id ORDER BY END_DATE DESC ) RN  --内关联，只取部门类型为“分支机构”的一级部门
                FROM PDATA_N.T04_INR_ORG_CLAS_H 
                WHERE Inr_Org_Clas_Type_Cd='03' --智慧人力部门类型
                    AND Inr_Org_Clas_Cd='12'  --分支机构
                    AND SRC_TBL='ODATA_N_PAS.J_HSSORG_ORG_VER'
                )T3
        ON T1.Inr_Org_Id=T3.Inr_Org_Id
    JOIN (SELECT *,ROW_NUMBER() OVER(PARTITION BY Inr_Org_Id ORDER BY END_DATE DESC ) RN 
            FROM PDATA_N.T04_INR_ORG_RELA_H WHERE Inr_Org_Rela_Type_Cd='11'
            AND SRC_TBL='ODATA_N_ERP.A_GF_ORGANIZATION_UNITS_V'
            ) T4
    ON T1.Rela_Inr_Org_Id=T4.Inr_Org_Id
    AND T1.RN=1
    ) LVL1_ORG
ON         BEL_ORG.BEL_Inr_Org_Id   =LVL1_ORG.Inr_Org_Id

--20240110 hzh 因前端权限控制，分公司看不到分公司私人财富中心的人员，单独处理私人财富中心归属营业部、分公司的4位编号
--20241220 hzh 注释以下代码，优化逻辑，组织机构为“分支机构”，分公司的2个字段取对应的一级机构
--LEFT JOIN (SELECT  distinct
--        A.Inr_Org_Id
--        ,C.Inr_Org_Name
--        ,case when d1.Inr_Org_Name like '%营业部%' then b1.Rela_Inr_Org_Id end as Brch_Inr_Org_Id
--        ,case when d1.Inr_Org_Name like '%营业部%' then d1.Inr_Org_Name end Brch_Inr_Org_Name
--        ,A.Rela_Inr_Org_Id  Brch_Bel_Div_Org_Id
--        ,D.Inr_Org_Name     Brch_Bel_Div_Org_Name
--        ,B.Rela_Inr_Org_Id  Brch_Bel_Div_Org_Cd
--FROM (SELECT Inr_Org_Id
--            ,Rela_Inr_Org_Id     brch_Inr_Org_Id   --营业部+分公司
--            ,case Inr_Org_Id when 'ERP-6216' then 'ERP-647'  --特殊处理两个归营业部下的私人财富中心，目前如果取2层层级，可能会出现总部部门的情况，需要加其他判断，先直接赋值，后续再优化一下
--                            when 'ERP-6217' then 'ERP-699'
--                else Rela_Inr_Org_Id end as Rela_Inr_Org_Id
--        from T04_INR_ORG_RELA_H_1
--        WHERE Inr_Org_Rela_Type_Cd='10'  --取erp层级
--        )A  
--INNER JOIN T04_INR_ORG_RELA_H_1 B
--    ON A.Rela_Inr_Org_Id=B.Inr_Org_Id
--    AND B.Inr_Org_Rela_Type_Cd='11'   --取私人财富中心所属分公司
--LEFT JOIN T04_INR_ORG_RELA_H_1 B1
--    ON A.brch_Inr_Org_Id=B1.Inr_Org_Id
--    AND B1.Inr_Org_Rela_Type_Cd='11'   --取私人财富中心所属营业部+分公司
--    LEFT JOIN PDATA_N.T04_INR_ORG C 
--    ON A.Inr_Org_Id=C.Inr_Org_Id
--    LEFT JOIN PDATA_N.T04_INR_ORG D 
--    ON A.Rela_Inr_Org_Id=D.Inr_Org_Id
--    LEFT JOIN PDATA_N.T04_INR_ORG D1
--    ON A.brch_Inr_Org_Id=D1.Inr_Org_Id
--WHERE D.INR_ORG_NAME like '%分公司%'   --因前端权限控制，分公司看不到分公司私人财富中心的人员，单独处理私人财富中心归属分公司
--) PWM
--ON (CASE WHEN SUBSTR(C.Inr_Org_Id,1,3)<>'ERP' THEN   I.Inr_Org_Id ELSE C.Inr_Org_Id END)=PWM.Inr_Org_Id
LEFT JOIN  (SELECT * FROM PDATA_N.T04_EMP_STATI_INFO_H WHERE Emp_Stati_Info_Type_Cd='33' AND Strt_Date <='${data_day_str}' and End_Date >'${data_day_str}' AND SRC_TBL='ODATA_N_PAS.J_HSSEMP_EMPLOYEE_BASEDOC')  W
ON A.Emp_Id=W.Emp_Id

LEFT JOIN RELA_OLD_NEW_TEMP W1  --获取最新工号
ON A.Emp_Id=W1.Emp_Id
LEFT JOIN  (SELECT * FROM PDATA_N.T04_EMP_STATI_INFO_H WHERE Emp_Stati_Info_Type_Cd='33' AND Strt_Date <='${data_day_str}' and End_Date >'${data_day_str}' AND SRC_TBL='ODATA_N_PAS.J_HSSEMP_EMPLOYEE_BASEDOC')  W2
ON NVL(W1.Rela_Emp_Id,A.Emp_Id)=W2.Emp_Id

LEFT JOIN  ( SELECT *
            FROM PDATA_N.T04_EMP_RELA_H 
            where strt_Date<='${data_day_str}' and end_date>'${data_day_str}' 
                AND Emp_Rela_Type_Cd='01'
                AND SRC_TBL='ODATA_N_ERP.A_GF_EMP_INFO_V'
                )Y
ON A.Emp_Id=Y.Emp_Id 

LEFT JOIN  ( SELECT *
            FROM PDATA_N.T04_EMP_NAME_H 
            where strt_Date<='${data_day_str}' and end_date>'${data_day_str}' 
              AND SRC_TBL='ODATA_N_ERP.A_GF_EMP_INFO_V'
                )Z
ON Y.Rela_Emp_Id=Z.Emp_Id 
LEFT JOIN PDATA_N.T04_EMP Z1
ON Y.Rela_Emp_Id=Z1. Emp_Id

LEFT JOIN (SELECT DISTINCT Emp_Id FROM PDATA_N.T04_EMP_INR_ORG_RELA_H WHERE Emp_Inr_Org_Rela_Type_Cd='17' AND strt_Date<='${data_day_str}' and end_date>'${data_day_str}' AND SRC_TBL='ODATA_N_PAS.J_HSSORG_HISTORY_DEPT_LEADER'  ) P1 
ON A.Emp_Id=P1.Emp_Id 
LEFT JOIN (SELECT DISTINCT DW_CD_VAL,DW_CD_VAL_DESC FROM  PDATA_N.REF_DW_CD_VAL WHERE DW_CD_ID='CD010' AND SRC_TBL='MANU_MATN') Nationality_Desc  
       ON A.Nationality = Nationality_Desc.DW_CD_VAL
LEFT JOIN (SELECT DISTINCT DW_CD_VAL,DW_CD_VAL_DESC FROM  PDATA_N.REF_DW_CD_VAL WHERE DW_CD_ID='CD009' AND SRC_TBL='MANU_MATN') Ethnic_Desc  
       ON A.Ethnic_Cd  = Ethnic_Desc.DW_CD_VAL
LEFT JOIN (SELECT DISTINCT DW_CD_VAL,DW_CD_VAL_DESC FROM  PDATA_N.REF_DW_CD_VAL WHERE DW_CD_ID='CD007' AND SRC_TBL='MANU_MATN') Dgre_Desc  
       ON A.Dgre_Cd  = Dgre_Desc.DW_CD_VAL
LEFT JOIN (SELECT DISTINCT DW_CD_VAL,DW_CD_VAL_DESC FROM  PDATA_N.REF_DW_CD_VAL WHERE DW_CD_ID='CD008' AND SRC_TBL='MANU_MATN') Edu_Dgre_Desc  
       ON A.Edu_Dgre_Cd  = Edu_Dgre_Desc.DW_CD_VAL
LEFT JOIN (SELECT DISTINCT DW_CD_VAL,DW_CD_VAL_DESC FROM  PDATA_N.REF_DW_CD_VAL WHERE DW_CD_ID='CD004' AND SRC_TBL='MANU_MATN') Marr_Stat_Desc  
       ON A.Marr_Stat_Cd  = Marr_Stat_Desc.DW_CD_VAL
LEFT JOIN (SELECT DISTINCT DW_CD_VAL,DW_CD_VAL_DESC FROM  PDATA_N.REF_DW_CD_VAL WHERE DW_CD_ID='CD005' AND SRC_TBL='MANU_MATN') Poli_Stat_Desc  
       ON A.Poli_Stat_Cd  = Poli_Stat_Desc.DW_CD_VAL
LEFT JOIN (SELECT DISTINCT DW_CD_VAL,DW_CD_VAL_DESC FROM  PDATA_N.REF_DW_CD_VAL WHERE DW_CD_ID='CD011' AND SRC_TBL='MANU_MATN') Emp_Stat_Desc  
       ON A.Emp_Stat_Cd  = Emp_Stat_Desc.DW_CD_VAL
LEFT JOIN (SELECT * FROM PDATA_N.T04_EMP_STATI_INFO_H WHERE Emp_Stati_Info_Type_Cd='38' AND Strt_Date <='${data_day_str}' and End_Date >'${data_day_str}' AND SRC_TBL='ODATA_N_PAS.J_HSSEMP_EMPLOYEE_OTHER_HOBBY') Psnl_Hobb
ON A.Emp_Id=Psnl_Hobb.Emp_Id
LEFT JOIN (SELECT * FROM PDATA_N.T04_EMP_STATI_INFO_H WHERE Emp_Stati_Info_Type_Cd='39' AND Strt_Date <='${data_day_str}' and End_Date >'${data_day_str}' AND SRC_TBL='ODATA_N_PAS.J_HSSEMP_EMPLOYEE_OTHER_HOBBY') Psnl_Spec
ON A.Emp_Id=Psnl_Spec.Emp_Id
LEFT JOIN(SELECT emp_id
                 ,CONCAT_WS(',',COLLECT_SET(Phone_Str_1)) AS Phone_Str
             from (
                   select emp_id
                          ,Phone_Str_1  
                     from(
                          select 
                                a.emp_id
                                ,E.Oth_Phone    AS Phone_Str     --手机串
                            FROM PDATA_N.T04_EMP A
                            LEFT JOIN (SELECT * FROM PDATA_N.T04_EMP_ADDR_H A  WHERE A.Strt_Date <='${data_day_str}'  and A.End_Date >'${data_day_str}'
                                        AND  SRC_TBL IN ('ODATA_N_ERP.H_PER_ALL_PEOPLE_F','ODATA_N_MMS.K_T_YG','ODATA_N_PPM.P_PERSON_BASE_INFO') 
                                          )E
                                   ON A.Emp_Id=E.Emp_Id 
                           )a
                      LATERAL  VIEW EXPLODE(split(Phone_Str,',')) TEMP  as Phone_Str_1
                      WHERE NVL(TRIM(Phone_Str_1),'') NOT IN ('', 'null','无','000','*')
                       )t
                      GROUP BY emp_id
                                   )Phone_Str
ON A.Emp_Id=Phone_Str.Emp_Id
LEFT JOIN (SELECT * FROM PDATA_N.T04_EMP_IMP_DATE_H WHERE Emp_Imp_Date_Type_Cd='05' AND Strt_Date <='${data_day_str}' and End_Date >'${data_day_str}' AND SRC_TBL='ODATA_N_PAS.J_HSSEMP_EMPLOYEE_BASEDOC_VER')  RD  --'05' --转正日期
       ON A.Emp_Id=RD.Emp_Id
LEFT JOIN (SELECT * FROM PDATA_N.T04_EMP_STATI_INFO_H WHERE Emp_Stati_Info_Type_Cd='41' AND Strt_Date <='${data_day_str}' and End_Date >'${data_day_str}' AND SRC_TBL='ODATA_N_PAS.J_HSSEMP_EMPLOYEE_CSRC_VER')  CEW  --'41' --证监会系统单位工作经历标志
       ON A.Emp_Id=CEW.Emp_Id
LEFT JOIN  (SELECT * FROM PDATA_N.T04_EMP_STATI_INFO_H WHERE Emp_Stati_Info_Type_Cd='40' AND Strt_Date <='${data_day_str}' and End_Date >'${data_day_str}' AND SRC_TBL='ODATA_N_PAS.J_HSSEMP_EMPLOYEE_BASEDOC_VER') PR
ON A.Emp_Id=PR.Emp_Id
LEFT JOIN  (SELECT * FROM PDATA_N.T04_EMP_STATI_INFO_H WHERE Emp_Stati_Info_Type_Cd='43' AND Strt_Date <='${data_day_str}' and End_Date >'${data_day_str}' AND SRC_TBL='ODATA_N_PAS.J_HSSEMP_EMPLOYEE_POST_INFO')  ODPD1  --'43' 智慧人力提供OA员工显示岗位名称（人工录入）
ON A.Emp_Id=ODPD1.Emp_Id
LEFT JOIN  (SELECT * FROM PDATA_N.T04_EMP_STATI_INFO_H WHERE Emp_Stati_Info_Type_Cd='44' AND Strt_Date <='${data_day_str}' and End_Date >'${data_day_str}' AND SRC_TBL='ODATA_N_PAS.J_HSSEMP_EMPLOYEE_POST_INFO')  ODPD2  --'44' 智慧人力提供OA员工显示岗位名称（加工）
ON A.Emp_Id=ODPD2.Emp_Id
LEFT JOIN (SELECT * FROM PDATA_N.T04_EMP_IMP_DATE_H WHERE Emp_Imp_Date_Type_Cd='07' AND Strt_Date <='${data_day_str}' and End_Date >'${data_day_str}' AND SRC_TBL='ODATA_N_PAS.J_HSSEMP_EMPLOYEE_POST_VER' ) NTRQ --内退日期
ON A.Emp_Id=NTRQ.Emp_Id
LEFT JOIN (
           select a.emp_id,a.strt_Date,a.end_Date,a.Pos_Id,b.pos_name
           from (select  emp_id,strt_Date,end_Date,Pos_Id ,row_number() over(partition by emp_id order by strt_Date desc, end_Date desc) rn
                   from pdata_n.t04_emp_pos_asgn_h  
                   where strt_Date<='${data_day_str}' --实例日期 
                   and Pri_Asgn_Flag='1' --主岗
                   and del_flag='0'
                   and src_tbl='ODATA_N_ERP.H_PER_ALL_ASSIGNMENTS_F'
           )a 
           left join (select pos_id,pos_name ,row_number() over(partition by pos_id order by strt_Date desc, end_Date desc) rn
                      from pdata_n.t04_pos_info_h where strt_Date<='${data_day_str}' and src_tbl='ODATA_N_ERP.A_PER_ALL_POSITIONS'
           )b 
           on a.pos_id=b.pos_id 
           and b.rn=1
           where a.rn=1
           ) posd
ON A.Emp_Id=posd.Emp_Id
;

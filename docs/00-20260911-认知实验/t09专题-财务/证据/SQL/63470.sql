-- task_id: 63470
-- hiveDb: pdata_n
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-GF_FDM_N/SUM/T98_FIN_SOB_SUBJ_SHOW_RELA.py
-- observed_at: 2026-09-05T01:06:22.650Z

-- createSql
--drop table if EXISTS T98_FIN_SOB_SUBJ_SHOW_RELA;
CREATE TABLE IF NOT EXISTS T98_FIN_SOB_SUBJ_SHOW_RELA (
   Child_Set_Name         STRING     COMMENT '子节点前端配置名称'
  ,Child_Seg              STRING     COMMENT '子科目id'
  ,Child_Seg_Name         STRING     COMMENT '子科目名称' 
  ,Prnt_Seg               STRING     COMMENT '父科目id'
  ,Prnt_Seg_Name          STRING     COMMENT '父科目名称'    
  ,Child_Prnt_Level       STRING     COMMENT '父子级层级' 
  ,Vld_Flag_Cd            STRING     COMMENT '有效标志代码'
  ,Tree_Flag_Cd           STRING     COMMENT '树标志代码'
  ,Data_Src_Cd            STRING     COMMENT '数据源代码'
)
COMMENT '财务帐套科目关系表'
STORED AS ORC
;

-- querySql
INSERT OVERWRITE TABLE T98_FIN_SOB_SUBJ_SHOW_RELA 
SELECT 
       B.FLEX_VALUE_SET_NAME AS Child_Set_Name,
       B.FLEX_VALUE          AS Child_Seg,         --子科目id
       B.DESCRIPTION         AS Child_Seg_Name,    --子科目名称
       A.FLEX_VALUE          AS Prnt_Seg,          --父科目id
       A.DESCRIPTION         AS Prnt_Seg_Name ,    --父科目名称
       A.HIERARCHY_LEVEL     AS Child_Prnt_Level,   --父级层级 
       B.ENABLED_FLAG        AS Vld_Flag_Cd,        --有效标志代码 
       '2'                   AS tree_flag_cd,
	   'ERP'                 AS Data_Src_Cd            --数据源代码
	   FROM (SELECT 
	           V.FLEX_VALUE_SET_ID,
               S.FLEX_VALUE_SET_NAME,
               V.FLEX_VALUE,
               V.DESCRIPTION,
               V.ENABLED_FLAG,
               V.HIERARCHY_LEVEL,
               H.CHILD_FLEX_VALUE_HIGH,
               H.CHILD_FLEX_VALUE_LOW
          FROM
		  (SELECT * FROM ODATA_N_ERP.A_FND_FLEX_VALUES_VL WHERE BUSI_DATE='${data_day_str}'
		  AND FLEX_VALUE_SET_ID IN ('1014849')
		  AND SUMMARY_FLAG = 'Y'
          --AND ENABLED_FLAG = 'Y' --20210831 陈潇注释掉解决'21219008','21210011'缺失问题
		  ) V 
		  INNER JOIN (SELECT * FROM ODATA_N_ERP.A_FND_FLEX_VALUE_SETS WHERE BUSI_DATE='${data_day_str}') S
		  ON V.FLEX_VALUE_SET_ID = S.FLEX_VALUE_SET_ID
		  INNER JOIN (SELECT * FROM ODATA_N_ERP.A_FND_FLEX_VALUE_HIERARCHIES WHERE BUSI_DATE=default.pretradedate('${data_day_str}',if(default.IsTradeDay('${data_day_str}')='1',0,1))) H
		  ON   V.FLEX_VALUE = H.PARENT_FLEX_VALUE AND V.FLEX_VALUE_SET_ID = H.FLEX_VALUE_SET_ID
     ) A
	 INNER JOIN
       (SELECT V.FLEX_VALUE_SET_ID,
               S.FLEX_VALUE_SET_NAME,
               V.FLEX_VALUE,
               V.DESCRIPTION,
               V.ENABLED_FLAG
          FROM 
		  (SELECT * FROM ODATA_N_ERP.A_FND_FLEX_VALUES_VL WHERE BUSI_DATE='${data_day_str}'
		  AND FLEX_VALUE_SET_ID IN ('1014849') 
		  AND SUMMARY_FLAG <> 'Y'
          -- AND ENABLED_FLAG = 'Y' --20210831 陈潇注释掉解决'21219008','21210011'缺失问题
           ) V 
		  INNER JOIN (SELECT * FROM ODATA_N_ERP.A_FND_FLEX_VALUE_SETS WHERE BUSI_DATE='${data_day_str}') S
         ON V.FLEX_VALUE_SET_ID = S.FLEX_VALUE_SET_ID
          ) B
 ON A.FLEX_VALUE_SET_ID = B.FLEX_VALUE_SET_ID 
  where    B.FLEX_VALUE BETWEEN A.CHILD_FLEX_VALUE_LOW AND A.CHILD_FLEX_VALUE_HIGH 
 -- ORDER BY Child_Seg
  
union all
select 
distinct
  child_set_name,
  child_seg,
  child_seg_name,
  prnt_seg,
  prnt_seg_name
  ,'' as child_prnt_level,
  '' as vld_flag_cd ,
  '1' as tree_flag_cd,
  'HFM' as Data_Src_Cd
  from odata_n_hfm.rpt_inr_seg_rela_h 
  where prnt_seg  not like 'Note%' 
  --and gkey='10020001'

union all
select
distinct 
  child_set_name,
  gkey as child_seg,
  key_name as child_seg_name,
  prnt_seg,
  prnt_seg_name
  ,'' as child_prnt_level,
  '' as vld_flag_cd 
  ,'2' as tree_flag_cd
  ,'HFM' as Data_Src_Cd
  from odata_n_hfm.rpt_inr_seg_rela_h 
  where prnt_seg  not like 'Note%' 
  
  --20220602 增加考核调整的数据
union all
select 
distinct
  ''            as child_set_name,
  Subj_Id       as child_seg,
  Subj_Name	    as child_seg_name,
  'COA'         as  prnt_seg,
  '会计科目表'  as prnt_seg_name,
  '' as child_prnt_level,
  ''  as vld_flag_cd ,
  '2' as tree_flag_cd,
  'FMS' as Data_Src_Cd
  from PDATA_N.T09_ACCTNT_SUBJ
  where Busi_Date='${data_day_str}'
  and SRC_TBL='ODATA_N_FMS.F_EXAM_ITEM_MANAGE'
;

-- task_id: 203216
-- hiveDb: dm_rd_n
-- source: SQL_MCP
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-dm_rd_n/IRP/dm_rd_n.ind_screen_index.py
-- observed_at: 2026-09-04T19:54:12.117Z

-- createSql
create table if not exists ind_screen_index (
  index_id string comment '指标id',
  index_name string comment '指标名',
  index_value string comment '指标值',
  data_time string comment '数据时间',
  busi_month string comment '业务月'
)
comment '智能研究展示大屏'
PARTITIONED BY (busi_date string comment '业务日期')
STORED AS orc ;

CREATE TABLE IF NOT EXISTS TEMP.ind_screen_index_TMP_ind_screen_index (
  index_id string,
  index_name string,
  index_value string,
  data_time string,
  busi_month string
)
;

-- querySql
DROP TABLE IF EXISTS TEMP.ind_screen_index_TMP_ind_screen_index;

INSERT INTO TABLE TEMP.ind_screen_index_TMP_ind_screen_index
SELECT  '1'                                                 AS Index_Id
, '当日作业运行成功次数'                                AS Index_Name
,COUNT(DISTINCT A.task_id)                            AS Index_Value
, '2026-05-24 08:15:22'                            AS Data_Time
,substr(DATE_ADD('2026-05-23', -1),1,7) as busi_month
FROM (
SELECT  *
FROM    pdata_n.t00_horae_task_instc_info
WHERE   Src_Tbl = 'ODATA_N_BDP.L_LB_TASK_RUN'
AND     busi_date IN ('2026-05-23',DATE_ADD('2026-05-23', -1))
AND     Due_Time > CONCAT(DATE_ADD('2026-05-23', -1), ' 22:00:00')
AND     Due_Time < CONCAT('2026-05-23', ' 22:00:00')
AND     Task_Instc_Stat_Cd = '53'
) A
JOIN (
SELECT  *
FROM    pdata_n.T00_HORAE_TASK_ADTNL_INFO
WHERE   src_tbl='ODATA_N_BDP.L_LB_TASK'
AND     ((theme_name='DM_RD_N' AND in_charge_user_id LIKE '%zhangyuanchun%')
OR (theme_name='PDATA_NEWS_N' AND in_charge_user_id LIKE '%wxxugaofei%')
OR (theme_name='PDATA_NEWS_N' AND in_charge_user_id LIKE '%wxtangyindi%')
OR (theme_name='DM_INDEX_N' AND in_charge_user_id LIKE '%zhangyuanchun%')
OR (theme_name='DM_INDEX_N' AND in_charge_user_id LIKE '%wxxujianquan%')
)
AND     task_stat_cd = 'Y'
) B ON A.task_id=B.task_id
;

INSERT INTO TABLE TEMP.ind_screen_index_TMP_ind_screen_index
SELECT '2'                                  AS Index_Id
, '数据表数量'                         AS Index_Name
, COUNT(1)                             AS Index_Value --目前明细表35张，pdata_news_n32张
, '2026-05-24 08:15:22'             AS Data_Time
,substr('2026-05-23',1,7) AS busi_month
FROM (
SELECT A.tbl_name
,MIN(CASE WHEN (A.in_charge_user_id LIKE '%zhangyuanchun%'
OR A.in_charge_user_id LIKE '%wxxugaofei%'
OR A.in_charge_user_id LIKE '%wxxujianquan%'
OR A.in_charge_user_id LIKE '%wxtangyindi%') THEN '1.zhangyuanchun'
WHEN A.in_charge_user_id LIKE '%liudongjing%' THEN '2.liudongjing'
WHEN B2.tbl_name IS NOT NULL THEN CONCAT('3.',B2.in_charge_user_id)
ELSE '4.other' END) col1
FROM (
SELECT  A.tbl_name ,B1.in_charge_user_id
FROM (
SELECT  tbl_name
FROM    pdata_n.t00_tbl_info
WHERE   src_tbl = 'ODATA_N_BDP.M_TBLS'
AND     (db_id = '247298'
OR (db_id = '26467' AND (tbl_name LIKE 'tyzx%irp' OR tbl_name LIKE 'nds_irp%maintenance'))
)
AND     tbl_name NOT LIKE '%temp%'
) A
LEFT JOIN (
SELECT  LOWER(schd_task_name) schd_task_name ,in_charge_user_id
FROM    pdata_n.T00_HORAE_TASK_ADTNL_INFO
WHERE   src_tbl = 'ODATA_N_BDP.L_LB_TASK'
AND     ((theme_name='DM_RD_N' AND in_charge_user_id LIKE '%zhangyuanchun%')
OR (theme_name='PDATA_NEWS_N' AND schd_task_name LIKE 'pdata_news_n.tyzx%irp%')
OR (theme_name='PDATA_NEWS_N' AND schd_task_name LIKE 'pdata_news_n.nds_irp%maintenance')
)
) B1 ON B1.schd_task_name LIKE CONCAT('%', A.tbl_name, '%')
UNION ALL
SELECT  A.tbl_name ,B1.in_charge_user_id
FROM (
SELECT  tbl_name
FROM    pdata_n.t00_tbl_info
WHERE   src_tbl = 'ODATA_N_BDP.M_TBLS'
AND     db_id IN ('247298','69237') --pdata_news_n、dm_index_n
AND     tbl_name NOT LIKE '%temp%'
) A
JOIN (
SELECT  LOWER(schd_task_name) schd_task_name ,in_charge_user_id
FROM    pdata_n.T00_HORAE_TASK_ADTNL_INFO
WHERE   src_tbl = 'ODATA_N_BDP.L_LB_TASK'
AND     ((theme_name='PDATA_NEWS_N' AND in_charge_user_id LIKE '%wxxugaofei%')
OR (theme_name='PDATA_NEWS_N' AND in_charge_user_id LIKE '%wxtangyindi%')
OR (theme_name='DM_INDEX_N' AND in_charge_user_id LIKE '%zhangyuanchun%')
OR (theme_name='DM_INDEX_N' AND in_charge_user_id LIKE '%wxxujianquan%')
)
) B1 ON B1.schd_task_name LIKE CONCAT('%', A.tbl_name, '%')
) A
LEFT JOIN (SELECT tbl_name ,in_charge_user_id FROM irp_tbl_in_charge) B2 ON A.tbl_name=B2.tbl_name
GROUP BY A.tbl_name
) A
WHERE col1 LIKE '%zhangyuanchun%'
;

INSERT INTO TABLE TEMP.ind_screen_index_TMP_ind_screen_index
SELECT
'3'                                     AS Index_Id
,'数据可视化产品-研究框架'                 AS Index_Name
,Index_Value                             AS Index_Value
,'2026-05-24 08:15:22'                AS Data_Time
,substr('2026-05-23',1,7)  as busi_month
FROM (
SELECT  count(1) as Index_Value
FROM    SPDATA_N.T00_RES_ITEM_INFO --204522
WHERE   SRC_TBL IN
('ODATA_N_IRP.K_FLOWCHART_RESOURCE'
,'ODATA_N_IRP.K_SJ_MIND_GRAPHRESOURCE'
)
AND     nvl(Res_Item_Stat_Cd,'')<>'01'
) tt
;

INSERT INTO TABLE TEMP.ind_screen_index_TMP_ind_screen_index
SELECT
'4'                                     AS Index_Id
,'输出阶段-服务调用次数'                   AS Index_Name
,count(1)                                AS Index_Value
,'2026-05-24 08:15:22'                AS Data_Time
,substr('2026-05-23',1,7)  as busi_month
FROM    PDATA_N.T05_RMS_API_ACS_LOG--204024
WHERE   SRC_TBL='ODATA_N_RMS.P_OPENAPI_LOG'
AND     substr(CREATE_TIME, 1, 10) <= '2026-05-23'
;

INSERT INTO TABLE TEMP.ind_screen_index_TMP_ind_screen_index
SELECT
'5'                                     AS Index_Id
,'输出阶段-累计接入客户数量'               AS Index_Name
,count(distinct  Api_Cust_Attr_Plac_Id)  AS Index_Value
,'2026-05-24 08:15:22'                AS Data_Time
,substr('2026-05-23',1,7)  as busi_month
FROM    PDATA_N.T05_RMS_API_ACS_LOG--204024
WHERE   SRC_TBL='ODATA_N_RMS.P_OPENAPI_LOG'
AND     substr(CREATE_TIME, 1, 10) <= '2026-05-23'
;

INSERT INTO TABLE TEMP.ind_screen_index_TMP_ind_screen_index
SELECT
'6'                                     AS Index_Id
,'投研数据集市TIDB-指标总数'               AS Index_Name
,count(distinct Idx_Id)                  AS Index_Value
,'2026-05-24 08:15:22'                AS Data_Time
,substr('2026-05-23',1,7)  as busi_month
FROM    SPDATA_N.T99_IDX_DEF_INFO
WHERE   SRC_TBL='ODATA_N_IRP.K_IND_INDICATOR_META'
AND     Logic_Del_Flag='0'
;

INSERT INTO TABLE TEMP.ind_screen_index_TMP_ind_screen_index
SELECT
'7'                                     AS Index_Id
,'投研数据集市TIDB-标准化数据点'           AS Index_Name
,count(1)                                AS Index_Value
,'2026-05-24 08:15:22'                AS Data_Time
,substr('2026-05-23',1,7)  as busi_month
FROM (
SELECT  A.indicator_key
FROM    (
SELECT  Idx_Id                          AS indicator_key
FROM    SPDATA_N.T99_IRP_IDX_DEF_ADTNL_INFO
WHERE   SRC_TBL='ODATA_N_IRP.K_IND_INDICATOR_META'
AND     Std_Flag = '1'
) A
JOIN    (
SELECT  Idx_Id                          AS indicator_key
FROM    SPDATA_N.T99_IDX_DEF_INFO
WHERE   SRC_TBL='ODATA_N_IRP.K_IND_INDICATOR_META'
AND     Logic_Del_Flag='0'
) B
ON      A.indicator_key=B.indicator_key
) t1
LEFT JOIN
(
SELECT  Idx_Id AS indicator_key
FROM    SPDATA_N.T98_IDX_VAL_INFO
WHERE   SRC_TBL='ODATA_N_IRP.K_IND_VALUE'
) t2
ON t1.indicator_key = t2.indicator_key
;

INSERT INTO TABLE TEMP.ind_screen_index_TMP_ind_screen_index
SELECT
'8'                                     AS Index_Id
,'投研数据集市TIDB-维度总数'               AS Index_Name
,count(1)                                AS Index_Value
,'2026-05-24 08:15:22'                AS Data_Time
,substr('2026-05-23',1,7)  as busi_month
FROM    SPDATA_N.T99_DIM_VAL_INFO
WHERE   SRC_TBL='ODATA_N_IRP.K_IND_DIM_VALUE' AND Dim_Val_Stat_Cd = '0'
;

INSERT INTO TABLE TEMP.ind_screen_index_TMP_ind_screen_index
SELECT
'9'                                             AS Index_Id
,'投研数据集市TIDB-覆盖行业'                      AS Index_Name
,count(distinct A.INDUSTRY)                      AS Index_Value
,'2026-05-24 08:15:22'                        AS Data_Time
,substr('2026-05-23',1,7)          as busi_month
FROM   (
SELECT  Idx_Id                          AS indicator_key
,Src_Indt_Ind                   AS industry
FROM    SPDATA_N.T99_IRP_IDX_DEF_ADTNL_INFO
WHERE   SRC_TBL='ODATA_N_IRP.K_IND_INDICATOR_META'
AND     Std_Flag = '1'
) A
JOIN    (
SELECT  Idx_Id                          AS indicator_key
FROM    SPDATA_N.T99_IDX_DEF_INFO
WHERE   SRC_TBL='ODATA_N_IRP.K_IND_INDICATOR_META'
AND     Logic_Del_Flag='0'
) B
ON      A.indicator_key=B.indicator_key
;

INSERT INTO TABLE TEMP.ind_screen_index_TMP_ind_screen_index
SELECT
'10'                                            AS Index_Id
,'投研数据集市TIDB-实体总数量'                     AS Index_Name
,count(distinct Src_Enty_Id)                     AS Index_Value
,'2026-05-24 08:15:22'                        AS Data_Time
,substr('2026-05-23',1,7)          as busi_month
FROM    SPDATA_N.T99_IRP_IDX_DEF_ADTNL_INFO
WHERE   SRC_TBL='ODATA_N_IRP.K_IND_INDICATOR_META'
;

INSERT INTO TABLE TEMP.ind_screen_index_TMP_ind_screen_index
SELECT
'11'                                            AS Index_Id
,'投研数据集市TIDB-指标标准化比率'                 AS Index_Name
,T2.index_value / T1.index_value * 100           AS Index_Value
,'2026-05-24 08:15:22'                        AS Data_Time
,substr('2026-05-23',1,7)          as busi_month
FROM (
SELECT
'6'                                     AS Index_Id
,'投研数据集市TIDB-指标总数'               AS Index_Name
,count(distinct Idx_Id)                  AS Index_Value
,'2026-05-24 08:15:22'                AS Data_Time
,substr('2026-05-23',1,7)  as busi_month
FROM    SPDATA_N.T99_IDX_DEF_INFO
WHERE   SRC_TBL='ODATA_N_IRP.K_IND_INDICATOR_META'
AND     Logic_Del_Flag='0'
)T1
JOIN (
SELECT  count(A.indicator_key)          AS Index_Value
FROM    (
SELECT  Idx_Id                          AS indicator_key
FROM    SPDATA_N.T99_IRP_IDX_DEF_ADTNL_INFO
WHERE   SRC_TBL='ODATA_N_IRP.K_IND_INDICATOR_META'
AND     Std_Flag = '1'
) A
JOIN    (
SELECT  Idx_Id                          AS indicator_key
FROM    SPDATA_N.T99_IDX_DEF_INFO
WHERE   SRC_TBL='ODATA_N_IRP.K_IND_INDICATOR_META'
AND     Logic_Del_Flag='0'
) B
ON      A.indicator_key=B.indicator_key
)T2
;

INSERT INTO TABLE TEMP.ind_screen_index_TMP_ind_screen_index
SELECT
'12'                                            AS Index_Id
,'年累计研报数'                                   AS Index_Name
,count(1)                                        AS Index_Value
,'2026-05-24 08:15:22'                        AS Data_Time
,substr('2026-05-23',1,7)          as busi_month
FROM    pdata_news_n.t02_rd_base_info
WHERE   src_id = 'RMS'
AND     rtp_stat = 200
AND     substr(rpt_inpt_time,1,4) = '2025'
;

INSERT INTO TABLE TEMP.ind_screen_index_TMP_ind_screen_index
SELECT
'13'                                            AS Index_Id
,'年累计电话会议数量'                             AS Index_Name
,count(distinct Src_Id)                          AS Index_Value
,'2026-05-24 08:15:22'                        AS Data_Time
,substr('2026-05-23',1,7)          as busi_month
from    pdata_n.T07_RMS_ACT_INFO
WHERE   SRC_TBL='ODATA_N_RMS.N_CRM_ACTIVITY_SERVICE'
AND     Del_Flag='0'
AND     substr(strt_time,1,4) = '2025'
AND     Appr_Stat_Cd not in ('2', '5', '6')
and     Rms_Serv_Type_Cd='201'
;

INSERT INTO TABLE TEMP.ind_screen_index_TMP_ind_screen_index
SELECT
'14'                                            AS Index_Id
,'年累计策略会议数'                               AS Index_Name
,count(1)                                        AS Index_Value
,'2026-05-24 08:15:22'                        AS Data_Time
,substr('2026-05-23',1,7)          as busi_month
FROM    PDATA_N.T07_RMS_STRG_CONF_INFO-- 204025
WHERE   SRC_TBL='ODATA_N_RMS.P_PORTAL_MEETING_MEET'--remove_tag = 0
AND     substr(Strg_Conf_Strt_Time, 1, 4) = '2025'
;

INSERT INTO TABLE TEMP.ind_screen_index_TMP_ind_screen_index
SELECT
'15'                                            AS Index_Id
,'年累计电话会议使用人数'                          AS Index_Name
,count(distinct a.serv_id,T.contact_id)          AS Index_Value
,'2026-05-24 08:15:22'                        AS Data_Time
,substr('2026-05-23',1,7)          as busi_month
FROM  PDATA_N.T98_RMS_SERV_BASE_INFO a
LATERAL VIEW explode(split(contact_id,',')) T AS contact_id
WHERE busi_date = '2026-05-23'
AND   substr(strt_time,1,4) = '2025'
AND   serv_type_code IN ('101','102','201','202','301','302')
;

INSERT INTO TABLE TEMP.ind_screen_index_TMP_ind_screen_index
SELECT
'21'                                                     AS Index_Id
,'年累计电话会议使用人数年同比'                           AS Index_Name
,nvl((ly.Index_Value / lly.Index_Value - 1) *100,0)     AS Index_Value
,'2026-05-24 08:15:22'                                 AS Data_Time
,substr('2026-05-23',1,7)                   as busi_month
FROM (
SELECT
'15'                                            AS Index_Id
,'年累计电话会议使用人数'                          AS Index_Name
,count(distinct a.serv_id,T.contact_id)          AS Index_Value
FROM  PDATA_N.T98_RMS_SERV_BASE_INFO a
LATERAL VIEW explode(split(contact_id,',')) T AS contact_id
WHERE busi_date = '2026-05-23'
AND   substr(strt_time,1,4) = '2025'
AND   serv_type_code IN ('101','102','201','202','301','302')
) ly
JOIN (
SELECT
'15'                                            AS Index_Id
,'年累计电话会议使用人数'                          AS Index_Name
,count(distinct a.serv_id,T.contact_id)          AS Index_Value
FROM  PDATA_N.T98_RMS_SERV_BASE_INFO a
LATERAL VIEW explode(split(contact_id,',')) T AS contact_id
WHERE busi_date = '2026-05-23'
AND   substr(strt_time,1,4) = '2024'
AND   serv_type_code IN ('101','102','201','202','301','302')
) lly ON 1 = 1
;

INSERT INTO TABLE TEMP.ind_screen_index_TMP_ind_screen_index
SELECT
'17'                                            AS Index_Id
,'客户使用覆盖率'                                 AS Index_Name
,t1.cnt / t2.cnt * 100                           AS Index_Value
,'2026-05-24 08:15:22'                        AS Data_Time
,'2026-04'                        as busi_month
FROM(
SELECT count(DISTINCT b.customerid) as cnt
FROM (
SELECT  distinct a.user_id AS user_objid
FROM    pdata_news_n.t02_rpt_read_det_info a
WHERE   split(read_evt_time,'-')[0] = substr('2026-04', 1, 4)
AND     LPAD(split(read_evt_time,'-')[1], 2, '0') = substr('2026-04', 6, 2)
UNION ALL
SELECT  distinct replace(Pty_Id,'RMS034-','') as user_objid
FROM    PDATA_N.T05_RMS_LOGN_LOG
WHERE   SRC_TBL='ODATA_N_RMS.P_PORTAL_LOGIN_EVENT'
AND     substr(Busi_Date, 1, 7) = '2026-04'
) a
INNER JOIN (
SELECT  REPLACE(Pty_Id,'RMS034-','')   AS OBJID
,Rela_Pty_Id                AS customerid
FROM    PDATA_N.T01_PTY_RELA_H
WHERE   SRC_TBL='ODATA_N_RMS.N_CRM_CONTACT'
AND     End_Date='2099-12-31'
) b
ON b.objid = a.user_objid
)t1
JOIN (
SELECT  COUNT(1) as cnt
FROM    PDATA_N.T01_RMS_CORP_CUST        --63203
WHERE   SRC_TBL = 'ODATA_N_RMS.N_CRM_CUSTOMER'
and     busi_date = '2026-05-23'
AND     del_flag = '0'
AND     Cust_Busi_Prog_Lvl_Cd != 4
)t2
;

INSERT INTO TABLE TEMP.ind_screen_index_TMP_ind_screen_index
SELECT
'22'                                                     AS Index_Id
,'客户使用覆盖率月同比'                                   AS Index_Name
,nvl((tt1.Index_Value / tt2.Index_Value - 1) * 100,0)   AS Index_Value
,'2026-05-24 08:15:22'                                 AS Data_Time
,'2026-04'                                 as busi_month
FROM(
SELECT
t1.cnt / t2.cnt * 100                           AS Index_Value
FROM(
SELECT count(DISTINCT b.customerid) as cnt
FROM (
SELECT  distinct a.user_id AS user_objid
FROM    pdata_news_n.t02_rpt_read_det_info a
WHERE   split(read_evt_time,'-')[0] = substr('2026-04', 1, 4)
AND     LPAD(split(read_evt_time,'-')[1], 2, '0') = substr('2026-04', 6, 2)
UNION ALL
SELECT  distinct replace(Pty_Id,'RMS034-','') as user_objid
FROM    PDATA_N.T05_RMS_LOGN_LOG
WHERE   SRC_TBL='ODATA_N_RMS.P_PORTAL_LOGIN_EVENT'
AND     substr(Busi_Date, 1, 7) = '2026-04'
) a
INNER JOIN (
SELECT  REPLACE(Pty_Id,'RMS034-','')   AS OBJID
,Rela_Pty_Id                AS customerid
FROM    PDATA_N.T01_PTY_RELA_H
WHERE   SRC_TBL='ODATA_N_RMS.N_CRM_CONTACT'
AND     End_Date='2099-12-31'
) b
ON b.objid = a.user_objid
)t1
JOIN (
SELECT  COUNT(1) as cnt
FROM    PDATA_N.T01_RMS_CORP_CUST        --63203
WHERE   SRC_TBL = 'ODATA_N_RMS.N_CRM_CUSTOMER'
and     busi_date = '2026-05-23'
AND     del_flag = '0'
AND     Cust_Busi_Prog_Lvl_Cd != 4
)t2
)tt1
JOIN (
SELECT
t1.cnt / t2.cnt * 100                           AS Index_Value
FROM(
SELECT count(DISTINCT b.customerid) as cnt
FROM (
SELECT  distinct a.user_id AS user_objid
FROM    pdata_news_n.t02_rpt_read_det_info a
WHERE   split(read_evt_time,'-')[0] = substr('2025-04', 1, 4)
AND     LPAD(split(read_evt_time,'-')[1], 2, '0') =  substr('2025-04', 6, 2)
UNION ALL
SELECT  distinct replace(Pty_Id,'RMS034-','') as user_objid
FROM    PDATA_N.T05_RMS_LOGN_LOG
WHERE   SRC_TBL='ODATA_N_RMS.P_PORTAL_LOGIN_EVENT'
AND     substr(Busi_Date, 1, 7) = '2025-04'
) a
INNER JOIN (
SELECT  REPLACE(Pty_Id,'RMS034-','')   AS OBJID
,Rela_Pty_Id                AS customerid
FROM    PDATA_N.T01_PTY_RELA_H
WHERE   SRC_TBL='ODATA_N_RMS.N_CRM_CONTACT'
AND     End_Date='2099-12-31'
) b
ON b.objid = a.user_objid
)t1
JOIN (
SELECT  COUNT(1) as cnt
FROM    PDATA_N.T01_RMS_CORP_CUST        --63203
WHERE   SRC_TBL = 'ODATA_N_RMS.N_CRM_CUSTOMER'
and     busi_date = '2026-05-23'
AND     del_flag = '0'
AND     Cust_Busi_Prog_Lvl_Cd != 4
)t2
)tt2
;

INSERT INTO TABLE TEMP.ind_screen_index_TMP_ind_screen_index
select
'18'                                                           as index_id,
'邮件报告发送次数'                                              as index_name,
cast(t.Rpt_Email_Send_Times   as int)                          as index_value,
'2026-05-24 08:15:22'                                           as data_time,
substr(default.add_months('2026-05-23', -1),1,7)     as busi_month
from    PDATA_N.T98_RMS_INTEL_RSRC_OPER_IDX_MTH t-- 204026
where   t.busi_date = '2026-05-23' AND t.Src_Tbl='ODATA_N_RMS.N_V_RPT_EMAIL_STATISTIC'
;

INSERT INTO TABLE TEMP.ind_screen_index_TMP_ind_screen_index
select
'24'                                                           as index_id,
'邮件报告发送次数同比'                                          as index_name,
nvl((m.total / n.total -1) * 100,0)                          as index_value,
'2026-05-24 08:15:22'                                           as data_time,
substr(default.add_months('2026-05-23', -1),1,7)     as busi_month
from
(
SELECT  t.Rpt_Email_Send_Times  as total
FROM    PDATA_N.T98_RMS_INTEL_RSRC_OPER_IDX_MTH t  -- 204026
WHERE   t.Src_Tbl='ODATA_N_RMS.N_V_RPT_EMAIL_STATISTIC' AND t.busi_date = '2026-05-23'
) m
left join (
select  t.Rpt_Email_Send_Times    as total
from    PDATA_N.T98_RMS_INTEL_RSRC_OPER_IDX_MTH t-- 204026
where   t.busi_date = default.add_months('2026-05-23', -12) AND t.Src_Tbl='ODATA_N_RMS.N_V_RPT_EMAIL_STATISTIC'
) n
;

INSERT OVERWRITE TABLE ind_screen_index PARTITION (busi_date = '2026-05-23')
SELECT * FROM TEMP.ind_screen_index_TMP_ind_screen_index
;

CREATE TABLE IF NOT EXISTS T05_OTC_DERI_EVT_RELA_H(
Evt_Id                     STRING COMMENT '事件编号'
,Rela_Evt_Id                STRING COMMENT '关联事件编号'
,Otc_Deri_Evt_Rela_Type_Cd   STRING COMMENT '场外衍生品事件关系类型代码'
,Strt_Date                  STRING COMMENT '开始日期'
,End_Date                   STRING COMMENT '结束日期'
,Data_Src_Cd                STRING COMMENT '数据来源代码'
,Task_Name                  STRING COMMENT '任务名'
,Data_Time                  STRING COMMENT '数据时间'
,Real_Src_Tbl               STRING COMMENT '真实源表'
)COMMENT '场外衍生品事件关系历史'
PARTITIONED BY (SRC_TBL   STRING COMMENT '源表')
STORED AS ORC;

CREATE TABLE IF NOT EXISTS TEMP.T05_OTC_DERI_EVT_RELA_H_TEMP_TIT298
AS
SELECT
CONCAT('TIT292-',KEY_SN_ID)             AS  Evt_Id1                 --事件编号
,IF(NVL(TRIM(TRANSFER_ID),'')='','',CONCAT('TIT157-',TRANSFER_ID))
AS  Rela_Evt_Id1            --关联事件编号
,'01'                                    AS  Otc_Deri_Evt_Rela_Type_Cd1--场外衍生品事件关系类型代码            '01'--结算通知书与收付款记录
,'TIT'                   AS  Data_Src_Cd1            --数据来源代码
,'ODATA_N_TIT.N_OPE_SETTLE_NOTICE_TRANSFER'                     AS  Src_Tbl1                --源表
,'PDATA_N.T05_OTC_DERI_EVT_RELA_H_TIT298'                      AS  Task_Name1              --任务名
,'ODATA_N_TIT.N_OPE_SETTLE_NOTICE_TRANSFER'                     AS  Real_Src_Tbl1           --真实源表
FROM (SELECT * FROM ODATA_N_TIT.N_OPE_SETTLE_NOTICE_TRANSFER WHERE BUSI_DATE ='2026-05-20') A
;

CREATE TABLE TEMP.T05_OTC_DERI_EVT_RELA_H_MID_TIT298
AS
SELECT
A.*,B.*
,CASE WHEN A.Evt_Id IS NULL     AND B.Evt_Id1 IS NOT NULL THEN 'I'           --当天不存在历史的数据为新增
WHEN A.Evt_Id IS NOT NULL AND B.Evt_Id1 IS NULL THEN 'D'           --历史不存在当天的数据为删除
ELSE 'S' END AS DATA_TYPE                                         --其他为无变更
FROM   (  SELECT
*
FROM  T05_OTC_DERI_EVT_RELA_H
WHERE STRT_DATE <='2026-05-20'
AND END_DATE  > '2026-05-20'
AND SRC_TBL IN ('ODATA_N_TIT.N_OPE_SETTLE_NOTICE_TRANSFER')  )A   --历史(昨日)开链数据
FULL OUTER JOIN TEMP.T05_OTC_DERI_EVT_RELA_H_TEMP_TIT298 B               --当天的数据
ON   A.Evt_Id= B.Evt_Id1
AND  A.Rela_Evt_Id= B.Rela_Evt_Id1
;
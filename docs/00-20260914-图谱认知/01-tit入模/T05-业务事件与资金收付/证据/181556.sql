WITH CALENDAR AS (
SELECT NATURE_DATE,SSE_DATE,LAST_1_DATE,LAST_2_DATE,NEXT_1_DATE,NEXT_2_DATE,DENSE_RANK() OVER(PARTITION BY 1 ORDER BY SSE_DATE) AS SSE_RN
FROM (
  SELECT CC.CAL_DATE AS NATURE_DATE,CC1.CAL_DATE AS SSE_DATE,CC1.LAST_1_DATE,CC1.LAST_2_DATE,CC1.NEXT_1_DATE,NEXT_2_DATE,ROW_NUMBER() OVER(PARTITION BY CC.CAL_DATE ORDER BY CC1.CAL_DATE) RN
  FROM (
    select from_unixtime(unix_timestamp(CAL_DATE,'yyyyMMdd'),'yyyy-MM-dd')  as CAL_DATE,mkt_cd as EXCHANGE_CODE,TRD_FLAG as IS_HOLIDAY
    from pdata_news_n.t02_tit_scr_trd_cal where SRC_ID = 'TIT' and GRP_ID = '01' and mkt_cd = 'NATURE' 
      AND from_unixtime(unix_timestamp(CAL_DATE,'yyyyMMdd'),'yyyy-MM-dd') between '2024-01-01' AND '${yyyy-MM-dd,1d}'
  ) CC
  LEFT JOIN (
    SELECT CAL_DATE,
    LAG(CAL_DATE) OVER(PARTITION BY 1 ORDER BY CAL_DATE) AS LAST_1_DATE,
    LAG(CAL_DATE,2) OVER(PARTITION BY 1 ORDER BY CAL_DATE) AS LAST_2_DATE,
    LEAD(CAL_DATE) OVER(PARTITION BY 1 ORDER BY CAL_DATE) AS NEXT_1_DATE,
    LEAD(CAL_DATE,2) OVER(PARTITION BY 1 ORDER BY CAL_DATE) AS NEXT_2_DATE
    FROM (
      select from_unixtime(unix_timestamp(CAL_DATE,'yyyyMMdd'),'yyyy-MM-dd')  as CAL_DATE,mkt_cd as EXCHANGE_CODE,TRD_FLAG as IS_HOLIDAY
      from pdata_news_n.t02_tit_scr_trd_cal where SRC_ID='TIT' and GRP_ID = '01' and mkt_cd = 'SSE' AND TRD_FLAG = '1'
    ) cc 
  ) CC1
  ON CC.CAL_DATE <= CC1.CAL_DATE 
) cla
WHERE RN = 1
ORDER BY NATURE_DATE
)

SELECT agt_id,
	trd_id,
	event_id,
	comp_stat,
	comp_stat_desc,
	create_time,
	appr_end_time,
	strt_time,
	end_time,
	evt_date,
	evt_type,
	evt_stat,
	evt_stat_desc,
	bgng_prcg_date,
	proc_name,
	proc_stat,
	tran_no,
	tran_type,
	tran_stat,
	clr_date,
	adj_frnt_bgng_pric,
	adj_pst_bgng_pric,
	inpt_time,
	err_type,
	stat,
	wind_cd,
	hld_pos_qty,
	src_upt_time,
	src_busi_date,
	key_ca_id,
	ex_date,
	ca_type,
	ca_sub_type,
	bel_dept,
	data_time,
	grp_id,
	busi_date FROM (
	 


select  distinct
        md.key_otc_trade_id  as agt_id                  --协议编号 
       ,md.internal_trade_id as trd_id                  --交易编号 
       ,''                   as event_id                --事件id
       ,cd.src_cd_val        as comp_stat               --合约状态 
       ,cd.src_cd_desc       as comp_stat_desc          --合约状态取值描述 
       ,md.created_datetime  as create_time             --创建时间 
       ,md.event_real_time   as appr_end_time           --事件审批结束时间 
       ,''                   as strt_time               --开始时间 
       ,''                   as end_time                --结束时间 
       ,md.event_date        as evt_date                --事件日期 
       ,md.event_type        as evt_type                --事件类型 
       ,''                   as evt_stat                --事件状态 
       ,''                   as evt_stat_desc           --事件状态取值描述 
       ,''                   as bgng_prcg_date          --期初定价日
       ,''                   as proc_name               --流程名称
       ,''                   as proc_stat               --流程状态
       ,''                   as tran_no                 --收付款编号
       ,''                   as tran_type               --收付款类型
       ,''                   as tran_stat               --收付款状态
       ,''                   as clr_date                --清算日期
       ,''                   as adj_frnt_bgng_pric      --调整前期初价格
       ,''                   as adj_pst_bgng_pric       --调整后期初价格
       ,''                   as inpt_time               --录入时间
       ,md.error_type        as err_type                --异常类型
       ,md.status            as stat                    --transfer状态/结算通知书
       ,''                   as wind_cd                 --wind代码
       ,''                   as hld_pos_qty             --持仓数量
       ,''                   as src_upt_time            --源系统更新时间
       ,''                   as src_busi_date           --源系统业务日期
       ,''                   as key_ca_id               --公司行为ID  
       ,''                   as ex_date                 --股票：股权登记日，基金：权益登记日
       ,''                   as ca_type                 --CA方式，如现金、股票、基金等
       ,''                   as ca_sub_type             --CA子类型，如送股、派息等 
       ,rb.department        as bel_dept                --部门
       ,from_unixtime(unix_timestamp(),'yyyy-MM-dd HH:mm:ss')  as data_time               --数据时间
       ,'06'                                                   as grp_id                  --并行标识
       ,'${yyyy-MM-dd}'                                        as busi_date               --业务日期
from (
--期权部分平仓TRANSFER未生成
  SELECT
  '期权部分平仓TRANSFER未生成' AS ERROR_TYPE,
  TOT.KEY_OTC_TRADE_ID ,
  TOT.INTERNAL_TRADE_ID ,
  ROOD.CONTR_STATUS,
  TOE.EVENT_DATE,
  TOE.EVENT_REAL_TIME,
  TOE.EVENT_TYPE,
  TT.CREATED_DATETIME,
  TT.TRANSFER_STATUS AS STATUS,
  TOT.KEY_BOOK_ID
  FROM  (
    select a.agt_id as key_otc_trade_id,a.stati_cont_desc as internal_trade_id,b.rela_agt_id as key_book_id
    from pdata_n.t03_agt_stati_info_h a
    left join PDATA_N.T03_AGT_RELA_H b
      on a.agt_id = b.agt_id and b.strt_date <= '${yyyy-MM-dd}' and b.end_date > '${yyyy-MM-dd}' and b.src_tbl = 'ODATA_N_TIT.D_TRD_OTC_TRADE'
    where a.strt_date <= '${yyyy-MM-dd}' and a.end_date > '${yyyy-MM-dd}' and a.src_tbl = 'ODATA_N_TIT.D_TRD_OTC_TRADE'
  ) TOT
  INNER JOIN (
    SELECT opt_comp_agt_id as KEY_OTC_TRADE_ID,Ext_Comp_No as CONTRACT_CODE,comp_stat_cd as CONTR_STATUS,Erly_Trmt_Date as EARLY_TERM_DATE,Create_Time as CREATED_DATETIME              
    from PDATA_N.T03_OTC_OPT_COMP_INFO 
    where src_tbl = 'ODATA_N_TIT.D_REF_OTC_OPTION_DEAL' and busi_date = '${yyyy-MM-dd}'
  )ROOD 
  ON TOT.KEY_OTC_TRADE_ID = ROOD.KEY_OTC_TRADE_ID 
  INNER JOIN (
    SELECT Opt_Comp_Agt_Id as KEY_OTC_TRADE_ID,Bgng_Prcg_Date as START_DATE,End_Prcg_Date as END_DATE,Src_Prd_Id as UNDERLYING_INS_ID,Undrl_Cd as UNDERLYING_WIND_CODE
    from PDATA_N.T03_OTC_OPT_COMP_STRU_ELMN_INFO 
    where src_tbl = 'ODATA_N_TIT.D_REF_OPTION_DEAL_STRUCTURE' and busi_date = '${yyyy-MM-dd}'
  )RODS 
  ON TOT.KEY_OTC_TRADE_ID = RODS.KEY_OTC_TRADE_ID
  INNER JOIN (
      SELECT Otc_Comp_Agt_Id as KEY_OPTION_DEAL_ID,Evt_Type_Cd as EVENT_TYPE,Evt_Date as EVENT_DATE,Evt_Stat_Cd as EVENT_STATUS,Create_Time as CREATED_DATETIME,Appr_End_Time as EVENT_REAL_TIME
      from PDATA_N.T05_OTC_COMP_DURA_CHG_EVT 
      where src_tbl = 'ODATA_N_TIT.D_TRD_OPTION_EVENT'
  )TOE                --场外合约存续期变动事件  最新全量数据   CREATED_DATETIME,EVENT_REAL_TIME 带时间
  ON TOT.KEY_OTC_TRADE_ID = TOE.KEY_OPTION_DEAL_ID
  AND TOE.EVENT_TYPE = 'PARTIAL_TERMINATION'
  AND TOE.EVENT_STATUS = '3'
  LEFT JOIN (
      select Comp_No as KEY_CONTRACT_ID,Clr_Date as CLEARING_DATE,Recv_Pymt_Type_Cd as TRANSFER_TYPE,Recv_Pymt_Stat_Cd as TRANSFER_STATUS,Create_Time as CREATED_DATETIME
      from PDATA_N.T05_OTC_RECV_PYMT_EVT
      where src_tbl = 'ODATA_N_TIT.D_TRD_TRANSFER' and del_flag <> '1'
  ) TT                --场外衍生品收付款事件   只有最新全量数据  CREATED_DATETIME 带时间
  ON TOT.INTERNAL_TRADE_ID = TT.KEY_CONTRACT_ID
  AND SUBSTR(TOE.EVENT_DATE,1,10) = SUBSTR(TT.CLEARING_DATE,1,10)
  AND TT.TRANSFER_STATUS IN ('VERIFIED','SETTLED')
  AND TT.TRANSFER_TYPE = 'PARTIAL_TERM_FEE' 
  JOIN CALENDAR C1
    ON SUBSTR(C1.NATURE_DATE,1,10) = '${yyyy-MM-dd,1d}'
  LEFT JOIN CALENDAR C2
  ON SUBSTR(TOE.EVENT_REAL_TIME,1,10) = C2.NATURE_DATE
  WHERE SUBSTR(C1.LAST_1_DATE,1,10) <= SUBSTR(TOE.EVENT_REAL_TIME,1,10)
  AND (TT.CREATED_DATETIME IS NULL OR SUBSTR(TT.CREATED_DATETIME,1,10) >= C2.NEXT_1_DATE)
  AND ROOD.CONTR_STATUS != '218'
  AND SUBSTR(TOE.EVENT_DATE,1,10) < '${yyyy-MM-dd,1d}'
  AND TOE.EVENT_REAL_TIME IS NOT NULL
  AND TOT.INTERNAL_TRADE_ID NOT LIKE 'OPT-OTC%'
  AND RODS.UNDERLYING_WIND_CODE NOT IN ('GAMMA.WI','CHARM.WI') --20250425增加条件
  AND SUBSTR(RODS.START_DATE,1,10) >= '2024-01-01' --为了增加效率增加此条件,如需查询24年之前的合约请先注释此条件
  UNION ALL

  --期权合约平仓TRANSFER未生成
  SELECT
  '期权合约终止TRANSFER未生成' AS ERROR_TYPE,
  TOT.KEY_OTC_TRADE_ID ,
  TOT.INTERNAL_TRADE_ID ,
  ROOD.CONTR_STATUS,
  NVL(ROOD.EARLY_TERM_DATE,RODS.END_DATE) AS EVENT_DATE,
  PRO.END_TIME_ AS EVENT_REAL_TIME,
  '期权合约终止',
  TT.CREATED_DATETIME,
  TT.TRANSFER_STATUS,
  TOT.KEY_BOOK_ID
  FROM  (
    select a.agt_id as key_otc_trade_id,a.stati_cont_desc as internal_trade_id,b.rela_agt_id as key_book_id
    from pdata_n.t03_agt_stati_info_h a
    left join PDATA_N.T03_AGT_RELA_H b
      on a.agt_id = b.agt_id and b.strt_date <= '${yyyy-MM-dd}' and b.end_date > '${yyyy-MM-dd}' and b.src_tbl = 'ODATA_N_TIT.D_TRD_OTC_TRADE'
    where a.strt_date <= '${yyyy-MM-dd}' and a.end_date > '${yyyy-MM-dd}' and a.src_tbl = 'ODATA_N_TIT.D_TRD_OTC_TRADE'
  ) TOT
  INNER JOIN (
    SELECT opt_comp_agt_id as KEY_OTC_TRADE_ID,Ext_Comp_No as CONTRACT_CODE,comp_stat_cd as CONTR_STATUS,Erly_Trmt_Date as EARLY_TERM_DATE,Create_Time as CREATED_DATETIME              
    from PDATA_N.T03_OTC_OPT_COMP_INFO 
    where src_tbl = 'ODATA_N_TIT.D_REF_OTC_OPTION_DEAL' and busi_date = '${yyyy-MM-dd}'
  )ROOD 
  ON TOT.KEY_OTC_TRADE_ID = ROOD.KEY_OTC_TRADE_ID 
  INNER JOIN (
    SELECT Opt_Comp_Agt_Id as KEY_OTC_TRADE_ID,Bgng_Prcg_Date as START_DATE,End_Prcg_Date as END_DATE,Src_Prd_Id as UNDERLYING_INS_ID,Undrl_Cd as UNDERLYING_WIND_CODE
    from PDATA_N.T03_OTC_OPT_COMP_STRU_ELMN_INFO 
    where src_tbl = 'ODATA_N_TIT.D_REF_OPTION_DEAL_STRUCTURE' and busi_date = '${yyyy-MM-dd}'
  )RODS 
  ON TOT.KEY_OTC_TRADE_ID = RODS.KEY_OTC_TRADE_ID
  INNER JOIN (
    SELECT Busi_Id as BUSINESS_KEY_,Proc_Def_Bpmn_Id as PROC_DEF_KEY_,Proc_Instc_Id as PROC_INST_ID_,to_timestamp(Stat_Time) as START_TIME_,to_timestamp(End_Time) as END_TIME_,Proc_Stat as STATE_,End_Node_Id as END_ACT_ID_
    from	PDATA_N.T05_TIT_PROC_INSTC 
    where SRC_TBL = 'ODATA_N_TIT.W_ACT_HI_PROCINST'
  ) PRO       --START_TIME_，END_TIME_ 带时间
  ON TOT.KEY_OTC_TRADE_ID = PRO.BUSINESS_KEY_ 
  AND PRO.PROC_DEF_KEY_ = 'Contract_effective_terminating_v1'
  AND PRO.STATE_ IN ('COMPLETED')
  AND PRO.END_ACT_ID_ = 'Event_0x994wk'
  LEFT JOIN CALENDAR C2
  ON GREATEST(SUBSTR(PRO.END_TIME_,1,10),SUBSTR(NVL(ROOD.EARLY_TERM_DATE,RODS.END_DATE),1,10)) = C2.NATURE_DATE
  LEFT JOIN (
      select Comp_No as KEY_CONTRACT_ID,Clr_Date as CLEARING_DATE,Recv_Pymt_Type_Cd as TRANSFER_TYPE,Recv_Pymt_Stat_Cd as TRANSFER_STATUS,Create_Time as CREATED_DATETIME
      from PDATA_N.T05_OTC_RECV_PYMT_EVT
      where src_tbl = 'ODATA_N_TIT.D_TRD_TRANSFER' and del_flag <> '1'
  ) TT                --场外衍生品收付款事件   只有最新全量数据
  ON TOT.INTERNAL_TRADE_ID = TT.KEY_CONTRACT_ID
  AND SUBSTR(NVL(ROOD.EARLY_TERM_DATE,RODS.END_DATE),1,10) = SUBSTR(TT.CLEARING_DATE,1,10)
  AND TT.TRANSFER_STATUS IN ('VERIFIED','SETTLED')
  AND SUBSTR(TT.CREATED_DATETIME,1,10) < C2.NEXT_1_DATE
  JOIN CALENDAR C1
    ON SUBSTR(C1.NATURE_DATE,1,10) = '${yyyy-MM-dd,1d}'
  WHERE SUBSTR(C1.LAST_1_DATE,1,10) <= SUBSTR(PRO.END_TIME_,1,10)
  AND TT.CREATED_DATETIME IS NULL
  AND ROOD.CONTR_STATUS != '218'
  AND SUBSTR(NVL(ROOD.EARLY_TERM_DATE,RODS.END_DATE),1,10) < '${yyyy-MM-dd,1d}'
  AND PRO.END_TIME_ IS NOT NULL
  AND TOT.INTERNAL_TRADE_ID NOT LIKE 'OPT-OTC%'
  AND RODS.UNDERLYING_WIND_CODE NOT IN ('GAMMA.WI','CHARM.WI') --20250425增加条件
  AND SUBSTR(RODS.START_DATE,1,10) >= '2024-01-01' --为了增加效率增加此条件,如需查询24年之前的合约请先注释此条件
  UNION ALL

  --互换部分平仓TRANSFER未生成
  SELECT
  '互换部分平仓TRANSFER未生成' AS ERROR_TYPE,
  TOT.KEY_OTC_TRADE_ID ,
  TOT.INTERNAL_TRADE_ID ,
  RT.CONTR_STATUS,
  TTE.EVENT_DATE,
  TTE.EVENT_REAL_TIME,
  TTE.EVENT_TYPE,
  TT.CREATED_DATETIME,
  TT.TRANSFER_STATUS,
  TOT.KEY_BOOK_ID
  FROM  (
    select a.agt_id as key_otc_trade_id,a.stati_cont_desc as internal_trade_id,b.rela_agt_id as key_book_id
    from pdata_n.t03_agt_stati_info_h a
    left join PDATA_N.T03_AGT_RELA_H b
      on a.agt_id = b.agt_id and b.strt_date <= '${yyyy-MM-dd}' and b.end_date > '${yyyy-MM-dd}' and b.src_tbl = 'ODATA_N_TIT.D_TRD_OTC_TRADE'
    where a.strt_date <= '${yyyy-MM-dd}' and a.end_date > '${yyyy-MM-dd}' and a.src_tbl = 'ODATA_N_TIT.D_TRD_OTC_TRADE'
  ) TOT
  INNER JOIN (
    SELECT Swap_Comp_Agt_Id as KEY_OTC_TRADE_ID,Ext_Comp_No as CONTRACT_CODE,Comp_Stat_Cd as CONTR_STATUS,Strt_Pric_Date as START_DATE,End_Pric_Date as END_DATE
    from PDATA_N.T03_OTC_SWAP_COMP_INFO
    where src_tbl = 'ODATA_N_TIT.D_REF_TRS' and busi_date = '${yyyy-MM-dd}'
  )RT    
  ON TOT.KEY_OTC_TRADE_ID = RT.KEY_OTC_TRADE_ID
  INNER JOIN (
      SELECT Otc_Comp_Agt_Id as KEY_OTC_TRADE_ID,Evt_Date as EVENT_DATE,Evt_Stat_Cd as EVENT_STATUS,Evt_Type_Cd as EVENT_TYPE,Create_Time as CREATED_DATETIME,Appr_End_Time AS EVENT_REAL_TIME,Src_Id as KEY_TRS_EVENT_ID 
      from PDATA_N.T05_OTC_COMP_DURA_CHG_EVT
      where src_tbl = 'ODATA_N_TIT.D_TRD_TRS_EVENT'
  )TTE            --场外合约存续期变动事件 最新全量数据 CREATED_DATETIME,EVENT_REAL_TIME 带时间
  ON TOT.KEY_OTC_TRADE_ID = TTE.KEY_OTC_TRADE_ID
  AND TTE.EVENT_TYPE = 'CLOSE_STOCKS'
  AND TTE.EVENT_STATUS = '3'
  LEFT JOIN (
      select Comp_No as KEY_CONTRACT_ID,Clr_Date as CLEARING_DATE,Recv_Pymt_Type_Cd as TRANSFER_TYPE,Recv_Pymt_Stat_Cd as TRANSFER_STATUS,Create_Time as CREATED_DATETIME,Swap_Dura_Evt_No as KEY_TRS_EVENT_ID
      from PDATA_N.T05_OTC_RECV_PYMT_EVT
      where src_tbl = 'ODATA_N_TIT.D_TRD_TRANSFER' and del_flag <> '1'
  ) TT                --场外衍生品收付款事件   只有最新全量数据
  ON TTE.KEY_TRS_EVENT_ID = TT.KEY_TRS_EVENT_ID
  AND TT.TRANSFER_STATUS IN ('VERIFIED','SETTLED')
  AND TT.TRANSFER_TYPE = 'TERMINATION_INCOME'
  JOIN CALENDAR C1
    ON SUBSTR(C1.NATURE_DATE,1,10) = '${yyyy-MM-dd,1d}'
  LEFT JOIN CALENDAR C2
    ON SUBSTR(TTE.EVENT_REAL_TIME,1,10) = C2.NATURE_DATE
  WHERE SUBSTR(C1.LAST_1_DATE,1,10) <= SUBSTR(TTE.EVENT_REAL_TIME,1,10)
  AND (TT.CREATED_DATETIME IS NULL OR SUBSTR(TT.CREATED_DATETIME,1,10) >= C2.NEXT_1_DATE)
  AND RT.CONTR_STATUS != '218'
  AND SUBSTR(TTE.EVENT_DATE,1,10) < '${yyyy-MM-dd,1d}'
  AND TTE.EVENT_REAL_TIME IS NOT NULL
  AND TOT.INTERNAL_TRADE_ID NOT LIKE 'OPT-OTC%'
  AND SUBSTR(RT.START_DATE,1,10) >= '2024-01-01' --为了增加效率增加此条件,如需查询24年之前的合约请先注释此条件
  UNION ALL

  --互换合约终止TRANSFER未生成
  SELECT
  '互换合约终止TRANSFER未生成' AS ERROR_TYPE,
  TOT.KEY_OTC_TRADE_ID ,
  TOT.INTERNAL_TRADE_ID ,
  RT.CONTR_STATUS,
  TTE.EVENT_DATE,
  TTE.EVENT_REAL_TIME,
  TTE.EVENT_TYPE,
  TT.CREATED_DATETIME,
  TT.TRANSFER_STATUS,
  TOT.KEY_BOOK_ID
  FROM  (
    select a.agt_id as key_otc_trade_id,a.stati_cont_desc as internal_trade_id,b.rela_agt_id as key_book_id
    from pdata_n.t03_agt_stati_info_h a
    left join PDATA_N.T03_AGT_RELA_H b
      on a.agt_id = b.agt_id and b.strt_date <= '${yyyy-MM-dd}' and b.end_date > '${yyyy-MM-dd}' and b.src_tbl = 'ODATA_N_TIT.D_TRD_OTC_TRADE'
    where a.strt_date <= '${yyyy-MM-dd}' and a.end_date > '${yyyy-MM-dd}' and a.src_tbl = 'ODATA_N_TIT.D_TRD_OTC_TRADE'
  ) TOT
  INNER JOIN (
    SELECT Swap_Comp_Agt_Id as KEY_OTC_TRADE_ID,Ext_Comp_No as CONTRACT_CODE,Comp_Stat_Cd as CONTR_STATUS,Strt_Pric_Date as START_DATE,End_Pric_Date as END_DATE
    from PDATA_N.T03_OTC_SWAP_COMP_INFO
    where src_tbl = 'ODATA_N_TIT.D_REF_TRS' and busi_date = '${yyyy-MM-dd}'
  )RT    
  ON TOT.KEY_OTC_TRADE_ID = RT.KEY_OTC_TRADE_ID
  INNER JOIN (
      SELECT Otc_Comp_Agt_Id as KEY_OTC_TRADE_ID,Evt_Date as EVENT_DATE,Evt_Stat_Cd as EVENT_STATUS,Evt_Type_Cd as EVENT_TYPE,Create_Time as CREATED_DATETIME,Appr_End_Time AS EVENT_REAL_TIME,Src_Id as KEY_TRS_EVENT_ID 
      from PDATA_N.T05_OTC_COMP_DURA_CHG_EVT
      where src_tbl = 'ODATA_N_TIT.D_TRD_TRS_EVENT'
  )TTE            --场外合约存续期变动事件 最新全量数据 CREATED_DATETIME,EVENT_REAL_TIME 带时间
  ON TOT.KEY_OTC_TRADE_ID = TTE.KEY_OTC_TRADE_ID
  AND TTE.EVENT_TYPE IN ('EARLY_TERMINATION','TERMINATION')
  AND TTE.EVENT_STATUS = '3'
  LEFT JOIN (
      select Comp_No as KEY_CONTRACT_ID,Clr_Date as CLEARING_DATE,Recv_Pymt_Type_Cd as TRANSFER_TYPE,Recv_Pymt_Stat_Cd as TRANSFER_STATUS,Create_Time as CREATED_DATETIME,Swap_Dura_Evt_No as KEY_TRS_EVENT_ID
      from PDATA_N.T05_OTC_RECV_PYMT_EVT
      where src_tbl = 'ODATA_N_TIT.D_TRD_TRANSFER' and del_flag <> '1'
  ) TT                --场外衍生品收付款事件   只有最新全量数据
  ON TTE.KEY_TRS_EVENT_ID = TT.KEY_TRS_EVENT_ID
  AND TT.TRANSFER_STATUS IN ('VERIFIED','SETTLED')
  AND TT.TRANSFER_TYPE = 'TERMINATION_INCOME'
  JOIN CALENDAR C1
    ON SUBSTR(C1.NATURE_DATE,1,10) = '${yyyy-MM-dd,1d}'
  LEFT JOIN CALENDAR C2
    ON SUBSTR(TTE.EVENT_REAL_TIME,1,10) = C2.NATURE_DATE
  WHERE SUBSTR(C1.LAST_1_DATE,1,10) <= SUBSTR(TTE.EVENT_REAL_TIME,1,10)
  AND (TT.CREATED_DATETIME IS NULL OR SUBSTR(TT.CREATED_DATETIME,1,10) >= C2.NEXT_1_DATE)
  AND RT.CONTR_STATUS != '218'
  AND SUBSTR(TTE.EVENT_DATE,1,10) < '${yyyy-MM-dd,1d}'
  AND TTE.EVENT_REAL_TIME IS NOT NULL
  AND TOT.INTERNAL_TRADE_ID NOT LIKE 'OPT-OTC%'
  AND SUBSTR(RT.START_DATE,1,10) >= '2024-01-01' --为了增加效率增加此条件,如需查询24年之前的合约请先注释此条件
  UNION ALL

  --结算通知书
SELECT 
ERROR_TYPE,
KEY_OTC_TRADE_ID,
INTERNAL_TRADE_ID,
CONTR_STATUS,
EVENT_DATE,
EVENT_REAL_TIME,
EVENT_TYPE,
CREATED_DATETIME,
STATUS,
KEY_BOOK_ID
FROM (
  --期权部分平仓结算通知书未生成
  SELECT
  '期权部分平仓结算通知书未生成' AS ERROR_TYPE,
  TOT.KEY_OTC_TRADE_ID ,
  TOT.INTERNAL_TRADE_ID ,
  ROOD.CONTR_STATUS,
  TOE.EVENT_DATE,
  TOE.EVENT_REAL_TIME,
  TOE.EVENT_TYPE,
  SN.CREATED_DATETIME,
  SN.STATUS,
  TOT.KEY_BOOK_ID,
  C2.NEXT_1_DATE,
  ROW_NUMBER() OVER(PARTITION BY TOT.KEY_OTC_TRADE_ID,TOE.EVENT_DATE ORDER BY NVL(SN.CREATED_DATETIME,'ZZZZZ')) AS RN
  FROM  (
    select a.agt_id as key_otc_trade_id,a.stati_cont_desc as internal_trade_id,b.rela_agt_id as key_book_id
    from pdata_n.t03_agt_stati_info_h a
    left join PDATA_N.T03_AGT_RELA_H b
      on a.agt_id = b.agt_id and b.strt_date <= '${yyyy-MM-dd}' and b.end_date > '${yyyy-MM-dd}' and b.src_tbl = 'ODATA_N_TIT.D_TRD_OTC_TRADE'
    where a.strt_date <= '${yyyy-MM-dd}' and a.end_date > '${yyyy-MM-dd}' and a.src_tbl = 'ODATA_N_TIT.D_TRD_OTC_TRADE'
  ) TOT
  INNER JOIN (
    SELECT opt_comp_agt_id as KEY_OTC_TRADE_ID,Ext_Comp_No as CONTRACT_CODE,comp_stat_cd as CONTR_STATUS,Erly_Trmt_Date as EARLY_TERM_DATE,Create_Time as CREATED_DATETIME              
    from PDATA_N.T03_OTC_OPT_COMP_INFO 
    where src_tbl = 'ODATA_N_TIT.D_REF_OTC_OPTION_DEAL' and busi_date = '${yyyy-MM-dd}'
  )ROOD 
  ON TOT.KEY_OTC_TRADE_ID = ROOD.KEY_OTC_TRADE_ID 
  INNER JOIN (
    SELECT Opt_Comp_Agt_Id as KEY_OTC_TRADE_ID,Bgng_Prcg_Date as START_DATE,End_Prcg_Date as END_DATE,Src_Prd_Id as UNDERLYING_INS_ID,Undrl_Cd as UNDERLYING_WIND_CODE
    from PDATA_N.T03_OTC_OPT_COMP_STRU_ELMN_INFO 
    where src_tbl = 'ODATA_N_TIT.D_REF_OPTION_DEAL_STRUCTURE' and busi_date = '${yyyy-MM-dd}'
  )RODS 
  ON TOT.KEY_OTC_TRADE_ID = RODS.KEY_OTC_TRADE_ID
  INNER JOIN (
      SELECT Otc_Comp_Agt_Id as KEY_OPTION_DEAL_ID,Evt_Type_Cd as EVENT_TYPE,Evt_Date as EVENT_DATE,Evt_Stat_Cd as EVENT_STATUS,Create_Time as CREATED_DATETIME,Appr_End_Time as EVENT_REAL_TIME
      from PDATA_N.T05_OTC_COMP_DURA_CHG_EVT 
      where src_tbl = 'ODATA_N_TIT.D_TRD_OPTION_EVENT'
  )TOE                --场外合约存续期变动事件  最新全量数据   CREATED_DATETIME,EVENT_REAL_TIME 带时间
    ON TOT.KEY_OTC_TRADE_ID = TOE.KEY_OPTION_DEAL_ID
    AND TOE.EVENT_TYPE = 'PARTIAL_TERMINATION'
    AND TOE.EVENT_STATUS = '3'
  LEFT JOIN (
      select Comp_No as KEY_CONTRACT_ID,Clr_Date as CLEARING_DATE,Recv_Pymt_Type_Cd as TRANSFER_TYPE,Recv_Pymt_Stat_Cd as TRANSFER_STATUS,Create_Time as CREATED_DATETIME,Recv_Pymt_No AS TRANSFER_ID
      from PDATA_N.T05_OTC_RECV_PYMT_EVT
      where src_tbl = 'ODATA_N_TIT.D_TRD_TRANSFER' and del_flag <> '1'
  ) TT                --场外衍生品收付款事件   只有最新全量数据  CREATED_DATETIME 带时间
    ON TOT.INTERNAL_TRADE_ID = TT.KEY_CONTRACT_ID
    AND TOE.EVENT_DATE = TT.CLEARING_DATE
    AND TT.TRANSFER_STATUS IN ('VERIFIED','SETTLED')
    AND TT.TRANSFER_TYPE = 'PARTIAL_TERM_FEE'
  LEFT JOIN (
    SELECT SUBSTR(Rela_Evt_Id,8) AS TRANSFER_ID,SUBSTR(EVT_ID,8) AS KEY_SN_ID
    FROM PDATA_N.T05_OTC_DERI_EVT_RELA_H
    WHERE SRC_TBL = 'ODATA_N_TIT.N_OPE_SETTLE_NOTICE_TRANSFER' 
      AND Strt_Date <= '${yyyy-MM-dd}' AND  '${yyyy-MM-dd}' < End_Date 
  ) NT
    ON TT.TRANSFER_ID = NT.TRANSFER_ID
  LEFT JOIN (
    select a.otc_comp_agt_id as key_otc_trade_id,a.sett_date as clearing_date,a.sett_ntfc_stat_cd as status,Create_Time as CREATED_DATETIME,Sett_Ntfc_Id as ID  
    from PDATA_N.T05_OTC_DERI_COMP_SETT_NTFC_SEND_EVT a
    where a.src_tbl = 'ODATA_N_TIT.N_OPE_SETTLE_NOTICE' and a.del_flag <> '1'
  ) SN 
    ON NT.KEY_SN_ID = SN.ID
    AND SN.STATUS IN ('GENERATED','NOTIFIED','REPLIED','VERIFIED','WITHDRAW')
  JOIN CALENDAR C1
    ON SUBSTR(C1.NATURE_DATE,1,10) = '${yyyy-MM-dd,1d}'
  LEFT JOIN CALENDAR C2
    ON SUBSTR(TT.CREATED_DATETIME,1,10) = C2.NATURE_DATE
  WHERE SUBSTR(C1.LAST_1_DATE,1,10) <= SUBSTR(TOE.EVENT_REAL_TIME,1,10)
  --AND SN.CREATED_DATETIME IS NULL 
  AND ROOD.CONTR_STATUS != '218'
  AND SUBSTR(TOE.EVENT_DATE,1,10) < '${yyyy-MM-dd,1d}'
  AND TOE.EVENT_REAL_TIME IS NOT NULL
  AND TOT.INTERNAL_TRADE_ID NOT LIKE 'OPT-OTC%'
  AND RODS.UNDERLYING_WIND_CODE NOT IN ('GAMMA.WI','CHARM.WI') --20250425增加条件
  AND SUBSTR(RODS.START_DATE,1,10) >= '2024-01-01' --为了增加效率增加此条件,如需查询24年之前的合约请先注释此条件
  UNION ALL

  --期权合约平仓结算通知书未生成
  SELECT
  '期权合约平仓结算通知书未生成' AS ERROR_TYPE,
  TOT.KEY_OTC_TRADE_ID ,
  TOT.INTERNAL_TRADE_ID ,
  ROOD.CONTR_STATUS,
  NVL(ROOD.EARLY_TERM_DATE,RODS.END_DATE) AS EVENT_DATE,
  PRO.END_TIME_ AS EVENT_REAL_TIME,
  '期权合约终止' as EVENT_TYPE,
  SN.CREATED_DATETIME,
  SN.STATUS,
  TOT.KEY_BOOK_ID,
  C2.NEXT_1_DATE,
  ROW_NUMBER() OVER(PARTITION BY TOT.KEY_OTC_TRADE_ID ORDER BY NVL(SN.CREATED_DATETIME,'ZZZZZ')) AS RN
  FROM  (
    select a.agt_id as key_otc_trade_id,a.stati_cont_desc as internal_trade_id,b.rela_agt_id as key_book_id
    from pdata_n.t03_agt_stati_info_h a
    left join PDATA_N.T03_AGT_RELA_H b
      on a.agt_id = b.agt_id and b.strt_date <= '${yyyy-MM-dd}' and b.end_date > '${yyyy-MM-dd}' and b.src_tbl = 'ODATA_N_TIT.D_TRD_OTC_TRADE'
    where a.strt_date <= '${yyyy-MM-dd}' and a.end_date > '${yyyy-MM-dd}' and a.src_tbl = 'ODATA_N_TIT.D_TRD_OTC_TRADE'
  ) TOT
  INNER JOIN (
    SELECT opt_comp_agt_id as KEY_OTC_TRADE_ID,Ext_Comp_No as CONTRACT_CODE,comp_stat_cd as CONTR_STATUS,Erly_Trmt_Date as EARLY_TERM_DATE,Create_Time as CREATED_DATETIME              
    from PDATA_N.T03_OTC_OPT_COMP_INFO 
    where src_tbl = 'ODATA_N_TIT.D_REF_OTC_OPTION_DEAL' and busi_date = '${yyyy-MM-dd}'
  )ROOD 
  ON TOT.KEY_OTC_TRADE_ID = ROOD.KEY_OTC_TRADE_ID 
  INNER JOIN (
    SELECT Opt_Comp_Agt_Id as KEY_OTC_TRADE_ID,Bgng_Prcg_Date as START_DATE,End_Prcg_Date as END_DATE,Src_Prd_Id as UNDERLYING_INS_ID,Undrl_Cd as UNDERLYING_WIND_CODE
    from PDATA_N.T03_OTC_OPT_COMP_STRU_ELMN_INFO 
    where src_tbl = 'ODATA_N_TIT.D_REF_OPTION_DEAL_STRUCTURE' and busi_date = '${yyyy-MM-dd}'
  )RODS 
  ON TOT.KEY_OTC_TRADE_ID = RODS.KEY_OTC_TRADE_ID
  INNER JOIN (
    SELECT Busi_Id as BUSINESS_KEY_,Proc_Def_Bpmn_Id as PROC_DEF_KEY_,Proc_Instc_Id as PROC_INST_ID_,to_timestamp(Stat_Time) as START_TIME_,to_timestamp(End_Time) as END_TIME_,Proc_Stat as STATE_,End_Node_Id as END_ACT_ID_
    from	PDATA_N.T05_TIT_PROC_INSTC 
    where SRC_TBL = 'ODATA_N_TIT.W_ACT_HI_PROCINST'
  ) PRO       --START_TIME_，END_TIME_ 带时间
    ON TOT.KEY_OTC_TRADE_ID = PRO.BUSINESS_KEY_ 
    AND PRO.PROC_DEF_KEY_ = 'Contract_effective_terminating_v1'
    AND pro.STATE_ IN ('COMPLETED')
    AND PRO.END_ACT_ID_ = 'Event_0x994wk'
  LEFT JOIN CALENDAR C2
    ON GREATEST(SUBSTR(PRO.END_TIME_,1,10),SUBSTR(NVL(ROOD.EARLY_TERM_DATE,RODS.END_DATE),1,10)) = C2.NATURE_DATE
  LEFT JOIN (
      select Comp_No as KEY_CONTRACT_ID,Clr_Date as CLEARING_DATE,Recv_Pymt_Type_Cd as TRANSFER_TYPE,Recv_Pymt_Stat_Cd as TRANSFER_STATUS,Create_Time as CREATED_DATETIME,Recv_Pymt_No AS TRANSFER_ID
      from PDATA_N.T05_OTC_RECV_PYMT_EVT
      where src_tbl = 'ODATA_N_TIT.D_TRD_TRANSFER' and del_flag <> '1'
  ) TT                --场外衍生品收付款事件   只有最新全量数据  CREATED_DATETIME 带时间
    ON TOT.INTERNAL_TRADE_ID = TT.KEY_CONTRACT_ID
    AND SUBSTR(NVL(ROOD.EARLY_TERM_DATE,RODS.END_DATE),1,10) = SUBSTR(TT.CLEARING_DATE,1,10)
    AND TT.TRANSFER_STATUS IN ('VERIFIED','SETTLED')
    AND SUBSTR(TT.CREATED_DATETIME,1,10) < C2.NEXT_1_DATE
  --AND TT.TRANSFER_TYPE IN ('TERMINATION_FEE','EXERCISE_FEE')
  LEFT JOIN (
    SELECT SUBSTR(Rela_Evt_Id,8) AS TRANSFER_ID,SUBSTR(EVT_ID,8) AS KEY_SN_ID
    FROM PDATA_N.T05_OTC_DERI_EVT_RELA_H
    WHERE SRC_TBL = 'ODATA_N_TIT.N_OPE_SETTLE_NOTICE_TRANSFER' 
      AND Strt_Date <= '${yyyy-MM-dd}' AND  '${yyyy-MM-dd}' < End_Date 
  ) NT
    ON TT.TRANSFER_ID = NT.TRANSFER_ID
  LEFT JOIN (
    select a.otc_comp_agt_id as key_otc_trade_id,a.sett_date as clearing_date,a.sett_ntfc_stat_cd as status,Create_Time as CREATED_DATETIME,Sett_Ntfc_Id as ID  
    from PDATA_N.T05_OTC_DERI_COMP_SETT_NTFC_SEND_EVT a
    where a.src_tbl = 'ODATA_N_TIT.N_OPE_SETTLE_NOTICE' and a.del_flag <> '1'
  ) SN 
    ON NT.KEY_SN_ID = SN.ID
    AND SN.STATUS IN ('GENERATED','NOTIFIED','REPLIED','VERIFIED','WITHDRAW')
  JOIN CALENDAR C1
    ON SUBSTR(C1.NATURE_DATE,1,10) = '${yyyy-MM-dd,1d}'
  WHERE SUBSTR(C1.LAST_1_DATE,1,10) <= GREATEST(SUBSTR(PRO.END_TIME_,1,10),SUBSTR(NVL(ROOD.EARLY_TERM_DATE,RODS.END_DATE),1,10))
    --AND SN.CREATED_DATETIME IS NULL 
    AND ROOD.CONTR_STATUS != '218'
    AND SUBSTR(NVL(ROOD.EARLY_TERM_DATE,RODS.END_DATE),1,10) < '${yyyy-MM-dd,1d}'
    AND PRO.END_TIME_ IS NOT NULL
    AND TOT.INTERNAL_TRADE_ID NOT LIKE 'OPT-OTC%'
    AND RODS.UNDERLYING_WIND_CODE NOT IN ('GAMMA.WI','CHARM.WI') --20250425增加条件
    AND SUBSTR(RODS.START_DATE,1,10) >= '2024-01-01' --为了增加效率增加此条件,如需查询24年之前的合约请先注释此条件
  UNION ALL

  --互换部分平仓结算通知书未生成
  SELECT
  '互换部分平仓结算通知书未生成' AS ERROR_TYPE,
  TOT.KEY_OTC_TRADE_ID ,
  TOT.INTERNAL_TRADE_ID ,
  RT.CONTR_STATUS,
  TTE.EVENT_DATE,
  TTE.EVENT_REAL_TIME,
  TTE.EVENT_TYPE,
  SN.CREATED_DATETIME,
  SN.STATUS,
  TOT.KEY_BOOK_ID,
  C2.NEXT_1_DATE,
  ROW_NUMBER() OVER(PARTITION BY TOT.KEY_OTC_TRADE_ID ORDER BY NVL(SN.CREATED_DATETIME,'ZZZZZ'),NVL(TTE.EVENT_DATE,'ZZZZZ')) AS RN
  FROM  (
    select a.agt_id as key_otc_trade_id,a.stati_cont_desc as internal_trade_id,b.rela_agt_id as key_book_id
    from pdata_n.t03_agt_stati_info_h a
    left join PDATA_N.T03_AGT_RELA_H b
      on a.agt_id = b.agt_id and b.strt_date <= '${yyyy-MM-dd}' and b.end_date > '${yyyy-MM-dd}' and b.src_tbl = 'ODATA_N_TIT.D_TRD_OTC_TRADE'
    where a.strt_date <= '${yyyy-MM-dd}' and a.end_date > '${yyyy-MM-dd}' and a.src_tbl = 'ODATA_N_TIT.D_TRD_OTC_TRADE'
  ) TOT
  INNER JOIN (
    SELECT Swap_Comp_Agt_Id as KEY_OTC_TRADE_ID,Ext_Comp_No as CONTRACT_CODE,Comp_Stat_Cd as CONTR_STATUS,Strt_Pric_Date as START_DATE,End_Pric_Date as END_DATE
    from PDATA_N.T03_OTC_SWAP_COMP_INFO
    where src_tbl = 'ODATA_N_TIT.D_REF_TRS' and busi_date = '${yyyy-MM-dd}'
  )RT    
  ON TOT.KEY_OTC_TRADE_ID = RT.KEY_OTC_TRADE_ID
  INNER JOIN (
      SELECT Otc_Comp_Agt_Id as KEY_OTC_TRADE_ID,Evt_Date as EVENT_DATE,Evt_Stat_Cd as EVENT_STATUS,Evt_Type_Cd as EVENT_TYPE,Create_Time as CREATED_DATETIME,Appr_End_Time AS EVENT_REAL_TIME,Src_Id AS KEY_TRS_EVENT_ID 
      from PDATA_N.T05_OTC_COMP_DURA_CHG_EVT
      where src_tbl = 'ODATA_N_TIT.D_TRD_TRS_EVENT'
  )TTE            --场外合约存续期变动事件 最新全量数据 CREATED_DATETIME,EVENT_REAL_TIME 带时间
    ON TOT.KEY_OTC_TRADE_ID = TTE.KEY_OTC_TRADE_ID
    AND TTE.EVENT_TYPE = 'CLOSE_STOCKS'
    AND TTE.EVENT_STATUS = '3'
  LEFT JOIN (
      select Comp_No as KEY_CONTRACT_ID,Clr_Date as CLEARING_DATE,Recv_Pymt_Type_Cd as TRANSFER_TYPE,Recv_Pymt_Stat_Cd as TRANSFER_STATUS,Create_Time as CREATED_DATETIME,Recv_Pymt_No AS TRANSFER_ID,Swap_Dura_Evt_No AS  KEY_TRS_EVENT_ID
      from PDATA_N.T05_OTC_RECV_PYMT_EVT
      where src_tbl = 'ODATA_N_TIT.D_TRD_TRANSFER' and del_flag <> '1'
  ) TT                --场外衍生品收付款事件   只有最新全量数据  CREATED_DATETIME 带时间
    ON TTE.KEY_TRS_EVENT_ID = TT.KEY_TRS_EVENT_ID
    AND TT.TRANSFER_STATUS IN ('VERIFIED','SETTLED')
    AND TT.TRANSFER_TYPE = 'TERMINATION_INCOME'
  LEFT JOIN (
    SELECT SUBSTR(Rela_Evt_Id,8) AS TRANSFER_ID,SUBSTR(EVT_ID,8) AS KEY_SN_ID
    FROM PDATA_N.T05_OTC_DERI_EVT_RELA_H
    WHERE SRC_TBL = 'ODATA_N_TIT.N_OPE_SETTLE_NOTICE_TRANSFER' 
      AND Strt_Date <= '${yyyy-MM-dd}' AND  '${yyyy-MM-dd}' < End_Date 
  ) NT
    ON TT.TRANSFER_ID = NT.TRANSFER_ID
  LEFT JOIN (
    select a.otc_comp_agt_id as key_otc_trade_id,a.sett_date as clearing_date,a.sett_ntfc_stat_cd as status,Create_Time as CREATED_DATETIME,Sett_Ntfc_Id as ID 
    from PDATA_N.T05_OTC_DERI_COMP_SETT_NTFC_SEND_EVT a
    where a.src_tbl = 'ODATA_N_TIT.N_OPE_SETTLE_NOTICE' and a.del_flag <> '1'
  ) SN 
    ON NT.KEY_SN_ID = SN.ID
    AND SN.STATUS IN ('GENERATED','NOTIFIED','REPLIED','VERIFIED','WITHDRAW')
  JOIN CALENDAR C1
    ON SUBSTR(C1.NATURE_DATE,1,10) = '${yyyy-MM-dd,1d}'
  LEFT JOIN CALENDAR C2
    ON SUBSTR(TTE.EVENT_REAL_TIME,1,10) = C2.NATURE_DATE
  WHERE SUBSTR(C1.LAST_1_DATE,1,10) <= SUBSTR(TTE.EVENT_REAL_TIME,1,10)
    --AND SN.CREATED_DATETIME IS NULL 
    AND RT.CONTR_STATUS != '218'
    AND SUBSTR(TTE.EVENT_DATE,1,10) < '${yyyy-MM-dd,1d}'
    AND TTE.EVENT_REAL_TIME IS NOT NULL
    AND TOT.INTERNAL_TRADE_ID NOT LIKE 'OPT-OTC%'
    AND SUBSTR(RT.START_DATE,1,10) >= '2024-01-01' --为了增加效率增加此条件,如需查询24年之前的合约请先注释此条件
  UNION ALL

  --互换合约终止结算通知书未生成
  SELECT
  '互换合约终止结算通知书未生成' AS ERROR_TYPE,
  TOT.KEY_OTC_TRADE_ID ,
  TOT.INTERNAL_TRADE_ID ,
  RT.CONTR_STATUS,
  TTE.EVENT_DATE,
  TTE.EVENT_REAL_TIME,
  TTE.EVENT_TYPE,
  SN.CREATED_DATETIME,
  SN.STATUS,
  TOT.KEY_BOOK_ID,
  C2.NEXT_1_DATE,
  ROW_NUMBER() OVER(PARTITION BY TOT.KEY_OTC_TRADE_ID ORDER BY NVL(SN.CREATED_DATETIME,'ZZZZZ'),NVL(TTE.EVENT_DATE,'ZZZZZ')) AS RN
  FROM  (
    select a.agt_id as key_otc_trade_id,a.stati_cont_desc as internal_trade_id,b.rela_agt_id as key_book_id
    from pdata_n.t03_agt_stati_info_h a
    left join PDATA_N.T03_AGT_RELA_H b
      on a.agt_id = b.agt_id and b.strt_date <= '${yyyy-MM-dd}' and b.end_date > '${yyyy-MM-dd}' and b.src_tbl = 'ODATA_N_TIT.D_TRD_OTC_TRADE'
    where a.strt_date <= '${yyyy-MM-dd}' and a.end_date > '${yyyy-MM-dd}' and a.src_tbl = 'ODATA_N_TIT.D_TRD_OTC_TRADE'
  ) TOT
  INNER JOIN (
    SELECT Swap_Comp_Agt_Id as KEY_OTC_TRADE_ID,Ext_Comp_No as CONTRACT_CODE,Comp_Stat_Cd as CONTR_STATUS,Strt_Pric_Date as START_DATE,End_Pric_Date as END_DATE
    from PDATA_N.T03_OTC_SWAP_COMP_INFO
    where src_tbl = 'ODATA_N_TIT.D_REF_TRS' and busi_date = '${yyyy-MM-dd}'
  )RT    
  ON TOT.KEY_OTC_TRADE_ID = RT.KEY_OTC_TRADE_ID
  INNER JOIN (
      SELECT Otc_Comp_Agt_Id as KEY_OTC_TRADE_ID,Evt_Date as EVENT_DATE,Evt_Stat_Cd as EVENT_STATUS,Evt_Type_Cd as EVENT_TYPE,Create_Time as CREATED_DATETIME,Appr_End_Time AS EVENT_REAL_TIME,Src_Id AS KEY_TRS_EVENT_ID  
      from PDATA_N.T05_OTC_COMP_DURA_CHG_EVT
      where src_tbl = 'ODATA_N_TIT.D_TRD_TRS_EVENT'
  )TTE            --场外合约存续期变动事件 最新全量数据 CREATED_DATETIME,EVENT_REAL_TIME 带时间
    ON TOT.KEY_OTC_TRADE_ID = TTE.KEY_OTC_TRADE_ID
    AND TTE.EVENT_TYPE IN ('EARLY_TERMINATION','TERMINATION')
    AND TTE.EVENT_STATUS = '3'
  LEFT JOIN (
      select Comp_No as KEY_CONTRACT_ID,Clr_Date as CLEARING_DATE,Recv_Pymt_Type_Cd as TRANSFER_TYPE,Recv_Pymt_Stat_Cd as TRANSFER_STATUS,Create_Time as CREATED_DATETIME,Recv_Pymt_No AS TRANSFER_ID,Swap_Dura_Evt_No AS  KEY_TRS_EVENT_ID
      from PDATA_N.T05_OTC_RECV_PYMT_EVT
      where src_tbl = 'ODATA_N_TIT.D_TRD_TRANSFER' and del_flag <> '1'
  ) TT                --场外衍生品收付款事件   只有最新全量数据  CREATED_DATETIME 带时间
    ON TTE.KEY_TRS_EVENT_ID = TT.KEY_TRS_EVENT_ID
    AND TT.TRANSFER_STATUS IN ('VERIFIED','SETTLED')
    AND TT.TRANSFER_TYPE = 'TERMINATION_INCOME'
  LEFT JOIN (
    SELECT SUBSTR(Rela_Evt_Id,8) AS TRANSFER_ID,SUBSTR(EVT_ID,8) AS KEY_SN_ID
    FROM PDATA_N.T05_OTC_DERI_EVT_RELA_H
    WHERE SRC_TBL = 'ODATA_N_TIT.N_OPE_SETTLE_NOTICE_TRANSFER' 
      AND Strt_Date <= '${yyyy-MM-dd}' AND  '${yyyy-MM-dd}' < End_Date 
  ) NT
    ON TT.TRANSFER_ID = NT.TRANSFER_ID
  LEFT JOIN (
    select a.otc_comp_agt_id as key_otc_trade_id,a.sett_date as clearing_date,a.sett_ntfc_stat_cd as status,Create_Time as CREATED_DATETIME,Sett_Ntfc_Id as ID 
    from PDATA_N.T05_OTC_DERI_COMP_SETT_NTFC_SEND_EVT a
    where a.src_tbl = 'ODATA_N_TIT.N_OPE_SETTLE_NOTICE' and a.del_flag <> '1'
  ) SN 
    ON NT.KEY_SN_ID = SN.ID
    AND SN.STATUS IN ('GENERATED','NOTIFIED','REPLIED','VERIFIED','WITHDRAW')
  JOIN CALENDAR C1
    ON SUBSTR(C1.NATURE_DATE,1,10) = '${yyyy-MM-dd,1d}'
  LEFT JOIN CALENDAR C2
    ON SUBSTR(TTE.EVENT_REAL_TIME,1,10) = C2.NATURE_DATE
  WHERE SUBSTR(C1.LAST_1_DATE,1,10) <= SUBSTR(TTE.EVENT_REAL_TIME,1,10)
  --AND SN.CREATED_DATETIME IS NULL 
  AND RT.CONTR_STATUS != '218'
  AND SUBSTR(TTE.EVENT_DATE,1,10) < '${yyyy-MM-dd,1d}'
  AND TTE.EVENT_REAL_TIME IS NOT NULL
  AND TOT.INTERNAL_TRADE_ID NOT LIKE 'OPT-OTC%'
  AND SUBSTR(RT.START_DATE,1,10) >= '2024-01-01' --为了增加效率增加此条件,如需查询24年之前的合约请先注释此条件
) SNI
WHERE RN = 1
  AND (CREATED_DATETIME IS NULL OR SUBSTR(CREATED_DATETIME,1,10) >= NEXT_1_DATE)
) MD
left join (
  SELECT SRC_CD_VAL,DW_CD_VAL,src_cd_desc
    FROM PDATA_N.REF_CD_CVT_MAP
  WHERE TGT_TAB_NAME = 'T03_OTC_OPT_COMP_INFO'
    AND TGT_TAB_FLD  = 'Comp_Stat_Cd'
    AND SRC_TAB_NAME = 'REF_OTC_OPTION_DEAL'
    AND SRC_FLD_NAME = 'CONTR_STATUS'
    AND SRC_SYS_NAME = 'TIT'
) CD on MD.CONTR_STATUS = CD.DW_CD_VAL
INNER JOIN (
  select book_agt_id as key_book_id,bel_dept as department  
  from PDATA_N.T03_OTC_DERI_BOOK_ADTNL_INFO
  where src_tbl = 'ODATA_N_TIT.D_REF_BOOK' and busi_date = '${yyyy-MM-dd}'
) RB
  ON MD.KEY_BOOK_ID = RB.KEY_BOOK_ID 
	) castTable
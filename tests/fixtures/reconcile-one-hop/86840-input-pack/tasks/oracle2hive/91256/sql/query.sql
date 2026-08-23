select
 key_otc_trade_id
,property_name
,property_value
,created_datetime
,created_by
,updated_datetime
,updated_by
,to_char(SYSDATE,'YYYY-MM-DD HH24:MI:SS') as DATA_TIME
from titans_dm.TRD_OTC_CONTR_PROPS


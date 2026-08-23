select
CURRENCY
,QUOTE_DATE
,MIDRATE
,UPDATED_DATETIME
,to_char(SYSDATE,'YYYY-MM-DD HH24:MI:SS') as DATA_TIME
,'${yyyy-MM-dd}' as busi_date
from titans_dm.ref_rmb_midrate


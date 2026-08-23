select
 key_instrument_id
,underlying_inst_id
,weight
,to_char(SYSDATE,'YYYY-MM-DD HH24:MI:SS') as DATA_TIME
from TITANS_DM.REF_BASKET_CONSTITUENT


select
     case when t1.cnt = t2.cnt then 1 else 0 end as check_result        --0:不通过，1:通过
from (
     select count(1) cnt from pdata_n.t05_otc_deri_comp_sett_ntfc_send_evt where  lower(src_tbl)='odata_n_tit.n_ope_settle_notice'  and del_flag='0'
) t1
join
(
     select count(1) cnt from odata_n_tit.n_ope_settle_notice  where busi_date ='${yyyy-MM-dd}' 
)t2
;
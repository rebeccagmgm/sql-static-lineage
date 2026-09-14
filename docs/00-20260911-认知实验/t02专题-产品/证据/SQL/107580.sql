-- task_id: 107580
-- hiveDb: pdata_ams
-- source: SQL_MCP
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-dm_ams/PDATA/T02/T02_BOND_PAYMENT_KXC.py
-- observed_at: 2026-09-04T02:10:14.023Z

-- createSql
create table if not exists T02_BOND_PAYMENT (
  sk_primary_key string comment '代理主键',
  public_dt string comment '公告日期',
  sk_f_bmpk_id string comment '债券市场代码代理外键',
  curr string comment '币种',
  cred_rights_record_dt string comment '债权登记日',
  exdividend_dt string comment '除息日',
  int_payment_dt string comment '付息日',
  int_pay_per_hand string comment '每手付息数',
  principal_pay_per_hand string comment '每手兑付本金数',
  after_int_pay_per_hand string comment '税后每手付息数',
  b_info_redeem_net_price string comment '每百元提前兑付/赎回净价',
  src_secu_code string comment '来源系统证券代码',
  system_source string comment '系统来源',
  syntimestamp string comment '内部使用',
  create_dt string comment '创建日期',
  update_dt string comment '更新日期'
)
comment '资管-债券付息和兑付'
PARTITIONED BY (busi_date string comment '业务日期')
STORED AS orc;

-- querySql
insert overwrite table T02_BOND_PAYMENT PARTITION (busi_date = '2026-05-18')
select
row_number() over()  AS SK_PRIMARY_KEY,--  代理主键
PUBLIC_DT,---公告日期
concat('BMKT',(CASE WHEN  MKT_CODE  IS NULL THEN '000' ELSE MKT_CODE END),BOND_CODE) AS SK_F_BMPK_ID,---债券市场代码代理外键
CURR,--  币种
CRED_RIGHTS_RECORD_DT,----债权登记日
EXDIVIDEND_DT,---除息日
INT_PAYMENT_DT,---付息日
INT_PAY_PER_HAND, ---每手付息数
PRINCIPAL_PAY_PER_HAND,---每手兑付本金数
AFTER_INT_PAY_PER_HAND,---税后每手付息数
b_info_redeem_net_price,--每百元提前兑付/赎回净价
SRC_SECU_CODE,--来源系统证券代码
'S07' AS SYSTEM_SOURCE,
from_unixtime(unix_timestamp(), 'yyyyMMddHHmmss') as syntimestamp,
from_unixtime(unix_timestamp(), 'yyyy-MM-dd') as create_dt,
from_unixtime(unix_timestamp(), 'yyyy-MM-dd') as update_dt
from
(
select
b_info_announcementdate as PUBLIC_DT,---公告日期
b.s_info_code as BOND_CODE , ----债券交易代码
c.ENUM_CODE AS MKT_CODE,---市场代码
d.ENUM_CODE AS CURR,--  币种
s_div_recorddate as CRED_RIGHTS_RECORD_DT,----债权登记日
s_div_exdate as EXDIVIDEND_DT,---除息日
b_info_paymentdate as INT_PAYMENT_DT,---付息日
b_info_interestperthousands as INT_PAY_PER_HAND, ---每手付息数
b_info_principalperthousands as PRINCIPAL_PAY_PER_HAND,---每手兑付本金数
b_info_principalaftertax as AFTER_INT_PAY_PER_HAND, ---税后每手付息数
b_info_redeem_net_price ,--每百元提前兑付/赎回净价
a.s_info_windcode as SRC_SECU_CODE--wind代码
FROM
odata_n_uip.w_cbondpayment a     --${owner_xn_dbcenter}.S07_CBondPayment a
INNER JOIN
odata_n_uip.w_windcustomcode b    --${owner_xn_dbcenter}.S07_WINDCUSTOMCODE b
ON
a.s_info_windcode = b.s_info_windcode
left join
PDATA_AMS.T00_SINITEK_SOURCE_MAPPING_TMP c
on
c.SOURCE_ENU_VALUE = b.s_info_exchmarket
and c.SINITEK_TABLE = 'XN_TABLE'
AND c.SINITEK_FIELD ='MKT_CODE'
AND c.SOURCE = '07'
AND c.SOURCE_TABLE = 'NEWWIND_TABLE'
AND c.SOURCE_FIELD = 'NEWWIND_FIELD'
left join
PDATA_AMS.T00_SINITEK_SOURCE_MAPPING_TMP d
on
D.SOURCE_ENU_VALUE = A.CRNCY_CODE
and d.SINITEK_TABLE = 'XN_TABLE'
AND d.SINITEK_FIELD ='CURR'
AND d.SOURCE = '07'
AND d.SOURCE_TABLE = 'NEWWIND_TABLE'
AND d.SOURCE_FIELD = 'NEWWIND_FIELD'
WHERE
b.s_info_windcode is not null
) aa;

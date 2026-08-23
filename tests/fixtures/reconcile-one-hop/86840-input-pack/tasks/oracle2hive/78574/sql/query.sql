select
ID
,KEY_CTPTY_ID
,PLAN_CODE
,MARK_MARKET
,UNDERLYING_SCOPE
,JOINT_TYPE
,MONITOR_PATTERN
,DEDUCTION_PATTERN
,FEE_SPIN_OFF
,FLOAT_PROFIT_OPEN
,CHARGE_PATTERN
,CTPTY_GUARANTEE_ID
,SIGNATURE_DATE
,CREATED_BY
,CREATED_DATETIME
,UPDATED_BY
,UPDATED_DATETIME
,IS_DELETED
,PLAN_STATUS
,to_char(SYSDATE,'YYYY-MM-DD HH24:MI:SS') as DATA_TIME
,need_margin
,need_allocate_cap_acct
,auto_remargin
,auto_withdraw
,auto_margin_op_time
,monitor_product_valuation
,department
,plan_property
,special_plan_remark
,receiver_min_amount
,pay_min_amount
,ultra_contract_id
,margin_collateral_type
,option_swap_fee_ratio
,plan_group_id
,is_allmarket_pb
,custom_ratio
,margin_type
,trs_structure_type
,auto_update_margin_line
,early_lock_pl
,null as GROUP_CTPTY_ID
from titans_dm.margin_plan


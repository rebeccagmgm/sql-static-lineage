/*
先准备当日两份资料，本模块还没有展开历史日。
sale_contracts：合约主信息；剔除费用互换、04组FAST及香港账簿。
sale_management：合约经营关系；提供经办人、引入机构、客户经理及分配比例。
下一步04用Agt_Id把它们和107491的逐日明细连接。
注意：这里的busi_date是加工日，04中det.busi_date才是收入归属日。
*/
-- PDATA_N.T98_OTC_DERI_COMP_SALE_INFO：场外衍生品合约销售收入基本信息表。
sale_contracts AS (
    select * from PDATA_N.T98_OTC_DERI_COMP_SALE_INFO
    where busi_date = '${yyyy-MM-dd}' and Src_Contr_Type != 'FEE_SWAP'  --销售收入不计算“费用互换”
        and grp_id != '04' and Book_Bel_Dept != 'OTC_HK'  --极速合约暂不计算，香港合约单独计算
)
,
-- PDATA_N.T98_OTC_COMP_MNG_RELA_INFO：合约经营关系；本脚本取本次加工日快照。
sale_management AS (
    select * from PDATA_N.T98_OTC_COMP_MNG_RELA_INFO
    where busi_Date = '${yyyy-MM-dd}'
)

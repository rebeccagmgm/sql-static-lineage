/*
02 / 哪条确认书记录进入后续加工？
输入：odata_n_tit.d_ks_trade_comfirm_info（交易确认书信息表）的加工日快照。
步骤：给每张确认书的历史记录排序 → 每张确认书只取最新一条。
输出：latest_confirmation，主脚本别名a；另外提供合约类型字典sct。

三个编号：
  key_trade_comfirm_id = 金仕达交易确认书ID（排序键、标的连接键、目标Agt_Id）。
  contract_code       = 主合约编号（输出Inr_Seri_No和Ext_Comp_No，不代替确认书ID）。
  counterparty_id     = 交易对手（直接连接境内客户client_id）。
*/

/* 第一步：排序
   busi_date是读取快照的日期；business_date是确认书记录的业务日期。
   rn=1表示当前快照里该确认书最新的一条，不是“最新有效的一条”。
*/
ranked_confirmations AS (
    select *,
        row_number() over(
            partition by key_trade_comfirm_id
            order by business_date desc
        ) as rn
    from odata_n_tit.d_ks_trade_comfirm_info -- 交易确认书信息表
    where busi_date = '${data_day_str}'
),

/* 第二步：每张确认书取1条
   本步输出仍包含合约状态、日期、本金等原字段。
   状态与起始日是否满足报表范围，在主脚本再判断；不可提前到排序前。
*/
latest_confirmation AS (
    select *
    from ranked_confirmations t
    where t.rn = 1
),

-- 并列输入：源互换类型的中文名，不参与挑选最新确认书。
-- a.trs_type（互换类型）→ sct.dw_cd_val（代码）→ dw_cd_val_desc（中文描述）。
contract_type_dictionary AS (
    select *
    from PDATA_N.REF_DW_CD_VAL -- 仓库代码取值
    where dw_cd_id = 'CD382' and remark = 'TITANS场外衍生品合约类型'
)
-- business_date并列时，原SQL没有第二排序键；本次不增加裁决规则。

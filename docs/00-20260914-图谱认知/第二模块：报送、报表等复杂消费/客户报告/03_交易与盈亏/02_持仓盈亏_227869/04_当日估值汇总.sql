-- 与结算一路并列：估值源d_value_report_element_result_pb，同时限定grp_id=h15、分区日及business_date=报告日。
-- 只取vr_opt_contractPV_eur（期权合约现值）和vr_trs_floatIncome_eur（互换浮动收益）两个要素。
-- rcf.remark用于INNER JOIN交易对手ID；rcf.business_key直接连接交易键，不走资金侧备注→内部交易号链。
-- 代码优先期权结构，否则互换多标的拼串；本路没有与01相同的wind_code非NULL筛选。
-- SUM(result)保持源符号，没有汇率转换；要素名eur不足以证明币种或客户/我司盈亏方向。
    SELECT
      SUBSTR(business_date, 1, 10) AS busi_date,
      ctpty_legal_entity,
      wind_code,
      SUM(CAST(result AS DOUBLE)) AS cap_amount
    FROM (
      -- @include 04.2_估值标的识别.sql
    )
    GROUP BY ctpty_legal_entity,SUBSTR(business_date, 1, 10), wind_code

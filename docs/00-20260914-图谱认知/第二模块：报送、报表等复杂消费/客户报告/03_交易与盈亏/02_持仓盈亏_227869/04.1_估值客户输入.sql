-- 当日估值输入 → 客户身份：本文件只取估值明细并补法律主体名称，不识别标的、不求和。
-- d_value_report_element_result_pb：估值要素结果；result为要素结果值。指定两个要素，分区日和业务日都限报告日。
-- d_ref_counter_party_p：交易对手资料；remark与id匹配，取得ctpty_legal_entity（法律主体名称）。
-- INNER JOIN意味着身份缺失的估值退出；DISTINCT(id,名称)不保证一id只对应一名称。
        SELECT
          rcf.*,
          ctpty_legal_entity
        FROM (
          SELECT *
          FROM odata_n_tit.d_value_report_element_result_pb
          WHERE grp_id = 'h15'
            AND busi_date = '${yyyy-MM-dd}'
            AND substr(business_date, 1, 10) = '${yyyy-MM-dd}'
            AND element_id IN ('vr_opt_contractPV_eur', 'vr_trs_floatIncome_eur')
        ) rcf
        INNER JOIN (
          SELECT DISTINCT
            id,
            ctpty_legal_entity
          FROM odata_n_tit.d_ref_counter_party_p
          WHERE busi_date = 'h15'
        ) rcp ON rcf.remark = rcp.id

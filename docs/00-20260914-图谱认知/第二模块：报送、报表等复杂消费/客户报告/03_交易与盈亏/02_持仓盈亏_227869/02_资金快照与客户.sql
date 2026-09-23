-- rcf=资金流水；先在busi_date='h15'内按src_busi_date计数，再在行数>100000的日期中取MAX。
-- 不是取行数最多的日期，也不能由阈值证明完整性；计数发生在结算类型/备注过滤之前。
-- 此MAX没有限制<=报告日，选源快照的日期与随后限制资金发生日期是两件事。
-- LIKE '%结算%'是文字包含匹配，也能命中“未结算”；IS NOT NULL仍允许空备注，不等于状态/格式验证。
-- cp=交易对手映射，INNER JOIN缺失会丢资金；DISTINCT只消除相同id+名称，不能保证id唯一。
-- tot=OTC交易，LEFT JOIN以资金备注精确等于内部交易号补交易键，不从备注字符串中提取编号。
        SELECT
          rcf.key_ctpty_id,
          rcf.vr_cap_busidate,
          rcf.vr_cap_type,
          rcf.vr_cap_remark,
          rcf.vr_cap_undrly_code,
          rcf.vr_cap_amount,
          cp.ctpty_legal_entity,
          tot.key_otc_trade_id
        FROM (
          SELECT
            key_ctpty_id,
            SUBSTR(vr_cap_busidate, 1, 10) AS vr_cap_busidate,
            vr_cap_type,
            vr_cap_remark,
            vr_cap_undrly_code,
            CAST(vr_cap_amount AS DOUBLE) AS vr_cap_amount
          FROM odata_n_tit.d_value_report_cap_flow_p
          WHERE busi_date = 'h15'
            AND src_busi_date = (
              SELECT MAX(src_busi_date)
              FROM (
                SELECT
                  src_busi_date,
                  COUNT(*) AS row_num
                FROM odata_n_tit.d_value_report_cap_flow_p
                WHERE busi_date = 'h15'
                GROUP BY src_busi_date
              )
              WHERE row_num > 100000
            )
            AND vr_cap_type LIKE '%结算%'
            AND vr_cap_remark IS NOT NULL
        ) rcf
        INNER JOIN (
          SELECT DISTINCT
            id,
            ctpty_legal_entity
          FROM odata_n_tit.d_ref_counter_party_p
          WHERE busi_date = 'h15'
        ) cp ON rcf.key_ctpty_id = cp.id
        LEFT JOIN (
          SELECT
            key_otc_trade_id,
            internal_trade_id
          FROM odata_n_tit.d_trd_otc_trade_p
          WHERE busi_date = 'h15'
        ) tot ON rcf.vr_cap_remark = tot.internal_trade_id

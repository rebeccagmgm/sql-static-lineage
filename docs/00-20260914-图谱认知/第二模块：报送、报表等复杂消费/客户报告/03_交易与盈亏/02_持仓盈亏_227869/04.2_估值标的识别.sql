-- 标的识别：输入为04.1带客户名称的估值记录；输出保留原估值明细并补wind_code。
-- business_key=交易键，先取期权结构代码，NULL才回退互换持仓去重排序后的拼串；空串不回退。
-- ods：期权交易结构表；trsp：互换当前腿持仓＋腿资料，固定h13分区，不是报告日。
      SELECT
        vrer.*,
        CASE
          WHEN underlying_wind_code IS NULL THEN trs_wind_code
          ELSE underlying_wind_code
        END AS wind_code
      FROM (
        -- @include 04.1_估值客户输入.sql
      ) vrer
      LEFT JOIN (
        SELECT
          key_otc_trade_id,
          underlying_wind_code
        FROM odata_n_tit.d_ref_option_deal_structure_p
        WHERE busi_date = 'h13'
      ) ods ON vrer.business_key = ods.key_otc_trade_id
      LEFT JOIN (
        SELECT
          key_otc_trade_id,
           CONCAT_WS(',', SORT_ARRAY(COLLECT_SET(wind_code))) AS trs_wind_code
        FROM (
          SELECT *
          FROM odata_n_tit.d_pos_trs_leg_current_pos_p
          WHERE busi_date = 'h13'
        ) pos
        LEFT JOIN (
          SELECT *
          FROM odata_n_tit.d_ref_trs_leg_p
          WHERE busi_date = 'h13'
        ) tl ON tl.KEY_LEG_ID = pos.KEY_LEG_ID
        GROUP BY key_otc_trade_id
      ) trsp ON vrer.business_key = trsp.key_otc_trade_id

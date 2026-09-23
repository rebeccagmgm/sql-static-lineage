-- ods=期权结构，按交易键取underlying_wind_code；固定读取h13分区，不是报告日分区。
-- trsp=互换当前持仓+互换腿，持仓KEY_LEG_ID关联腿，再按交易键收集标的代码。
-- COLLECT_SET去重、SORT_ARRAY排序、CONCAT_WS逗号拼串；AAA,BBB整体是一个匹配值，不自动拆成两个标的分摊。
-- 这些LEFT JOIN可能扩行；最终01再聚合不能消除被复制资金的金额影响。
      LEFT JOIN (
        SELECT
          key_otc_trade_id,
          underlying_wind_code
        FROM odata_n_tit.d_ref_option_deal_structure_p
        WHERE busi_date = 'h13'
      ) ods ON vrcf.key_otc_trade_id = ods.key_otc_trade_id
      LEFT JOIN (
        SELECT
          tl.key_otc_trade_id,
          CONCAT_WS(',', SORT_ARRAY(COLLECT_SET(pos.wind_code))) AS trs_wind_code
        FROM (
          SELECT KEY_LEG_ID,wind_code
          FROM odata_n_tit.d_pos_trs_leg_current_pos_p
          WHERE busi_date = 'h13'
        ) pos
        LEFT JOIN (
          SELECT KEY_LEG_ID,key_otc_trade_id
          FROM odata_n_tit.d_ref_trs_leg_p
          WHERE busi_date = 'h13'
        ) tl ON tl.KEY_LEG_ID = pos.KEY_LEG_ID
        GROUP BY tl.key_otc_trade_id
      ) trsp ON vrcf.key_otc_trade_id = trsp.key_otc_trade_id

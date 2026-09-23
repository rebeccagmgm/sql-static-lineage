-- 结算一路：02选择资金快照并取得客户/交易身份，03补标的代码，最后按客户名+标的累计资金。
-- 代码优先资金流水自身vr_cap_undrly_code，其次期权结构，再回退互换多标的拼串；只在NULL时回退，空串保留。
-- 资金日期先截10位，再与下方含时间的起始字面量比较；保留原写法，边界日期类型行为需引擎复核。
-- 结果日期强制写成报告日，金额却是筛选历史资金的合计，不是当天新增资金。
    SELECT
      '${yyyy-MM-dd}' AS busi_date,
      ctpty_legal_entity,
      wind_code,
      SUM(CAST(vr_cap_amount AS DOUBLE)) AS cap_amount
    FROM (
      SELECT
        vrcf.key_ctpty_id,
        vrcf.vr_cap_busidate,
        vrcf.vr_cap_type,
        vrcf.vr_cap_remark,
        vrcf.vr_cap_undrly_code,
        vrcf.vr_cap_amount,
        vrcf.ctpty_legal_entity,
        vrcf.key_otc_trade_id,
        CASE
          WHEN vrcf.vr_cap_undrly_code IS NULL THEN
            CASE
              WHEN ods.underlying_wind_code IS NULL THEN trsp.trs_wind_code
              ELSE ods.underlying_wind_code
            END
          ELSE vrcf.vr_cap_undrly_code
        END AS wind_code
      FROM (
-- @include 02_资金快照与客户.sql
      ) vrcf
-- @include 03_资金标的识别.sql
    )
    WHERE wind_code IS NOT NULL
      AND vr_cap_busidate >= '2021-01-22 00:00:00'
      AND vr_cap_busidate <= '${yyyy-MM-dd}'
    GROUP BY ctpty_legal_entity,wind_code

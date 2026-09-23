-- 04 客户类型价差适用期（118141的LEFT JOIN片段，不是独立SQL）
-- 输入：02写出的客户类型价差T99，以及info合约主信息中的客户号、类型和期初定价日。
-- 本文件：展开“哪些期初定价日适用”的参数区间，按客户＋类型＋合约期初日匹配。
-- 得到：c_sp，适用于这份合约的客户侧计算类型和两个价差系数；不按逐日计提日换档。
-- 下一步：05与03的合约侧字段一起选择；03与本文件是两路并行输入，不是前后覆盖。
--
-- 贯穿例：客户C1/OPTION_STOCK的0.002适用于2026-09-01至09-30期初的合约。
-- A1期初日09-10在区间内；无论正在算09-14、15还是16，客户侧都能匹配到0.002。
-- 但05是否采用它，还取决于相应日期有没有合约侧价差。

LEFT JOIN (
    SELECT
        CLIENT_ID, -- 客户编号：本例C1
        CONTRACT_TYPE, -- 合约类型代码：本例OPTION_STOCK
        CONTRACT_TYPE_NAME, -- 合约类型名称
        Spread_Calculation, -- 价差计算类型
        Annualized_Spread, -- 年化价差系数：本例0.002
        Absolute_Spread, -- 绝对价差系数
        date_add(strt_date, pos) AS busi_date -- 此处是可适用的合约期初日，不是det计提日
    FROM (
        SELECT
            Pty_Id AS CLIENT_ID, -- 原OIS CLIENT_ID
            Src_Comp_Type_Cd AS CONTRACT_TYPE, -- 原OIS CONTRACT_TYPE
            Src_Comp_Type_Desc AS CONTRACT_TYPE_NAME,
            IF(Calc_Type = '', null, Calc_Type) AS Spread_Calculation, -- 仅类型空串转NULL
            Annu_Sprd_Coef AS Annualized_Spread,
            Absl_Sprd_Coef AS Absolute_Spread,
            -- 两个上下限来自OIS CONTRACT_START_DATE_MIN/MAX；极值日期按原规则替换。
            IF(Bgng_Prcg_Date_Llmt = '1900-01-01', '2019-01-01', Bgng_Prcg_Date_Llmt) AS strt_date,
            IF(Bgng_Prcg_Date_Ulmt = '2999-12-31', '${yyyy-MM-dd}', Bgng_Prcg_Date_Ulmt) AS end_Date
        FROM PDATA_N.T99_DERI_CUTP_COMP_TYPE_SPRD_COEF_REF -- 衍生品对手方合约类型价差系数参考信息
        WHERE src_tbl = 'ODATA_N_OIS.O_CTPTY_CROSS_SELL_COEFFICIENT'
          AND Del_Flag = '0'
    ) x
    -- 正常非负区间逐日展开，首尾都包括；参数区间重叠时可匹配多条，不在这里择一。
    LATERAL VIEW posexplode(split(space(datediff(end_date, strt_date)), ' ')) y AS pos, val
) c_sp
    ON c_sp.CLIENT_ID = info.Cutp_Pty_Id
   AND c_sp.CONTRACT_TYPE = info.Contr_Type_Cd
   AND c_sp.busi_date = info.Strt_Pric_Date

-- 客户号直接取合约主信息info.Cutp_Pty_Id，不沿用105743管理归属中的特殊客户换号。
-- 本段未读取Vld_Date，也未按其选最新；未附加标的类型/当事人类别/业务类型等匹配条件。
-- 没有参数时合约仍由LEFT JOIN保留；展示与金额怎样处理缺失，继续看05。

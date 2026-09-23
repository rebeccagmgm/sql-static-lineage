-- 03 合约价差有效期（118141的LEFT JOIN片段，不是独立SQL）
-- 输入：01写出的合约价差T99，以及info合约主信息、det逐日本金费用。
-- 本文件：把每份合约的生效版本转成日期区间，再用“合约号＋计提日”匹配。
-- 得到：s_sp，某份合约在某个计提日适用的计算类型和两个价差系数。
-- 下一步：05将s_sp与04并行匹配的c_sp逐字段比较，选择用于收入的价差。
--
-- 贯穿例：T99.Inr_Comp_No=A1、Agt_Id=I1，0.006从2026-09-15生效；加工日09-22。
-- 若无更晚版本，本条展开09-15至09-22。A1的09-14匹配不到，09-15/16匹配到0.006。
-- info.Agt_Id=A1与原合约号Inr_Comp_No相连；T99.Agt_Id=I1非空只用于入选，不作连接键。

LEFT JOIN (
    SELECT
        Contract_Code, -- 原OIS合约号：本例A1
        Spread_Calculation, -- 价差计算类型：年化／绝对
        Annualized_Spread, -- 年化价差系数
        Absolute_Spread, -- 绝对价差系数
        date_add(strt_date, pos) AS busi_date -- 该版本适用的每个计提日
    FROM (
        SELECT
            Inr_Comp_No AS Contract_Code, -- 01中的A.CONTRACT_CODE，未转换的原合约号
            -- 仅计算类型空串转NULL；两个系数字段的空串仍原样保留。
            IF(Sprd_Calc_Type = '', null, Sprd_Calc_Type) AS Spread_Calculation,
            Annu_Sprd_Coef AS Annualized_Spread, -- 原A.ANNUALIZED_SPREAD
            Absl_Sprd_Coef AS Absolute_Spread, -- 原A.ABSOLUTE_SPREAD
            Vld_Date AS strt_date, -- 原A.EFFECTIVE_DATE，本版本生效日
            -- 本行生效日 → 下一条生效日前一天；最后一条 → 加工日。
            date_sub(
                lead(Vld_Date, 1, date_add('${yyyy-MM-dd}', 1)) OVER (
                    PARTITION BY Inr_Comp_No
                    ORDER BY Vld_Date
                ),
                1
            ) AS end_Date
        FROM PDATA_N.T99_DERI_COMP_SPRD_COEF_REF -- 衍生品合约价差系数参考信息
        WHERE src_tbl = 'ODATA_N_OIS.O_CONTRACT_SPREAD_RATE'
          AND Del_Flag = '0'
          AND coalesce(Coef_Type, '') != 'INR'
          AND Agt_Id != ''
    ) x
    -- 日期位置0..两日之差：正常非负区间包含首尾，每个位置形成一条参数日记录。
    LATERAL VIEW posexplode(split(space(datediff(end_date, strt_date)), ' ')) y AS pos, val
) s_sp
    ON s_sp.CONTRACT_CODE = info.Agt_Id
   AND s_sp.busi_date = det.busi_date

-- 连接含义：LEFT JOIN保留没有合约参数的合约日，05可继续使用客户侧字段。
-- 版本仅按原合约号分组、按Vld_Date排序，没有再按类型/系数大类分组，也无同日版本决胜键。
-- “非INR”包含Coef_Type的NULL/空串，不能改成仅CROSS；异常倒置区间的Hive行为未在本专题验证。

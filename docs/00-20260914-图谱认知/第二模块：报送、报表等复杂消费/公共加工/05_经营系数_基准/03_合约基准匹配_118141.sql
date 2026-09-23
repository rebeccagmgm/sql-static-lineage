-- 03 / 这份销售合约能匹配到哪条单笔基准？
-- 位置：118141的03_参数匹配引用本JOIN，展开在01_合约日与资料的FROM中。
-- 输入：info合约主信息；133055写入的合约T99。输出别名s_ba，供同层展示及收入CASE使用。
-- 本例：T99身份TIT_DEMO非空 → 保留；原号OPT_DEMO = info.Agt_Id → 匹配年化0.004。
-- 本段是主查询的一部分，不能独立执行。LEFT JOIN缺失时保留原合约日。

-- ① 从合约T99取可用配置；编号转换与参数改名保持原值。
LEFT JOIN (
    SELECT
        Inr_Comp_No AS Contract_Code, -- 原OIS合约号，不是本表转换后的Agt_Id
        Calc_Type AS BASE_CALCULATION, -- 年化／绝对
        Base_Yield AS BASE_AWARD_RATE, -- 基础收益率
        IF(Adtnl_Rwd = '', 0, Adtnl_Rwd) AS additional_reward, -- 空串改0，NULL仍为NULL
        Adtnl_Rwd_Flag AS have_additional_reward -- 取出标志，但后续收入CASE未使用
    FROM PDATA_N.T99_DERI_COMP_BASE_COEF_REF -- 衍生品合约基础系数参考信息
    -- 来源限133055交叉销售分区，不读133054的INR分区。
    -- 本例Del_Flag=0、Agt_Id=TIT_DEMO通过筛选；无日期/更新时间择一条件。
    WHERE src_tbl = 'ODATA_N_OIS.O_CONTRACT_BASE_RATE'
      AND Del_Flag = '0'
      AND Agt_Id != ''
) s_ba
    -- ② 配回销售合约：用原合约号OPT_DEMO，不是转换后的TIT_DEMO。
    -- 同号多条配置会扩行，参数选择COALESCE不会消除这些重复。
    ON s_ba.CONTRACT_CODE = info.Agt_Id

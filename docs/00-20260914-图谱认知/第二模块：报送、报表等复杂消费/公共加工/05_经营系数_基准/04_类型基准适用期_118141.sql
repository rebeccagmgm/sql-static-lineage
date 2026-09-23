-- 04 / 按合约类型维护的基准，能否用于这份合约？
-- 位置：与03并列，由118141的03_参数匹配引用，展开在01_合约日与资料的FROM中。
-- 输入：info合约主信息；133056写入的类型T99。输出c_ba，供同层展示及收入CASE使用。
-- 阅读顺序：①类型配置x → ②展开可适用的期初日 → ③用类型+合约期初日匹配。
--
-- README变例：OPTION_STOCK / 绝对0.003 / 9月16—30日 → 15条日期记录。
-- OPT_DEMO是OPTION_STOCK、期初9月18日，匹配其中9月18日这条。
-- 算9月19日收入时仍用期初9月18日匹配，本JOIN没有使用det计提日，也没有客户键。
-- 本段依赖主查询，不能独立执行；LEFT JOIN缺失时保留合约日。
LEFT JOIN (
    -- ② 将一条配置的日期区间展开；pos=0..14时，本例得到9月16..30日。
    SELECT
        CONTRACT_TYPE, -- 合约类型代码
        CONTRACT_TYPE_NAME, -- 合约类型名称
        BASE_CALCULATION, -- 年化／绝对
        BASE_AWARD_RATE, -- 基准系数
        date_add(strt_date, pos) AS busi_date -- 区间中的每个可适用日期
    FROM (
        -- ① 准备类型配置x：范围与系数来自02，先过滤来源、删除标志和部门。
        -- 只处理日期哨兵，不按Vld_Date生效日选版本，不使用业务/标的类型列匹配。
        SELECT
            Src_Comp_Type_Cd AS CONTRACT_TYPE,
            Src_Comp_Type_Desc AS CONTRACT_TYPE_NAME,
            Calc_Type AS BASE_CALCULATION,
            Base_Yield AS BASE_AWARD_RATE,
            -- 哨兵下限1900改为2019，上限2999改为运行日；展开范围仍是有限区间。
            IF(Bgng_Prcg_Date_Llmt = '1900-01-01', '2019-01-01', Bgng_Prcg_Date_Llmt) AS strt_date,
            IF(Bgng_Prcg_Date_Ulmt = '2999-12-31', '${yyyy-MM-dd}', Bgng_Prcg_Date_Ulmt) AS end_Date
        FROM PDATA_N.T99_DERI_COMP_TYPE_BASE_COEF_REF -- 衍生品合约类型基础系数参考信息
        WHERE src_tbl = 'ODATA_N_OIS.O_BUS_TYPE_BASE_RATE'
          AND Del_Flag = '0'
          AND Src_Dept_No = 'OTC'
    ) x
    -- ② 日期展开的实际位置：两日之差N → 空格拆分 → pos=0..N → date_add取日期。
    -- 正常非负区间含首尾；空值、逆向区间的Hive行为未由本地示例验证。
    LATERAL VIEW posexplode(split(space(datediff(end_date, strt_date)), ' ')) y AS pos, val
) c_ba
    -- ③ 用经营类别+期初日配回合约。c_ba.busi_date是可适用期初日，不是计提日。
    -- 重叠区间可能同时命中，原SQL不择一；合约基准有值也不能阻止本JOIN扩行。
    ON c_ba.CONTRACT_TYPE = info.Contr_Type_Cd
   AND c_ba.busi_date = info.Strt_Pric_Date

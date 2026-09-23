-- 02 / 某类合约可用什么基准，适用于哪些期初日？（生产任务133056，独立查询）
-- 输入：ODATA_N_OIS.O_BUS_TYPE_BASE_RATE（源SQL称销售收入交叉销售合约类型基础系数表）。
-- 输出：PDATA_N.T99_DERI_COMP_TYPE_BASE_COEF_REF（衍生品合约类型基础系数参考信息）。
-- 一条源配置原样映射成一条T99配置，无JOIN、无客户键，不展开日期。
--
-- README变例：OPTION_STOCK / ABSOLUTE / 0.003 / 期初日范围9月16—30日。
-- 这里先保存该条配置；04再展开范围，并用OPT_DEMO的期初日9月18日匹配。
-- 04产物c_ba与03产物s_ba并列，供118141逐字段选择；02不读取01的结果。
-- 源字段注释缺口见README；以下中文按目标DDL和实际字段映射解释。

INSERT OVERWRITE TABLE T99_DERI_COMP_TYPE_BASE_COEF_REF
PARTITION (SRC_TBL = '${src_table}')
SELECT
    -- 1. 参数主体：本例类型=OPTION_STOCK，计算类型=ABSOLUTE，系数=0.003。
    BUSINESS_TYPE AS Busi_Type, -- 业务类型
    BASE_CALCULATION AS Calc_Type, -- 计算类型：年化／绝对
    'CROSS' AS Coef_Type, -- 系数类型：交叉销售
    CONTRACT_TYPE AS Src_Comp_Type_Cd, -- 源合约类型代码：118141匹配Contr_Type_Cd
    CONTRACT_TYPE_NAME AS Src_Comp_Type_Desc, -- 源合约类型名称
    UNDERLYING_TYPE AS Src_Undrl_Type_Cd, -- 源标的类型代码：118141基准连接未用此列
    EFFECTIVE_DATE AS Vld_Date, -- 生效日期：有落表，但118141基准连接未用此列
    BASE_AWARD_RATE AS Base_Yield, -- 基础收益率：后续与本金相乘的基准系数

    -- 2. 维护记录
    CREATED_DATETIME AS Estb_Time, -- 创建时间
    UPDATED_DATETIME AS Upd_Time, -- 更新时间
    CREATED_BY AS Creator, -- 创建人
    UPDATED_BY AS Upd_Prsn, -- 更新人
    DISCRIPTION AS Desc, -- 描述
    CASE
        WHEN IS_DELETED = 'Y' THEN '1'
        WHEN IS_DELETED = 'N' THEN '0'
        ELSE IS_DELETED
    END AS Del_Flag, -- 删除标志：这里只转换，118141才过滤

    -- 3. 加工标识
    '${data_src_cd}' AS Data_Src_Cd, -- 数据来源代码
    '${filename}' AS Task_Name, -- 任务名
    '${data_day_str}' AS Data_Etl_Date, -- 数据加载日期
    '${data_today_str}' AS Data_Upt_Date, -- 数据更新日期
    '${data_today}' AS Data_Time, -- 数据时间
    '${src_table}' AS Real_Src_Tbl, -- 真实源表

    -- 4. 适用范围：本例部门OTC、期初日下限9月16日、上限9月30日。
    -- 这些范围值在本任务不展开；04才按它们生成可匹配日期、处理哨兵日期。
    DEPARTMENT AS Src_Dept_No, -- 源部门编码：118141只读OTC
    CONTRACT_START_DATE_MIN AS Bgng_Prcg_Date_Llmt, -- 期初定价日下限
    CONTRACT_START_DATE_MAX AS Bgng_Prcg_Date_Ulmt, -- 期初定价日上限
    'OTC' AS Bel_Busi_Dept -- 所属业务部门：固定值，不代替Src_Dept_No过滤
FROM (
    SELECT *
    FROM ${src_table}
    WHERE BUSI_DATE = '${data_day_str}'
) A
;

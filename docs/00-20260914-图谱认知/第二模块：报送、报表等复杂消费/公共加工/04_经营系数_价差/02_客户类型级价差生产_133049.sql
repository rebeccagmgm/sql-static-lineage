-- 02 客户＋合约类型级价差生产（任务133049）
-- 输入：OIS维护的一条“客户＋合约类型＋适用条件”参数，以及境内/香港客户分类资料。
-- 本文件：参数与适用日期原样带出，两路客户资料只补当事人类别，不计算价差或收入。
-- 得到：PDATA_N.T99_DERI_CUTP_COMP_TYPE_SPRD_COEF_REF（衍生品对手方合约类型价差系数参考信息）。
-- 下一步：04按客户号＋类型＋合约期初定价日匹配；05在合约价差缺失时使用相应客户字段。
--
-- 贯穿例：客户C1/类型OPTION_STOCK维护ANNUALIZED/0.002，期初日适用范围09-01至09-30。
-- 这里不含合约A1；到04才用A1的客户C1、类型和期初日09-10把两者关联起来。
-- 本任务的${src_table}是ODATA_N_OIS.O_CTPTY_CROSS_SELL_COEFFICIENT，不与01共用源参数执行。
-- 原文见99_证据/证据_133049.sql；源表及客户号/类型/系数/生效日注释带【AI】，上下限无AI标记。

INSERT OVERWRITE TABLE T99_DERI_CUTP_COMP_TYPE_SPRD_COEF_REF
PARTITION (SRC_TBL = '${src_table}')
SELECT
    -- 1. 客户身份：B境内分类优先，未命中再看C香港分类。
    A.CLIENT_ID AS Pty_Id, -- 当事人编号：客户号，本例C1
    -- 保留原类别代码；本CASE没有兜底ELSE，不凭110500/210500的数字猜含义。
    CASE
        WHEN B.IS_PROD_HOLDER = '01' THEN '110500'
        WHEN B.IS_PROD_HOLDER in ('02','03') THEN '210500'
        WHEN C.CLIENT_TYPE = 'Individual(PI Confirmed)' THEN '110500'
        WHEN C.CLIENT_TYPE in ('CPI','IPI') THEN '210500'
        WHEN trim(nvl(B.IS_PROD_HOLDER,'')) = '' THEN trim(nvl(C.CLIENT_TYPE,''))
    END AS Pty_Cate_Cd, -- 当事人类别代码

    -- 2. 业务分类与价差：原值传递，不除以100，不识别TIT/金仕达单笔合约。
    BUSINESS_TYPE AS Busi_Type, -- 业务类型
    CALCULATION_TYPE AS Calc_Type, -- 计算类型：本例ANNUALIZED
    'CROSS' AS Coef_Type, -- 系数类型：本任务固定交叉销售
    CONTRACT_TYPE AS Src_Comp_Type_Cd, -- 源合约类型代码：本例OPTION_STOCK
    CONTRACT_TYPE_NAME AS Src_Comp_Type_Desc, -- 源合约类型名称
    UNDERLYING_TYPE AS Src_Undrl_Type_Cd, -- 源标的类型代码
    ANNUALIZED_SPREAD AS Annu_Sprd_Coef, -- 年化价差系数：本例0.002
    ABSOLUTE_SPREAD AS Absl_Sprd_Coef, -- 绝对价差系数
    EFFECTIVE_DATE AS Vld_Date, -- 生效日期：04未按此列匹配，不能代替下面的期初日上下限
    DESCRIPTION AS Desc, -- 描述

    -- 3. 维护记录：删除标志在这里转换，118141取参时才过滤。
    CREATED_DATETIME AS Estb_Time, -- 创建时间
    CREATED_BY AS Creator, -- 创建人
    CASE
        WHEN IS_DELETED = 'Y' THEN '1'
        WHEN IS_DELETED = 'N' THEN '0'
        ELSE IS_DELETED
    END AS Del_Flag, -- 删除标志：其他标记原样保留

    -- 4. 加工标识
    '${data_src_cd}' AS Data_Src_Cd, -- 数据来源代码
    '${filename}' AS Task_Name, -- 任务名
    '${data_day_str}' AS Data_Etl_Date, -- 数据加载日期
    '${data_today_str}' AS Data_Upt_Date, -- 数据更新日期
    '${data_today}' AS Data_Time, -- 数据时间

    -- 5. 适用的合约期初定价日：本例覆盖2026-09-01至09-30。
    CONTRACT_START_DATE_MIN AS Bgng_Prcg_Date_Llmt, -- 期初定价日下限
    CONTRACT_START_DATE_MAX AS Bgng_Prcg_Date_Ulmt -- 期初定价日上限

-- A：ODATA_N_OIS.O_CTPTY_CROSS_SELL_COEFFICIENT（【AI】交易对手合约价差系数表）。
-- 按源快照日读取；目标只有SRC_TBL分区，源快照日不等于参数适用日。
FROM (
    SELECT *
    FROM ${src_table}
    WHERE BUSI_DATE = '${data_day_str}'
) A

-- B：衍生品交易对手维护表；按CLIENT_ID客户编号补IS_PROD_HOLDER客户类型。
-- 只排除DEPARTMENT='HK'，本连接没有客户删除标志筛选。
LEFT JOIN (
    SELECT CLIENT_ID, IS_PROD_HOLDER
    FROM ODATA_N_OIS.O_OTC_DERIVATIVE_COUNTERPARTY
    WHERE BUSI_DATE = '${data_day_str}'
      AND DEPARTMENT <> 'HK'
) B
    ON A.CLIENT_ID = B.CLIENT_ID

-- C：香港交易对手；按同一客户编号补CLIENT_TYPE客户类型。
-- LEFT JOIN不要求客户资料完整；两侧均未去重，多条匹配可使参数输出扩行。
LEFT JOIN (
    SELECT CLIENT_ID, CLIENT_TYPE
    FROM ODATA_N_OIS.G_HK_COUNTERPARTY
    WHERE BUSI_DATE = '${data_day_str}'
) C
    ON A.CLIENT_ID = C.CLIENT_ID
;

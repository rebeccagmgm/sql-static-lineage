-- 01 / 这条OIS合约配置属于哪份业务合约？（生产任务133055，独立查询）
-- 输入A已经维护原合约号、计算方式和系数；本段补身份，系数原值传递。
-- 输出：PDATA_N.T99_DERI_COMP_BASE_COEF_REF（衍生品合约基础系数参考信息）。
--
-- A原合约号 ── B交易编号映射 ── C互换 / D期权：按内部流水号识别
--          └─ E金仕达确认书：直接按原合约号识别
--                          ↓
-- T99同时保留：识别后的Agt_Id + 原合约号Inr_Comp_No + 原系数
--                          ↓
-- 03用Agt_Id非空筛选，用Inr_Comp_No匹配销售合约，不用两表Agt_Id直接相连。
-- 来源表原注释带【AI】；字段释义冲突见README证据区。

INSERT OVERWRITE TABLE T99_DERI_COMP_BASE_COEF_REF
PARTITION (SRC_TBL = '${src_table}')
SELECT
    -- 1. 输出身份：互换 → 期权 → 金仕达；按第一项命中。
    -- 构造例：A原号OPT_DEMO，经B映射为TIT_DEMO，只有D期权匹配。
    -- 本例Agt_Id=TIT_DEMO，Agt_Modifr=20207；下面Inr_Comp_No仍为OPT_DEMO。
    -- 都未识别时仍写参数，编号填空串；03消费才排除该配置。
    CASE
        WHEN C.KEY_OTC_TRADE_ID IS NOT NULL THEN B.KEY_OTC_TRADE_ID
        WHEN D.KEY_OTC_TRADE_ID IS NOT NULL THEN B.KEY_OTC_TRADE_ID
        WHEN E.KEY_TRADE_COMFIRM_ID IS NOT NULL THEN A.CONTRACT_CODE
        ELSE ''
    END AS Agt_Id, -- 协议编号：识别后的业务编号
    CASE
        WHEN C.KEY_OTC_TRADE_ID IS NOT NULL THEN '20206'
        WHEN D.KEY_OTC_TRADE_ID IS NOT NULL THEN '20207'
        WHEN E.KEY_TRADE_COMFIRM_ID IS NOT NULL THEN '20206-KST'
        ELSE ''
    END AS Agt_Modifr, -- 协议修饰符
    A.CONTRACT_CODE AS Inr_Comp_No, -- 内部合约编号：原OIS合约号，118141实际用这个连接

    -- 2. 输出参数：本例Calc_Type=ANNUALIZED、Base_Yield=0.004。
    -- 0.004是系数，年化时按0.4%使用；金额要等118141乘本金后才形成。
    A.BASE_CALCULATION AS Calc_Type, -- 计算类型：ANNUALIZED年化／ABSOLUTE绝对
    'CROSS' AS Coef_Type, -- 系数类型：交叉销售
    A.BASE_AWARD_RATE AS Base_Yield, -- 基础收益率：基准项使用的系数
    '' AS Dft_Base_Coef, -- 拟定基础系数：交叉销售分支填空串
    A.DISCRIPTION AS Desc, -- 描述：保留源字段拼写

    -- 3. 经办与额外奖励：带出属性，不在本段分配人员收入。
    A.OPERATOR_NAME AS Main_Oper_Prsn, -- 主经办人：按目标DDL释义
    A.INTRODUCTION_OPERATOR_NAME AS Intro_Oper_Prsn, -- 引入经办人：源AI注释有冲突，见README
    A.HAVE_ADDITIONAL_REWARD AS Adtnl_Rwd_Flag, -- 额外奖励标志
    A.ADDITIONAL_REWARD AS Adtnl_Rwd, -- 额外奖励：与Base_Yield是不同字段

    -- 4. 维护记录
    A.CREATED_DATETIME AS Estb_Time, -- 创建时间
    A.UPDATED_DATETIME AS Upd_Time, -- 更新时间
    A.CREATED_BY AS Creator, -- 创建人
    A.UPDATED_BY AS Upd_Prsn, -- 更新人
    CASE
        WHEN A.IS_DELETED = 'Y' THEN '1'
        WHEN A.IS_DELETED = 'N' THEN '0'
        ELSE A.IS_DELETED
    END AS Del_Flag, -- 删除标志：这里只转换；118141才过滤Del_Flag='0'

    -- 5. 加工标识
    '${data_src_cd}' AS Data_Src_Cd, -- 数据来源代码
    '${filename}' AS Task_Name, -- 任务名
    '${data_day_str}' AS Data_Etl_Date, -- 数据加载日期
    '${data_today_str}' AS Data_Upt_Date, -- 数据更新日期
    '${data_today}' AS Data_Time -- 数据时间

-- 输入与连接：全部LEFT JOIN，主体是参数A，不是全部交易。
-- 缺少身份仍保留A；连接右侧多行可能扩行，不保证每合约只输出一行。
-- 各表按参数日取快照，目标按SRC_TBL覆盖；这里没有参数历史版本择一。
FROM (
    SELECT *
    FROM ${src_table}
    WHERE BUSI_DATE = '${data_day_str}'
) A

-- B：ODATA_N_TIT.D_TRD_OTC_TRADE，交易编号映射。
-- INTERNAL_TRADE_ID=交易内部编号；KEY_OTC_TRADE_ID=TRADEFLOW内部交易流水号。
-- 本例A.CONTRACT_CODE=OPT_DEMO匹配B.INTERNAL_TRADE_ID，带出B.KEY_OTC_TRADE_ID=TIT_DEMO。
LEFT JOIN (
    SELECT *
    FROM ODATA_N_TIT.D_TRD_OTC_TRADE
    WHERE BUSI_DATE = '${data_day_str}'
) B
    ON A.CONTRACT_CODE = B.INTERNAL_TRADE_ID

-- C：场外交易-TRS；这里只用是否匹配到交易键来判定身份。
LEFT JOIN (
    SELECT *
    FROM ODATA_N_TIT.D_REF_TRS
    WHERE BUSI_DATE = '${data_day_str}'
) C
    ON B.KEY_OTC_TRADE_ID = C.KEY_OTC_TRADE_ID

-- D：场外交易-期权交易合同要素表；按相同交易键识别期权。
-- 本例D匹配TIT_DEMO，使上方身份CASE命中期权；D不提供基准系数。
LEFT JOIN (
    SELECT KEY_OTC_TRADE_ID
    FROM ODATA_N_TIT.D_REF_OTC_OPTION_DEAL
    WHERE BUSI_DATE = '${data_day_str}'
) D
    ON B.KEY_OTC_TRADE_ID = D.KEY_OTC_TRADE_ID

-- E：交易确认书信息表；KEY_TRADE_COMFIRM_ID=金仕达交易确认书id。
-- 仅这一侧对确认书编号做DISTINCT，不能理解为所有输入统一去重。
LEFT JOIN (
    SELECT DISTINCT KEY_TRADE_COMFIRM_ID
    FROM ODATA_N_TIT.D_KS_TRADE_COMFIRM_INFO
    WHERE BUSI_DATE = '${data_day_str}'
) E
    ON A.CONTRACT_CODE = E.KEY_TRADE_COMFIRM_ID
;

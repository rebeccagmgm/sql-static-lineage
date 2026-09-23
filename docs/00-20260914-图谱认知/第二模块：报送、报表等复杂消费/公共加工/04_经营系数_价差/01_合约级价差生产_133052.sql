-- 01 合约级价差生产（任务133052）
-- 输入：OIS维护的一条合约价差参数，以及交易、期权/互换/金仕达身份和审批资料。
-- 本文件：参数系数原样保留，通过JOIN补合约身份与审批属性，不计算收入。
-- 得到：PDATA_N.T99_DERI_COMP_SPRD_COEF_REF（衍生品合约价差系数参考信息）。
-- 下一步：03按参数生效日生成有效期，再匹配合约的每个计提日；尚不在这里选择当天系数。
--
-- 贯穿例A1：原合约号A1 → 交易表映射TIT键I1 → 期权表识别成功。
-- 输出Inr_Comp_No=A1、Agt_Id=I1，保留ANNUALIZED/0.006及生效日2026-09-15。
-- 03真正用Inr_Comp_No=A1连接销售表info.Agt_Id；Agt_Id=I1非空只用于身份识别入选。
-- 主体是已维护的参数，不是全部合约；一条参数及其JOIN结果的行数规则见下方连接说明。
--
-- A的${src_table}按原SQL注释指向ODATA_N_OIS.O_CONTRACT_SPREAD_RATE。
-- 本任务独立运行，读取参数日快照、按SRC_TBL源表分区写入；原文见99_证据/证据_133052.sql。

INSERT OVERWRITE TABLE T99_DERI_COMP_SPRD_COEF_REF
PARTITION (SRC_TBL = '${src_table}')
SELECT
    -- 1. 合约身份
    -- 按互换→期权→金仕达识别；都未识别仍写空串，118141取参时才排除。
    CASE
        WHEN C.KEY_OTC_TRADE_ID IS NOT NULL THEN B.KEY_OTC_TRADE_ID
        WHEN D.KEY_OTC_TRADE_ID IS NOT NULL THEN B.KEY_OTC_TRADE_ID
        WHEN E.KEY_TRADE_COMFIRM_ID IS NOT NULL THEN A.CONTRACT_CODE
        ELSE ''
    END AS Agt_Id, -- 协议编号：TIT交易流水号或金仕达确认书编号
    CASE
        WHEN C.KEY_OTC_TRADE_ID IS NOT NULL THEN '20206'
        WHEN D.KEY_OTC_TRADE_ID IS NOT NULL THEN '20207'
        WHEN E.KEY_TRADE_COMFIRM_ID IS NOT NULL THEN '20206-KST'
        ELSE ''
    END AS Agt_Modifr, -- 协议修饰符：区分互换、期权、金仕达
    A.CONTRACT_CODE AS Inr_Comp_No, -- 内部合约编号：原OIS合约号，118141用它连接销售表

    -- 2. 业务分类
    A.BUSINESS_TYPE AS Busi_Type, -- 业务类型
    A.CROSS_OR_INR AS Coef_Type, -- 系数类型：交叉／内部大类，原样保留
    A.CONTRACT_TYPE AS Src_Comp_Type_Cd, -- 源合约类型代码
    A.CONTRACT_TYPE_NAME AS Src_Comp_Type_Name, -- 源合约类型名称
    A.UNDERLYING_TYPE AS Src_Undrl_Type_Cd, -- 源标的类型代码

    -- 3. 价差参数
    -- 直接带出，不做“报价减成本”，也不除以100；不在本任务选最新生效参数。
    -- 下列四个源字段释义带【AI】；目标中文名称来自原DDL。
    A.SPREAD_CALCULATION AS Sprd_Calc_Type, -- 价差计算类型：年化／绝对
    A.ANNUALIZED_SPREAD AS Annu_Sprd_Coef, -- 年化价差系数
    A.ABSOLUTE_SPREAD AS Absl_Sprd_Coef, -- 绝对价差系数
    A.EFFECTIVE_DATE AS Vld_Date, -- 生效日期

    -- 4. 参数维护信息
    A.DISCRIPTION AS Desc, -- 描述；DISCRIPTION保留源字段拼写
    A.CREATED_DATETIME AS Estb_Time, -- 创建时间
    A.UPDATED_DATETIME AS Upd_Time, -- 更新时间
    A.CREATED_BY AS Creator, -- 创建人
    A.UPDATED_BY AS Upd_Prsn, -- 更新人
    CASE
        WHEN A.IS_DELETED = 'Y' THEN '1'
        WHEN A.IS_DELETED = 'N' THEN '0'
        ELSE A.IS_DELETED
    END AS Del_Flag, -- 删除标志：仅转换，不过滤；未知标记原样保留

    -- 5. 加工标识与固定值
    '${data_src_cd}' AS Data_Src_Cd, -- 数据来源代码
    '${filename}' AS Task_Name, -- 任务名
    '${data_day_str}' AS Data_Etl_Date, -- 数据加载日期
    '${data_today_str}' AS Data_Upt_Date, -- 数据更新日期
    '${data_today}' AS Data_Time, -- 数据时间
    '${src_table}' AS Real_Src_Tbl, -- 真实源表
    'OTC' AS Bel_Busi_Dept, -- 所属业务部门：总部股衍
    '' AS Cms_Fee_Rate, -- 佣金费率：本任务填空串

    -- 6. 审批附加资料
    -- 来自T3，仅补流程、客户、拟稿人，不覆盖A侧价差系数。
    CONCAT('OIS061-', T3.CROSS_SELL_APPROVAL_PROCESS_ID) AS Para_Appr_Evt_Id, -- 参数审批事件编号
    T3.CLIENT_ID AS Trd_Cutp_Pty_Id, -- 交易对手当事人编号
    T3.DRAFTER AS Dft_Prsn_User_Id -- 拟稿人用户编号

-- 输入与连接
-- A原合约号 → B交易编号映射 → C互换／D期权识别
-- A原合约号 → E金仕达确认书；A的六项参数 → T3审批资料
-- 全部LEFT JOIN：缺少业务或审批资料仍保留A；除E外，业务输入未统一去重，可能扩行。

-- A：合约价差参数（ODATA_N_OIS.O_CONTRACT_SPREAD_RATE，【AI】合约价差系数表）。
FROM (
    SELECT *
    FROM ${src_table}
    WHERE BUSI_DATE = '${data_day_str}'
) A

-- B：交易编号映射（【AI】交易-OTC—交易表/父类）。
-- INTERNAL_TRADE_ID=交易内部编号；KEY_OTC_TRADE_ID=TRADEFLOW内部交易流水号。
LEFT JOIN (
    SELECT *
    FROM ODATA_N_TIT.D_TRD_OTC_TRADE
    WHERE BUSI_DATE = '${data_day_str}'
) B
    ON A.CONTRACT_CODE = B.INTERNAL_TRADE_ID

-- C：互换身份（场外交易-TRS），按交易流水号识别。
LEFT JOIN (
    SELECT *
    FROM ODATA_N_TIT.D_REF_TRS
    WHERE BUSI_DATE = '${data_day_str}'
) C
    ON B.KEY_OTC_TRADE_ID = C.KEY_OTC_TRADE_ID

-- D：期权身份（场外交易-期权交易合同要素表），同样按交易流水号识别。
LEFT JOIN (
    SELECT KEY_OTC_TRADE_ID
    FROM ODATA_N_TIT.D_REF_OTC_OPTION_DEAL
    WHERE BUSI_DATE = '${data_day_str}'
) D
    ON B.KEY_OTC_TRADE_ID = D.KEY_OTC_TRADE_ID

-- E：金仕达身份（交易确认书信息表）；KEY_TRADE_COMFIRM_ID=金仕达交易确认书id。
-- 这里只对确认书ID做DISTINCT，再直接与OIS合约号连接。
LEFT JOIN (
    SELECT DISTINCT KEY_TRADE_COMFIRM_ID
    FROM ODATA_N_TIT.D_KS_TRADE_COMFIRM_INFO
    WHERE BUSI_DATE = '${data_day_str}'
) E
    ON A.CONTRACT_CODE = E.KEY_TRADE_COMFIRM_ID

-- T3：审批资料（交叉销售合约编号价差系数临时表）。
-- 同一组六项参数取更新时间最新行；有效日期不在分组键中，同更新时间无额外决胜键。
-- CROSS_SELL_APPROVAL_PROCESS_ID=关联审批流程ID；CLIENT_ID=客户编号；DRAFTER=拟稿人。
LEFT JOIN (
    SELECT *
    FROM (
        SELECT
            T.*,
            ROW_NUMBER() OVER (
                PARTITION BY CONTRACT_CODE, CROSS_OR_INR, CONTRACT_TYPE,
                             SPREAD_CALCULATION, ANNUALIZED_SPREAD, ABSOLUTE_SPREAD
                ORDER BY UPDATED_DATETIME DESC
            ) AS RN
        FROM ODATA_N_OIS.G_CONTRACT_SPREAD_RATE_TEMP T
        WHERE IS_DELETED = 'N'
          AND BUSI_DATE = '${data_day_str}'
    ) T0
    WHERE T0.RN = 1
) T3
    -- 六项都用等号连接：任一键为NULL都不会匹配，包括两个系数字段。
    ON A.CONTRACT_CODE = T3.CONTRACT_CODE
   AND A.CROSS_OR_INR = T3.CROSS_OR_INR
   AND A.CONTRACT_TYPE = T3.CONTRACT_TYPE
   AND A.SPREAD_CALCULATION = T3.SPREAD_CALCULATION
   AND A.ANNUALIZED_SPREAD = T3.ANNUALIZED_SPREAD
   AND A.ABSOLUTE_SPREAD = T3.ABSOLUTE_SPREAD
;

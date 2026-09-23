-- 用途：整理对内合约基础系数；与133055写同表不同来源分区。
-- 输入：G_INR_CONTRACT_BASE_RATE加工日快照；交易及业务表识别合约。
-- 一行：源配置及身份匹配结果；除金仕达确认号DISTINCT外，没有统一去重。
-- 输出：Base_Yield基础收益率、Dft_Base_Coef拟定基础系数、Calc_Type计算类型；额外奖励填空。
-- 使用：114013/113993以Inr_Comp_No匹配业务合约号；Agt_Id非空只作身份已识别的筛选。
-- 说明入口：README.md；完整DDL及来源时间见99_证据。

INSERT OVERWRITE TABLE T99_DERI_COMP_BASE_COEF_REF PARTITION(SRC_TBL='${src_table}')
-----------------------------------------------------------------------------------------------------
--Group2: Source Table:[ODATA_N_OIS.G_INR_CONTRACT_BASE_RATE:销售收入内部合约基础系数维护表]
-----------------------------------------------------------------------------------------------------
SELECT
    -- C互换／D期权命中时用TIT流水号；E金仕达命中时保留原确认书号；均未命中写空。
    CASE WHEN C.KEY_OTC_TRADE_ID IS NOT NULL THEN B.KEY_OTC_TRADE_ID
    WHEN D.KEY_OTC_TRADE_ID IS NOT NULL THEN B.KEY_OTC_TRADE_ID
    WHEN E.KEY_TRADE_COMFIRM_ID IS NOT NULL THEN A.CONTRACT_CODE
    ELSE '' END    AS  Agt_Id    --协议编号
    ,CASE WHEN C.KEY_OTC_TRADE_ID IS NOT NULL THEN '20206'
    WHEN D.KEY_OTC_TRADE_ID IS NOT NULL THEN '20207'
    WHEN E.KEY_TRADE_COMFIRM_ID IS NOT NULL THEN '20206-KST'
    ELSE '' END    AS  Agt_Modifr    --协议修饰符
    ,A.CONTRACT_CODE    AS  Inr_Comp_No    --内部合约编号
    ,A.BASE_CALCULATION    AS  Calc_Type    --计算类型
    ,'INR'    AS  Coef_Type    --系数类型
    ,A.BASE_EARNING_RATE    AS  Base_Yield    -- 基础收益率；114013在括号内与价差相加
    ,A.DRAFT_BASE_RATE    AS  Dft_Base_Coef    -- 拟定基础系数；114013另外乘这一项，不是另一种收益率
    ,A.DISCRIPTION    AS  Desc    --描述
    ,A.OPERATOR_NAME    AS  Main_Oper_Prsn    --主经办人
    ,A.INTRODUCTION_OPERATOR_NAME    AS  Intro_Oper_Prsn    --引入经办人
    ,''    AS  Adtnl_Rwd_Flag    --额外奖励标志
    ,''    AS  Adtnl_Rwd    --额外奖励
    ,A.CREATED_DATETIME    AS  Estb_Time    --创建时间
    ,A.UPDATED_DATETIME    AS  Upd_Time    --更新时间
    ,A.CREATED_BY    AS  Creator    --创建人
    ,A.UPDATED_BY    AS  Upd_Prsn    --更新人
    ,CASE WHEN A.IS_DELETED='Y' THEN '1'
    WHEN A.IS_DELETED='N' THEN '0'
    ELSE A.IS_DELETED END    AS  Del_Flag    --删除标志
    ,'${data_src_cd}'    AS  Data_Src_Cd    --数据来源代码
    ,'${filename}'    AS  Task_Name    --任务名
    ,'${data_day_str}'    AS  Data_Etl_Date    --数据加载日期
    ,'${data_today_str}'    AS  Data_Upt_Date    --数据更新日期
    ,'${data_today}'    AS  Data_Time    --数据时间
-- A：内部销售合约基础系数表；一条原合约配置是本查询主体，删除记录仍在生产中保留。
FROM (
    SELECT * FROM ${src_table}
    WHERE BUSI_DATE='${data_day_str}'
) A

-- B：【AI】交易-OTC—交易表（父类）；将原合约编号匹配内部交易编号，取TIT流水号。
LEFT JOIN (
    SELECT * FROM ODATA_N_TIT.D_TRD_OTC_TRADE
    WHERE BUSI_DATE ='${data_day_str}'
) B
    ON A.CONTRACT_CODE=B.INTERNAL_TRADE_ID

-- C：场外交易-TRS；用流水号识别互换，命中后身份采用B的流水号及20206修饰符。
LEFT JOIN (
    SELECT * FROM ODATA_N_TIT.D_REF_TRS
    WHERE BUSI_DATE ='${data_day_str}'
) C
    ON B.KEY_OTC_TRADE_ID=C.KEY_OTC_TRADE_ID

-- D：场外交易-期权交易合同要素表；同一流水号识别期权，CASE优先级在互换之后。
LEFT JOIN (
    SELECT KEY_OTC_TRADE_ID FROM ODATA_N_TIT.D_REF_OTC_OPTION_DEAL
    WHERE BUSI_DATE ='${data_day_str}'
) D
    ON B.KEY_OTC_TRADE_ID=D.KEY_OTC_TRADE_ID

-- E：交易确认书信息表；金仕达直接用原合约号匹配确认书号，不依赖B是否命中。
-- 此处仅确认书号DISTINCT；B/C/D没有统一去重，其多条匹配仍可能放大配置行数。
LEFT JOIN (
    SELECT DISTINCT KEY_TRADE_COMFIRM_ID FROM ODATA_N_TIT.D_KS_TRADE_COMFIRM_INFO
    WHERE BUSI_DATE='${data_day_str}'
) E
    ON A.CONTRACT_CODE=E.KEY_TRADE_COMFIRM_ID


;

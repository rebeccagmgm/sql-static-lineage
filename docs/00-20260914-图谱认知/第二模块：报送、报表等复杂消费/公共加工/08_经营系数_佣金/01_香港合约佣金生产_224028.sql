-- 用途：把香港合约佣金放入价差T99的独立源分区；Cms_Fee_Rate仍是佣金费率。
-- 输入：G_REV_HK_CONTRACT_COMMISSION_RATE加工日快照；交易及业务表识别合约身份。
-- 一行：源配置及右侧身份匹配结果，多条身份记录可扩行，没有统一择一。
-- 输出：合约号、佣金费率、计算方式；年化价差、绝对价差、生效日期在这个映射中填空。
-- 使用：220979/220981实际直接读ODATA的佣金源；源EFFECTIVE_DATE用于选版本，不能用此T99替换。
-- 说明入口：README.md；完整DDL及来源时间见99_证据。

INSERT OVERWRITE TABLE T99_DERI_COMP_SPRD_COEF_REF PARTITION(SRC_TBL='${src_table}')
-----------------------------------------------------------------------------------------------------
--Group2: Source Table:[ODATA_N_OIS.G_REV_HK_CONTRACT_COMMISSION_RATE:交叉销售合约编号佣金费率系数正式表]
-----------------------------------------------------------------------------------------------------
SELECT
    -- 配置仍以原合约号保留；只有TIT交易流水号非空时才写Agt_Id。
    CASE WHEN NVL(TRIM(B.KEY_OTC_TRADE_ID),'') = '' THEN ''
    ELSE B.KEY_OTC_TRADE_ID END
    AS  Agt_Id    --协议编号
    -- 修饰符按TRS → 期权 → 外汇远期 → FAST_TRS顺序命中；不是把四个身份拼接。
    ,CASE WHEN C.KEY_OTC_TRADE_ID IS NOT NULL THEN '20206'
    WHEN D.KEY_OTC_TRADE_ID IS NOT NULL THEN '20207'
    WHEN E.KEY_OTC_TRADE_ID IS NOT NULL THEN '20208'
    WHEN F.KEY_OTC_TRADE_ID IS NOT NULL THEN '20206'
    ELSE '' END
    AS  Agt_Modifr    --协议修饰符
    ,A.CONTRACT_CODE    AS  Inr_Comp_No    --内部合约编号
    ,A.BUSINESS_TYPE    AS  Busi_Type    --业务类型
    ,'CROSS'    AS  Coef_Type    --系数类型    'CROSS' --交叉
    ,A.CONTRACT_TYPE    AS  Src_Comp_Type_Cd    --源合约类型代码
    ,A.CONTRACT_TYPE_NAME    AS  Src_Comp_Type_Name    --源合约类型名称
    ,A.UNDERLYING_TYPE    AS  Src_Undrl_Type_Cd    --源标的类型代码
    ,A.COMMIS_CALC_TYPE    AS  Sprd_Calc_Type    -- 佣金计算方式存入现有类型列；日报不经本列选公式
    ,''    AS  Annu_Sprd_Coef    --年化价差系数
    ,''    AS  Absl_Sprd_Coef    --绝对价差系数
    ,''    AS  Vld_Date    --生效日期
    ,A.DISCRIPTION    AS  Desc    --描述
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
    ,'${src_table}'    AS  Real_Src_Tbl    --真实源表
    ,'OTC_HK'    AS  Bel_Busi_Dept    --所属业务部门  'OTC_HK' --香港股衍
    ,COMMISSION_RATE    AS  Cms_Fee_Rate    -- 佣金费率；源元数据写“价差费率”，按实际用途保留差异
    ,''    AS  Para_Appr_Evt_Id    --参数审批事件编号
    ,''    AS  Trd_Cutp_Pty_Id    --交易对手当事人编号
    ,''    AS  Dft_Prsn_User_Id    --拟稿人用户编号
-- A：交叉销售合约编号佣金费率系数正式表；读取加工日快照，未在生产端删除配置。
FROM (
    SELECT * FROM ${src_table}
    WHERE BUSI_DATE='${data_day_str}'
) A

-- B：【AI】交易-OTC—交易表（父类）。原合约号对应内部交易编号，补TIT流水号。
-- LEFT JOIN未匹配仍保留A；多条内部交易编号匹配会扩行，不在这里择一。
LEFT JOIN (
    SELECT * FROM ODATA_N_TIT.D_TRD_OTC_TRADE
    WHERE BUSI_DATE ='${data_day_str}'
) B
    ON A.CONTRACT_CODE=B.INTERNAL_TRADE_ID

-- C：场外交易-TRS；以B的流水号检查是否属于互换，用于20206修饰符。
LEFT JOIN (
    SELECT * FROM ODATA_N_TIT.D_REF_TRS
    WHERE BUSI_DATE ='${data_day_str}'
) C
    ON B.KEY_OTC_TRADE_ID=C.KEY_OTC_TRADE_ID

-- D：场外交易-期权交易合同要素表；同一流水号检查期权身份，优先级在C之后。
LEFT JOIN (
    SELECT KEY_OTC_TRADE_ID FROM ODATA_N_TIT.D_REF_OTC_OPTION_DEAL
    WHERE BUSI_DATE ='${data_day_str}'
) D
    ON B.KEY_OTC_TRADE_ID=D.KEY_OTC_TRADE_ID

-- E：外汇远期-合约要素；同一流水号识别20208，不读价格或结算金额。
LEFT JOIN (
    SELECT KEY_OTC_TRADE_ID FROM ODATA_N_TIT.D_REF_FX_FORWARD
    WHERE BUSI_DATE ='${data_day_str}'
) E
    ON B.KEY_OTC_TRADE_ID=E.KEY_OTC_TRADE_ID

-- F：极速互换合约要素表；同一流水号识别FAST_TRS，修饰符同样为20206。
-- C/D/E/F是四个并列LEFT JOIN，CASE先命中不阻止其他连接扩行；均没有DISTINCT。
LEFT JOIN (
    SELECT KEY_OTC_TRADE_ID FROM ODATA_N_TIT.D_REF_FAST_TRS
    WHERE BUSI_DATE ='${data_day_str}'
) F
    ON B.KEY_OTC_TRADE_ID=F.KEY_OTC_TRADE_ID
;

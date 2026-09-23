/*
09 / 这份互换在销售经营口径中归到哪一类？

源合约类型回答“系统登记成什么产品”；经营分类把合约按报表口径分组。
例如旧规则把CALL_SWAP（多头互换）、PUT_SWAP（空头互换）都归为“多空互换”。
所以Contr_Type_Cd/Desc与Src_Contr_Type/Desc在11模块同时保留，不能混为一套类型。

输入地图：
  02合约 rt      → trs_type互换类型、START_DATE期初定价日、contract_use合约用途
  01交易 trade   → department账簿部门、company公司
  06结构腿 rtl   → ipo_type（本SQL作IPO判断）、Private_Placement限售判断
  07初始持仓 his_ini → ins_family证券集、currency证券币种、interotc_underlying_category工具池标的小类
  02字典 sct     → dw_cd_val_desc源合约类型名称，仅旧01使用

先选版本，再按顺序取首个命中；不是用加工日切换：
  substring(rt.START_DATE, 1, 10) <= '2025-03-31' → 旧01～旧12
  其余（包括START_DATE为NULL）                  → 新01～新07

规则对照（编号与下方代码、名称两段CASE对应）：
  下列简写仅为阅读，不是新增SQL条件：
  股票 = ins_family IN ('EQUITY','GDR')；非IPO = ipo_type为'N'或NULL；
  非限售 = Private_Placement为'N'或NULL；空串不等于NULL。

  旧规则 / 条件 → 分类代码 → 中文名称
  旧01 OTC_HK部门 + CROSS_LEND_SWAP/HK_LONG_HOLD_SWAP/N_CROSS_FUTURE_SWAP/N_CROSS_QFII_SWAP
       → TRS_拼接源类型 → sct.dw_cd_val_desc（源类型字典名称）
  旧02 N_CROSS_SWAP → TRS_N_STOCK → 北上A股
  旧03 CALL_SWAP/PUT_SWAP → TRS_LONG_SHORT → 多空互换
  旧04 S_CROSS_FUTURE_SWAP → TRS_S_CROSS_FUTURES → 南下期货
  旧05 S_CROSS_SWAP + 工具池标的小类BONDS → TRS_S_CROSS_BOND → 南下债券
  旧06 S_CROSS_SWAP + 股票 + 币种非CNY + IPO='Y' → TRS_S_IPO → 南下IPO
  旧07 S_CROSS_SWAP + 股票 + 币种非CNY + 非IPO + 限售='Y'
       → TRS_S_STOCK_LIMITED → 南下跨境互换（限售股）
  旧08 S_CROSS_SWAP + 股票 + 币种HKD + 非IPO + 非限售
       → TRS_S_CROSS_HK → 南下跨境港股
  旧09 S_CROSS_SWAP + 股票 + 币种非HKD且非CNY + 非IPO + 非限售
       → TRS_S_CROSS_OTHER → 南下跨境-其他股票市场
  旧10 GFS_HK公司 + FEE_SWAP + 用途REBATE_INTEREST → FEE_SWAP_HK → 费用合约
  旧11 GFS_HK公司 + INDEX_ENHANCE_SWAP → TRS_N_CROSS_INDEX_ENHANCE → 北上指数增强
  旧12 其余 → TRS_OTHER_SWAP → 其它互换类型

  新规则 / 条件 → 分类代码 → 中文名称
  新01 LEND_SWAP + 股票 → TRS_SHORT_SELL → 借券互换
  新02 证券集QIS → TRS_S_CROSS_QTF_STRG_IDX → 南下量化策略指数互换
  新03 S_CROSS_FUTURE_SWAP → TRS_S_CROSS_FUTURES → 南下期货
  新04 S_CROSS_SWAP/S_CROSS_OPTION_SWAP + 股票 + 币种非CNY + IPO='Y'
       → TRS_S_IPO → 南下IPO
  新05 S_CROSS_SWAP/S_CROSS_OPTION_SWAP + 股票 + 非IPO
       → TRS_S_CROSS_STOCK → 南下跨境股票
  新06 GFS_HK公司 + INDEX_ENHANCE_SWAP → TRS_N_CROSS_INDEX_ENHANCE → 北上指数增强
  新07 其余 → TRS_OTHER_SWAP → 其它互换类型

三处不要凭中文名称补条件：
  新02没有限定公司或互换类型；QIS命中后，不再继续匹配南下期货等后续规则。
  新05没有限定币种或限售标志，不要把旧08/09的条件搬进来。
  his_ini的类型/币种可能为分号拼接多值；SQL按整个字符串比较，不逐标的判断。

下方只输出代码、名称两列表达式，不增加JOIN；保留独立条件树和原优先级。
旧01的名称取字典，不能把全部名称改成由分类代码固定映射。
*/
-- A. 经营类别代码：下面分别列出旧口径和新口径。
if(
    substring(rt.START_DATE, 1, 10) <= '2025-03-31'
    -- 旧口径：按类型及业务属性细分，保持原有顺序。
    ,case
        -- 旧01
        when trade.department = 'OTC_HK'
            and rt.trs_type in ('CROSS_LEND_SWAP','HK_LONG_HOLD_SWAP','N_CROSS_FUTURE_SWAP','N_CROSS_QFII_SWAP')
            then concat('TRS_',rt.trs_type)
        -- 旧02
        when rt.trs_type = 'N_CROSS_SWAP'
            then 'TRS_N_STOCK'
        -- 旧03
        when rt.trs_type in ('CALL_SWAP', 'PUT_SWAP')
            then 'TRS_LONG_SHORT'
        -- 旧04
        when rt.trs_type = 'S_CROSS_FUTURE_SWAP'
            then 'TRS_S_CROSS_FUTURES'
        -- 旧05
        when rt.trs_type = 'S_CROSS_SWAP'
            and his_ini.interotc_underlying_category = 'BONDS'
            then 'TRS_S_CROSS_BOND'
        -- 旧06
        when rt.trs_type = 'S_CROSS_SWAP'
            and his_ini.ins_family in ('EQUITY', 'GDR')
            and his_ini.currency != 'CNY'
            and rtl.ipo_type = 'Y'
            then 'TRS_S_IPO' -- 非CNY股票且IPO；条件没有进一步限定必须为HKD
        -- 旧07
        when rt.trs_type = 'S_CROSS_SWAP'
            and his_ini.ins_family in ('EQUITY', 'GDR')
            and his_ini.currency != 'CNY'
            and (rtl.ipo_type = 'N' or rtl.ipo_type is null)
            and rtl.Private_Placement = 'Y'
            then 'TRS_S_STOCK_LIMITED'
        -- 旧08
        when rt.trs_type = 'S_CROSS_SWAP'
            and his_ini.ins_family in ('EQUITY', 'GDR')
            and his_ini.currency = 'HKD'
            and (rtl.ipo_type = 'N' or rtl.ipo_type is null)
            and (rtl.Private_Placement = 'N' or rtl.Private_Placement is null)
            then 'TRS_S_CROSS_HK'
        -- 旧09
        when rt.trs_type = 'S_CROSS_SWAP'
            and his_ini.ins_family in ('EQUITY', 'GDR')
            and his_ini.currency not in ('HKD','CNY')
            and (rtl.ipo_type = 'N' or rtl.ipo_type is null)
            and (rtl.Private_Placement = 'N' or rtl.Private_Placement is null)
            then 'TRS_S_CROSS_OTHER'
        -- 旧10
        when trade.company = 'GFS_HK'
            and rt.trs_type = 'FEE_SWAP'
            and rt.contract_use = 'REBATE_INTEREST'
            then 'FEE_SWAP_HK'
        -- 旧11
        when trade.company = 'GFS_HK'
            and rt.trs_type = 'INDEX_ENHANCE_SWAP'
            then 'TRS_N_CROSS_INDEX_ENHANCE'
        -- 旧12 / 兜底
        else 'TRS_OTHER_SWAP'
    end
    -- 新口径：按下列条件优先级匹配，末尾保留原兜底。
    ,case
        -- 新01
        when rt.trs_type = 'LEND_SWAP'
            and his_ini.ins_family in ('EQUITY', 'GDR')
            then 'TRS_SHORT_SELL'
        -- 新02
        when his_ini.ins_family = 'QIS'
            then 'TRS_S_CROSS_QTF_STRG_IDX'
        -- 新03
        when rt.trs_type = 'S_CROSS_FUTURE_SWAP'
            then 'TRS_S_CROSS_FUTURES'
        -- 新04
        when rt.trs_type in ('S_CROSS_SWAP', 'S_CROSS_OPTION_SWAP')
            and his_ini.ins_family in ('EQUITY', 'GDR')
            and his_ini.currency != 'CNY'
            and rtl.ipo_type = 'Y'
            then 'TRS_S_IPO'
        -- 新05
        when rt.trs_type in ('S_CROSS_SWAP', 'S_CROSS_OPTION_SWAP')
            and his_ini.ins_family in ('EQUITY', 'GDR')
            and (rtl.ipo_type = 'N' or rtl.ipo_type is null)
            then 'TRS_S_CROSS_STOCK'
        -- 新06
        when trade.company = 'GFS_HK'
            and rt.trs_type = 'INDEX_ENHANCE_SWAP'
            then 'TRS_N_CROSS_INDEX_ENHANCE'
        -- 新07 / 兜底
        else 'TRS_OTHER_SWAP'
    end
) as Contr_Type_Cd, -- 合约类型代码
-- B. 经营类别名称：沿用独立条件树；不要只靠代码重新映射中文名。
if(
    substring(rt.START_DATE, 1, 10) <= '2025-03-31'
    -- 旧口径：按类型及业务属性细分，保持原有顺序。
    ,case
        -- 旧01
        when trade.department = 'OTC_HK'
            and rt.trs_type in ('CROSS_LEND_SWAP','HK_LONG_HOLD_SWAP','N_CROSS_FUTURE_SWAP','N_CROSS_QFII_SWAP')
            then sct.dw_cd_val_desc
        -- 旧02
        when rt.trs_type = 'N_CROSS_SWAP'
            then '北上A股'
        -- 旧03
        when rt.trs_type in ('CALL_SWAP', 'PUT_SWAP')
            then '多空互换'
        -- 旧04
        when rt.trs_type = 'S_CROSS_FUTURE_SWAP'
            then '南下期货'
        -- 旧05
        when rt.trs_type = 'S_CROSS_SWAP'
            and his_ini.interotc_underlying_category = 'BONDS'
            then '南下债券'
        -- 旧06
        when rt.trs_type = 'S_CROSS_SWAP'
            and his_ini.ins_family in ('EQUITY', 'GDR')
            and his_ini.currency != 'CNY'
            and rtl.ipo_type = 'Y'
            then '南下IPO'
        -- 旧07
        when rt.trs_type = 'S_CROSS_SWAP'
            and his_ini.ins_family in ('EQUITY', 'GDR')
            and his_ini.currency != 'CNY'
            and (rtl.ipo_type = 'N' or rtl.ipo_type is null)
            and rtl.Private_Placement = 'Y'
            then '南下跨境互换（限售股）'
        -- 旧08
        when rt.trs_type = 'S_CROSS_SWAP'
            and his_ini.ins_family in ('EQUITY', 'GDR')
            and his_ini.currency = 'HKD'
            and (rtl.ipo_type = 'N' or rtl.ipo_type is null)
            and (rtl.Private_Placement = 'N' or rtl.Private_Placement is null)
            then '南下跨境港股'
        -- 旧09
        when rt.trs_type = 'S_CROSS_SWAP'
            and his_ini.ins_family in ('EQUITY', 'GDR')
            and his_ini.currency not in ('HKD','CNY')
            and (rtl.ipo_type = 'N' or rtl.ipo_type is null)
            and (rtl.Private_Placement = 'N' or rtl.Private_Placement is null)
            then '南下跨境-其他股票市场'
        -- 旧10
        when trade.company = 'GFS_HK'
            and rt.trs_type = 'FEE_SWAP'
            and rt.contract_use = 'REBATE_INTEREST'
            then '费用合约'
        -- 旧11
        when trade.company = 'GFS_HK'
            and rt.trs_type = 'INDEX_ENHANCE_SWAP'
            then '北上指数增强'
        -- 旧12 / 兜底
        else '其它互换类型'
    end
    -- 新口径：按下列条件优先级匹配，末尾保留原兜底。
    ,case
        -- 新01
        when rt.trs_type = 'LEND_SWAP'
            and his_ini.ins_family in ('EQUITY', 'GDR')
            then '借券互换'
        -- 新02
        when his_ini.ins_family = 'QIS'
            then '南下量化策略指数互换'
        -- 新03
        when rt.trs_type = 'S_CROSS_FUTURE_SWAP'
            then '南下期货'
        -- 新04
        when rt.trs_type in ('S_CROSS_SWAP', 'S_CROSS_OPTION_SWAP')
            and his_ini.ins_family in ('EQUITY', 'GDR')
            and his_ini.currency != 'CNY'
            and rtl.ipo_type = 'Y'
            then '南下IPO'
        -- 新05
        when rt.trs_type in ('S_CROSS_SWAP', 'S_CROSS_OPTION_SWAP')
            and his_ini.ins_family in ('EQUITY', 'GDR')
            and (rtl.ipo_type = 'N' or rtl.ipo_type is null)
            then '南下跨境股票'
        -- 新06
        when trade.company = 'GFS_HK'
            and rt.trs_type = 'INDEX_ENHANCE_SWAP'
            then '北上指数增强'
        -- 新07 / 兜底
        else '其它互换类型'
    end
) as Contr_Type_Desc, -- 合约类型描述

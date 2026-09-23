/*
* 根据期权标的、合约类型、业务属性，把 option_underlying 里的期权合约划分经营类别，新增 Contr_Type_Cd 和 Contr_Type_Desc。
  - 老合约 → 老分类体系
  - 新合约 → 新分类体系

新口径
      option_underlying
            ↓
      classification_ins_family
            ↓
      EQUITY/GDR → 个股期权
      INDEX/FUND → 指数/ETF期权
      QIS        → 北上 / 现货 / 非现货QIS
      RISKY系    → 限售 / 流通股
      其他       → 其他期权
*/
option_classified AS ( 
    SELECT u.*,
if(
        substring(u.start_date, 1, 10) <= '2025-03-31'
-- 旧口径：按类型及业务属性细分，保持原有顺序。
        ,case when u.source_contract_type = 'AUTOCALL' and u.source_contract_sub_type not in ('SNOWBALL','SECURED') and u.classification_ins_family in ('EQUITY', 'GDR') then 'OPTION_AUTOCALL_STOCK'
              when u.source_contract_type = 'AUTOCALL' and u.source_contract_sub_type not in ('SNOWBALL','SECURED') and u.classification_ins_family not in ('EQUITY', 'GDR') then 'OPTION_AUTOCALL_NONSTOCK'
              when u.source_contract_type = 'AUTOCALL' and u.source_contract_sub_type in ('SNOWBALL','SECURED') then 'OPTION_SNOWBALL_SECURED'
              when u.source_contract_type = 'AIRBAG' and u.classification_ins_family in ('EQUITY', 'GDR') then 'OPTION_AIRBAG_STOCK'
              when u.source_contract_type = 'AIRBAG' and u.classification_ins_family not in ('EQUITY', 'GDR') then 'OPTION_AIRBAG_NONSTOCK'
              when u.source_contract_type in ('RISKY','AIRBAGX') and u.classification_ins_family = 'EQUITY' and u.private_placement_flag = 'Y' then 'OPTION_RISKY_AIRBAGX_PRI_STOCK'
              when u.source_contract_type in ('RISKY','AIRBAGX') and coalesce(u.private_placement_flag,'N') <> 'Y' then 'OPTION_RISKY_AIRBAGX_CIR_STOCK'
              when u.book_desk = 'OTCHK_QIS' and u.classification_ins_family = 'QIS' and u.seller_id = '11613' then 'OPTION_N_CROSS_QTF_STRG_IDX'
              when (u.source_contract_type not in ('AUTOCALL','AIRBAG','RISKY','AIRBAGX') or u.source_contract_type is null) and u.classification_ins_family in ('EQUITY', 'GDR') then 'OPTION_OTHER_STOCK'
              when (u.source_contract_type not in ('AUTOCALL','AIRBAG','RISKY','AIRBAGX') or u.source_contract_type is null) and u.classification_ins_family not in ('EQUITY', 'GDR') then 'OPTION_OTHER_NONSTOCK'
              end
-- 新口径：按下列条件优先级匹配，末尾保留原兜底。
        ,case when u.classification_ins_family in ('EQUITY', 'GDR')
                    and u.source_contract_type not in ('RISKY','AIRBAGX','AIRBAGM','AIRBAGL','CUSTOMISED')
                    and not(u.source_contract_type = 'AUTOCALL' and u.source_contract_sub_type = 'SNOWBALL')
                    then 'OPTION_STOCK'
              when u.classification_ins_family in ('INDEX', 'FUND')
                    and(u.source_contract_type in ('ACCUMULATOR','DECCUMULATOR','AIRBAG') or (u.source_contract_type = 'AUTOCALL' and u.source_contract_sub_type <> 'SNOWBALL'))
                    then 'OPTION_IDX_ETF'
              when u.book_desk = 'OTCHK_QIS' and u.classification_ins_family = 'QIS' and u.seller_id = '11613' then 'OPTION_N_CROSS_QTF_STRG_IDX'
              when u.classification_ins_family = 'QIS' and u.underlying_wind_code not in('GAMMA.WI', 'CHARM.WI') then 'OPTION_QTF_STRG_IDX_SPOT'
              when u.classification_ins_family = 'QIS' and u.underlying_wind_code in('GAMMA.WI', 'CHARM.WI') then 'OPTION_QTF_STRG_IDX_NONSPOT'
              when u.source_contract_type in ('RISKY','AIRBAGX') and u.classification_ins_family = 'EQUITY' and u.private_placement_flag = 'Y' then 'OPTION_RISKY_AIRBAGX_PRI_STOCK'
              when u.source_contract_type in ('RISKY','AIRBAGX') and coalesce(u.private_placement_flag,'N') <> 'Y' then 'OPTION_RISKY_AIRBAGX_CIR_STOCK'
              else 'OPTION_OTHER_NONSTOCK'
              end
    ) as Contr_Type_Cd, -- 合约类型代码
-- B. 经营类别名称：沿用独立条件树；不要只靠代码重新映射中文名。
if(
        substring(u.start_date, 1, 10) <= '2025-03-31'
-- 旧口径：按类型及业务属性细分，保持原有顺序。
        ,case when u.source_contract_type = 'AUTOCALL' and u.source_contract_sub_type not in ('SNOWBALL','SECURED') and u.classification_ins_family in ('EQUITY', 'GDR') then '自动赎回（除保本雪球和保本敲入型雪球）'
              when u.source_contract_type = 'AUTOCALL' and u.source_contract_sub_type not in ('SNOWBALL','SECURED') and u.classification_ins_family not in ('EQUITY', 'GDR') then '自动赎回（除保本雪球和保本敲入型雪球）'
              when u.source_contract_type = 'AUTOCALL' and u.source_contract_sub_type in ('SNOWBALL','SECURED') then '保本雪球和保本敲入型雪球'
              when u.source_contract_type = 'AIRBAG' and u.classification_ins_family in ('EQUITY', 'GDR') then '安全气囊'
              when u.source_contract_type = 'AIRBAG' and u.classification_ins_family not in ('EQUITY', 'GDR') then '安全气囊'
              when u.source_contract_type in ('RISKY','AIRBAGX') and u.classification_ins_family = 'EQUITY' and u.private_placement_flag = 'Y' then 'Risky和安全气囊X（限售股）'
              when u.source_contract_type in ('RISKY','AIRBAGX') and coalesce(u.private_placement_flag,'N') <> 'Y' then 'Risky和安全气囊X（流通股）'
              when u.book_desk = 'OTCHK_QIS' and u.classification_ins_family = 'QIS' and u.seller_id = '11613' then '北上量化策略指数期权'
              when (u.source_contract_type not in ('AUTOCALL','AIRBAG','RISKY','AIRBAGX') or u.source_contract_type is null) and u.classification_ins_family in ('EQUITY', 'GDR') then '其他期权（除Risky和安全气囊X）'
              when (u.source_contract_type not in ('AUTOCALL','AIRBAG','RISKY','AIRBAGX') or u.source_contract_type is null) and u.classification_ins_family not in ('EQUITY', 'GDR') then '其他期权（除Risky和安全气囊X）'
               end 
-- 新口径：按下列条件优先级匹配，末尾保留原兜底。
        ,case when u.classification_ins_family in ('EQUITY', 'GDR')
                    and u.source_contract_type not in ('RISKY','AIRBAGX','AIRBAGM','AIRBAGL','CUSTOMISED')
                    and not(u.source_contract_type = 'AUTOCALL' and u.source_contract_sub_type = 'SNOWBALL')
                    then '个股期权'
              when u.classification_ins_family in ('INDEX', 'FUND')
                    and(u.source_contract_type in ('ACCUMULATOR','DECCUMULATOR','AIRBAG') or (u.source_contract_type = 'AUTOCALL' and u.source_contract_sub_type <> 'SNOWBALL'))
                    then '指数/ETF期权'
              when u.book_desk = 'OTCHK_QIS' and u.classification_ins_family = 'QIS' and u.seller_id = '11613' then '北上量化策略指数期权'
              when u.classification_ins_family = 'QIS' and u.underlying_wind_code not in('GAMMA.WI', 'CHARM.WI') then '量化策略指数期权（现货类）'
              when u.classification_ins_family = 'QIS' and u.underlying_wind_code in('GAMMA.WI', 'CHARM.WI') then '量化策略指数期权（非现货类）'
              when u.source_contract_type in ('RISKY','AIRBAGX') and u.classification_ins_family = 'EQUITY' and u.private_placement_flag = 'Y' then 'Risky和安全气囊X（限售股）'
              when u.source_contract_type in ('RISKY','AIRBAGX') and coalesce(u.private_placement_flag,'N') <> 'Y' then 'Risky和安全气囊X（流通股）'
              else '其他期权'
              end
    ) as Contr_Type_Desc -- 合约类型描述
    FROM option_underlying u
)

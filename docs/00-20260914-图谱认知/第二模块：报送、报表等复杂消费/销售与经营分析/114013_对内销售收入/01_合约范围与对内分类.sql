-- 用途：保留当前加工日的合约资料，补对内经营分类与用于映射的标的分类。
-- 输出contract_info，在04中作为info：先与逐日明细、客户范围INNER JOIN，再补参数。
-- End_Pric_Date_n优先提前终止日，仅NULL回退；空串不会回退到期末日。
-- 原主信息Contr_Type_Cd没有被改写：本层另产生Inr_Contr_Type_Cd，04才选择日报分类。
-- 构造例INR_DEMO：EQUITY且Res_Flag=0 → CIR_STOCK；非B2B/同业/跨境 → 显式经营分类NULL。
-- 04再让mp映射到演示配置CD017，类型基准据此匹配；不是在本层就选完参数。
select *, coalesce(Early_Term_Date, End_Pric_Date) as End_Pric_Date_n,
    -- 标的分类：此特殊互换留空用于匹配；其输出文字在04另处理。
    case when Src_Contr_Type = 'B_LONG_SHORT_SWAP' then ''
         when (Src_Undrl_Type in ('EQUITY', 'BASKET') and Res_Flag = '1') or Src_Undrl_Type = 'GDR' then 'PRI_STOCK'
         when Src_Undrl_Type in ('EQUITY', 'BASKET') and Res_Flag = '0' then 'CIR_STOCK'
         when Src_Undrl_Type = 'BOND' then 'BOND'
         when Src_Undrl_Type = 'FUTURE' then 'FUTURE'
         when Src_Undrl_Type = 'INDEX' then 'INDEX'
         when Src_Undrl_Type = 'QIS' then 'QIS'
         when Src_Undrl_Type in ('FUND','HEDGE_FUND') then 'FUND'
         else 'OTHER'
         end as Undrl_Type_n,
    case when Src_Contr_Type = 'B_LONG_SHORT_SWAP' then ''
         when (Src_Undrl_Type in ('EQUITY', 'BASKET') and Res_Flag = '1') or Src_Undrl_Type = 'GDR' then '限售股'
         when Src_Undrl_Type in ('EQUITY', 'BASKET') and Res_Flag = '0' then '流通股'
         when Src_Undrl_Type = 'BOND' then '债券'
         when Src_Undrl_Type = 'FUTURE' then '期货'
         when Src_Undrl_Type = 'INDEX' then '股指'
         when Src_Undrl_Type = 'QIS' then '策略指数'
         when Src_Undrl_Type in ('FUND','HEDGE_FUND') then '基金'
         else '其他'
         end as Undrl_Type_Desc_n,
    -- 分类优先顺序：2026港股通特殊类型 → 同业 → B2B → 跨境 → 其余QIS/互换。
    -- 没有ELSE：本层未命中为NULL，映射与CD017兜底留在04，不提前覆盖公共分类。
    case when Strt_Pric_Date >= '2026-01-01' and Ex_Rate_Model in ('SHENZHEN_HONGKONG_STOCK_CONNECT','SHANGHAI_HONGKONG_STOCK_CONNECT')
            and Src_Contr_Type in ('RISKY','AIRBAGX','S_CROSS_SWAP') then 'CD025'
         when Busi_Type = 'OPTION' and Indt_Cd in ('11','13') and coalesce(hedg_type_cd,'') != 'B2B'
            and Src_Undrl_Type not in ('EQUITY','GDR','QIS') and Src_Contr_Type not in ('RISKY','AIRBAGX','AIRBAGM','AIRBAGL') then 'CD002'
         when Busi_Type = 'OPTION' and Indt_Cd in ('11','13') and coalesce(hedg_type_cd,'') != 'B2B'
            and Src_Undrl_Type = 'QIS' and Src_Contr_Type not in ('RISKY','AIRBAGX','AIRBAGM','AIRBAGL') then 'CD020'
         when Busi_Type = 'OPTION' and hedg_type_cd = 'B2B' then 'CD001'
         when Busi_Type = 'OPTION' and Book_Bel_Dept = 'OTC' and Src_Undrl_Type not in ('EQUITY','GDR','QIS')
            and Undrl_Curr != 'CNY' and Src_Contr_Type not in ('RISKY','AIRBAGX','AIRBAGM','AIRBAGL') then 'CD023'
         when Busi_Type = 'OPTION' and (Cutp_Pty_Id like 'HK%' or Cutp_Pty_Full_Name = '廣發全球資本有限公司') and Src_Undrl_Type not in ('EQUITY','GDR','QIS')
            and Undrl_Curr = 'CNY' and Src_Contr_Type not in ('RISKY','AIRBAGX','AIRBAGM','AIRBAGL') then 'CD023'
         when Busi_Type = 'OPTION' and Book_Bel_Dept = 'OTC' and Src_Undrl_Type in ('EQUITY','GDR')
            and Undrl_Curr != 'CNY' and Src_Contr_Type not in ('RISKY','AIRBAGX','AIRBAGM','AIRBAGL') then 'CD024'
         when Busi_Type = 'OPTION' and (Cutp_Pty_Id like 'HK%' or Cutp_Pty_Full_Name = '廣發全球資本有限公司') and Src_Undrl_Type in ('EQUITY','GDR')
            and Undrl_Curr = 'CNY' and Src_Contr_Type not in ('RISKY','AIRBAGX','AIRBAGM','AIRBAGL') then 'CD024'
         when Busi_Type = 'OPTION' and Book_Bel_Dept = 'OTC' and Src_Undrl_Type = 'QIS'
            and Undrl_Curr != 'CNY' and Src_Contr_Type not in ('RISKY','AIRBAGX','AIRBAGM','AIRBAGL') then 'CD021'
         when Busi_Type = 'OPTION' and (Cutp_Pty_Id like 'HK%' or Cutp_Pty_Full_Name = '廣發全球資本有限公司') and Src_Undrl_Type = 'QIS'
            and Undrl_Curr = 'CNY' and Src_Contr_Type not in ('RISKY','AIRBAGX','AIRBAGM','AIRBAGL') then 'CD021'
         when Busi_Type = 'OPTION' and Src_Undrl_Type = 'QIS' then 'CD022'
         when Busi_Type = 'TRS' and (Cutp_Pty_Id like 'HK%' or Cutp_Pty_Full_Name = '廣發全球資本有限公司')
            and Undrl_Curr = 'CNY' then 'CD018'
         when Busi_Type = 'TRS' and Src_Undrl_Type = 'QIS' then 'CD019'
         end as Inr_Contr_Type_Cd,
    case when Strt_Pric_Date >= '2026-01-01' and Ex_Rate_Model in ('SHENZHEN_HONGKONG_STOCK_CONNECT','SHANGHAI_HONGKONG_STOCK_CONNECT')
            and Src_Contr_Type in ('RISKY','AIRBAGX','S_CROSS_SWAP') then '特殊气囊（港股通）'
         when Busi_Type = 'OPTION' and Indt_Cd in ('11','13') and coalesce(hedg_type_cd,'') != 'B2B'
            and Src_Undrl_Type not in ('EQUITY','GDR','QIS') and Src_Contr_Type not in ('RISKY','AIRBAGX','AIRBAGM','AIRBAGL') then '同业自主对冲真期权（非个股）'
         when Busi_Type = 'OPTION' and Indt_Cd in ('11','13') and coalesce(hedg_type_cd,'') != 'B2B'
            and Src_Undrl_Type = 'QIS' and Src_Contr_Type not in ('RISKY','AIRBAGX','AIRBAGM','AIRBAGL') then '策略指数-同业期权'
         when Busi_Type = 'OPTION' and hedg_type_cd = 'B2B' then '真期权背靠背'
         when Busi_Type = 'OPTION' and Book_Bel_Dept = 'OTC' and Src_Undrl_Type not in ('EQUITY','GDR','QIS')
            and Undrl_Curr != 'CNY' and Src_Contr_Type not in ('RISKY','AIRBAGX','AIRBAGM','AIRBAGL') then '跨境期权（非个股）'
         when Busi_Type = 'OPTION' and (Cutp_Pty_Id like 'HK%' or Cutp_Pty_Full_Name = '廣發全球資本有限公司') and Src_Undrl_Type not in ('EQUITY','GDR','QIS')
            and Undrl_Curr = 'CNY' and Src_Contr_Type not in ('RISKY','AIRBAGX','AIRBAGM','AIRBAGL') then '跨境期权（非个股）'
         when Busi_Type = 'OPTION' and Book_Bel_Dept = 'OTC' and Src_Undrl_Type in ('EQUITY','GDR')
            and Undrl_Curr != 'CNY' and Src_Contr_Type not in ('RISKY','AIRBAGX','AIRBAGM','AIRBAGL') then '跨境期权（个股）'
         when Busi_Type = 'OPTION' and (Cutp_Pty_Id like 'HK%' or Cutp_Pty_Full_Name = '廣發全球資本有限公司') and Src_Undrl_Type in ('EQUITY','GDR')
            and Undrl_Curr = 'CNY' and Src_Contr_Type not in ('RISKY','AIRBAGX','AIRBAGM','AIRBAGL') then '跨境期权（个股）'
         when Busi_Type = 'OPTION' and Book_Bel_Dept = 'OTC' and Src_Undrl_Type = 'QIS'
            and Undrl_Curr != 'CNY' and Src_Contr_Type not in ('RISKY','AIRBAGX','AIRBAGM','AIRBAGL') then '策略指数-跨境期权'
         when Busi_Type = 'OPTION' and (Cutp_Pty_Id like 'HK%' or Cutp_Pty_Full_Name = '廣發全球資本有限公司') and Src_Undrl_Type = 'QIS'
            and Undrl_Curr = 'CNY' and Src_Contr_Type not in ('RISKY','AIRBAGX','AIRBAGM','AIRBAGL') then '策略指数-跨境期权'
         when Busi_Type = 'OPTION' and Src_Undrl_Type = 'QIS' then '策略指数-其他期权'
         when Busi_Type = 'TRS' and (Cutp_Pty_Id like 'HK%' or Cutp_Pty_Full_Name = '廣發全球資本有限公司')
            and Undrl_Curr = 'CNY' then '北上跨境互换'
         when Busi_Type = 'TRS' and Src_Undrl_Type = 'QIS' then '策略指数-互换'
         end as Inr_Contr_Type_Desc
-- T98场外衍生品合约销售收入基本信息：保留原资料，再追加本消费的分类。
from PDATA_N.T98_OTC_DERI_COMP_SALE_INFO
-- 筛选边界是提前终止日优先的结束日期；当前快照保留历史合约，不等于只看当日新签。
where busi_date = '${yyyy-MM-dd}' and coalesce(Early_Term_Date, End_Pric_Date) >= '2023-01-01'
    and Cutp_Pty_Id not in ('DEV1100101715','DEV1100103266')
    and grp_id != '04'

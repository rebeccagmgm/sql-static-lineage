-- 230202 期权客户创收：下面SELECT先列输出，FROM之后显示这些字段来自哪里。
-- 阅读主线：01合约日 → 02费用客户／03对冲盈亏／04市场利率汇率／05成本参数（并列）→ 06当日创收、07NPV → 09输出。
-- CASE先判断气囊，再动态、静态；07的NPV独立判断柜台，并非06的剩余分支。
-- 只按原查询位置抽取片段；不新增CTE、去重、提前过滤或生产视图。
-- 外层只按目标表顺序投影74列；字段清单不遮住下面的加工主线。
-- @include 11_最终字段顺序.sql
select
-- @include 08_身份与本金.sql
-- @include 06_当日创收.sql
-- @include 07_NPV创收.sql
-- @include 09_展示与输出.sql
-- 连接主线：FROM / JOIN / ON直接保留在这里；复杂输入在括号内引用查询体。
-- 合约快照info：读取范围在01；与逐日明细det按合约号相接才形成合约日。
from (
-- @include 01_合约日底座.sql
) info

-- 逐日本金det：只用明细自身起止日过滤；缺明细不生成合约日。
inner join (
    select * from PDATA_N.T98_OTC_DERI_COMP_SALE_ADTNL_DET
    where busi_date between Strt_Pric_Date and End_Pric_Date
    ) det
on info.agt_id = det.agt_id

-- 计提费用fee：场外流水号＋计提日；费用分类汇总见02。
left join (
-- @include 02_费用与客户.sql
) fee
on fee.Src_Prd_Id = info.Otc_Seri_No and fee.Busi_Date = det.Busi_Date

-- 客户cp：T01_CORP_CUST法人客户，交易对手客户编号取USCC；多匹配仍会扩行。
left join (
    select * from PDATA_N.T01_CORP_CUST
    where src_tbl = 'ODATA_N_OIS.O_OTC_DERIVATIVE_COUNTERPARTY' and busi_date = '${yyyy-MM-dd}' and DEL_FLAG = '0'
    ) cp
on cp.pty_id = info.Cutp_Pty_Id

-- 动态对冲pe：产品号＋账簿＋计提日，且本合约为动态柜台。
left join (
    select * from PDATA_N.T98_SB_TIT_DAY_HOLD_INDX
    where src_tbl = 'ODATA_N_TIT.D_POS_EOD_CALC_METRICS' and busi_date >= '2022-01-01'
    ) pe
on info.otc_seri_no = pe.Src_Prd_Id and det.busi_date = pe.busi_date and info.Book_Agt_Id = pe.Book_Agt_Id and info.Cntr = 'DYNAMIC_HEDGING'

-- 标的盈亏池u：复杂账簿／标的归集留在模块，下方ON保留实际领取范围。
left join (
-- @include 03_对冲与持仓盈亏.sql
) u
on info.undrl_wd_cd = u.Map_Undrl_Cd and det.busi_date = u.busi_date

-- 合约持仓盈亏pd：场外流水号＋账簿＋计提日，供当日创收公式使用。
left join (
    select * from PDATA_N.T98_OTC_BOOK_HOLD_SUM
    where src_tbl = 'ODATA_N_TIT.D_POS_POSITION_DAILY'
    ) pd
on info.otc_seri_no = pd.Src_Prd_Id and det.busi_date = pd.busi_date and info.Book_Agt_Id = pd.Book_Agt_Id

-- 参考利率cr：补日加工留在模块，币种与计提日匹配见下方ON。
left join (
-- @include 04_市场利率与汇率.sql
) cr
on cr.Curr = if(info.Undrl_Curr = 'HKD', 'HKD', 'OTHER') and cr.trd_dt = det.busi_date

-- 汇率mid：人民币中间汇率报价，按结算币种＋计提日接入。
left join (
    select default.datekey2date(trd_dt) as trd_dt, src_crrc_cd, mid_price
    from pdata_news_n.t02_fxr_cfets_quot
    where src_id = 'TIT' and grp_id = '01'
    ) mid
on mid.src_crrc_cd = info.Sett_Crrc_Cd and mid.trd_dt = det.busi_date

-- 生效成本co：按计提日及实际类型／币种条件匹配；不要统一改成报告日最新参数。
left join (
-- @include 05_气囊成本参数.sql
) co
on co.busi_date = det.busi_date and co.currency = if(info.Undrl_Curr = 'HKD', 'HKD', 'OTHER') and info.Src_Contr_Type in ('RISKY','AIRBAGX')

-- 人民币用资成本co_c：与co独立匹配，不能把两个参数范围合并。
left join (
-- @include 05.1_人民币用资成本.sql
) co_c
on co_c.busi_date = det.busi_date and info.Src_Contr_Type in ('RISKY','AIRBAGX')

) castTable

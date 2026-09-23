-- 本文件生产cr参考利率；mid汇率查询和两路ON条件均在00主脚本。
-- cr：HKD取HIBOR3M，其余币种取SOFR；日期先选上月末交易日，再从次月1日向后展开。
-- cr.ir原百分数在收入中除100；pretradedate/datekey2date是平台UDF，具体交易日历不在此推定。
-- mid：CFETS人民币中间汇率，按info.Sett_Crrc_Cd（结算币种）+det.busi_date（计提日）匹配。
-- 缺汇率时实际公式COALESCE(...,1)，不是先补汇率或停止计算；不能据此认定源币种就是人民币。
-- 本文件提供cr查询体；外层JOIN与ON在00主脚本，实际公式继续在收入模块。
--安全气囊X，当月取上月最后一个交易日数据
    select Curr, ir, date_add(trd_dt, pos) as trd_dt
    from (
        select
            date_add(last_day(default.datekey2date(trd_dt)),1) as trd_dt, 
            case scr_cd when 'HIBOR3M' then 'HKD'
                        when 'SOFR' then 'OTHER'
                        end as Curr, ir,
            lead(date_add(last_day(default.datekey2date(trd_dt)),1), 1, date_add('${yyyy-MM-dd}',1)) over(partition by scr_cd order by default.datekey2date(trd_dt)) as next_date
        from pdata_news_n.t02_ira_ibor
        where src_id = 'WD' and scr_cd in ('HIBOR3M','SOFR') and trd_dt >= '20201201'
            and default.datekey2date(trd_dt) = default.pretradedate(date_add(last_day(default.datekey2date(trd_dt)),1),1)
        ) t
    lateral view posexplode(split(space(datediff(next_date, trd_dt)-1), ' ')) t as pos, val

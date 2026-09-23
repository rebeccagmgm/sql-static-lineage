-- cr：参考成本利率，HIBOR1M→HKD、SOFR→USD、TONAR→JPY，从各报价日填到下次报价日前一天。
-- 本文件生产cr；连接键是info.Undrl_Curr标的币种+det计提日，与00的mid汇率结算币种不同。
-- fr查询另在00：浮动腿参考指数利率，rec_id按'-'取首段匹配info.Float_Undrl_Cd，日期精确匹配，不补非交易日。
-- cr.ir与fr.intrt进公式都除100；自定义datekey2date与日历语义不能由普通日期测试替代。
-- 本文件提供cr查询体；外层JOIN与ON在00主脚本，实际公式继续在收入模块。
--补非交易日数据，主表有新增货币告警，跟业务确认
    select Curr, ir, date_add(trd_dt, pos) as trd_dt
    from (
        select default.datekey2date(trd_dt) as trd_dt, 
            case scr_cd when 'HIBOR1M' then 'HKD'
                        when 'SOFR' then 'USD'
                        when 'TONAR' then 'JPY'
                        end as Curr, ir,
            lead(default.datekey2date(trd_dt), 1, date_add('${yyyy-MM-dd}',1)) over(partition by scr_cd order by default.datekey2date(trd_dt)) as next_date
        from pdata_news_n.t02_ira_ibor
        where src_id = 'WD' and scr_cd in ('HIBOR1M','SOFR','TONAR') and trd_dt >= '20201201'
        ) t
    lateral view posexplode(split(space(datediff(next_date, trd_dt)-1), ' ')) t as pos, val

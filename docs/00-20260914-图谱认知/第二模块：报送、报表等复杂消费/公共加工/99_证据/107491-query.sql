set hive.merge.mapfiles=true ;
set hive.merge.mapredfiles=true;
set hive.merge.size.per.task=1073741824;
set hive.merge.smallfiles.avgsize=1073741824;
set hive.merge.orcfile.stripe.level=false;

set hive.input.format=org.apache.hadoop.hive.ql.io.CombineHiveInputFormat;
set mapreduce.input.fileinputformat.split.maxsize=1073741824;
set mapreduce.input.fileinputformat.split.minsize=1073741824;

insert overwrite table T98_OTC_DERI_COMP_SALE_ADTNL_DET PARTITION(busi_date,grp_id)
select
    info.Agt_Id,
    info.Busi_Type,
    info.Cutp_Pty_Id,
    info.Undrl_Ins_Id,
    info.Undrl_Wd_Cd,
    info.Undrl_Name,
    info.Strt_Pric_Date,
    info.End_Pric_Date_n as End_Pric_Date,
    info.Init_Nom_Prin,
    case when grp_id = '01' then if(info.Accrued_Date = info.Strt_Pric_Date, info.Init_Nom_Prin, if(info.Accrued_Date > info.End_Pric_Date_n, 0, coalesce(evt.notional_change * info.Cny_Ex_Rate + info.Init_Nom_Prin, info.Init_Nom_Prin, 0)))
         when grp_id = '02' then if(info.Accrued_Date = info.Strt_Pric_Date, info.Init_Nom_Prin, if(info.Accrued_Date > info.End_Pric_Date_n, 0, coalesce(his_dy.Dyna_Nom_Prin_Org * info.Cny_Ex_Rate, 0)))
         when grp_id = '03' then ks.dynamic_notional
         when grp_id = '04' then coalesce(nd.dynamic_notional * info.Cny_Ex_Rate,0)
         end as Dyna_Nom_Prin,
    fee.fee_rate,
    ks.accrued_interest * (-1) as Inta,
    ks.occupy_cost as Fnd_Cost,
    coalesce(ks_t.profit,0) as Trd_Cms,
    coalesce(ks_t.fee_cost,0) as Trd_Cms_Cost,
    prop.Marg_Prop,
    'TIT' AS Data_Src_Cd,
    UPPER('${filename}') AS Task_Name,
    '${data_day_str}' AS Data_Etl_Date,
    '${data_day_str}' AS Data_Upt_Date,
    '${data_today}' AS Data_Time,
    info.Accrued_Date as Busi_Date,
    info.Grp_Id
from (
    select *,    
        date_add(default.gfgreatest(Strt_Pric_Date,date_sub('${data_day_str}',150)), pos) as Accrued_Date
    from (
        select *, coalesce(Early_Term_Date, End_Pric_Date) as End_Pric_Date_n
        from T98_OTC_DERI_COMP_SALE_INFO
        where busi_date = '${data_day_str}'
            and coalesce(Early_Term_Date, End_Pric_Date) > '2021-09-30'
            and Strt_Pric_Date <= coalesce(Early_Term_Date, End_Pric_Date)
        ) opt
    lateral view posexplode(split(space(datediff('${data_day_str}', default.gfgreatest(Strt_Pric_Date,date_sub('${data_day_str}',150)))), ' ')) t as pos, val
    ) info
left join (
    --期权
    select
        key_option_deal_id,
        notional_change,
        date_format(date_add(event_date, pos),'yyyy-MM-dd') as Accrued_Date
    from (
        select
            key_option_deal_id,
            sum(case when cast(notional_after as double) < cast(notional_before as double) then - notional_delta else notional_delta end) over(partition by key_option_deal_id order by event_date) as notional_change,
            lead(event_date, 1, date_add('${data_day_str}',1)) over(partition by key_option_deal_id order by event_date) as next_date,
            event_date
        from (
            select
                key_option_deal_id,
                max(cast(notional_before as double)) as notional_before,
                min(cast(notional_after as double)) as notional_after,
                sum(notional_delta) as notional_delta,
                event_date
            from odata_n_tit.d_trd_option_event toe
            where busi_Date = '${data_day_str}' and event_status = 'EFFECTIVE' and event_type in ('PARTIAL_TERMINATION','EARLY_LOCK_PL')
            group by key_option_deal_id, event_date
            ) x
        ) t
    lateral view posexplode(split(space(datediff(next_date, event_date)-1), ' ')) t as pos, val
    ) evt
on evt.key_option_deal_id = info.Inr_Seri_No and evt.Accrued_Date = info.Accrued_Date
left join (
    --互换
    SELECT
        rtl.key_otc_trade_id,
        sum(his.Init_Price * his.Init_Quantity) as Init_Nom_Prin_Org,
        sum(his.Init_Price * his.Quantity) as Dyna_Nom_Prin_Org,
        substring(his.src_busi_date,1,10) as Accrued_Date
    FROM (
        select * from odata_n_tit.d_ref_trs_leg
        where busi_Date = '${data_day_str}' and leg_type = 'STRUCTURE_LEG_TYPE'
        ) rtl
    inner join (
        SELECT *
        FROM odata_n_tit.d_pos_trs_leg_his_pos
        where busi_Date = '${data_day_str}'
            and substring(src_busi_date,1,10) between date_sub('${data_day_str}',150) and '${data_day_str}'
        ) his
    ON his.key_leg_id = rtl.key_leg_id
    group by rtl.key_otc_trade_id, substring(his.src_busi_date,1,10)
    ) his_dy
on his_dy.key_otc_trade_id = info.Inr_Seri_No and his_dy.Accrued_Date = info.Accrued_Date
left join (
    --金仕达
    select *, date_add(business_date, pos) as Accrued_Date
    from (
        select key_trade_comfirm_id, business_date, accrued_interest, occupy_cost, dynamic_notional,
            lead(business_date, 1, date_add('${data_day_str}',1)) over(partition by key_trade_comfirm_id order by business_date) as next_date
        from odata_n_tit.d_ks_trade_comfirm_info
        where busi_date = '${data_day_str}'
        ) t
    lateral view posexplode(split(space(datediff(next_date, business_date)-1), ' ')) t as pos, val
    ) ks
on info.Agt_Id = ks.key_trade_comfirm_id and info.Accrued_Date = ks.Accrued_Date
left join (
    --金仕达
    select key_trade_comfirm_id, profit, fee_cost, business_date as Accrued_Date
    from odata_n_tit.d_ks_trade_comfirm_info
    where busi_date = '${data_day_str}'
        and business_date between date_sub('${data_day_str}',150) and '${data_day_str}'
    ) ks_t
on info.Agt_Id = ks_t.key_trade_comfirm_id and info.Accrued_Date = ks_t.Accrued_Date
left join (
    --北上DMA
    select
        key_instrument_id,
        sum(dynamic_notional) as dynamic_notional,
        substring(src_busi_date,1,10) as Accrued_Date
    from odata_n_tit.d_pos_fast_trs_leg_his_pos
    where busi_date = '${data_day_str}' and position_type = 'EOD_POSITION'
        and substring(src_busi_date,1,10) between date_sub('${data_day_str}',150) and '${data_day_str}'
    group by key_instrument_id, substring(src_busi_date,1,10)
    ) nd
on nd.key_instrument_id = info.Otc_Seri_No and info.Accrued_Date = nd.Accrued_Date
left join (
    select *, date_add(GEN_DATE, pos) as Accrued_Date
    from (
        select *, lead(GEN_DATE, 1, date_add('${data_day_str}',1)) over(partition by CONTRACT_ID order by GEN_DATE) as next_date
        from (
            select
                default.datekey2date(GEN_DATE) as GEN_DATE,
                CONTRACT_ID,
                GUARANTEE_RATIO as Marg_Prop,
                row_number() over(partition by CONTRACT_ID, GEN_DATE order by GEN_DATE) as rk
            from odata_n_tit.d_ks_trs_for_risk
            where busi_date = '${data_day_str}'
            ) a
        where rk = 1
        ) b
    lateral view posexplode(split(space(datediff(next_date, GEN_DATE)-1), ' ')) t as pos, val
    ) prop
on prop.Accrued_Date = info.Accrued_Date and prop.CONTRACT_ID = info.agt_id
left join (
    select *, date_format(date_add(CALC_DATE, pos),'yyyy-MM-dd') as Accrued_Date
    from (
        SELECT *, lead(CALC_DATE, 1, date_add('${data_day_str}',1)) over(partition by KEY_INSTRUMENT_ID order by CALC_DATE) as next_date
        FROM odata_n_tit.d_trd_daily_accrual_fee
        where busi_Date = '${data_day_str}' and fee_type = 'ACCRUAL_PREMIUM_FEE'
        ) t
    lateral view posexplode(split(space(datediff(next_date, CALC_DATE)-1), ' ')) t as pos, val
    ) fee
on fee.key_instrument_id = info.Otc_Seri_No and fee.Accrued_Date = info.Accrued_Date
;
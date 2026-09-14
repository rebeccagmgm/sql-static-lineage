-- task_id: 92343
-- hiveDb: PDATA_N
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-GF_FDM_N/SUM/PDATA_N.T98_CSTD_SUBJ_INFO_H_ACV001.py
-- observed_at: 2026-09-05T01:06:39.518Z

-- createSql
CREATE TABLE IF NOT EXISTS T98_CSTD_SUBJ_INFO_H(
     Sob_Id                 STRING COMMENT '账套编号'
    ,Subj_Id                STRING COMMENT '科目编号'
    ,Subj_Name              STRING COMMENT '科目名称'
    ,Subj_Sys_Subj_Id       STRING COMMENT '科目方案代码'
    ,Subj_Sys_Subj_Name     STRING COMMENT '科目体系科目名称'
    ,Subj_Bal_Dir_Cd        STRING COMMENT '科目余额方向代码'
    ,Upper_Subj_Id          STRING COMMENT '上级科目编号'
    ,Subj_Type_Cd           STRING COMMENT '科目类型代码'
    ,Subj_Lvl               STRING COMMENT '科目层级'
    ,Subj_Id_Lvl1           STRING COMMENT '科目对应1级科目编号'
    ,Subj_Id_Lvl2           STRING COMMENT '科目对应2级科目编号'
    ,Subj_Id_Lvl3           STRING COMMENT '科目对应3级科目编号'
    ,Sys_Flag               STRING COMMENT '科目体系科目标志'
    ,Det_Flag               STRING COMMENT '明细项标志'
    ,Qty_Acctng_Ind         STRING COMMENT '数量核算标识'
    ,Cost_Subj_Flag         STRING COMMENT '成本科目标识'
    ,Incrs_Subj_Flag        STRING COMMENT '增值科目标识'
    ,Tax_Flag               STRING COMMENT '利息科目标志'
    ,Divd_Flag              STRING COMMENT '股利科目标志'
    ,Crrd_Cd                STRING COMMENT '币种代码'
    ,Scr_Inr_Cd             STRING COMMENT '证券内码'
    ,Scr_Cd                 STRING COMMENT '证券代码'
    ,Secu_Id                STRING COMMENT '统一证券编码'
    ,Exch_Type_Cd           STRING COMMENT '市场代码'
    ,Scr_Type               STRING COMMENT '证券类型'
    ,Del_Flag               STRING COMMENT '删除标志'
    ,Del_Date               STRING COMMENT '删除日期'
    ,Data_Time              STRING COMMENT '数据日期'
    ,Data_Src_Cd            STRING COMMENT '数据来源代码'
    ,Used_Flag              STRING COMMENT '是否使用标志:1-是 0-否'
)COMMENT 'T98_资产托管产科目信息历史'
PARTITIONED BY (Src_Tbl     STRING COMMENT '源表')
STORED AS ORC;

set hive.tez.exec.print.summary=true;

--临时表1：成本与增值科目
drop table if exists TEMP_N.T98_CSTD_SUBJ_INFO_H_ACV001_TEMP1;
create table if not exists TEMP_N.T98_CSTD_SUBJ_INFO_H_ACV001_TEMP1 as 
select Scr_Clas_Cd Subj_Sys_Subj_Id, 'cost' flag
from PDATA_N.T09_ACV_SCR_SETT_HOLD_INFO
where busi_date>= date_sub('{busi_date}',90) and busi_date<='{busi_date}' 
    and src_tbl= 'ODATA_N_ACV.H_TACCOUNTZQJC'
group by Scr_Clas_Cd
union all 
select Cost_Valu Subj_Sys_Subj_Id, 'incrs' flag
from PDATA_N.T09_ACV_SCR_SETT_HOLD_INFO
where busi_date>= date_sub('{busi_date}',90) and busi_date<='{busi_date}' 
    and src_tbl= 'ODATA_N_ACV.H_TACCOUNTZQJC'
group by Cost_Valu
;

--临时表2：产品
drop table if exists TEMP_N.T98_CSTD_SUBJ_INFO_H_ACV001_TEMP2;
create table TEMP_N.T98_CSTD_SUBJ_INFO_H_ACV001_TEMP2 as  
select Secu_Id
    ,Scr_Inr_cd
    ,Scr_Cd
    ,Ch_Name
    ,Scr_Var
    ,b.dw_cd_val as Exch_Type_Cd
from 
(select secu_id
    ,src_rec_id as scr_inr_cd
    ,scr_cd
    ,ch_name
    ,split(src_sys_prdno,'-')[1] as src_exch_type_cd
    ,split(src_sys_prdno,'-')[2] as scr_var
    ,row_number() over(partition by src_sys_prdno order by secu_id) rn
from pdata_news_n.t02_scr_base_info
where src_id = 'ACVT'
) a 
left join 
(select src_cd_val,dw_cd_val,dw_cd_desc
from pdata_n.ref_cd_cvt_map
where tgt_tab_name = 'T09_VALU_H'         -- 仓库表名
    and tgt_tab_fld  = 'Exch_Type_Cd'      -- 落地字段名
    and src_tab_name = 'TTMP_H_GZB'        -- 源系统表名
    and src_fld_name = 'L_SCLB'            -- 源系统字段名
    and src_sys_name = 'ACV'                 -- 源系统简称
) b
on a.src_exch_type_cd = b.src_cd_val
where a.rn=1;

--临时表3：从证券结存信息抽取科目与标的的关联信息
drop table if exists TEMP_N.T98_CSTD_SUBJ_INFO_H_ACV001_TEMP3;
create table TEMP_N.T98_CSTD_SUBJ_INFO_H_ACV001_TEMP3 as  
select Sob_Id
    ,Subj_Id
    --,Subj_Name
    ,b.Scr_Cd
    ,b.Exch_Type_Cd
    ,b.Scr_Var
    ,b.Secu_id
    ,b.Scr_Inr_cd
from 
    (select *
    from 
        (select sob_id,subj_id,scr_inr_cd,scr_cd,exch_type_cd,
            row_number() over(partition by sob_id,subj_id order by busi_date desc) rn
        from PDATA_N.T09_ACV_SCR_SETT_HOLD_INFO
        where busi_date>= date_sub('{busi_date}',90) and busi_date<='{busi_date}' 
            and src_tbl= 'ODATA_N_ACV.H_TACCOUNTZQJC'
        ) t
    where rn = 1
    ) a 
    left join 
    TEMP_N.T98_CSTD_SUBJ_INFO_H_ACV001_TEMP2 b 
    on a.scr_inr_cd=b.scr_inr_cd
;

--临时表4：从凭证表抽取科目与标的的关联信息
drop table if exists TEMP_N.T98_CSTD_SUBJ_INFO_H_ACV001_TEMP4;
create table TEMP_N.T98_CSTD_SUBJ_INFO_H_ACV001_TEMP4 as  
select a.Sob_Id
    ,a.Subj_Id
    --,Subj_Name
    ,b.Scr_Cd
    ,b.Exch_Type_Cd
    ,b.Scr_Var
    ,b.Secu_Id
    ,a.Scr_Inr_Cd
from 
    (select l_fundid as Sob_Id
        ,vc_code as Subj_Id
        ,max(l_zqnm) as Scr_Inr_Cd
    from
        (select l_fundid,vc_code,l_zqnm
        from odata_n_acv.h_tvouchers_pb --凭证表增量采集
        where grp_id ='d_date'
            and busi_date = '{busi_date}'
            and coalesce(l_zqnm,'')<>''
            and substr(vc_code,1,4) in ('1102','1103','1104','1105','1108','1109','1112','2101','3102','3201')
            and substr(vc_code,1,6) not in ('110302')
        group by l_fundid,vc_code,l_zqnm
        ) t 
    group by l_fundid,vc_code having count(1)=1
    ) a 
    --关联证券内码 
    left join 
    TEMP_N.T98_CSTD_SUBJ_INFO_H_ACV001_TEMP2 b 
    on a.Scr_Inr_cd=b.Scr_Inr_cd
;

--临时表5：从估值表抽取科目与标的的关联信息
drop table if exists TEMP_N.T98_CSTD_SUBJ_INFO_H_ACV001_TEMP5;
create table TEMP_N.T98_CSTD_SUBJ_INFO_H_ACV001_TEMP5 as  
select sob_plan_id as Sob_Id
    ,subj_id as Subj_Id
    ,Subj_Name
    ,coalesce(s1.Scr_Cd,s2.Scr_Cd,a.Scr_Cd) as Scr_Cd
    ,a.Exch_Type_Cd
    ,a.Scr_Var
    ,nvl(s1.Secu_Id,s2.Secu_Id) as Secu_Id
    ,nvl(s1.Scr_Inr_Cd,s2.Scr_Inr_Cd) as Scr_Inr_Cd
from 
    (select sob_plan_id,subj_id,subj_name,exch_type_cd,scr_cd,scr_var,substr(scr_cd,9) scr_cd2
    from
        (select sob_plan_id,subj_id,subj_name,exch_type_cd,scr_cd,scr_var,
        row_number() over(partition by sob_plan_id,subj_id order by busi_date desc)rn
        from pdata_n.T09_VALU_H 
        where src_tbl = 'ODATA_N_ACV.H_TTMP_H_GZB'
            and busi_date>= date_sub('{busi_date}',90) and busi_date<='{busi_date}' 
            and nvl(scr_var,'0')<>'0'
        ) t 
    where rn=1
    ) a 
    --关联证券内码 
    left join 
    TEMP_N.T98_CSTD_SUBJ_INFO_H_ACV001_TEMP2 s1 
    on a.scr_cd=s1.scr_cd
        and a.scr_var = s1.scr_var 
        and a.exch_type_cd = s1.exch_type_cd
    --scr_cd关联失败的再用科目关联一次 
    left join 
    TEMP_N.T98_CSTD_SUBJ_INFO_H_ACV001_TEMP2 s2
    on a.scr_cd2=s2.scr_cd
        and a.scr_var = s2.scr_var 
        and a.exch_type_cd = s1.exch_type_cd
       -- and a.subj_name = s2.ch_name
;

--临时表6：估值表使用过的科目
drop table if exists TEMP_N.T98_CSTD_SUBJ_INFO_H_ACV001_TEMP6;
create table TEMP_N.T98_CSTD_SUBJ_INFO_H_ACV001_TEMP6 as  
select sob_plan_id as Sob_Id
    ,subj_id as Subj_Id
from pdata_n.T09_VALU_H 
where src_tbl = 'ODATA_N_ACV.H_TTMP_H_GZB'
    and busi_date>= date_sub('{busi_date}',90) and busi_date<='{busi_date}' 
    and nvl(subj_id,'')<>''
group by sob_plan_id,subj_id
;



--临时表：当天科目表
drop table if exists TEMP_N.T98_CSTD_SUBJ_INFO_H_ACV001_DAY;
create table if not exists TEMP_N.T98_CSTD_SUBJ_INFO_H_ACV001_DAY as 
select 
     t1.sob_plan_id         as Sob_Id 
    ,t1.subj_id             as Subj_Id  
    ,t1.subj_name           as Subj_Name
    ,t2.Subj_Sys_Subj_Id    as Subj_Sys_Subj_Id
    ,t3.Subj_Sys_Subj_Name  as Subj_Sys_Subj_Name
    ,t1.subj_bal_dir_cd     as Subj_Bal_Dir_Cd
    ,t1.upper_subj_id       as Upper_Subj_Id
    ,t1.subj_type_cd        as Subj_Type_Cd
    ,t1.subj_lvl            as Subj_Lvl
    ,case when t1.subj_lvl = '1' then t1.subj_id 
        when t4.subj_lvl = '1' then t4.subj_id 
        when t5.subj_lvl = '1' then t5.subj_id 
        when t6.subj_lvl = '1' then t6.subj_id 
        else null end       as Subj_Id_Lvl1
    ,case when t1.subj_lvl = '2' then t1.subj_id 
        when t4.subj_lvl = '2' then t4.subj_id 
        when t5.subj_lvl = '2' then t5.subj_id 
        when t6.subj_lvl = '2' then t6.subj_id 
        else null end       as Subj_Id_Lvl2
    ,case when t1.subj_lvl = '3' then t1.subj_id 
        when t4.subj_lvl = '3' then t4.subj_id 
        when t5.subj_lvl = '3' then t5.subj_id 
        when t6.subj_lvl = '3' then t6.subj_id 
        else null end       as Subj_Id_Lvl3
    ,case when t3.Subj_Sys_Subj_id is not null then '1' else '0' end as Sys_Flag
    ,t1.det_flag            as Det_Flag
    ,t1.qty_acctng_ind      as Qty_Acctng_Ind
    ,case when t7.Subj_Sys_Subj_Id is not null then '1' else '0' end as Cost_Subj_Flag
    ,case when t8.Subj_Sys_Subj_Id is not null then '1' else '0' end as Incrs_Subj_Flag
    ,cast(null as string) as Tax_Flag
    ,cast(null as string) as Divd_Flag 
    ,t1.crrc_cd             as Crrd_Cd
    ,coalesce(t9.Scr_Inr_Cd, t10.Scr_Inr_Cd, t11.Scr_Inr_Cd)  as Scr_Inr_Cd
    ,coalesce(t9.Scr_Cd, t10.Scr_Cd, t11.Scr_Cd)  as Scr_Cd
    ,coalesce(t9.Secu_Id, t10.Secu_Id, t11.Secu_Id)  as Secu_Id
    ,coalesce(t9.Exch_Type_Cd, t10.Exch_Type_Cd, t11.Exch_Type_Cd)  as Exch_Type_Cd
    ,coalesce(t9.Scr_Var, t10.Scr_Var, t11.Scr_Var)  as Scr_Type
    ,if(t12.subj_id is not null,'1',null) as Used_Flag
from 
    (select sob_plan_id,subj_id,subj_name,subj_lvl,upper_subj_id,crrc_cd,subj_type_cd,subj_bal_dir_cd,det_flag,qty_acctng_ind
    from PDATA_N.T09_ACCTNT_SUBJ --会计科目
    where src_tbl = 'ODATA_N_ACV.H_TACCOUNT' 
        and busi_date = '{busi_date}'
        and Sob_Plan_Id  not in ('9999','9986','9987','9998')
    ) t1
    left join
    (select Sob_Plan_Id,
        Subj_Id,
        Subj_Sys_Subj_Id
    from PDATA_N.T09_ACV_ACCTNT_SUBJ_ADTNL
    where src_tbl = 'ODATA_N_ACV.H_TACCOUNT'
        and busi_date = '{busi_date}'
    ) t2
    on t1.Sob_Plan_Id = t2.Sob_Plan_Id and t1.Subj_Id = t2.Subj_Id 
    left join 
    (select Subj_Sys_Subj_id,Subj_Sys_Subj_Name
    from PDATA_N.T09_SUBJ_SYS_PLAN_INFO --科目体系方案信息
    where src_tbl = 'ODATA_N_ACV.H_TACCOUNT_HS'
        and Sob_Id = '9999'
    ) t3
    on t2.Subj_Sys_Subj_Id = t3.Subj_Sys_Subj_id
    --上1级科目
    left join 
    (select sob_plan_id,subj_id,upper_subj_id,subj_lvl
    from PDATA_N.T09_ACCTNT_SUBJ --会计科目
    where src_tbl = 'ODATA_N_ACV.H_TACCOUNT' 
        and busi_date = '{busi_date}'
        and Sob_Plan_Id  not in ('9999','9986','9987','9998')
    ) t4
    on t1.sob_plan_id = t4.sob_plan_id and t1.upper_subj_id = t4.subj_id
    --上2级科目
    left join 
    (select sob_plan_id,subj_id,upper_subj_id,subj_lvl
    from PDATA_N.T09_ACCTNT_SUBJ --会计科目
    where src_tbl = 'ODATA_N_ACV.H_TACCOUNT' 
        and busi_date = '{busi_date}'
        and Sob_Plan_Id  not in ('9999','9986','9987','9998')
    ) t5
    on t4.sob_plan_id = t5.sob_plan_id and t4.upper_subj_id = t5.subj_id 
    --上3级科目
    left join 
    (select sob_plan_id,subj_id,upper_subj_id,subj_lvl
    from PDATA_N.T09_ACCTNT_SUBJ --会计科目
    where src_tbl = 'ODATA_N_ACV.H_TACCOUNT' 
        and busi_date = '{busi_date}'
        and Sob_Plan_Id  not in ('9999','9986','9987','9998')
    ) t6
    on t5.sob_plan_id = t6.sob_plan_id and t5.upper_subj_id = t6.subj_id 
    --成本科目
    left join 
    (select Subj_Sys_Subj_Id 
    from TEMP_N.T98_CSTD_SUBJ_INFO_H_ACV001_TEMP1 where flag = 'cost'
    ) t7 
    on t2.Subj_Sys_Subj_Id = t7.Subj_Sys_Subj_Id
    --增值科目
    left join 
    (select Subj_Sys_Subj_Id 
    from TEMP_N.T98_CSTD_SUBJ_INFO_H_ACV001_TEMP1 where flag = 'incrs'
    ) t8
    on t2.Subj_Sys_Subj_Id = t8.Subj_Sys_Subj_Id
    --关联证券标的（证券结存信息）
    left join 
    TEMP_N.T98_CSTD_SUBJ_INFO_H_ACV001_TEMP3 t9 
    on t1.sob_plan_id = t9.sob_id and t1.subj_id = t9.subj_id 
    --关联证券标的（凭证表）
    left join 
    TEMP_N.T98_CSTD_SUBJ_INFO_H_ACV001_TEMP4 t10
    on t1.sob_plan_id = t10.sob_id and t1.subj_id = t10.subj_id 
    --关联证券标的（估值表）
    left join 
    TEMP_N.T98_CSTD_SUBJ_INFO_H_ACV001_TEMP5 t11
    on t1.sob_plan_id = t11.sob_id and t1.subj_id = t11.subj_id 
    --关联估值表使用过的科目
    left join 
    TEMP_N.T98_CSTD_SUBJ_INFO_H_ACV001_TEMP6 t12
    on t1.sob_plan_id = t12.sob_id and t1.subj_id = t12.subj_id 
;

--临时表：与昨天对比
drop table if exists TEMP_N.T98_CSTD_SUBJ_INFO_H_ACV001_TEMP;
create table if not exists TEMP_N.T98_CSTD_SUBJ_INFO_H_ACV001_TEMP as 
select 
     coalesce(a.Sob_Id,b.Sob_Id) as  Sob_Id
    ,coalesce(b.Subj_Id,a.Subj_Id) as Subj_Id
    ,coalesce(b.Subj_Name,a.Subj_Name) as Subj_Name
    ,coalesce(b.Subj_Sys_Subj_Id,a.Subj_Sys_Subj_Id) as Subj_Sys_Subj_Id
    ,coalesce(b.Subj_Sys_Subj_Name,a.Subj_Sys_Subj_Name) as Subj_Sys_Subj_Name
    ,coalesce(b.Subj_Bal_Dir_Cd,a.Subj_Bal_Dir_Cd) as Subj_Bal_Dir_Cd
    ,coalesce(b.Upper_Subj_Id,a.Upper_Subj_Id) as Upper_Subj_Id
    ,coalesce(b.Subj_Type_Cd,a.Subj_Type_Cd) as Subj_Type_Cd
    ,coalesce(b.Subj_Lvl,a.Subj_Lvl) as Subj_Lvl
    ,coalesce(b.Subj_Id_Lvl1,a.Subj_Id_Lvl1) as Subj_Id_Lvl1
    ,coalesce(b.Subj_Id_Lvl2,a.Subj_Id_Lvl2) as Subj_Id_Lvl2
    ,coalesce(b.Subj_Id_Lvl3,a.Subj_Id_Lvl3) as Subj_Id_Lvl3
    ,coalesce(b.Sys_Flag,a.Sys_Flag) as Sys_Flag
    ,coalesce(b.Det_Flag,a.Det_Flag) as Det_Flag
    ,coalesce(b.Qty_Acctng_Ind,a.Qty_Acctng_Ind) as Qty_Acctng_Ind
    ,coalesce(b.Cost_Subj_Flag,a.Cost_Subj_Flag) as Cost_Subj_Flag
    ,coalesce(b.Incrs_Subj_Flag,a.Incrs_Subj_Flag) as Incrs_Subj_Flag
    ,coalesce(b.Tax_Flag,a.Tax_Flag) as Tax_Flag
    ,coalesce(b.Divd_Flag,a.Divd_Flag) as Divd_Flag
    ,coalesce(b.Crrd_Cd,a.Crrd_Cd) as Crrd_Cd
    ,coalesce(b.Scr_Inr_Cd,a.Scr_Inr_Cd) as Scr_Inr_Cd
    ,coalesce(b.Scr_Cd,a.Scr_Cd) as Scr_Cd
    ,coalesce(b.Secu_Id,a.Secu_Id) as Secu_Id
    ,coalesce(b.Exch_Type_Cd,a.Exch_Type_Cd) as Exch_Type_Cd
    ,coalesce(b.Scr_Type,a.Scr_Type) as Scr_Type
    ,case when b.Subj_Id is null then '1' else '0' end as Del_Flag
    ,case when b.Subj_Id is null then '{busi_date}' else a.Del_Date end as Del_Date
    ,'{data_today}' as Data_Time
    ,'ACV' as Data_Src_Cd
    ,coalesce(b.Used_Flag,a.Used_Flag,'0') as Used_Flag
from
    (select *
    from PDATA_N.T98_CSTD_SUBJ_INFO_H 
    where src_tbl = '{src_table}'
    ) a 
    full join
    (select *
    from
        (select *, 
            row_number() over(partition by Sob_Id,Subj_Id order by Upper_Subj_Id desc) rn
        from TEMP_N.T98_CSTD_SUBJ_INFO_H_ACV001_DAY
        ) t 
    where rn = 1
    ) b 
    on a.Sob_Id = b.Sob_Id and a.Subj_Id = b.Subj_Id
;

-- querySql
INSERT OVERWRITE TABLE T98_CSTD_SUBJ_INFO_H PARTITION(Src_Tbl = '{src_table}')
SELECT *
from TEMP_N.T98_CSTD_SUBJ_INFO_H_ACV001_TEMP;

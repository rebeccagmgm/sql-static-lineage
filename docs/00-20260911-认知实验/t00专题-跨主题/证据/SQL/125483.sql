-- task_id: 125483
-- hiveDb: pdata_n
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-GF_FDM_N/CSA/PDATA_N.T00_INCTV_PLAN_ADTNL_INFO_CRM176.py
-- observed_at: 2026-09-05T01:06:50.485Z

-- createSql
CREATE TABLE IF NOT EXISTS T00_INCTV_PLAN_ADTNL_INFO(
     Inctv_Plan_Id              STRING COMMENT '激励计划编号'
    ,Scr_Cd                     STRING COMMENT '证券代码'
    ,Inctv_Tot                  STRING COMMENT '激励总人数'
    ,Inctv_Snir_Tot             STRING COMMENT '激励董高人数'
    ,Inctv_Norm_Tot             STRING COMMENT '激励非董高人数'
    ,Conf_Pric                  STRING COMMENT '授予价格'
    ,Conf_Type_Cd               STRING COMMENT '授予类型代码'
    ,Conf_Vol                   STRING COMMENT '授予数量'
    ,Snir_Conf_Vol              STRING COMMENT '董高授予股数'
    ,Norm_Conf_Vol              STRING COMMENT '非董高授予股数'
    ,Conf_Reg_Date              STRING COMMENT '授予登记日期'
    ,Conf_Reg_Inctv_Mval        STRING COMMENT '授予登记日激励市值'
    ,Repo_Pric_Type_Cd          STRING COMMENT '回购价格类型代码'
    ,Repo_Pric_Desc             STRING COMMENT '回购价格描述'
    ,Res_Term                   STRING COMMENT '限售期'
    ,Eff_Term                   STRING COMMENT '有效期'
    ,Amrt_Times                 STRING COMMENT '分期期数'
    ,Ei_Dsgn_Co_Cd              STRING COMMENT '股权激励设计方代码'
    ,Self_Proj_Flag             STRING COMMENT '我司项目标志'
    ,Drft_Ntce_Date             STRING COMMENT '草案公告日'
    ,Drft_Ntce_Inctv_Mval       STRING COMMENT '草案公告日激励市值'
    ,Prov_Cd                    STRING COMMENT '省代码'
    ,City_Cd                    STRING COMMENT '城市代码'
    ,Amrt_Tot_Fee               STRING COMMENT '摊销总费用'
    ,Undrl_Scr                  STRING COMMENT '标的证券'
    ,Sign_Flag                  STRING COMMENT '签约标志'
    ,Conf_Date                  STRING COMMENT '授予日期'
    ,Unlist_Date                STRING COMMENT '上市日期'
    ,Actl_Oact_Tot              STRING COMMENT '实际开户总数'
    ,Actl_Snir_Oact_Tot         STRING COMMENT '实际董高开户数'
    ,Actl_Cstd_Cnt              STRING COMMENT '实际托管数'
    ,Actl_Cstd_Inctv_Mval       STRING COMMENT '实际托管激励权益市值'
    ,Scr_Scrp_Vol               STRING COMMENT '证券认购数量'
    ,Wait_Begn_Type_Cd          STRING COMMENT '等待期起始日类型代码'
    ,Exer_Begn_Date             STRING COMMENT '行权起始日'
    ,Inctv_Plan_Prog_Cd         STRING COMMENT '激励计划进度代码'
    ,Manu_Upd_Flag              STRING COMMENT '手工更新标志'
    ,Cfm_Tax_Flag               STRING COMMENT '确认缴税标志'
    ,Rec_Stat_Cd                STRING COMMENT '记录状态代码'
    ,Data_Src_Cd                STRING COMMENT '数据来源代码'
    ,Task_Name                  STRING COMMENT '任务名'
    ,Data_Etl_Date              STRING COMMENT '数据加载日期'
    ,Data_Upt_Date              STRING COMMENT '数据更新日期'
    ,Data_Time                  STRING COMMENT '数据时间'
    ,Scrp_Pric                  STRING COMMENT '认购价格'
    ,Intr_Pay_Mode_Cd           STRING COMMENT '付息方式代码'
    ,Entr_Strt_Date             STRING COMMENT '委托开始日期'
    ,Entr_End_Date              STRING COMMENT '委托结束日期'
    ,Fin_Scrp_Date              STRING COMMENT '融资认购日期'
    ,Snir_Cust_Fin_Rati         STRING COMMENT '董高客户融资比例'
    ,Norm_Cust_Fin_Rati         STRING COMMENT '非董高客户融资比例'
    ,Snir_Cust_Covt_Rati        STRING COMMENT '董高客户折算率'
    ,Norm_Cust_Covt_Rati        STRING COMMENT '非董高客户折算率'
    ,Snir_Cust_Fin_Rate         STRING COMMENT '董高客户融资利率'
    ,Norm_Cust_Fin_Rate         STRING COMMENT '非董高客户融资利率'
    ,Snir_Cust_Guar_Line        STRING COMMENT '董高客户提保线'
    ,Norm_Cust_Guar_Line        STRING COMMENT '非董高客户提保线'
    ,Snir_Cust_Alr_Line         STRING COMMENT '董高客户警戒线'
    ,Norm_Cust_Alr_Line         STRING COMMENT '非董高客户警戒线'
    ,Snir_Cust_Opps_Line        STRING COMMENT '董高客户平仓线'
    ,Norm_Cust_Line             STRING COMMENT '非董高客户平仓线'
    ,Reco_Rate                  STRING COMMENT '补偿利率'
    ,Fine_Rate                  STRING COMMENT '罚息利率'
    ,Agt_Pric                   STRING COMMENT '协议价'
    ,Plg_Flag                   STRING COMMENT '质押标志'
    ,Plg_Lmt                    STRING COMMENT '质押额度'
    ,Par_val                    STRING COMMENT '每股面值'
    ,Dect_Tax_Flag              STRING COMMENT '代扣税标志'
    ,Guar_Calc_Guar_Flag        STRING COMMENT '担保线计算合并履保标志'
    ,Inpt_User                  STRING COMMENT '录入人'
    ,Inpt_Time                  STRING COMMENT '录入时间'
    ,Remark                     STRING COMMENT '备注'
    ,Exer_Pric                  STRING COMMENT '行权价'
    ,Exer_Cd                    STRING COMMENT '行权代码'
    ,Fin_Alr_Line               STRING COMMENT '融资警戒线'
    ,Fin_Trt_Line               STRING COMMENT '融资处置线'
    ,Fin_Term                   STRING COMMENT '融资期限'

)COMMENT '激励计划附加信息'
PARTITIONED BY (SRC_TBL  STRING COMMENT'源表')
STORED AS ORC;

-- querySql
INSERT OVERWRITE TABLE T00_INCTV_PLAN_ADTNL_INFO PARTITION(SRC_TBL='${src_table}')
-----------------------------------------------------------------------------------------------------
--Group3: Source Table:[ODATA_N_CRM.C_TXQRZ_JLJHGL:行权融资激励计划管理] 
-----------------------------------------------------------------------------------------------------
SELECT
     CONCAT('CRM176-',ID)                  AS  Inctv_Plan_Id           --激励计划编
    ,ZQDM                                  AS  Scr_Cd                  --证券代码
    ,''                                    AS  Inctv_Tot               --激励总人数
    ,''                                    AS  Inctv_Snir_Tot          --激励董高人数
    ,''                                    AS  Inctv_Norm_Tot          --激励非董高人数
    ,''                                    AS  Conf_Pric               --授予价格
    ,''                                    AS  Conf_Type_Cd            --授予类型代码
    ,''                                    AS  Conf_Vol                --授予数量
    ,''                                    AS  Snir_Conf_Vol           --董高授予股数
    ,''                                    AS  Norm_Conf_Vol           --非董高授予股数
    ,''                                    AS  Conf_Reg_Date           --授予登记日期
    ,''                                    AS  Conf_Reg_Inctv_Mval     --授予登记日激励市值
    ,''                                    AS  Repo_Pric_Type_Cd       --回购价格类型代码
    ,''                                    AS  Repo_Pric_Desc          --回购价格描述
    ,''                                    AS  Res_Term                --限售期
    ,''                                    AS  Eff_Term                --有效期
    ,''                                    AS  Amrt_Times              --分期期数
    ,''                                    AS  Ei_Dsgn_Co_Cd           --股权激励设计方代码
    ,''                                    AS  Self_Proj_Flag          --我司项目标志
    ,''                                    AS  Drft_Ntce_Date          --草案公告日
    ,''                                    AS  Drft_Ntce_Inctv_Mval    --草案公告日激励市值
    ,''                                    AS  Prov_Cd                 --省代码
    ,''                                    AS  City_Cd                 --城市代码
    ,''                                    AS  Amrt_Tot_Fee            --摊销总费用
    ,BDZQ                                   AS  Undrl_Scr               --标的证券
    ,''                                    AS  Sign_Flag               --签约标志
    ,''                                    AS  Conf_Date               --授予日期
    ,''                                    AS  Unlist_Date             --上市日期
    ,''                                    AS  Actl_Oact_Tot           --实际开户总数
    ,''                                    AS  Actl_Snir_Oact_Tot      --实际董高开户数
    ,''                                    AS  Actl_Cstd_Cnt           --实际托管数
    ,''                                    AS  Actl_Cstd_Inctv_Mval    --实际托管激励权益市值
    ,''                                    AS  Scr_Scrp_Vol            --证券认购数量
    ,''                                    AS  Wait_Begn_Type_Cd       --等待期起始日类型代码
    ,''                                    AS  Exer_Begn_Date          --行权起始日
    ,''                                    AS  Inctv_Plan_Prog_Cd      --激励计划进度代码
    ,''                                    AS  Manu_Upd_Flag           --手工更新标志
    ,''                                    AS  Cfm_Tax_Flag            --确认缴税标志
    ,''                                    AS  Rec_Stat_Cd             --记录状态代码
    ,'${data_src_cd}'                 AS  Data_Src_Cd             --数据来源代码
    ,'${filename}'                    AS  Task_Name               --任务名
    ,'${data_day_str}'                AS  Data_Etl_Date           --数据加载日期
    ,'${data_today_str}'              AS  Data_Upt_Date           --数据更新日期
    ,'${data_today}'                  AS  Data_Time               --数据时间
    ,''                                    AS Scrp_Pric                --认购价格
    ,''                                    AS Intr_Pay_Mode_Cd         --付息方式代码
    ,''                                    AS Entr_Strt_Date           --委托开始日期
    ,''                                    AS Entr_End_Date            --委托结束日期
    ,''                                    AS Fin_Scrp_Date            --融资认购日期
    ,DG_RZBL                               AS Snir_Cust_Fin_Rati       --董高客户融资比例
    ,FDG_RZBL                              AS Norm_Cust_Fin_Rati       --非董高客户融资比例
    ,DG_ZSL                                AS Snir_Cust_Covt_Rati      --董高客户折算率
    ,FDG_ZSL                               AS Norm_Cust_Covt_Rati      --非董高客户折算率
    ,DG_LL                                 AS Snir_Cust_Fin_Rate       --董高客户融资利率
    ,FDG_LL                                AS Norm_Cust_Fin_Rate       --非董高客户融资利率
    ,''                                    AS Snir_Cust_Guar_Line      --董高客户提保线
    ,''                                    AS Norm_Cust_Guar_Line      --非董高客户提保线
    ,''                                    AS Snir_Cust_Alr_Line       --董高客户警戒线
    ,''                                    AS Norm_Cust_Alr_Line       --非董高客户警戒线
    ,''                                    AS Snir_Cust_Opps_Line      --董高客户平仓线
    ,''                                    AS Norm_Cust_Line           --非董高客户平仓线
    ,''                                    AS Reco_Rate                --补偿利率
    ,''                                    AS Fine_Rate                --罚息利率
    ,''                                    AS Agt_Pric                 --协议价
    ,''                                    AS Plg_Flag                 --质押标志
    ,''                                    AS Plg_Lmt                  --质押额度
    ,''                                    AS Par_val                  --每股面值
    ,''                                    AS Dect_Tax_Flag            --代扣税标志
    ,''                                    AS Guar_Calc_Guar_Flag      --担保线计算合并履保标志
    ,LRR                                   AS Inpt_User                --录入人
    ,LRSJ                                  AS Inpt_Time                --录入时间
    ,''                                    AS Remark                   --备注
    ,XQJG                                  AS Exer_Pric                --行权价
    ,XQDM                                  AS Exer_Cd                  --行权代码
    ,JJX                                   AS Fin_Alr_Line             --融资警戒线
    ,CZX                                   AS Fin_Trt_Line             --融资处置线
    ,RZQX                                  AS Fin_Term                 --融资期限

FROM   (SELECT *  FROM ${src_table} WHERE  BUSI_DATE='${data_day_str}' )A
;

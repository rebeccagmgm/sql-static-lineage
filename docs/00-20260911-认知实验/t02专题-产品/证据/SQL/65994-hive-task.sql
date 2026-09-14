-- task_id: 65994
-- hiveDb: pdata_news_n
-- source: LOCAL_CODE
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-pdata_news_n/prd_dm/pdata_news_n.t02_marg_base_info_RCC
-- observed_at: 2026-09-05T01:06:26.144Z

-- createSql
CREATE TABLE IF NOT EXISTS T02_MARG_BASE_INFO(
        Secu_Id             STRING COMMENT '统一证券编号'
        ,Src_Sys_Prdno       STRING COMMENT '源系统产品编'
        ,scr_type             string  comment  '证券类别'
        ,Contr_Agt_Id        STRING COMMENT '合同号'
        ,Marg_Comp_Id        STRING COMMENT '合约编号'
        ,Marg_Comp_Type      STRING COMMENT '合约类别'
        ,Comp_Stat_Cd        STRING COMMENT '合约状态'
        ,Comp_Src            STRING COMMENT '合约来源'
        ,Cash_Grp_No         STRING COMMENT '头寸编号'
        ,Entr_No             STRING COMMENT '委托编号'
        ,Crrc_Cd             STRING COMMENT '币种类别'
        ,Year_Rate           STRING COMMENT '年利率'
        ,Marg_Rati           STRING COMMENT '保证金比率'
        ,Trd_Date            STRING COMMENT '交易日期'
        ,Create_Date         STRING COMMENT '创建日期'
        ,Retu_Date           STRING COMMENT '归还日期'
        ,Curr_Date           STRING COMMENT '当前日期'
        ,Curr_Time           STRING COMMENT '当前时间'
        ,Clr_Date            STRING COMMENT '清算日期'
        ,Prd_Holder_Id       STRING COMMENT '客户编号'
        ,Prd_Holder_Name     STRING COMMENT '客户姓名'
        ,Ast_Acct            STRING COMMENT '资产账户'
        ,Stk_Acct            STRING COMMENT '证券账号'
        ,Tgt_Secu_Id         STRING COMMENT '交易标的统一证券代码'
        ,Exch_Type           STRING COMMENT '交易类别'
        ,Stk_Code            STRING COMMENT '证券代码'
        ,Stk_Type            STRING COMMENT '证券类别'
        ,Stk_Name            STRING COMMENT '证券名称'
        ,Entr_pric           STRING COMMENT '委托价格'
        ,Entr_Vol            STRING COMMENT '委托数量'
        ,Src_Tbl             STRING COMMENT '来源表'
        ,Remark              STRING COMMENT '备注'
        ,Rec_Upd_Time        STRING COMMENT '记录更新时间'
        ,Rec_Down_Time       STRING COMMENT '记录修改时间'
        ,DATA_TIME			 STRING COMMENT '数据时间'
    )COMMENT '两融产品基本信息表'
    PARTITIONED BY (Src_Id string comment '来源标识')
    STORED AS ORC;

-- querySql
WITH A AS (
        SELECT  * 
        FROM    ODATA_N_RCC.H_HIS_COMPACT
        WHERE   Busi_Date  = '${data_day_str}'
    ) 

    INSERT OVERWRITE TABLE T02_MARG_BASE_INFO PARTITION (Src_Id='RCC')
    SELECT 
        Secu_Id        
        ,Src_Sys_Prdno  
        ,Scr_type
        ,Contr_Agt_Id   
        ,Marg_Comp_Id   
        ,Marg_Comp_Type 
        ,Comp_Stat_Cd   
        ,Comp_Src       
        ,Cash_Grp_No    
        ,Entr_No        
        ,Crrc_Cd        
        ,Year_Rate      
        ,Marg_Rati     
        ,Trd_Date       
        ,Create_Date    
        ,Retu_Date      
        ,Curr_Date      
        ,Curr_Time      
        ,Clr_Date       
        ,Prd_Holder_Id  
        ,Prd_Holder_Name
        ,Ast_Acct       
        ,Stk_Acct
        ,Tgt_Secu_Id       
        ,Exch_Type      
        ,Stk_Code       
        ,Stk_Type       
        ,Stk_Name       
        ,Entr_pric      
        ,Entr_Vol       
        ,Src_Tbl        
        ,Remark         
        ,Rec_Upd_Time   
        ,Rec_Down_Time          
        ,DATA_TIME	
    FROM
    (
        SELECT x.*, row_number() over (partition by Src_Sys_Prdno order by DATA_TIME desc, Trd_Date desc) rn_time_desc
        from
        (
            SELECT
            default.get_rcc_secuid('CT',A.COMPACT_ID,default.get_rcc_mktcode(A.Exchange_Type))     AS Secu_Id            --'统一证券编号'
            , CONCAT('MG','-',A.COMPACT_ID)  AS Src_Sys_Prdno      --'源系统产品编'
            , 'CT'                          AS Scr_type             --'证券类别'
            , contract_id                  AS Contr_Agt_Id       --'合同号'
            , compact_id                  AS Marg_Comp_Id       --'合约编号'
            , compact_type                  AS Marg_Comp_Type     --'合约类别'
            , compact_status                  AS Comp_Stat_Cd       --'合约状态'
            , compact_source                  AS Comp_Src           --'合约来源'
            , cashgroup_no                  AS Cash_Grp_No        --'头寸编号'
            , entrust_no                  AS Entr_No            --'委托编号'
            , COALESCE(MAP4.Const_Cd, A.Money_Type)                  AS Crrc_Cd            --'币种类别'
            , year_rate                  AS Year_Rate          --'年利率'
            , crdt_ratio                  AS Marg_Rati         --'保证金比率'
            , init_date                 AS Trd_Date           --'交易日期'
            , create_date                 AS Create_Date        --'创建日期'
            , repaid_date                 AS Retu_Date          --'归还日期'
            , curr_date                 AS Curr_Date          --'当前日期'
            , curr_time                 AS Curr_Time          --'当前时间'
            , date_clear                 AS Clr_Date           --'清算日期'
            , client_id                 AS Prd_Holder_Id      --'客户编号'
            , client_name                 AS Prd_Holder_Name    --'客户姓名'
            , fund_account                 AS Ast_Acct           --'资产账户'
            , stock_account                 AS Stk_Acct           --'证券账号'
            , default.get_rcc_secuid(stock_type,Stock_Code,Exchange_Type)  AS Tgt_Secu_Id 
            , exchange_type                 AS Exch_Type          --'交易类别'
            , stock_code                 AS Stk_Code           --'证券代码'
            , stock_type                 AS Stk_Type           --'证券类别'
            , stock_name                 AS Stk_Name           --'证券名称'
            , entrust_price                 AS Entr_pric          --'委托价格'
            , entrust_amount                 AS Entr_Vol           --'委托数量'
            , 'ODATA_N_RCC.H_HIS_COMPACT'                  AS Src_Tbl            --'来源表'
            , ''                  AS Remark             --'备注'
            , '${data_today}'                  AS Rec_Upd_Time       --'记录更新时间'
            , '${data_today}'                  AS Rec_Down_Time      --'记录修改时间'
            , DATA_TIME    AS Data_Time
            , 'RCC'                  AS Src_Id             --'来源标识'
            FROM A
            LEFT JOIN(
                SELECT  Src_Const_Cd,Const_Cd,Const_Cn_Desc
                FROM    t02_pub_covt_const
                WHERE   Const_Type_Cd   = 'fin00001'
                AND     Src_Id          = 'RCC'
                AND     rmk_desc        = ''
                AND     src_type_cd      = 'money_type'
            ) MAP4  ON  A.Money_Type  = MAP4.Src_Const_Cd

            UNION ALL

            SELECT Secu_Id        
                ,Src_Sys_Prdno  
                ,Scr_type
                ,Contr_Agt_Id   
                ,Marg_Comp_Id   
                ,Marg_Comp_Type 
                ,Comp_Stat_Cd   
                ,Comp_Src       
                ,Cash_Grp_No    
                ,Entr_No        
                ,Crrc_Cd        
                ,Year_Rate      
                ,Marg_Rati     
                ,Trd_Date       
                ,Create_Date    
                ,Retu_Date      
                ,Curr_Date      
                ,Curr_Time      
                ,Clr_Date       
                ,Prd_Holder_Id  
                ,Prd_Holder_Name
                ,Ast_Acct       
                ,Stk_Acct
                ,Tgt_Secu_Id     
                ,Exch_Type      
                ,Stk_Code       
                ,Stk_Type       
                ,Stk_Name       
                ,Entr_pric      
                ,Entr_Vol       
                ,Src_Tbl        
                ,Remark         
                ,Rec_Upd_Time   
                ,Rec_Down_Time  
                ,DATA_TIME
                ,Src_Id                
            FROM T02_MARG_BASE_INFO
            WHERE Src_Id='RCC'
        ) x
    ) y
    where rn_time_desc = 1
    ;

--    WITH A AS (
--        SELECT  * 
--        FROM    ODATA_YGT.NYGT_H_HIS_COMPACT
--        WHERE   Busi_Date between '${start_day}' and '${end_day}'
--    ) 
--
--    INSERT OVERWRITE TABLE T02_MARG_BASE_INFO PARTITION (Src_Id='RCC')
--    SELECT 
--        Secu_Id        
--        ,Src_Sys_Prdno
--        ,Scr_type  
--        ,Contr_Agt_Id   
--        ,Marg_Comp_Id   
--        ,Marg_Comp_Type 
--        ,Comp_Stat_Cd   
--        ,Comp_Src       
--        ,Cash_Grp_No    
--        ,Entr_No        
--        ,Crrc_Cd        
--        ,Year_Rate      
--        ,Marg_Rati     
--        ,Trd_Date       
--        ,Create_Date    
--        ,Retu_Date      
--        ,Curr_Date      
--        ,Curr_Time      
--        ,Clr_Date       
--        ,Prd_Holder_Id  
--        ,Prd_Holder_Name
--        ,Ast_Acct       
--        ,Stk_Acct
--        ,Tgt_Secu_Id       
--        ,Exch_Type      
--        ,Stk_Code       
--        ,Stk_Type       
--        ,Stk_Name       
--        ,Entr_pric      
--        ,Entr_Vol       
--        ,Src_Tbl        
--        ,Remark         
--        ,Rec_Upd_Time   
--        ,Rec_Down_Time          
--        ,DATA_TIME	
--    FROM
--    (
--        SELECT x.*, row_number() over (partition by Src_Sys_Prdno order by DATA_TIME desc) rn_time_desc
--        from
--        (
--            SELECT
--             default.get_rcc_secuid('CT',A.COMPACT_ID,default.get_rcc_mktcode(A.Exchange_Type))     AS Secu_Id            --'统一证券编号'
--            , CONCAT('MG','-',A.COMPACT_ID)  AS Src_Sys_Prdno      --'源系统产品编'
--            , 'CT'                          AS Scr_type             --'证券类别'
--            , contract_id                  AS Contr_Agt_Id       --'合同号'
--            , compact_id                  AS Marg_Comp_Id       --'合约编号'
--            , compact_type                  AS Marg_Comp_Type     --'合约类别'
--            , compact_status                  AS Comp_Stat_Cd       --'合约状态'
--            , compact_source                  AS Comp_Src           --'合约来源'
--            , cashgroup_no                  AS Cash_Grp_No        --'头寸编号'
--            , entrust_no                  AS Entr_No            --'委托编号'
--            , money_type                  AS Crrc_Cd            --'币种类别'
--            , year_rate                  AS Year_Rate          --'年利率'
--            , crdt_ratio                  AS Marg_Rati         --'保证金比率'
--            , init_date                 AS Trd_Date           --'交易日期'
--            , create_date                 AS Create_Date        --'创建日期'
--            , repaid_date                 AS Retu_Date          --'归还日期'
--            , curr_date                 AS Curr_Date          --'当前日期'
--            , curr_time                 AS Curr_Time          --'当前时间'
--            , date_clear                 AS Clr_Date           --'清算日期'
--            , client_id                 AS Prd_Holder_Id      --'客户编号'
--            , client_name                 AS Prd_Holder_Name    --'客户姓名'
--            , fund_account                 AS Ast_Acct           --'资产账户'
--            , stock_account                 AS Stk_Acct           --'证券账号'
--            , default.get_rcc_secuid(stock_type,Stock_Code,Exchange_Type)  AS Tgt_Secu_Id 
--            , exchange_type                 AS Exch_Type          --'交易类别'
--            , stock_code                 AS Stk_Code           --'证券代码'
--            , stock_type                 AS Stk_Type           --'证券类别'
--            , stock_name                 AS Stk_Name           --'证券名称'
--            , entrust_price                 AS Entr_pric          --'委托价格'
--            , entrust_amount                 AS Entr_Vol           --'委托数量'
--            , 'ODATA_YGT.NYGT_H_HIS_COMPACT'                  AS Src_Tbl            --'来源表'
--            , ''                  AS Remark             --'备注'
--            , '${data_today}'                  AS Rec_Upd_Time       --'记录更新时间'
--            , '${data_today}'                  AS Rec_Down_Time      --'记录修改时间'
--            , DATA_TIME    AS Data_Time
--            , 'RCC'                  AS Src_Id             --'来源标识'
--            FROM A
--
--            UNION ALL
--
--            SELECT Secu_Id        
--                ,Src_Sys_Prdno  
--                ,Scr_type
--                ,Contr_Agt_Id   
--                ,Marg_Comp_Id   
--                ,Marg_Comp_Type 
--                ,Comp_Stat_Cd   
--                ,Comp_Src       
--                ,Cash_Grp_No    
--                ,Entr_No        
--                ,Crrc_Cd        
--                ,Year_Rate      
--                ,Marg_Rati     
--                ,Trd_Date       
--                ,Create_Date    
--                ,Retu_Date      
--                ,Curr_Date      
--                ,Curr_Time      
--                ,Clr_Date       
--                ,Prd_Holder_Id  
--                ,Prd_Holder_Name
--                ,Ast_Acct       
--                ,Stk_Acct
--                ,Tgt_Secu_Id     
--                ,Exch_Type      
--                ,Stk_Code       
--                ,Stk_Type       
--                ,Stk_Name       
--                ,Entr_pric      
--                ,Entr_Vol       
--                ,Src_Tbl        
--                ,Remark         
--                ,Rec_Upd_Time   
--                ,Rec_Down_Time  
--                ,DATA_TIME
--                ,Src_Id
--            FROM T02_MARG_BASE_INFO
--            WHERE Src_Id='RCC'
--        ) x
--    ) y
--    where rn_time_desc = 1
--    ;

    WITH A AS (
        SELECT x.*, row_number() over (distribute by Src_Sys_Prdno sort by DATA_TIME desc, Trd_Date desc) rn
        from
        (
            SELECT
             default.get_rcc_secuid('CT',A.COMPACT_ID,default.get_rcc_mktcode(A.Exchange_Type))     AS Secu_Id            --'统一证券编号'
            , CONCAT('MG','-',A.COMPACT_ID)  AS Src_Sys_Prdno      --'源系统产品编'
            , 'CT'                          AS Scr_type             --'证券类别'
            , contract_id                  AS Contr_Agt_Id       --'合同号'
            , compact_id                  AS Marg_Comp_Id       --'合约编号'
            , compact_type                  AS Marg_Comp_Type     --'合约类别'
            , compact_status                  AS Comp_Stat_Cd       --'合约状态'
            , compact_source                  AS Comp_Src           --'合约来源'
            , cashgroup_no                  AS Cash_Grp_No        --'头寸编号'
            , entrust_no                  AS Entr_No            --'委托编号'
            , COALESCE(MAP4.Const_Cd, A.Money_Type)                  AS Crrc_Cd            --'币种类别'
            , year_rate                  AS Year_Rate          --'年利率'
            , crdt_ratio                  AS Marg_Rati         --'保证金比率'
            , init_date                 AS Trd_Date           --'交易日期'
            , create_date                 AS Create_Date        --'创建日期'
            , repaid_date                 AS Retu_Date          --'归还日期'
            , curr_date                 AS Curr_Date          --'当前日期'
            , curr_time                 AS Curr_Time          --'当前时间'
            , date_clear                 AS Clr_Date           --'清算日期'
            , client_id                 AS Prd_Holder_Id      --'客户编号'
            , client_name                 AS Prd_Holder_Name    --'客户姓名'
            , fund_account                 AS Ast_Acct           --'资产账户'
            , stock_account                 AS Stk_Acct           --'证券账号'
            , default.get_rcc_secuid(stock_type,Stock_Code,Exchange_Type)  AS Tgt_Secu_Id 
            , exchange_type                 AS Exch_Type          --'交易类别'
            , stock_code                 AS Stk_Code           --'证券代码'
            , stock_type                 AS Stk_Type           --'证券类别'
            , stock_name                 AS Stk_Name           --'证券名称'
            , entrust_price                 AS Entr_pric          --'委托价格'
            , entrust_amount                 AS Entr_Vol           --'委托数量'
            , 'ODATA_YGT.NYGT_H_HIS_COMPACT'                  AS Src_Tbl            --'来源表'
            , ''                  AS Remark             --'备注'
            , '${data_today}'                  AS Rec_Upd_Time       --'记录更新时间'
            , '${data_today}'                  AS Rec_Down_Time      --'记录修改时间'
            , DATA_TIME    AS Data_Time
            , 'RCC'                  AS Src_Id             --'来源标识'
            FROM (select *
                  from ODATA_YGT.NYGT_H_HIS_COMPACT
                  WHERE   Busi_Date between '${start_day}' and '${end_day}'
                  ) A
            LEFT JOIN(
                SELECT  Src_Const_Cd,Const_Cd,Const_Cn_Desc
                FROM    t02_pub_covt_const
                WHERE   Const_Type_Cd   = 'fin00001'
                AND     Src_Id          = 'RCC'
                AND     rmk_desc        = ''
                AND     src_type_cd      = 'money_type'
            ) MAP4  ON  A.Money_Type  = MAP4.Src_Const_Cd
            
            UNION ALL
        
            SELECT Secu_Id        
                ,Src_Sys_Prdno  
                ,Scr_type
                ,Contr_Agt_Id   
                ,Marg_Comp_Id   
                ,Marg_Comp_Type 
                ,Comp_Stat_Cd   
                ,Comp_Src       
                ,Cash_Grp_No    
                ,Entr_No        
                ,Crrc_Cd        
                ,Year_Rate      
                ,Marg_Rati     
                ,Trd_Date       
                ,Create_Date    
                ,Retu_Date      
                ,Curr_Date      
                ,Curr_Time      
                ,Clr_Date       
                ,Prd_Holder_Id  
                ,Prd_Holder_Name
                ,Ast_Acct       
                ,Stk_Acct
                ,Tgt_Secu_Id     
                ,Exch_Type      
                ,Stk_Code       
                ,Stk_Type       
                ,Stk_Name       
                ,Entr_pric      
                ,Entr_Vol       
                ,Src_Tbl        
                ,Remark         
                ,Rec_Upd_Time   
                ,Rec_Down_Time  
                ,DATA_TIME
                ,Src_Id
            FROM T02_MARG_BASE_INFO
            WHERE Src_Id='RCC'
        ) x
    )

    INSERT OVERWRITE TABLE T02_MARG_BASE_INFO PARTITION (Src_Id='RCC')
    SELECT 
        Secu_Id        
        ,Src_Sys_Prdno
        ,Scr_type  
        ,Contr_Agt_Id   
        ,Marg_Comp_Id   
        ,Marg_Comp_Type 
        ,Comp_Stat_Cd   
        ,Comp_Src       
        ,Cash_Grp_No    
        ,Entr_No        
        ,Crrc_Cd        
        ,Year_Rate      
        ,Marg_Rati     
        ,Trd_Date       
        ,Create_Date    
        ,Retu_Date      
        ,Curr_Date      
        ,Curr_Time      
        ,Clr_Date       
        ,Prd_Holder_Id  
        ,Prd_Holder_Name
        ,Ast_Acct       
        ,Stk_Acct
        ,Tgt_Secu_Id       
        ,Exch_Type      
        ,Stk_Code       
        ,Stk_Type       
        ,Stk_Name       
        ,Entr_pric      
        ,Entr_Vol       
        ,Src_Tbl        
        ,Remark         
        ,Rec_Upd_Time   
        ,Rec_Down_Time          
        ,DATA_TIME	
    FROM
    (
        SELECT x.*, row_number() over (partition by Src_Sys_Prdno order by DATA_TIME desc, Trd_Date) rn_time_desc
        from
        (
            select Secu_Id        
                ,Src_Sys_Prdno  
                ,Scr_type
                ,Contr_Agt_Id   
                ,Marg_Comp_Id   
                ,Marg_Comp_Type 
                ,Comp_Stat_Cd   
                ,Comp_Src       
                ,Cash_Grp_No    
                ,Entr_No        
                ,Crrc_Cd        
                ,Year_Rate      
                ,Marg_Rati     
                ,Trd_Date       
                ,Create_Date    
                ,Retu_Date      
                ,Curr_Date      
                ,Curr_Time      
                ,Clr_Date       
                ,Prd_Holder_Id  
                ,Prd_Holder_Name
                ,Ast_Acct       
                ,Stk_Acct
                ,Tgt_Secu_Id     
                ,Exch_Type      
                ,Stk_Code       
                ,Stk_Type       
                ,Stk_Name       
                ,Entr_pric      
                ,Entr_Vol       
                ,Src_Tbl        
                ,Remark         
                ,Rec_Upd_Time   
                ,Rec_Down_Time  
                ,DATA_TIME
                ,Src_Id
                ,rn
            from A
            where rn=1
        ) x
    ) y
    where rn_time_desc = 1
    ;

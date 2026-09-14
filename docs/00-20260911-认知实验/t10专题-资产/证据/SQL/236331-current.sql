CREATE TABLE IF NOT EXISTS  dm_fin_n.erp_fix_ast_ast_nature( 
	 Ast_Id string COMMENT '固定资产资产编号' , Fa_Ast_Id string COMMENT '财务资产编号' , Ast_Clas_Cd string COMMENT '资产性质' , Strt_Date string COMMENT '开始日期' , End_Date string COMMENT '截至日期' ) COMMENT '估值系统固资系统资产性质' STORED AS ORC;

SELECT Ast_Id,
	Fa_Ast_Id,
	Ast_Clas_Cd,
	Strt_Date,
	End_Date FROM (
	 select
  Ast_Id,--固定资产资产编号
  Fa_Ast_Id,--财务资产编号
  Ast_Clas_Cd,--资产性质
  Strt_Date,--开始日期
  End_Date  --截至日期
from
  (
    select
      *
    from
      pdata_n.T10_AST_CLAS_H
    where
      ast_clas_type_cd = '03'
      and SRC_TBL = 'ODATA_N_FAM.W_ASSET_ACCOUNT'
  ) a
  left join (
    select
      *
    from
      pdata_n.T10_OUR_FIX_AST_ADTNL_INFO
    where
      busi_date = '${yyyy-MM-dd}'
  ) b on a.Ast_Id = b.Fix_Ast_Id 
	) castTable
-- task_id: 197390
-- hiveDb: 
-- source: SQL_MCP
-- sqlStatus: AVAILABLE
-- scriptPath: 
-- observed_at: 2026-09-05T06:41:12.763Z

-- createSql
CREATE TABLE IF NOT EXISTS T09_VCHR_PYMT_INFO (
  Src_Id STRING COMMENT '源ID',
  Vchr_Head_Id STRING COMMENT '凭证头ID',
  Vchr_Head_No STRING COMMENT '凭证头编号',
  Vchr_Stat_Cd STRING COMMENT '凭证状态代码',
  Vchr_Summ STRING COMMENT '凭证摘要',
  Vchr_Type_Cd STRING COMMENT '凭证类型代码',
  Vchr_Type_Desc STRING COMMENT '凭证类型描述',
  Cost_Center_Org_Cd STRING COMMENT '成本中心机构代码',
  Cost_Center_Name STRING COMMENT '成本中心机构名称',
  Acctng_Enty_Org_Cd STRING COMMENT '核算主体机构代码',
  Acctng_Enty_Name STRING COMMENT '核算主体机构名称',
  Fsc_Busi_Type_Id STRING COMMENT '财务共享业务类型ID',
  Fsc_Busi_Type_Cd STRING COMMENT '财务共享业务类型代码',
  Rpt_Emp_Id STRING COMMENT '报账员工编号',
  Rpt_Emp_Name STRING COMMENT '报账员工名称',
  Rpt_Amt STRING COMMENT '报账金额',
  Splr_Id STRING COMMENT '供应商ID',
  Splr_Cd STRING COMMENT '供应商编码',
  Splr_Name STRING COMMENT '供应商名称',
  Pymt_Time STRING COMMENT '付款时间',
  Pymt_No STRING COMMENT '付款编号',
  Pymt_Amt STRING COMMENT '付款金额',
  Pymt_Id STRING COMMENT '付款编号',
  Tran_Mode_Cd STRING COMMENT '划款模式代码',
  Pymt_Method_Cd STRING COMMENT '付款方式代码',
  Pymt_Method_Desc STRING COMMENT '支付方式名称',
  Pay_Stat_Cd STRING COMMENT '支付状态代码',
  Pymt_Crrc_Cd STRING COMMENT '付款币种代码',
  Pymt_Bnk_Id STRING COMMENT '付款银行编号',
  Pymt_Bnk_Name STRING COMMENT '付款银行名称',
  Pymt_Bnk_Acct_Id STRING COMMENT '付款银行账户ID',
  Pymt_Bnk_Acct STRING COMMENT '付款银行账户',
  Pymt_Bnk_Acct_Name STRING COMMENT '付款银行账户名',
  Pymt_Bnk_Acct_Subb_Name STRING COMMENT '付款银行支行名称',
  Pymt_Bnk_Unit_Cd STRING COMMENT '付款联行号',
  Pymt_Desc STRING COMMENT '付款说明',
  Pymt_Err_Rsn STRING COMMENT '付款失败原因',
  Pymt_Vchr_No STRING COMMENT '付款凭证号',
  Paye_Bnk_Id STRING COMMENT '收款银行编号',
  Paye_Bnk_Name STRING COMMENT '收款银行名称',
  Paye_Bnk_Acct STRING COMMENT '收款银行账户',
  Paye_Bnk_Acct_Name STRING COMMENT '收款银行账户名',
  Paye_Bnk_Acct_Subb_Name STRING COMMENT '收款银行支行名称',
  Paye_Bnk_Unit_Cd STRING COMMENT '收款联行号',
  Grp_Id STRING COMMENT '集团ID',
  Acctnt_Appr_Flag STRING COMMENT '会计审核标志',
  Pay_Refnd_Flag STRING COMMENT '支付退票标志',
  Prev_Pymt_Id STRING COMMENT '上一支付ID',
  Hold_Flag STRING COMMENT '挂起标记',
  Hold_Rsn STRING COMMENT '挂起原因',
  Suspt_Dbl_Pay_Id STRING COMMENT '疑似重复支付ID',
  Suspt_Dbl_Pay_No STRING COMMENT '疑似重复支付编号',
  Suspt_Dbl_Pay_Vchr_Head_Id STRING COMMENT '疑似重复支付凭证头ID',
  Suspt_Dbl_Pay_Vchr_Head_No STRING COMMENT '疑似重复支付凭证头编号',
  Ori_Pymt_Bnk_Acct STRING COMMENT '原付款银行账户',
  Ori_Pymt_Method_Cd STRING COMMENT '原付款方式代码',
  Scda_Time STRING COMMENT '复审时间',
  Vsb_Flag STRING COMMENT '可见标志',
  Vld_Flag STRING COMMENT '有效标志',
  Onln_Ofln_Type_Cd STRING COMMENT '线上线下类型代码',
  Exp_Flag STRING COMMENT '导出标志',
  Remark STRING COMMENT '备注',
  Data_Src_Cd STRING COMMENT '数据来源代码',
  Task_Name STRING COMMENT '任务名',
  Data_Etl_Date STRING COMMENT '数据加载日期',
  Data_Upt_Date STRING COMMENT '数据更新日期',
  Data_Time STRING COMMENT '数据时间',
  Real_Src_Tbl STRING COMMENT '真实源表'
)
COMMENT '凭证付款信息'
PARTITIONED BY (Src_Tbl STRING COMMENT'源表',Busi_Date STRING COMMENT '业务日期')
STORED AS ORC;

-- querySql
INSERT OVERWRITE TABLE T09_VCHR_PYMT_INFO PARTITION(Src_Tbl='ODATA_N_FSC.ZO_OP_EFS_PAYMENT',Busi_Date='2026-05-20')
SELECT
ID                                                AS  Src_Id                  --源ID
,BOE_HEADER_ID                                     AS  Vchr_Head_Id            --凭证头ID
,BOE_NO                                            AS  Vchr_Head_No            --凭证头编号
,NVL(B.DW_CD_VAL,BOE_STATUS)                       AS  Vchr_Stat_Cd            --凭证状态代码
,BOE_ABSTRACT                                      AS  Vchr_Summ               --凭证摘要
,BOE_TYPE_CODE                                     AS  Vchr_Type_Cd            --凭证类型代码
,FORM_TYPE_NAME                                    AS  Vchr_Type_Desc          --凭证类型描述
,CC_CODE                                           AS  Cost_Center_Org_Cd      --成本中心机构代码
,CC_NAME                                           AS  Cost_Center_Name        --成本中心机构名称
,LE_CODE                                           AS  Acctng_Enty_Org_Cd      --核算主体机构代码
,LE_NAME                                           AS  Acctng_Enty_Name        --核算主体机构名称
,OPERATION_TYPE_ID                                 AS  Fsc_Busi_Type_Id        --财务共享业务类型ID
,OPERATION_TYPE_CODE                               AS  Fsc_Busi_Type_Cd        --财务共享业务类型代码
,EMPLOYEE_CODE                                     AS  Rpt_Emp_Id              --报账员工编号
,EMPLOY_NAME                                       AS  Rpt_Emp_Name            --报账员工名称
,APPLY_AMOUNT                                      AS  Rpt_Amt                 --报账金额
,VENDOR_ID                                         AS  Splr_Id                 --供应商ID
,VENDOR_CODE                                       AS  Splr_Cd                 --供应商编码
,VENDOR_NAME                                       AS  Splr_Name               --供应商名称
,PAYMENT_DATE                                      AS  Pymt_Time               --付款时间
,PAYMENT_NO                                        AS  Pymt_No                 --付款编号
,PAYMENT_AMOUNT                                    AS  Pymt_Amt                --付款金额
,PAYMENT_ID                                        AS  Pymt_Id                 --付款编号
,NVL(C.DW_CD_VAL,TRANSFER_FUND_FLAG)               AS  Tran_Mode_Cd            --划款模式代码
,PAYMENT_MODE_CODE                                 AS  Pymt_Method_Cd          --付款方式代码
,PAYMENT_MODE_NAME                                 AS  Pymt_Method_Desc        --支付方式名称
,NVL(D.DW_CD_VAL,PAYMENT_STATUS)                   AS  Pay_Stat_Cd             --支付状态代码
,CURRENCY_CODE                                     AS  Pymt_Crrc_Cd            --付款币种代码
,PAYER_BANK_HEAD_CODE                              AS  Pymt_Bnk_Id             --付款银行编号
,PAYER_BANK_HEAD_NAME                              AS  Pymt_Bnk_Name           --付款银行名称
,PAYMENT_ACCOUNT_ID                                AS  Pymt_Bnk_Acct_Id        --付款银行账户ID
,PAYER_BANK_ACCOUNT_NUM                            AS  Pymt_Bnk_Acct           --付款银行账户
,PAYER_BANK_ACCOUNT_NAME                           AS  Pymt_Bnk_Acct_Name      --付款银行账户名
,PAYER_BANK_BRANCH_NAME                            AS  Pymt_Bnk_Acct_Subb_Name --付款银行支行名称
,PAYER_BANK_UNITED_CODE                            AS  Pymt_Bnk_Unit_Cd        --付款联行号
,PAYMENT_MEMO                                      AS  Pymt_Desc               --付款说明
,ERROR_MSG                                         AS  Pymt_Err_Rsn            --付款失败原因
,VOUCHERNO_WHENPAYSUC                              AS  Pymt_Vchr_No            --付款凭证号
,GATHER_BANK_HEAD_CODE                             AS  Paye_Bnk_Id             --收款银行编号
,GATHER_BANK_HEAD_NAME                             AS  Paye_Bnk_Name           --收款银行名称
,GATHER_BANK_ACCOUNT_NUM                           AS  Paye_Bnk_Acct           --收款银行账户
,GATHER_BANK_ACCOUNT_NAME                          AS  Paye_Bnk_Acct_Name      --收款银行账户名
,GATHER_BANK_BRANCH_NAME                           AS  Paye_Bnk_Acct_Subb_Name --收款银行支行名称
,GATHER_BANK_UNITED_CODE                           AS  Paye_Bnk_Unit_Cd        --收款联行号
,GROUP_ID                                          AS  Grp_Id                  --集团ID
,CASE WHEN CASHIER_AUDIT_FLAG = 'Y' THEN '1'
WHEN CASHIER_AUDIT_FLAG = 'N' THEN '0'
ELSE CASHIER_AUDIT_FLAG END                  AS  Acctnt_Appr_Flag        --会计审核标志
,PAY_RETICKET_FLAG                                 AS  Pay_Refnd_Flag          --支付退票标志
,PRE_EFSPAYMENT_ID                                 AS  Prev_Pymt_Id            --上一支付ID
,HANG_FLAG                                         AS  Hold_Flag               --挂起标记
,HANG_REASON                                       AS  Hold_Rsn                --挂起原因
,DOUBLE_PAY_EFS_ID                                 AS  Suspt_Dbl_Pay_Id        --疑似重复支付ID
,DOUBLE_PAY_EFS_NO                                 AS  Suspt_Dbl_Pay_No        --疑似重复支付编号
,DOUBLE_PAY_EFS_BOE_ID                             AS  Suspt_Dbl_Pay_Vchr_Head_Id--疑似重复支付凭证头ID
,DOUBLE_PAY_EFS_BOE_NO                             AS  Suspt_Dbl_Pay_Vchr_Head_No--疑似重复支付凭证头编号
,ORGN_PAYMENT_ACCOUNT                              AS  Ori_Pymt_Bnk_Acct       --原付款银行账户
,ORGN_PAYMENT_MODE_CODE                            AS  Ori_Pymt_Method_Cd      --原付款方式代码
,FS_APPROVAL_TIME                                  AS  Scda_Time               --复审时间
,CASE WHEN ENABLED_FLAG = 'Y' THEN '1'
WHEN ENABLED_FLAG = 'N' THEN '0'
ELSE ENABLED_FLAG END                        AS  Vsb_Flag                --可见标志
,CASE WHEN VALIDITY_FLAG = 'Y' THEN '1'
WHEN VALIDITY_FLAG = 'N' THEN '0'
ELSE VALIDITY_FLAG END                       AS  Vld_Flag                --有效标志
,ON_OFF_LINE                                       AS  Onln_Ofln_Type_Cd       --线上线下类型代码
,IS_IMPORT                                         AS  Exp_Flag                --导出标志
,REMARK                                            AS  Remark                  --备注
,'FSC'                             AS  Data_Src_Cd             --数据来源代码
,'PDATA_N.T09_VCHR_PYMT_INFO_FSC004'                                AS  Task_Name               --任务名
,'2026-05-20'                            AS  Data_Etl_Date           --数据加载日期
,'2026-05-20'                            AS  Data_Upt_Date           --数据更新日期
,'2026-05-21 06:25:32'                              AS  Data_Time               --数据时间
,'ODATA_N_FSC.ZO_OP_EFS_PAYMENT'                               AS  Real_Src_Tbl            --真实源表
FROM (SELECT *  FROM ODATA_N_FSC.ZO_OP_EFS_PAYMENT WHERE  Busi_Date='2026-05-20' )A
LEFT JOIN (
SELECT SRC_CD_VAL,DW_CD_VAL
FROM PDATA_N.REF_CD_CVT_MAP_TEMP
WHERE TGT_TAB_NAME = 'T09_VCHR_PYMT_INFO'
AND TGT_TAB_FLD  = 'Vchr_Stat_Cd'
AND SRC_TAB_NAME = 'OP_EFS_PAYMENT'
AND SRC_FLD_NAME = 'BOE_STATUS'
AND SRC_SYS_NAME='FSC')B
ON      A.BOE_STATUS =B.SRC_CD_VAL                  --BOE_STATUS 转码
LEFT JOIN (
SELECT SRC_CD_VAL,DW_CD_VAL
FROM PDATA_N.REF_CD_CVT_MAP_TEMP
WHERE TGT_TAB_NAME = 'T09_VCHR_PYMT_INFO'
AND TGT_TAB_FLD  = 'Tran_Mode_Cd'
AND SRC_TAB_NAME = 'OP_EFS_PAYMENT'
AND SRC_FLD_NAME = 'TRANSFER_FUND_FLAG'
AND SRC_SYS_NAME='FSC')C
ON      A.TRANSFER_FUND_FLAG =C.SRC_CD_VAL                  --TRANSFER_FUND_FLAG 转码
LEFT JOIN (
SELECT SRC_CD_VAL,DW_CD_VAL
FROM PDATA_N.REF_CD_CVT_MAP_TEMP
WHERE TGT_TAB_NAME = 'T09_VCHR_PYMT_INFO'
AND TGT_TAB_FLD  = 'Pay_Stat_Cd'
AND SRC_TAB_NAME = 'OP_EFS_PAYMENT'
AND SRC_FLD_NAME = 'PAYMENT_STATUS'
AND SRC_SYS_NAME='FSC')D
ON      A.PAYMENT_STATUS =D.SRC_CD_VAL                  --PAYMENT_STATUS 转码
;

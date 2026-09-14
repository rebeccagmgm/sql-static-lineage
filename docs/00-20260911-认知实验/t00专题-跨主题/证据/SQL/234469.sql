-- task_id: 234469
-- hiveDb: 
-- source: SQL_MCP
-- sqlStatus: AVAILABLE
-- scriptPath: 
-- observed_at: 2026-09-05T07:27:15.319Z

-- createSql
CREATE TABLE IF NOT EXISTS T00_AI_SKL_ADTNL_INFO (
  Compnt_Id STRING COMMENT '组件编号',
  Compnt_Name STRING COMMENT '组件名称',
  Compnt_Stat_Cd STRING COMMENT '组件状态代码',
  Skl_Instr_Cont STRING COMMENT '技能指令内容',
  Skl_Ref_Info STRING COMMENT '技能参考信息',
  Icon_Addr STRING COMMENT '图标地址',
  Shr_Flag STRING COMMENT '公用标志',
  Quick_Instr_Avl_Flag STRING COMMENT '快捷指令可用标志',
  Own_Plfm_Code STRING COMMENT '所属平台编码',
  Join_Inst_List_Info STRING COMMENT '关联工具列表信息',
  Data_Src_Cd STRING COMMENT '数据来源代码',
  Task_Name STRING COMMENT '任务名',
  Data_Etl_Date STRING COMMENT '数据加载日期',
  Data_Upt_Date STRING COMMENT '数据更新日期',
  Data_Time STRING COMMENT '数据时间',
  Real_Src_Tbl STRING COMMENT '真实源表'
)
COMMENT 'AI技能附加信息'
PARTITIONED BY (Src_Tbl STRING COMMENT'源表',Busi_Date STRING COMMENT '业务日期')
STORED AS ORC;

-- querySql
INSERT OVERWRITE TABLE T00_AI_SKL_ADTNL_INFO PARTITION(Src_Tbl='ODATA_N_MIO.H_GUANGZHI_SKILL',Busi_Date='2026-05-24')
SELECT
CONCAT('MIO072-',ID)                              AS  Compnt_Id               --组件编号
,DISPLAY_NAME                                      AS  Compnt_Name             --组件名称
,CASE WHEN STATUS = 'enable'  THEN '01'
WHEN STATUS = 'disable' THEN '02'
ELSE STATUS END                              AS  Compnt_Stat_Cd          --组件状态代码
,SKILLS_MD                                         AS  Skl_Instr_Cont          --技能指令内容
,REFERENCE                                         AS  Skl_Ref_Info            --技能参考信息
,ICON                                              AS  Icon_Addr               --图标地址
,IS_PUBLIC                                         AS  Shr_Flag                --公用标志
,SLASH_CMD_ENABLED                                 AS  Quick_Instr_Avl_Flag    --快捷指令可用标志
,BUSINESS_CODE                                     AS  Own_Plfm_Code           --所属平台编码
,ALLOW_TOOLS                                       AS  Join_Inst_List_Info     --关联工具列表信息
,'MIO'                             AS  Data_Src_Cd             --数据来源代码
,'PDATA_N.T00_AI_SKL_ADTNL_INFO_MIO072'                                AS  Task_Name               --任务名
,'2026-05-24'                            AS  Data_Etl_Date           --数据加载日期
,'2026-05-24'                            AS  Data_Upt_Date           --数据更新日期
,'2026-05-25 07:56:33'                              AS  Data_Time               --数据时间
,'ODATA_N_MIO.H_GUANGZHI_SKILL'                               AS  Real_Src_Tbl            --真实源表
FROM (SELECT *  FROM ODATA_N_MIO.H_GUANGZHI_SKILL WHERE  Busi_Date='2026-05-24' )A
;

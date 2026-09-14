-- task_id: 236112
-- hiveDb: gfstest
-- source: SQL_MCP
-- sqlStatus: AVAILABLE
-- scriptPath: BigData-GF_FDM_TEST/fdm_fin/PDATA_N.T10_AST_ADDR_H_FAM001.py
-- observed_at: 2026-09-05T00:25:14.746Z

-- createSql
CREATE TABLE IF NOT EXISTS T10_AST_ADDR_H (
  Ast_Id STRING COMMENT '资产编号',
  Strt_Date STRING COMMENT '开始日期',
  Ip_Addr STRING COMMENT 'Ip地址',
  Prov_Cd STRING COMMENT '省份代码',
  City_Cd STRING COMMENT '城市代码',
  Cnty_Cd STRING COMMENT '县区代码',
  Addr STRING COMMENT '地址',
  End_Date STRING COMMENT '结束日期',
  Data_Src_Cd STRING COMMENT '数据来源代码',
  Task_Name STRING COMMENT '任务名',
  Data_Time STRING COMMENT '数据时间',
  Real_Src_Tbl STRING COMMENT '真实源表'
)
COMMENT '资产地址历史'
PARTITIONED BY (SRC_TBL STRING COMMENT '源表')
STORED AS ORC;

CREATE TABLE IF NOT EXISTS TEMP.T10_AST_ADDR_H_TEMP_FAM001 AS SELECT ASSET_TAG_NO AS Ast_Id1 --资产编号 ,'' AS Ip_Addr1 --Ip地址 '' ,NVL (
  B.DW_CD_VAL,
  Prov_Cd
)
AS Prov_Cd1 --省份代码 ,NVL(C.DW_CD_VAL,City_Cd) AS City_Cd1 --城市代码 ,NVL(D.DW_CD_VAL,Cnty_Cd) AS Cnty_Cd1 --县区代码 ,ASSET_PLACE AS Addr1 --地址 ,'FAM' AS Data_Src_Cd1 --数据来源代码 ,'ODATA_N_FAM.W_ASSET_ACCOUNT' AS Src_Tbl1 --源表 ,'PDATA_N.T10_AST_ADDR_H_FAM001' AS Task_Name1 --任务名 ,'ODATA_N_FAM.W_ASSET_ACCOUNT' AS Real_Src_Tbl1 --真实源表 FROM (SELECT ASSET_TAG_NO ,ASSET_PLACE ,SUBSTR(get_json_object(ASSET_BELONG_ADDRESS,'$.province_code'),1,6) AS Prov_Cd ,SUBSTR(get_json_object(ASSET_BELONG_ADDRESS,'$.city_code') ,1,6) AS City_Cd ,SUBSTR(get_json_object(ASSET_BELONG_ADDRESS,'$.county_code') ,1,6) AS Cnty_Cd FROM ODATA_N_FAM.W_ASSET_ACCOUNT WHERE BUSI_DATE ='2026-05-28' ) A LEFT JOIN ( SELECT SRC_CD_VAL,DW_CD_VAL FROM PDATA_N.REF_CD_CVT_MAP WHERE TGT_TAB_NAME = 'T10_AST_ADDR_H' AND TGT_TAB_FLD = 'Prov_Cd' AND SRC_TAB_NAME = 'ASSET_ACCOUNT' AND SRC_FLD_NAME = 'province_code' AND SRC_SYS_NAME='FAM')B ON A.Prov_Cd =B.SRC_CD_VAL --province_code 转码 LEFT JOIN ( SELECT SRC_CD_VAL,DW_CD_VAL FROM PDATA_N.REF_CD_CVT_MAP WHERE TGT_TAB_NAME = 'T10_AST_ADDR_H' AND TGT_TAB_FLD = 'City_Cd' AND SRC_TAB_NAME = 'ASSET_ACCOUNT' AND SRC_FLD_NAME = 'city_code' AND SRC_SYS_NAME='FAM')C ON A.City_Cd =C.SRC_CD_VAL --city_code 转码 LEFT JOIN ( SELECT SRC_CD_VAL,DW_CD_VAL FROM PDATA_N.REF_CD_CVT_MAP WHERE TGT_TAB_NAME = 'T10_AST_ADDR_H' AND TGT_TAB_FLD = 'Cnty_Cd' AND SRC_TAB_NAME = 'ASSET_ACCOUNT' AND SRC_FLD_NAME = 'county_code' AND SRC_SYS_NAME='FAM')D ON A.Cnty_Cd =D.SRC_CD_VAL --county_code 转码 ;

CREATE TABLE TEMP.T10_AST_ADDR_H_MID_FAM001 AS SELECT A.*,B.* ,CASE WHEN A.Ast_Id IS NULL AND B.Ast_Id1 IS NOT NULL THEN 'I' --当天不存在历史的数据为新增 WHEN A.Ast_Id IS NOT NULL AND B.Ast_Id1 IS NULL THEN 'D' --历史不存在当天的数据为删除 WHEN A.Ast_Id IS NOT NULL AND B.Ast_Id1 IS NOT NULL AND (
  COALESCE(A.Ip_Addr ,'') <> COALESCE(B.Ip_Addr1 ,'') OR COALESCE(A.Prov_Cd ,'') <> COALESCE(B.Prov_Cd1 ,'') OR COALESCE(A.City_Cd ,'') <> COALESCE(B.City_Cd1 ,'') OR COALESCE(A.Cnty_Cd ,'') <> COALESCE(B.Cnty_Cd1 ,'') OR COALESCE(A.Addr ,'') <> COALESCE(B.Addr1 ,'')
)
THEN 'U' --当天和历史均存在,除主键外如有字段变更为变更 ELSE 'S' END AS DATA_TYPE --其他为无变更 FROM ( SELECT * FROM T10_AST_ADDR_H WHERE STRT_DATE <='2026-05-28' AND END_DATE > '2026-05-28' AND SRC_TBL IN ('ODATA_N_FAM.W_ASSET_ACCOUNT') )A --历史(昨日)开链数据 FULL OUTER JOIN TEMP.T10_AST_ADDR_H_TEMP_FAM001 B --当天的数据 ON A.Ast_Id= B.Ast_Id1 ;

-- querySql
INSERT OVERWRITE TABLE T10_AST_ADDR_H PARTITION(SRC_TBL)
SELECT
DISTINCT
Ast_Id                                --资产编号
,Strt_Date                             --开始日期
,Ip_Addr                               --Ip地址
,Prov_Cd                               --省份代码
,City_Cd                               --城市代码
,Cnty_Cd                               --县区代码
,Addr                                  --地址
,End_Date                              --结束日期
,Data_Src_Cd                           --数据来源代码
,Task_Name                             --任务名
,Data_Time                             --数据时间
,Real_Src_Tbl                          --真实源表
,Src_Tbl                               --源表
FROM (
SELECT
Ast_Id                                --资产编号
,Strt_Date                             --开始日期
,Ip_Addr                               --Ip地址
,Prov_Cd                               --省份代码
,City_Cd                               --城市代码
,Cnty_Cd                               --县区代码
,Addr                                  --地址
,End_Date                              --结束日期
,Data_Src_Cd                           --数据来源代码
,Task_Name                             --任务名
,Data_Time                             --数据时间
,Real_Src_Tbl                          --真实源表
,Src_Tbl                               --源表
FROM T10_AST_ADDR_H
WHERE STRT_DATE !='2026-05-28'
AND END_DATE  !='2026-05-28'
AND SRC_TBL IN ('ODATA_N_FAM.W_ASSET_ACCOUNT')
UNION ALL
SELECT
Ast_Id                                --资产编号
,Strt_Date                             --开始日期
,Ip_Addr                               --Ip地址
,Prov_Cd                               --省份代码
,City_Cd                               --城市代码
,Cnty_Cd                               --县区代码
,Addr                                  --地址
,'2099-12-31'  AS End_Date             --结束日期
,Data_Src_Cd                           --数据来源代码
,Task_Name                             --任务名
,Data_Time                             --数据时间
,Real_Src_Tbl                          --真实源表
,Src_Tbl                               --源表
FROM T10_AST_ADDR_H
WHERE  END_DATE ='2026-05-28'
AND  SRC_TBL IN ('ODATA_N_FAM.W_ASSET_ACCOUNT')
) T
;

DROP TABLE IF EXISTS TEMP.T10_AST_ADDR_H_TEMP_FAM001;

DROP TABLE IF EXISTS TEMP.T10_AST_ADDR_H_MID_FAM001;

INSERT OVERWRITE TABLE T10_AST_ADDR_H PARTITION(SRC_TBL)
SELECT
Ast_Id                                                     --资产编号
,Strt_Date                                                  --开始日期
,Ip_Addr                                                    --Ip地址
,Prov_Cd                                                    --省份代码
,City_Cd                                                    --城市代码
,Cnty_Cd                                                    --县区代码
,Addr                                                       --地址
,End_Date                                                   --结束日期
,Data_Src_Cd                                                --数据来源代码
,Task_Name                                                  --任务名
,Data_Time                                                  --数据时间
,Real_Src_Tbl                                               --真实源表
,Src_Tbl                                                    --源表
FROM T10_AST_ADDR_H
WHERE NOT(    STRT_DATE <='2026-05-28'
AND END_DATE  > '2026-05-28'   )
AND SRC_TBL IN ('ODATA_N_FAM.W_ASSET_ACCOUNT')  --只插入目标表分区字段为该表的数据
UNION ALL
SELECT
Ast_Id1                        AS  Ast_Id                  --资产编号
,'2026-05-28'         AS  Strt_Date               --开始日期
,Ip_Addr1                       AS  Ip_Addr                 --Ip地址
,Prov_Cd1                       AS  Prov_Cd                 --省份代码
,City_Cd1                       AS  City_Cd                 --城市代码
,Cnty_Cd1                       AS  Cnty_Cd                 --县区代码
,Addr1                          AS  Addr                    --地址
,'2099-12-31'                   AS  End_Date                --结束日期
,Data_Src_Cd1                   AS  Data_Src_Cd             --数据来源代码
,Task_Name1                     AS  Task_Name               --任务名
,'2026-05-29 09:27:41'           AS  Data_Time               --数据时间
,Real_Src_Tbl1                  AS  Real_Src_Tbl            --真实源表
,Src_Tbl1                       AS  Src_Tbl                 --源表
FROM TEMP.T10_AST_ADDR_H_MID_FAM001 WHERE DATA_TYPE IN ('I','U')     --新增-I,变更-U
UNION ALL
SELECT
Ast_Id                                                     --资产编号
,Strt_Date                                                  --开始日期
,Ip_Addr                                                    --Ip地址
,Prov_Cd                                                    --省份代码
,City_Cd                                                    --城市代码
,Cnty_Cd                                                    --县区代码
,Addr                                                       --地址
,'2026-05-28'         AS  End_Date                --结束日期
,Data_Src_Cd                    AS  Data_Src_Cd             --数据来源代码
,Task_Name                      AS  Task_Name               --任务名
,'2026-05-29 09:27:41'           AS  Data_Time               --数据时间
,Real_Src_Tbl                   AS  Real_Src_Tbl            --真实源表
,Src_Tbl                        AS  Src_Tbl                 --源表
FROM TEMP.T10_AST_ADDR_H_MID_FAM001 WHERE DATA_TYPE IN ('D','U')     --变更-U,删除-D
UNION ALL
SELECT
Ast_Id                                                     --资产编号
,Strt_Date                                                  --开始日期
,Ip_Addr                                                    --Ip地址
,Prov_Cd                                                    --省份代码
,City_Cd                                                    --城市代码
,Cnty_Cd                                                    --县区代码
,Addr                                                       --地址
,End_Date                                                   --结束日期
,Data_Src_Cd                                                --数据来源代码
,Task_Name                                                  --任务名
,Data_Time                                                  --数据时间
,Real_Src_Tbl                                               --真实源表
,Src_Tbl                                                    --源表
FROM TEMP.T10_AST_ADDR_H_MID_FAM001 WHERE DATA_TYPE ='S'         --无变更-S
;

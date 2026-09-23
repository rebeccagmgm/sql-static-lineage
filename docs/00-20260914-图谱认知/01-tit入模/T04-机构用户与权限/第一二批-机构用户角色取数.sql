-- T04 第一、第二批：Presto/Trino 兼容语法，只读取样。六段 SELECT 分别执行、分别导出 CSV；第 02 段已有导出，默认跳过。
-- 将所有 2026-09-15 统一替换为同一个有数据的业务日。
-- 每份最多 500 行；先覆盖不同分组，再轮流补充组内记录，不用于推断总体分布。
-- 字段中文别名是阅读说明；A_ADM_* 原字段注释缺失，不冒充原始注释。
-- 不需要密码、联系方式等资料；本文件不查询这些字段。
-- 01/02/03 解释机构与账簿，04/05/06 解释用户与角色，07 核对状态转码。
-- 07 是当前参考配置，不含业务日筛选，不能充当历史业务日的转码快照。

-- 01 部门配置：按公司、本币、跨币种履保标志轮转。
WITH ranked AS (
  SELECT ID, DEPARTMENT, COMPANY, BASE_CURRENCY, ENABLE_CURRENCY_MARGIN,
         CREATED_DATETIME, UPDATED_DATETIME, BUSI_DATE,
         COUNT(*) OVER (PARTITION BY DEPARTMENT) AS dept_config_count,
         ROW_NUMBER() OVER (
           PARTITION BY COMPANY, BASE_CURRENCY, ENABLE_CURRENCY_MARGIN
           ORDER BY DEPARTMENT, ID, CREATED_DATETIME, UPDATED_DATETIME
         ) AS sample_round
  FROM ODATA_N_TIT.D_BK_DEPARTMENT_PROPERTIES
  WHERE BUSI_DATE = '2026-09-15'
)
SELECT ID AS "ID_部门属性ID", DEPARTMENT AS "DEPARTMENT_部门代码",
       COMPANY AS "COMPANY_公司代码", BASE_CURRENCY AS "BASE_CURRENCY_本币",
       ENABLE_CURRENCY_MARGIN AS "ENABLE_CURRENCY_MARGIN_跨币种履保原值",
       dept_config_count AS "同日该部门配置行数",
       CREATED_DATETIME AS "CREATED_DATETIME_创建时间",
       UPDATED_DATETIME AS "UPDATED_DATETIME_更新时间", BUSI_DATE AS "BUSI_DATE_业务日期"
FROM ranked
ORDER BY sample_round, COMPANY, BASE_CURRENCY, ENABLE_CURRENCY_MARGIN, DEPARTMENT, ID
LIMIT 500;

-- 02 已复用 D_CFG_DICTIONARY_DESC_合并_中英文字段.csv（2026-09-14），不必重取。
-- 下面仅供以后需要严格同日核验时使用，默认不执行。
/*
-- 02 公司/部门源字典：保留重复记录及失效时间，不擅自取一条名称。
WITH ranked AS (
  SELECT DICT_NAME, DICT_ITEM_NAME, DICT_ITEM_LABEL, DICT_ITEM_COMMENTS,
         CREATE_DATETIME, INVALID_DATETIME, BUSI_DATE,
         COUNT(*) OVER (PARTITION BY DICT_NAME, DICT_ITEM_NAME) AS key_count,
         ROW_NUMBER() OVER (
           PARTITION BY DICT_NAME
           ORDER BY DICT_ITEM_NAME, DICT_ITEM_LABEL, CREATE_DATETIME, INVALID_DATETIME
         ) AS sample_round
  FROM ODATA_N_TIT.D_CFG_DICTIONARY_DESC
  WHERE BUSI_DATE = '2026-09-15' AND DICT_NAME IN ('Department', 'Company')
)
SELECT DICT_NAME AS "DICT_NAME_代码域", DICT_ITEM_NAME AS "DICT_ITEM_NAME_代码值",
       DICT_ITEM_LABEL AS "DICT_ITEM_LABEL_显示名称",
       DICT_ITEM_COMMENTS AS "DICT_ITEM_COMMENTS_说明", key_count AS "同域同码行数",
       CREATE_DATETIME AS "CREATE_DATETIME_创建时间",
       INVALID_DATETIME AS "INVALID_DATETIME_失效时间", BUSI_DATE AS "BUSI_DATE_业务日期"
FROM ranked
ORDER BY sample_round, DICT_NAME, DICT_ITEM_NAME, DICT_ITEM_LABEL
LIMIT 500;

*/

-- 03 账簿与部门配置：先把配置汇总为每部门一行再关联，避免把账簿扩成多行。
-- ARRAY_AGG(DISTINCT ...) 仅提供候选值列表；配置行数仍保留，不能把列表当成唯一匹配结果。
WITH dept AS (
  SELECT DEPARTMENT, COUNT(*) AS config_count,
         ARRAY_JOIN(ARRAY_SORT(ARRAY_AGG(DISTINCT ID)), '|') AS config_ids,
         ARRAY_JOIN(ARRAY_SORT(ARRAY_AGG(DISTINCT COMPANY)), '|') AS companies,
         ARRAY_JOIN(ARRAY_SORT(ARRAY_AGG(DISTINCT BASE_CURRENCY)), '|') AS currencies
  FROM ODATA_N_TIT.D_BK_DEPARTMENT_PROPERTIES
  WHERE BUSI_DATE = '2026-09-15'
  GROUP BY DEPARTMENT
), ranked AS (
  SELECT b.KEY_BOOK_ID, b.BOOK_NAME, b.DEPARTMENT, b.COMPANY, b.DESK,
         b.VALID_STARTDATE, b.VALID_ENDDATE, b.BUSI_DATE,
         COALESCE(d.config_count, 0) AS config_count,
         d.config_ids, d.companies, d.currencies,
         ROW_NUMBER() OVER (
           PARTITION BY b.DEPARTMENT, b.COMPANY,
             CASE WHEN d.config_count IS NULL THEN '未匹配'
                  WHEN d.config_count = 1 THEN '单行' ELSE '多行' END
           ORDER BY b.KEY_BOOK_ID, b.BOOK_NAME
         ) AS sample_round
  FROM (SELECT * FROM ODATA_N_TIT.D_REF_BOOK WHERE BUSI_DATE = '2026-09-15') b
  LEFT JOIN dept d ON b.DEPARTMENT = d.DEPARTMENT
)
SELECT KEY_BOOK_ID AS "KEY_BOOK_ID_账簿ID", BOOK_NAME AS "BOOK_NAME_账簿名称",
       DEPARTMENT AS "DEPARTMENT_账簿部门", COMPANY AS "COMPANY_账簿公司", DESK AS "DESK_柜台",
       config_count AS "部门配置匹配行数", config_ids AS "匹配配置ID集合",
       companies AS "配置公司集合", currencies AS "配置本币集合",
       VALID_STARTDATE AS "VALID_STARTDATE_生效日期",
       VALID_ENDDATE AS "VALID_ENDDATE_失效日期", BUSI_DATE AS "BUSI_DATE_业务日期"
FROM ranked
ORDER BY sample_round, config_count, DEPARTMENT, COMPANY, KEY_BOOK_ID
LIMIT 500;

-- 04 系统用户：按状态、外部编号是否为空轮转。保留数值型源 ID 原值。
WITH ranked AS (
  SELECT KEY_USER_ID, NAME, USER_DESC, OUTSIDE_ID, STATUS,
         CREATED_DATETIME, CREATED_BY, UPDATED_DATETIME, BUSI_DATE,
         COUNT(*) OVER (PARTITION BY KEY_USER_ID) AS user_key_count,
         ROW_NUMBER() OVER (
           PARTITION BY STATUS,
             CASE WHEN OUTSIDE_ID IS NULL OR TRIM(OUTSIDE_ID) = '' THEN '空' ELSE '非空' END
           ORDER BY KEY_USER_ID, NAME, CREATED_DATETIME
         ) AS sample_round
  FROM ODATA_N_TIT.A_ADM_USER
  WHERE BUSI_DATE = '2026-09-15'
)
SELECT KEY_USER_ID AS "KEY_USER_ID_源用户编号", NAME AS "NAME_用户名称",
       USER_DESC AS "USER_DESC_用户描述", OUTSIDE_ID AS "OUTSIDE_ID_外部编号",
       STATUS AS "STATUS_源状态原值", user_key_count AS "同日源用户编号行数",
       CREATED_DATETIME AS "CREATED_DATETIME_创建时间", CREATED_BY AS "CREATED_BY_创建人引用",
       UPDATED_DATETIME AS "UPDATED_DATETIME_更新时间", BUSI_DATE AS "BUSI_DATE_业务日期"
FROM ranked
ORDER BY sample_round, STATUS, KEY_USER_ID
LIMIT 500;

-- 05 角色定义：按是否已有分配、创建人轮转，保留角色别名及分配情况。
WITH assignment AS (
  SELECT KEY_ROLE_ID, COUNT(*) AS assignment_rows,
         COUNT(DISTINCT KEY_USER_ID) AS assigned_users
  FROM ODATA_N_TIT.A_ADM_USER_ROLE
  WHERE BUSI_DATE = '2026-09-15'
  GROUP BY KEY_ROLE_ID
), ranked AS (
  SELECT r.KEY_ROLE_ID, r.ROLE_NAME, r.ROLE_ALIAS, r.ROLE_DESC,
         r.CREATED_BY, r.CREATED_DATETIME, r.BUSI_DATE,
         COALESCE(a.assignment_rows, 0) AS assignment_rows,
         COALESCE(a.assigned_users, 0) AS assigned_users,
         ROW_NUMBER() OVER (
           PARTITION BY CASE WHEN a.assignment_rows IS NULL THEN '未分配' ELSE '有分配' END,
                        r.CREATED_BY
           ORDER BY r.KEY_ROLE_ID, r.ROLE_NAME
         ) AS sample_round
  FROM (SELECT * FROM ODATA_N_TIT.A_ADM_ROLE WHERE BUSI_DATE = '2026-09-15') r
  LEFT JOIN assignment a ON r.KEY_ROLE_ID = a.KEY_ROLE_ID
)
SELECT KEY_ROLE_ID AS "KEY_ROLE_ID_源角色编号", ROLE_NAME AS "ROLE_NAME_角色名称",
       ROLE_ALIAS AS "ROLE_ALIAS_角色别名原值", ROLE_DESC AS "ROLE_DESC_角色描述",
       CREATED_BY AS "CREATED_BY_创建人引用", CREATED_DATETIME AS "CREATED_DATETIME_创建时间",
       assignment_rows AS "同日角色分配行数", assigned_users AS "同日不同用户数",
       BUSI_DATE AS "BUSI_DATE_业务日期"
FROM ranked
ORDER BY sample_round, assignment_rows, CREATED_BY, KEY_ROLE_ID
LIMIT 500;

-- 06 用户角色关系：按角色轮转；两端名称按 ID 预聚合，显示缺失/重复匹配。
WITH users AS (
  SELECT KEY_USER_ID, COUNT(*) AS user_count,
         ARRAY_JOIN(ARRAY_SORT(ARRAY_AGG(DISTINCT NAME)), '|') AS user_names,
         ARRAY_JOIN(ARRAY_SORT(ARRAY_AGG(DISTINCT OUTSIDE_ID)), '|') AS outside_ids
  FROM ODATA_N_TIT.A_ADM_USER WHERE BUSI_DATE = '2026-09-15'
  GROUP BY KEY_USER_ID
), roles AS (
  SELECT KEY_ROLE_ID, COUNT(*) AS role_count,
         ARRAY_JOIN(ARRAY_SORT(ARRAY_AGG(DISTINCT ROLE_NAME)), '|') AS role_names
  FROM ODATA_N_TIT.A_ADM_ROLE WHERE BUSI_DATE = '2026-09-15'
  GROUP BY KEY_ROLE_ID
), ranked AS (
  SELECT a.KEY_USER_ID, a.KEY_ROLE_ID, a.CREATED_DATETIME, a.CREATED_BY, a.BUSI_DATE,
         COUNT(*) OVER (PARTITION BY a.KEY_USER_ID, a.KEY_ROLE_ID) AS pair_count,
         COALESCE(u.user_count, 0) AS user_count, u.user_names, u.outside_ids,
         COALESCE(r.role_count, 0) AS role_count, r.role_names,
         ROW_NUMBER() OVER (
           PARTITION BY a.KEY_ROLE_ID,
             CASE WHEN u.user_count IS NULL OR r.role_count IS NULL THEN '缺端点' ELSE '有端点' END
           ORDER BY a.KEY_USER_ID, a.CREATED_DATETIME, a.CREATED_BY
         ) AS sample_round
  FROM (SELECT * FROM ODATA_N_TIT.A_ADM_USER_ROLE WHERE BUSI_DATE = '2026-09-15') a
  LEFT JOIN users u ON a.KEY_USER_ID = u.KEY_USER_ID
  LEFT JOIN roles r ON a.KEY_ROLE_ID = r.KEY_ROLE_ID
)
SELECT KEY_USER_ID AS "KEY_USER_ID_源用户编号", user_names AS "用户名称集合",
       outside_ids AS "用户外部编号集合", user_count AS "用户匹配行数",
       KEY_ROLE_ID AS "KEY_ROLE_ID_源角色编号", role_names AS "角色名称集合",
       role_count AS "角色匹配行数", pair_count AS "同日同用户角色关系行数",
       CREATED_DATETIME AS "CREATED_DATETIME_分配记录创建时间",
       CREATED_BY AS "CREATED_BY_分配记录创建人引用", BUSI_DATE AS "BUSI_DATE_业务日期"
FROM ranked
ORDER BY sample_round, user_count, role_count, KEY_ROLE_ID, KEY_USER_ID
LIMIT 500;

-- 07 用户状态实际转码：不是业务行样本，保留同源值的重复映射以便核验。
SELECT SRC_SYS_NAME AS "SRC_SYS_NAME_源系统", SRC_TAB_NAME AS "SRC_TAB_NAME_源表",
       SRC_FLD_NAME AS "SRC_FLD_NAME_源字段", SRC_CD_VAL AS "SRC_CD_VAL_源值",
       TGT_TAB_NAME AS "TGT_TAB_NAME_目标表", TGT_TAB_FLD AS "TGT_TAB_FLD_目标字段",
       DW_CD_VAL AS "DW_CD_VAL_模型代码", SRC_CD_DESC AS "SRC_CD_DESC_源值说明",
       DW_CD_DESC AS "DW_CD_DESC_模型值说明", UPD_DATE AS "UPD_DATE_配置更新日期"
FROM PDATA_N.REF_CD_CVT_MAP
WHERE TGT_TAB_NAME = 'T04_USER' AND TGT_TAB_FLD = 'User_Stat_Cd'
  AND SRC_TAB_NAME = 'ADM_USER' AND SRC_FLD_NAME = 'STATUS' AND SRC_SYS_NAME = 'TIT'
ORDER BY SRC_CD_VAL, DW_CD_VAL
LIMIT 500;

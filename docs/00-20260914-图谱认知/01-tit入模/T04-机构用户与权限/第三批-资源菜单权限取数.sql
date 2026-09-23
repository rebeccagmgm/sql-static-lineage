-- 第三批补充：Presto/Trino 兼容语法，四段只读 SELECT，各最多 500 行。
-- 2026-09-16 已收到本批导出：08/09/10 各 500 行，业务日 2026-09-15；11 共 12 行。
-- 样本及结论已写入 05 资源与菜单权限.md，无需重复执行，保留本文件供复核。
-- 沿用前批编号 08—11；不重复导出用户、角色、D_CFG_DICTIONARY_DESC。
-- 08—10 请将 2026-09-15 改为与前批相同的业务日；11 为查询时的参考配置。
-- 按类型/角色轮转覆盖，不用于总体分布推断。中文别名为阅读解释。

-- 08 资源权限：保留类型、访问方式、角色及同一授权组合的源行数。
WITH ranked AS (
  SELECT KEY_ROLE_ID, RESOURCE_TYPE, RESOURCE_ID, ACCESS_TYPE,
         CREATED_DATETIME, CREATED_BY, BUSI_DATE,
         COUNT(*) OVER (PARTITION BY KEY_ROLE_ID, RESOURCE_TYPE, RESOURCE_ID, ACCESS_TYPE) AS key_rows,
         ROW_NUMBER() OVER (
           PARTITION BY RESOURCE_TYPE, ACCESS_TYPE, KEY_ROLE_ID
           ORDER BY RESOURCE_ID, CREATED_DATETIME, CREATED_BY
         ) AS sample_round
  FROM ODATA_N_TIT.A_ADM_ROLE_ACCESS
  WHERE BUSI_DATE = '2026-09-15'
)
SELECT KEY_ROLE_ID AS "KEY_ROLE_ID_角色编号", RESOURCE_TYPE AS "RESOURCE_TYPE_资源类型原值",
       RESOURCE_ID AS "RESOURCE_ID_资源编号", ACCESS_TYPE AS "ACCESS_TYPE_访问类型原值",
       key_rows AS "同日同授权组合行数", CREATED_DATETIME AS "CREATED_DATETIME_创建时间",
       CREATED_BY AS "CREATED_BY_创建人引用", BUSI_DATE AS "BUSI_DATE_业务日期"
FROM ranked
ORDER BY sample_round, RESOURCE_TYPE, ACCESS_TYPE, KEY_ROLE_ID, RESOURCE_ID
LIMIT 500;

-- 09 菜单分配与定义：同日左连接，保留无匹配及定义重复，不挑任意一条名称。
WITH assignments AS (
  SELECT ROLE_ID, MENU_ID, CREATE_TIME, CREATE_BY, BUSI_DATE,
         COUNT(*) OVER (PARTITION BY ROLE_ID, MENU_ID) AS assignment_rows
  FROM ODATA_N_TIT.A_ADM_MENU_ROLE_MAPPING
  WHERE BUSI_DATE = '2026-09-15'
), menus AS (
  SELECT MENU_ID, MENU_NUMBER, MENU_NAME, MENU_LEVEL, PARENT_NUMBER,
         COUNT(*) OVER (PARTITION BY MENU_ID) AS menu_id_rows,
         COUNT(*) OVER (PARTITION BY MENU_NUMBER) AS menu_number_rows
  FROM ODATA_N_TIT.A_ADM_MENU_PERMISSION
  WHERE BUSI_DATE = '2026-09-15'
), ranked AS (
  SELECT a.ROLE_ID, a.MENU_ID, a.CREATE_TIME, a.CREATE_BY, a.BUSI_DATE,
         a.assignment_rows, m.MENU_NUMBER, m.MENU_NAME, m.MENU_LEVEL, m.PARENT_NUMBER,
         COALESCE(m.menu_id_rows, 0) AS menu_id_rows, m.menu_number_rows,
         ROW_NUMBER() OVER (
           PARTITION BY a.ROLE_ID, m.MENU_LEVEL,
                        CASE WHEN m.menu_id_rows IS NULL THEN '缺定义' ELSE '有定义' END
           ORDER BY a.MENU_ID, m.MENU_NUMBER, m.MENU_NAME, a.CREATE_TIME
         ) AS sample_round
  FROM assignments a
  LEFT JOIN menus m ON a.MENU_ID = m.MENU_ID
)
SELECT ROLE_ID AS "ROLE_ID_角色编号", MENU_ID AS "MENU_ID_菜单内部编号",
       MENU_NUMBER AS "MENU_NUMBER_菜单展示代码", MENU_NAME AS "MENU_NAME_菜单名称",
       MENU_LEVEL AS "MENU_LEVEL_层级", PARENT_NUMBER AS "PARENT_NUMBER_父菜单展示代码",
       assignment_rows AS "同角色菜单分配行数", menu_id_rows AS "菜单内部编号匹配行数",
       menu_number_rows AS "同日菜单展示代码行数", CREATE_TIME AS "CREATE_TIME_分配创建时间",
       CREATE_BY AS "CREATE_BY_创建人引用", BUSI_DATE AS "BUSI_DATE_业务日期"
FROM ranked
ORDER BY sample_round, ROLE_ID, MENU_LEVEL, MENU_ID, MENU_NUMBER
LIMIT 500;

-- 10 功能与菜单对应：从映射出发，按 FUNCTION_NUMBER 而不是 KEY_FUNCTION_ID 连接。
-- 不导出功能 URL、微服务地址等实现信息。无映射的功能不在本查询范围。
WITH functions AS (
  SELECT KEY_FUNCTION_ID, FUNCTION_NUMBER, FUNCTION_NAME,
         COUNT(*) OVER (PARTITION BY FUNCTION_NUMBER) AS function_rows
  FROM ODATA_N_TIT.A_ADM_FUNCTION
  WHERE BUSI_DATE = '2026-09-15'
), menus AS (
  SELECT MENU_ID, MENU_NUMBER, MENU_NAME, MENU_LEVEL, PARENT_NUMBER,
         COUNT(*) OVER (PARTITION BY MENU_NUMBER) AS menu_rows
  FROM ODATA_N_TIT.A_ADM_MENU_PERMISSION
  WHERE BUSI_DATE = '2026-09-15'
), mappings AS (
  SELECT FUNCTION_NUMBER, MENU_NUMBER, BUSI_DATE,
         COUNT(*) OVER (PARTITION BY FUNCTION_NUMBER, MENU_NUMBER) AS mapping_rows
  FROM ODATA_N_TIT.A_ADM_FUNCTION_MENU_MAPPING
  WHERE BUSI_DATE = '2026-09-15'
), ranked AS (
  SELECT x.FUNCTION_NUMBER, x.MENU_NUMBER, x.BUSI_DATE, x.mapping_rows,
         f.KEY_FUNCTION_ID, f.FUNCTION_NAME, COALESCE(f.function_rows, 0) AS function_rows,
         m.MENU_ID, m.MENU_NAME, m.MENU_LEVEL, m.PARENT_NUMBER,
         COALESCE(m.menu_rows, 0) AS menu_rows,
         ROW_NUMBER() OVER (
           PARTITION BY x.MENU_NUMBER,
             CASE WHEN f.function_rows IS NULL OR m.menu_rows IS NULL THEN '缺端点' ELSE '有端点' END
           ORDER BY x.FUNCTION_NUMBER, f.KEY_FUNCTION_ID, m.MENU_ID, f.FUNCTION_NAME
         ) AS sample_round
  FROM mappings x
  LEFT JOIN functions f ON x.FUNCTION_NUMBER = f.FUNCTION_NUMBER
  LEFT JOIN menus m ON x.MENU_NUMBER = m.MENU_NUMBER
)
SELECT KEY_FUNCTION_ID AS "KEY_FUNCTION_ID_功能内部编号",
       FUNCTION_NUMBER AS "FUNCTION_NUMBER_功能代码", FUNCTION_NAME AS "FUNCTION_NAME_功能名称",
       MENU_ID AS "MENU_ID_菜单内部编号", MENU_NUMBER AS "MENU_NUMBER_菜单展示代码",
       MENU_NAME AS "MENU_NAME_菜单名称", MENU_LEVEL AS "MENU_LEVEL_菜单层级",
       PARENT_NUMBER AS "PARENT_NUMBER_父菜单展示代码", mapping_rows AS "同日同映射行数",
       function_rows AS "功能代码匹配行数", menu_rows AS "菜单代码匹配行数",
       BUSI_DATE AS "BUSI_DATE_业务日期"
FROM ranked
ORDER BY sample_round, MENU_NUMBER, FUNCTION_NUMBER, KEY_FUNCTION_ID, MENU_ID
LIMIT 500;

-- 11 仅补资源类型、访问类型的转换配置；用户状态转换在前批第 07 段。
SELECT SRC_SYS_NAME AS "SRC_SYS_NAME_源系统", SRC_TAB_NAME AS "SRC_TAB_NAME_源表",
       SRC_FLD_NAME AS "SRC_FLD_NAME_源字段", SRC_CD_VAL AS "SRC_CD_VAL_源代码",
       SRC_CD_DESC AS "SRC_CD_DESC_源含义", TGT_TAB_NAME AS "TGT_TAB_NAME_目标表",
       TGT_TAB_FLD AS "TGT_TAB_FLD_目标字段", DW_CD_VAL AS "DW_CD_VAL_模型代码",
       DW_CD_DESC AS "DW_CD_DESC_模型含义", UPD_DATE AS "UPD_DATE_更新日期"
FROM PDATA_N.REF_CD_CVT_MAP
WHERE SRC_SYS_NAME = 'TIT' AND SRC_TAB_NAME = 'ADM_ROLE_ACCESS'
  AND TGT_TAB_NAME = 'T04_ROLE_RIGH_H'
  AND ((SRC_FLD_NAME = 'RESOURCE_TYPE' AND TGT_TAB_FLD = 'Righ_Obj_Type_Cd')
    OR (SRC_FLD_NAME = 'ACCESS_TYPE' AND TGT_TAB_FLD = 'User_Righ_Cd'))
ORDER BY SRC_FLD_NAME, SRC_CD_VAL, DW_CD_VAL
LIMIT 500;

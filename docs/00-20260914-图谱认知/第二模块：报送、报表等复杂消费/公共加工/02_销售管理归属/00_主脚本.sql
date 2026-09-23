-- 105743 销售管理归属：阅读版入口，原SQL见 ../99_证据/105743-query.sql。
-- 要回答：一份合约带上哪三组介绍关系，以及哪些普通／内部／TIT经办角色？
-- 介绍关系带分配比例；经办角色另行选人。本任务不计算收入或本金分摊。
--
-- 第一段：介绍关系 → 01各自排序 + 02补人员机构 → 03横排成三组 → otc_div_temp
-- 第二段：04销售合约 + 上述合约级／客户级关系 → 07逐字段选择介绍关系
--                     + 05普通／内部经办 + 06TIT角色 → 同一行并列输出
--
-- 先读README中合约A1的贯穿例，再对照03和07；其余模块按来源需要回查。
-- 保留原SQL两次写入、字段顺序和取值规则；CTE只是当前语句内的命名输入。
-- @include不是Hive语法：用render.mjs生成完整SQL.sql后才能得到完整语句。

-- 第一段：中间表，没有显式分区；覆盖范围沿用原SQL。
set hive.merge.mapfiles=true ;
set hive.merge.mapredfiles=true;
set hive.merge.size.per.task=1073741824;
set hive.merge.smallfiles.avgsize=1073741824;
set hive.merge.orcfile.stripe.level=false;
set hive.input.format=org.apache.hadoop.hive.ql.io.CombineHiveInputFormat;
set mapreduce.input.fileinputformat.split.maxsize=1073741824;
set mapreduce.input.fileinputformat.split.minsize=1073741824;
with
-- @include 01_介绍关系排序.sql
,
-- @include 02_人员与机构.sql

-- @include 03_介绍关系横排.sql

-- 第二段：最终管理归属，按参数日写busi_date分区。
-- WITH只对当前语句生效；第二段所用员工资料在其自身模块重新定义。
set hive.merge.mapfiles=true ;
set hive.merge.mapredfiles=true;
set hive.merge.size.per.task=1073741824;
set hive.merge.smallfiles.avgsize=1073741824;
set hive.merge.orcfile.stripe.level=false;
set hive.input.format=org.apache.hadoop.hive.ql.io.CombineHiveInputFormat;
set mapreduce.input.fileinputformat.split.maxsize=1073741824;
set mapreduce.input.fileinputformat.split.minsize=1073741824;
with
-- @include 04_合约与客户关系.sql
,
-- @include 05_普通与内部经办.sql
,
-- @include 06_TIT经办与客户经理.sql

-- @include 07_管理归属输出.sql

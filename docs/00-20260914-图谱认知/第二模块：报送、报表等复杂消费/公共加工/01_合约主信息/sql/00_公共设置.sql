-- 【用途】沿用四个分支原有Hive/MapReduce执行设置；被主脚本首先引用，不包含业务筛选逻辑。
-- 【文件合并】启用Map及MapReduce输出文件合并；目标合并大小和小文件均值阈值均为1 GiB。
-- 【输入切片】使用CombineHiveInputFormat，split最大/最小值均为1 GiB；这是执行参数，不代表数据行粒度。
-- 【边界】实际效果取决于引擎与作业配置；本次仅保留原设置，没有调参或运行验证。
set hive.merge.mapfiles=true ;
set hive.merge.mapredfiles=true;
set hive.merge.size.per.task=1073741824;
set hive.merge.smallfiles.avgsize=1073741824;
set hive.merge.orcfile.stripe.level=false;

set hive.input.format=org.apache.hadoop.hive.ql.io.CombineHiveInputFormat;
set mapreduce.input.fileinputformat.split.maxsize=1073741824;
set mapreduce.input.fileinputformat.split.minsize=1073741824;

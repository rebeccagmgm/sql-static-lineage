-- 231146：三路标签UNION ALL并列叠加，不以创收日报客户为全局唯一底座。
-- 01规模排名；02历史交易类型及特征；04垫资候选（内部引用03月计数）。
-- 最外层rn<=10只筛有排名的01；其他分支rn=NULL通过。最终不统一去重。
SELECT company_name,
	company_id,
	tag_name,
	busi_date FROM (
	 SELECT
    t0.company_name                    -- 公司名称
    ,t0.company_id                     -- 公司ID
    ,t0.tag_name                       -- 标签
    ,'${yyyy-MM-dd}' as busi_date      -- 业务日期
from (
    
-- @include 01_规模前十.sql

    UNION ALL
    
    
-- @include 02_历史交易与特征.sql

    UNION ALL
    
    
-- @include 04_垫资滑窗与标签.sql


) t0
where t0.rn <= 10 or t0.rn is null 
	) castTable

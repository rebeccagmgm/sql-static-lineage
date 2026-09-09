import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

const OUT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(OUT_DIR, "..", "..", "..", "..");
const DATA_ROOT = join(REPO_ROOT, "..", "sql-static-lineage-data");
const BASELINE_DIR = join(REPO_ROOT, "docs", "data-graph-derived-2.0", "analysis");
const TARGET_DATASET =
  "dataset:f322d64cc13f2c1fedf2c1d26bc3f5dbf17e636b8ef92b75b28867c45f417aed";
const TARGET_TABLE = "pdata_n.t03_otc_deri_book_adtnl_info";
const GRAPH_VERSION =
  "44e87de15ca82eb40480569c1db59c87b3636f7194b50576137889162425224e";

const REVIEW_TASKS = [
  "114782", "184662", "215700", "221300", "234256",
  "176610", "171179", "134167", "234175", "143830",
  "107018", "209894", "138186", "241773", "200078",
  "230202", "145871", "243918", "243650", "209119",
];

// These notes are deliberately task-specific. The script inventories and joins
// saved evidence; it is not a general SQL parser or a replacement for Facts.
// Legacy `fields`/`peers` notes are retained only to audit the first pilot pass;
// no generated evidence or statistics consume them. Structural usage now comes
// exclusively from factUsagesForTask().
const REVIEWS = {
  "114782": {
    patternIds: ["P02_OTC_BOOK_ELIGIBILITY"],
    uses: ["范围控制"],
    summary: "在互换净值、期权净值两个任务内临时分支中，以账簿ID+修饰符内连接，仅保留当日、OTC部门账簿；合格分支随后并入客户账户总资产并按客户汇总。",
    differences: "目标表不向最终结果直接补列；它是两个资产分支的资格闸门。日期是材料中的固定日期，不应泛化为任意日。",
    confirmedOutputs: ["dm_ecif.cust_otc_acctast_s"],
    fields: {
      book_agt_id: ["JOIN", "范围控制"], book_agt_modifr: ["JOIN", "范围控制"],
      bel_dept: ["FILTER", "范围控制"], src_tbl: ["FILTER"], busi_date: ["FILTER"],
    },
    peers: {
      book_agt_id: ["pdata_n.t03_agt_rela_h.rela_agt_id"],
      book_agt_modifr: ["pdata_n.t03_agt_rela_h.rela_agt_modifr"],
    },
    questions: ["两个资产分支的账簿键在当日快照是否唯一", "被账簿条件排除的资产规模与客户数"],
  },
  "184662": {
    patternIds: ["P02_OTC_BOOK_ELIGIBILITY"],
    uses: ["范围控制"],
    summary: "在互换净值、期权净值两个临时分支中，以账簿ID+修饰符内连接筛选当日OTC账簿；分支进入账户级临时表，并继续汇总到账户、ECIF、UID三个写入。",
    differences: "与114782局部规则一致，但日期、临时表链和最终写入集合不同，不能把整条任务SQL视为相同。",
    confirmedOutputs: ["dm_mast_n.cust_acct_ast", "dm_mast_n.cust_ecf_ast", "dm_mast_n.cust_uid_ast"],
    fields: {
      book_agt_id: ["JOIN", "范围控制"], book_agt_modifr: ["JOIN", "范围控制"],
      bel_dept: ["FILTER", "范围控制"], src_tbl: ["FILTER"], busi_date: ["FILTER"],
    },
    peers: {
      book_agt_id: ["pdata_n.t03_agt_rela_h.rela_agt_id"],
      book_agt_modifr: ["pdata_n.t03_agt_rela_h.rela_agt_modifr"],
    },
    questions: ["账户到ECIF、UID映射覆盖率", "两个账簿筛选分支的实际排除量"],
  },
  "215700": {
    patternIds: ["P01_DEPARTMENT_ENRICHMENT"],
    uses: ["属性补充", "计算或条件取值"],
    summary: "构造REF_BOOK后左连接风险结果，通过NVL(账簿部门, 原风险部门)写出部门；账簿未匹配时使用原部门回退。",
    differences: "区别于200078/200030的直接部门取值：本任务有显式NVL回退，空匹配不必然写空。",
    confirmedOutputs: ["dm_fms_n.adm_v_risk_daily_bundle_margin"],
    fields: {
      book_agt_id: ["JOIN"], bel_dept: ["SELECT", "计算或条件取值", "属性补充"],
      src_tbl: ["FILTER"], busi_date: ["FILTER"],
    },
    peers: { book_agt_id: ["pdata_n.t03_agt_rela_h.rela_agt_id"] },
    questions: ["当日账簿ID是否唯一", "NVL两侧部门不一致时采用账簿侧是否符合业务口径"],
  },
  "221300": {
    patternIds: ["P03_FICC_BOOK_SCOPE"],
    uses: ["范围控制"],
    summary: "互换、期权两个分支均沿交易到账簿关系，以账簿ID内连接当日GFS_FICC账簿，只让固收账簿对应合约进入指标使用情况统计。",
    differences: "目标表只提供资格集合，不输出账簿属性；两个分支的上游合约结构不同。",
    confirmedOutputs: ["dm_cisp_n.det_idx_use_situ_stati"],
    fields: { book_agt_id: ["JOIN", "范围控制"], bel_dept: ["FILTER", "范围控制"], src_tbl: ["FILTER"], busi_date: ["FILTER"] },
    peers: { book_agt_id: ["pdata_n.t03_agt_rela_h.rela_agt_id"] },
    questions: ["同一合约是否会因多条账簿快照记录重复进入统计"],
  },
  "234256": {
    patternIds: ["P04_DUAL_BOOK_ROLE"],
    uses: ["属性补充", "范围控制"],
    summary: "同一任务两次引用：rb以账簿ID内连接当前账簿资格；bb中的第二个别名以账簿ID连接名称，并用生效/到期日筛选后输出Bel_Dept。",
    differences: "两个别名角色不可合并：rb没有有效期条件，bb有Eff_Date/Exp_Date条件并承担部门取值。",
    confirmedOutputs: ["dm_fii_test.dtl_otc_swap_ast_leg_info_day"],
    fields: {
      book_agt_id: ["JOIN", "范围控制"], bel_dept: ["SELECT", "属性补充"],
      eff_date: ["FILTER", "范围控制"], exp_date: ["FILTER", "范围控制"], src_tbl: ["FILTER"], busi_date: ["FILTER"],
    },
    peers: { book_agt_id: ["任务内main_trd_otc_trade.rela_agt_id", "pdata_n.t03_agt_name_h.agt_id"] },
    questions: ["rb与bb的快照/有效期口径不同是否为有意设计", "两个别名匹配基数是否一致"],
  },
  "176610": {
    patternIds: ["P05_DEPARTMENT_CLASSIFICATION"],
    uses: ["范围控制", "计算或条件取值"],
    summary: "三个互换事件分支分别内连接当日OTC或GFS_FICC账簿，并把Bel_Dept通过CASE映射为系统名称‘股衍/固收’。",
    differences: "三处账簿规则相同，但事件日期锚点分别为起始、平仓和实际/计划结算日，后续持仓连接条件不同。",
    confirmedOutputs: ["dm_cmpl_n.aml_comp_trd_info"],
    fields: { book_agt_id: ["JOIN", "范围控制"], bel_dept: ["FILTER", "CASE", "计算或条件取值"], src_tbl: ["FILTER"], busi_date: ["FILTER"] },
    peers: { book_agt_id: ["pdata_n.t98_sb_otc_swap_comp_info.book_agt_id"] },
    questions: ["CASE只覆盖OTC/GFS_FICC，是否存在其他部门值", "三个事件分支是否可能重复覆盖同一交易"],
  },
  "171179": {
    patternIds: ["P06_REPORTING_ELIGIBILITY"],
    uses: ["属性补充", "范围控制"],
    summary: "直接读取目标表的两个互换分支都以账簿ID内连接Rep_Fin_Flag=1的当日账簿，同时输出Bel_Dept；其他文本命中是T98表的src_tbl常量，不是再次读取目标物理表。",
    differences: "同一SQL还有多个已派生T98账簿表引用；本核验只把Facts确认的两次物理表读取计作目标表消费。",
    confirmedOutputs: ["dm_fin_n.adm_trd_otc_comp_day"],
    fields: { book_agt_id: ["JOIN", "范围控制"], rep_fin_flag: ["FILTER", "范围控制"], bel_dept: ["SELECT", "属性补充"], src_tbl: ["FILTER"], busi_date: ["FILTER"] },
    peers: { book_agt_id: ["pdata_n.t98_sb_otc_swap_comp_info.book_agt_id"] },
    questions: ["财务报送标志历史变化是否允许回溯重算", "T98派生账簿表与本表快照口径是否一致"],
  },
  "134167": {
    patternIds: ["P07_BOOK_DIMENSION_PROJECTION"],
    uses: ["属性补充", "范围控制", "计算或条件取值"],
    summary: "以GFS_HK账簿快照为驱动，输出账簿公司、部门、柜台和各类开关；若干0/1开关通过CASE转成Y/N，并内连接有效账簿名称。",
    differences: "这是账簿维表投影，不是给事实表补一个字段；Bel_Co与名称内连接共同限定输出范围。",
    confirmedOutputs: ["dm_hk_n.ref_book"],
    fields: {
      book_agt_id: ["JOIN", "SELECT"], bel_co: ["FILTER", "SELECT", "范围控制"], bel_dept: ["SELECT"], cntr: ["SELECT"],
      rep_fin_flag: ["CASE", "SELECT"], rep_risk_flag: ["CASE", "SELECT"], enable_rgst_flag: ["CASE", "SELECT"],
      enable_sett_ntfc_flag: ["CASE", "SELECT"], enable_trd_cfm_flag: ["CASE", "SELECT"], enable_ast_module_flag: ["CASE", "SELECT"],
      enable_risk_qta_flag: ["CASE", "SELECT"], enable_scdtm_revw_flag: ["CASE", "SELECT"], src_tbl: ["FILTER"], busi_date: ["FILTER"],
    },
    peers: { book_agt_id: ["pdata_n.t03_agt_name_h.agt_id", "pdata_n.t03_agt_pty_rela_h.agt_id"] },
    questions: ["GFS_HK账簿ID在名称和主体关系表中的有效期唯一性"],
  },
  "234175": {
    patternIds: ["P08_HK_CONTRACT_SCOPE"],
    uses: ["范围控制"],
    summary: "期权通用信息先连接子交易，再按Book_Agt_Id内连接当日Bel_Co=GFS_HK账簿，仅保留香港公司账簿关联的标的信息。",
    differences: "不读取账簿属性到输出；公司条件只作为资格筛选。目标写入为test schema，不能自动推广到生产同名逻辑。",
    confirmedOutputs: ["dm_hk_test.info_ref_option_general_info_test"],
    fields: { book_agt_id: ["JOIN", "范围控制"], bel_co: ["FILTER", "范围控制"], src_tbl: ["FILTER"], busi_date: ["FILTER"] },
    peers: { book_agt_id: ["pdata_n.t03_otc_opt_comp_sub_trd_info.book_agt_id"] },
    questions: ["测试目标与生产版本逻辑是否一致"],
  },
  "143830": {
    patternIds: ["P06_REPORTING_ELIGIBILITY"],
    uses: ["范围控制"],
    summary: "履保映射分支沿交易到账簿关系内连接当日账簿，并在WHERE要求Rep_Risk_Flag=1，限定进入风险合约与保证金账户映射的账簿。",
    differences: "使用风控报送标志而非财务报送标志；另一UNION分支写固定部门且不消费目标表。",
    confirmedOutputs: ["dm_rsk_n.d_v_risk_contr_capital_mapping"],
    fields: { book_agt_id: ["JOIN", "范围控制"], rep_risk_flag: ["FILTER", "范围控制"], src_tbl: ["ON附加条件"], busi_date: ["ON附加条件"] },
    peers: { book_agt_id: ["pdata_n.t03_agt_rela_h.rela_agt_id"] },
    questions: ["Rep_Risk_Flag=1账簿的匹配覆盖率"],
  },
  "107018": {
    patternIds: ["P09_BOOK_REASSIGNMENT"],
    uses: ["身份/代码映射", "范围控制", "属性补充"],
    summary: "多次引用目标表验证映射后的目标账簿存在；主分支又按账簿ID+修饰符连接，输出Bel_Dept。合约可按合约号、交易对手或默认规则从原账簿重映射到目标账簿。",
    differences: "三个MAPPING分支的规则来源不同，不能合并成单一等值键；主查询还区分原账簿与映射后账簿。",
    confirmedOutputs: ["pdata_n.t98_otc_swap_comp_trd_undrl_info"],
    fields: { book_agt_id: ["JOIN", "身份/代码映射", "范围控制"], book_agt_modifr: ["JOIN"], bel_dept: ["SELECT", "属性补充"], src_tbl: ["FILTER"], busi_date: ["FILTER"] },
    peers: { book_agt_id: ["pdata_n.t03_otc_deri_agt_rela_adtnl_info.rela_book_agt_id", "pdata_n.t03_agt_rela_h.rela_agt_id"], book_agt_modifr: ["pdata_n.t03_agt_rela_h.rela_agt_modifr"] },
    questions: ["映射规则优先级及UNION去重后的唯一目标账簿", "映射目标账簿是否存在多快照行"],
  },
  "209894": {
    patternIds: ["P03_FICC_BOOK_SCOPE"],
    uses: ["范围控制"],
    summary: "三个互换名义本金窗口和一个期权名义本金分支分别内连接当日GFS_FICC账簿，再按合约、账簿、状态等维度汇总规模。",
    differences: "四个别名规则局部一致，但期间分别为存量、年新增、月新增和期权口径；金额公式及上游合约表不同。",
    confirmedOutputs: ["dm_fii_n.adm_trd_comp_scal_sum_day_titans"],
    fields: { book_agt_id: ["JOIN", "范围控制"], bel_dept: ["FILTER", "范围控制"], src_tbl: ["FILTER"], busi_date: ["FILTER"] },
    peers: { book_agt_id: ["pdata_n.t98_sb_otc_swap_comp_info.book_agt_id", "pdata_n.t03_agt_rela_h.rela_agt_id"] },
    questions: ["四个分支的账簿匹配是否一对一", "窗口之间是否有意重叠"],
  },
  "138186": {
    patternIds: ["P10_SPECIAL_SCOPE_EXCEPTION"],
    uses: ["范围控制"],
    summary: "按账簿ID内连接当日账簿，WHERE采用‘Bel_Dept=ED 或指定合约/标的白名单’的复合条件控制权益TRS标的输出范围。",
    differences: "这是本批最明确的特殊例外：白名单分支可绕过ED部门条件，不能归一化为单纯部门筛选。",
    confirmedOutputs: ["dm_otc_n.v_equity_trs_underlying"],
    fields: { book_agt_id: ["JOIN", "范围控制"], bel_dept: ["WHERE复合条件", "范围控制"], src_tbl: ["FILTER"], busi_date: ["FILTER"] },
    peers: { book_agt_id: ["pdata_n.t98_sb_otc_swap_comp_info.book_agt_id"] },
    questions: ["硬编码合约白名单的维护责任和失效日期", "OR条件命中的实际分支占比"],
  },
  "241773": {
    patternIds: ["P05_DEPARTMENT_CLASSIFICATION"],
    uses: ["属性补充", "计算或条件取值", "范围控制"],
    summary: "期权分支左连接账簿取Cntr参与北上QIS分类；互换分支内连接账簿取Bel_Dept/Bel_Co参与OTC_HK、GFS_HK等合约标签CASE。",
    differences: "两个别名连接类型和字段完全不同：期权缺账簿仍保留并走其他CASE，互换缺账簿会被过滤。",
    confirmedOutputs: ["dm_index_n.grp_tag_otc_deri_contr_cros_contr_type"],
    fields: { book_agt_id: ["JOIN"], cntr: ["CASE", "计算或条件取值"], bel_dept: ["CASE", "计算或条件取值"], bel_co: ["CASE", "计算或条件取值"], src_tbl: ["FILTER"], busi_date: ["FILTER"] },
    peers: { book_agt_id: ["pdata_n.t98_sb_otc_opt_comp_info.book_agt_id", "pdata_n.t98_sb_otc_swap_comp_info.book_agt_id"] },
    questions: ["左连接缺失账簿时标签落入哪个兜底分支", "内连接互换分支的账簿覆盖率"],
  },
  "200078": {
    patternIds: ["P01_DEPARTMENT_ENRICHMENT"],
    uses: ["属性补充"],
    summary: "REF_BOOK按当日快照取账簿ID与部门，最终LEFT JOIN到风险结果并直接输出部门；未看到后续部门过滤或计算。",
    differences: "没有215700的NVL回退；未匹配时部门为空。外层DISTINCT也不能证明多部门匹配不会增行。",
    confirmedOutputs: ["dm_rsk_n.adm_v_risk_daily_bundle_margin"],
    fields: { book_agt_id: ["JOIN"], bel_dept: ["SELECT", "属性补充"], src_tbl: ["FILTER"], busi_date: ["FILTER"] },
    peers: { book_agt_id: ["pdata_n.t03_agt_rela_h.rela_agt_id"] },
    questions: ["账簿ID在当日快照是否唯一", "空部门是否被下游接受"],
  },
  "230202": {
    patternIds: ["P11_DYNAMIC_HEDGE_YIELD"],
    uses: ["身份/代码映射", "范围控制", "计算或条件取值", "粒度变化"],
    summary: "只保留Cntr=DYNAMIC_HEDGING账簿，按账簿ID内连接持仓；Map_Undrl_Cd空时回退证券分类，按映射标的×业务日期汇总Tdy_Yield，并把聚合收益接入创收公式。",
    differences: "唯一同时覆盖资格、映射身份、聚合粒度和金额计算的已核模式；空串经IF转NULL后再NVL回退，不能简写为普通COALESCE。",
    confirmedOutputs: ["dm_otc_n.otc_rev_daily_rpt"],
    fields: { book_agt_id: ["JOIN", "范围控制"], cntr: ["FILTER", "范围控制"], map_undrl_cd: ["NVL/IF", "GROUP BY", "计算或条件取值", "身份/代码映射", "粒度变化"], src_tbl: ["FILTER"], busi_date: ["FILTER"] },
    peers: { book_agt_id: ["pdata_n.t98_otc_book_hold_sum.book_agt_id"], map_undrl_cd: ["pdata_news_n.t02_tit_scr_base_info.undrl_clas"] },
    questions: ["动态对冲账簿快照唯一性", "Map_Undrl_Cd空串/空值分布及回退命中率", "聚合前后行数与收益守恒"],
  },
  "145871": {
    patternIds: ["P07_BOOK_DIMENSION_PROJECTION"],
    uses: ["属性补充", "范围控制"],
    summary: "以当日D_REF_BOOK快照为驱动，直接透传柜台、部门、公司及各类开关，再左连接协议、名称和持有人名称，生成T98账簿信息。",
    differences: "与134167同为账簿维表投影，但本任务不过滤GFS_HK，也不把0/1开关转Y/N，并保留更多源字段。",
    confirmedOutputs: ["pdata_n.t98_otc_deri_book_info"],
    fields: {
      book_agt_id: ["SELECT", "JOIN"], book_agt_modifr: ["JOIN"], bel_dept: ["SELECT"], bel_co: ["SELECT"], cntr: ["SELECT"],
      rep_fin_flag: ["SELECT"], rep_risk_flag: ["SELECT"], enable_rgst_flag: ["SELECT"], enable_sett_ntfc_flag: ["SELECT"],
      enable_trd_cfm_flag: ["SELECT"], enable_ast_module_flag: ["SELECT"], enable_risk_qta_flag: ["SELECT"], enable_scdtm_revw_flag: ["SELECT"],
      ost_otc_ind: ["SELECT"], remark: ["SELECT"], src_tbl: ["FILTER"], busi_date: ["FILTER"],
    },
    peers: { book_agt_id: ["pdata_n.t03_agt.agt_id", "pdata_n.t03_agt_name_h.agt_id"] , book_agt_modifr: ["pdata_n.t03_agt.agt_modifr", "pdata_n.t03_agt_name_h.agt_modifr"] },
    questions: ["驱动快照同一账簿键是否唯一", "左连接名称/持有人多匹配是否扩行"],
  },
  "243918": {
    patternIds: ["P07_BOOK_DIMENSION_PROJECTION", "P03_FICC_BOOK_SCOPE"],
    uses: ["属性补充", "身份/代码映射", "范围控制"],
    summary: "以GFS_FICC账簿快照为驱动，输出有效期、柜台、部门、公司、开关和映射Wind代码；再补账簿名称、持有人交易对手ID及柜台中文名。",
    differences: "不同于145871，它限定GFS_FICC并额外解释柜台代码；不同于只做资格筛选的FICC模式，它把大量账簿属性写入结果。",
    confirmedOutputs: ["dm_fii_n.det_titans_book_acct_lvl_info"],
    fields: {
      book_agt_id: ["SELECT", "JOIN"], eff_date: ["SELECT"], exp_date: ["SELECT"], cntr: ["SELECT", "JOIN", "身份/代码映射"], bel_dept: ["FILTER", "SELECT", "范围控制"],
      bel_co: ["SELECT"], rep_fin_flag: ["SELECT"], rep_risk_flag: ["SELECT"], enable_rgst_flag: ["SELECT"], enable_sett_ntfc_flag: ["SELECT"],
      enable_trd_cfm_flag: ["SELECT"], enable_ast_module_flag: ["SELECT"], enable_risk_qta_flag: ["SELECT"], enable_scdtm_revw_flag: ["SELECT"],
      ost_otc_ind: ["SELECT"], remark: ["SELECT"], map_undrl_cd: ["SELECT", "身份/代码映射"], src_tbl: ["FILTER"], busi_date: ["FILTER", "SELECT"],
    },
    peers: { book_agt_id: ["pdata_n.t03_agt.agt_id", "pdata_n.t03_agt_name_h.agt_id"], cntr: ["pdata_n.ref_dw_cd_val.dw_cd_val"] },
    patternSlices: {
      P03_FICC_BOOK_SCOPE: {
        uses: ["范围控制"],
        usageTypes: ["过滤条件"],
        summary: "目标表自身的GFS_FICC、来源和业务日期过滤定义固收账簿范围。",
      },
      P07_BOOK_DIMENSION_PROJECTION: {
        uses: ["属性补充", "身份/代码映射"],
        excludeUsageTypes: ["过滤条件", "物理读取定位"],
        summary: "账簿字段的输出绑定、名称/主体连接和柜台代码解释构成维表投影。",
      },
    },
    questions: ["账簿、名称、持有人、代码表各自唯一性", "Map_Undrl_Cd的治理含义和稳定性"],
  },
  "243650": {
    patternIds: ["P12_REVENUE_CONTRACT_SCOPE"],
    uses: ["范围控制"],
    summary: "常速互换标签分支按账簿ID内连接当日账簿，并在WHERE要求Bel_Dept=OTC；再叠加合约状态、日期和非内部互换条件形成创收合约范围。",
    differences: "账簿部门只是多项资格条件之一；另两个UNION标签分支不消费目标表，不能把全部输出行都归因于账簿表。",
    confirmedOutputs: ["dm_index_n.grp_tag_otc_deri_contr_rev_contr_scop"],
    fields: { book_agt_id: ["JOIN", "范围控制"], bel_dept: ["WHERE", "范围控制"], src_tbl: ["ON附加条件"], busi_date: ["ON附加条件"] },
    peers: { book_agt_id: ["pdata_n.t98_sb_otc_swap_comp_info.book_agt_id"] },
    questions: ["常速互换分支在最终标签结果中的占比", "账簿快照多匹配是否造成重复标签"],
  },
  "209119": {
    patternIds: ["P09_BOOK_REASSIGNMENT", "P13_BOOK_OUTPUT_ENRICHMENT"],
    uses: ["身份/代码映射", "属性补充", "计算或条件取值", "范围控制"],
    summary: "三条重映射规则分支都用目标表验证目标账簿存在；主查询分别读取原账簿Map_Undrl_Cd和目标账簿Bel_Dept/Cntr/名称，输出原/目标账簿及底层摘要映射。",
    differences: "五次物理读取至少分成三类别名角色：映射目标资格、原账簿标的映射、目标账簿属性；其中首个映射分支缺少src_tbl条件，是独立风险点。",
    confirmedOutputs: ["dm_rsk_n.otc_opt_sub_trd_info"],
    fields: { book_agt_id: ["JOIN", "身份/代码映射", "范围控制"], map_undrl_cd: ["SELECT", "IF/NVL回退", "身份/代码映射", "计算或条件取值"], bel_dept: ["SELECT", "属性补充"], cntr: ["SELECT", "属性补充"], src_tbl: ["FILTER"], busi_date: ["FILTER"] },
    peers: { book_agt_id: ["pdata_n.t03_otc_deri_agt_rela_adtnl_info.rela_book_agt_id", "pdata_n.t03_agt_rela_h.rela_agt_id"], map_undrl_cd: ["pdata_news_n.t02_tit_scr_base_info.undrl_clas"] },
    patternSlices: {
      P09_BOOK_REASSIGNMENT: {
        uses: ["身份/代码映射", "范围控制"],
        scopePrefixes: ["root.(child)"],
        summary: "三个映射分支以目标账簿Book_Agt_Id做存在性校验；首分支只有业务日期条件，另两支还有src_tbl条件。",
      },
      P13_BOOK_OUTPUT_ENRICHMENT: {
        uses: ["身份/代码映射", "属性补充", "计算或条件取值"],
        excludeScopePrefixes: ["root.(child)"],
        summary: "主查询的rb_ori/rb角色分别提供Map_Undrl_Cd以及Bel_Dept/Cntr，并绑定到目标输出字段。",
      },
    },
    questions: ["首个映射分支为何不限制src_tbl", "三条映射规则是否互斥且目标唯一", "原/目标账簿映射标的冲突时的业务口径"],
  },
};

const PATTERNS = {
  P01_DEPARTMENT_ENRICHMENT: ["部门属性补充", "账簿ID连接后输出部门；200078/200030无回退，215700以原风险部门回退", "同主题不同规则（回退差异）"],
  P02_OTC_BOOK_ELIGIBILITY: ["OTC账簿资格闸门", "账簿ID+修饰符内连接，限定当日OTC部门；不直接输出账簿字段", "局部规则一致（限定两类资产分支）"],
  P03_FICC_BOOK_SCOPE: ["GFS_FICC账簿范围", "按当日账簿和Bel_Dept=GFS_FICC限制合约/指标范围", "局部规则一致（范围相同，输出作用不同）"],
  P04_DUAL_BOOK_ROLE: ["双别名账簿角色", "一个别名校验账簿存在，另一个带有效期并补部门", "单例模式"],
  P05_DEPARTMENT_CLASSIFICATION: ["账簿属性驱动分类", "Bel_Dept/Bel_Co/Cntr进入CASE或标签分类；连接类型决定缺匹配是否留存", "同主题不同规则（字段与连接类型不同）"],
  P06_REPORTING_ELIGIBILITY: ["报送资格控制", "Rep_Fin_Flag或Rep_Risk_Flag参与范围过滤，标志不可互换", "同主题不同规则（标志不可互换）"],
  P07_BOOK_DIMENSION_PROJECTION: ["账簿维表投影", "以目标表为驱动，输出账簿属性和开关，再补名称/主体/代码描述", "同主题不同规则（范围与转换不同）"],
  P08_HK_CONTRACT_SCOPE: ["香港公司账簿范围", "Bel_Co=GFS_HK作为内连接资格条件", "单例模式"],
  P09_BOOK_REASSIGNMENT: ["原账簿到目标账簿重映射", "依据规则表/关系表形成目标账簿并由目标表验证存在", "同主题不同规则（规则来源与输出不同）"],
  P10_SPECIAL_SCOPE_EXCEPTION: ["部门条件加硬编码例外", "ED部门或合约/标的白名单，OR分支不可被归一化掉", "单例特殊规则"],
  P11_DYNAMIC_HEDGE_YIELD: ["动态对冲收益映射与汇总", "账簿提供动态对冲范围及映射/分组依据；收益数值来自持仓", "单例特殊规则"],
  P12_REVENUE_CONTRACT_SCOPE: ["创收常速互换范围", "OTC账簿条件与状态、日期、非内部互换条件共同限定一个UNION分支", "单例模式"],
  P13_BOOK_OUTPUT_ENRICHMENT: ["原/目标账簿属性并列输出", "原账簿提供映射标的，目标账簿提供部门和柜台", "单例模式"],
};

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function readGzipJson(path) {
  return JSON.parse(gunzipSync(readFileSync(path)).toString("utf8"));
}

function evidenceForTask(taskId) {
  const taskDir = join(DATA_ROOT, "task-projections", "tasks", taskId);
  const dir = join(taskDir, "versions");
  if (!existsSync(dir)) return null;
  const pointerPath = join(taskDir, "task-local-projection.json");
  if (!existsSync(pointerPath)) return null;
  const pointer = readJson(pointerPath);
  const expectedFile = pointer.cacheKey ? `${pointer.cacheKey}.evidence-v3.json` : "";
  const candidates = readdirSync(dir).filter((name) => name.endsWith(".evidence-v3.json"));
  const file = candidates.includes(expectedFile)
    ? expectedFile
    : candidates.length === 1 ? candidates[0] : null;
  if (!file) return null;
  const evidencePath = join(dir, file);
  return { evidencePath, evidence: readJson(evidencePath), pointer };
}

function physicalFields(value, result = []) {
  if (!value || typeof value !== "object") return result;
  if (Array.isArray(value)) {
    for (const item of value) physicalFields(item, result);
    return result;
  }
  if (
    typeof value.table === "string" &&
    value.table.toLowerCase() === TARGET_TABLE &&
    value.column
  ) {
    result.push(String(value.column).toLowerCase());
  }
  for (const child of Object.values(value)) physicalFields(child, result);
  return result;
}

function physicalFieldRefs(value, result = []) {
  if (!value || typeof value !== "object") return result;
  if (Array.isArray(value)) {
    for (const item of value) physicalFieldRefs(item, result);
    return result;
  }
  if (typeof value.table === "string" && value.column) {
    result.push({
      table: String(value.table).toLowerCase(),
      column: String(value.column).toLowerCase(),
    });
  }
  for (const child of Object.values(value)) physicalFieldRefs(child, result);
  return result;
}

function uniqueFieldRefs(refs) {
  const seen = new Set();
  return refs.filter((ref) => {
    const key = `${ref.table}.${ref.column}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function targetQualifiers(value, result = []) {
  if (!value || typeof value !== "object") return result;
  if (Array.isArray(value)) {
    for (const item of value) targetQualifiers(item, result);
    return result;
  }
  if (value.qualifier && physicalFieldRefs(value.physical ?? []).some((ref) => ref.table === TARGET_TABLE)) {
    result.push(String(value.qualifier));
  }
  for (const child of Object.values(value)) targetQualifiers(child, result);
  return [...new Set(result)];
}

function expressionAliases(expressionText, sourceField) {
  const escaped = sourceField.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matcher = new RegExp(`\\b([A-Za-z_][A-Za-z0-9_]*)\\s*\\.\\s*${escaped}\\b`, "ig");
  return [...new Set([...String(expressionText).matchAll(matcher)].map((match) => match[1]))];
}

function relationCondition(relation) {
  return relation.relation?.condition_expr
    ?? relation.relation?.predicate_expr
    ?? relation.relation?.predicate_display
    ?? relation.relation?.group_by_exprs_display?.join("; ")
    ?? relation.source_text
    ?? "";
}

function conditionAtoms(tree, result = []) {
  if (!tree || typeof tree !== "object") return result;
  if (tree.kind === "ATOM") result.push(tree);
  for (const child of tree.children ?? []) conditionAtoms(child, result);
  return result;
}

function atomText(atom) {
  const operator = {
    EQ: "=", NEQ: "!=", GT: ">", GTE: ">=", LT: "<", LTE: "<=",
  }[atom.operator] ?? atom.operator ?? "?";
  return (atom.operands ?? []).map((operand) => operand.expression ?? operand.kind).join(` ${operator} `);
}

function joinPairings(detail) {
  const atoms = conditionAtoms(detail.condition_tree);
  const additionalConditions = atoms
    .filter((atom) => !physicalFieldRefs(atom).some((ref) => ref.table === TARGET_TABLE))
    .map((atom) => ({ expression: atomText(atom), atom }));
  const pairings = [];
  for (const atom of atoms) {
    const operands = atom.operands ?? [];
    operands.forEach((operand, operandIndex) => {
      const operandRefs = uniqueFieldRefs(physicalFieldRefs(operand));
      const targetRefs = operandRefs.filter((ref) => ref.table === TARGET_TABLE);
      if (!targetRefs.length) return;
      const otherOperandRefs = uniqueFieldRefs(
        operands.flatMap((candidate, candidateIndex) => candidateIndex === operandIndex ? [] : physicalFieldRefs(candidate)),
      );
      const peerFields = otherOperandRefs
        .filter((ref) => ref.table !== TARGET_TABLE)
        .map((ref) => `${ref.table}.${ref.column}`).sort();
      const expressionSourceFields = operandRefs
        .filter((ref) => ref.table !== TARGET_TABLE)
        .map((ref) => `${ref.table}.${ref.column}`).sort();
      for (const targetRef of targetRefs) {
        pairings.push({
          targetRef,
          sourceAliases: targetQualifiers(operand),
          peerFields,
          expressionSourceFields,
          pairingStatus: expressionSourceFields.length ? "EXPRESSION_MULTI_SOURCE_TO_PEER" : "DIRECT_ATOM_PAIR",
          atomExpression: atomText(atom),
          atom,
          additionalConditions,
        });
      }
    });
  }
  return pairings;
}

function factUsagesForTask(evidence, taskId) {
  const usages = [];
  const relationById = new Map((evidence.relations ?? []).map((relation) => [relation.relation_id, relation]));
  const bindingsByExpression = new Map();
  for (const binding of evidence.bindings ?? []) {
    if (!bindingsByExpression.has(binding.expression_id)) bindingsByExpression.set(binding.expression_id, []);
    bindingsByExpression.get(binding.expression_id).push(binding);
  }

  function addUsage(usage) {
    const suffix = sha256(JSON.stringify({
      kind: usage.evidenceKind,
      source: usage.sourceField,
      type: usage.usageType,
      relation: usage.relationId,
      expression: usage.expressionId,
      output: usage.targetField,
      peers: usage.peerFields,
      expressionSources: usage.expressionSourceFields,
      pairing: usage.pairingStatus,
    })).slice(0, 12);
    usages.push({ factUsageId: `FU-${taskId}-${suffix}`, ...usage });
  }

  for (const io of evidence.datasetIo ?? []) {
    if (io.direction !== "READ" || io.physical_dataset?.toLowerCase() !== TARGET_TABLE) continue;
    for (const occurrence of io.read_occurrences ?? []) {
      addUsage({
        evidenceKind: "READ_OCCURRENCE",
        usageType: "物理读取定位",
        sourceField: "",
        sourceAliases: [],
        peerFields: [],
        relationId: occurrence.relation_id,
        expressionId: "",
        statementId: io.statement_id,
        scopeId: occurrence.scope_id,
        joinType: "",
        condition: "",
        sourceSpan: occurrence.source_span ?? null,
        targetDataset: "",
        targetField: "",
        writeObservationId: "",
        extraction: "FACTS_STRUCTURED",
      });
    }
  }

  for (const relation of evidence.relations ?? []) {
    const detail = relation.relation ?? {};
    const relationType = relation.relation_type;
    const allRefs = uniqueFieldRefs(physicalFieldRefs(detail));
    const targetRefs = allRefs.filter((ref) => ref.table === TARGET_TABLE);
    if (!targetRefs.length) continue;
    let usageType = null;
    if (relationType === "join") usageType = "JOIN关联";
    else if (relationType === "filter") usageType = "过滤条件";
    else if (relationType === "window") usageType = "窗口条件";

    if (relationType === "join") {
      const pairings = joinPairings(detail);
      for (const pairing of pairings) {
        addUsage({
          evidenceKind: "RELATION",
          usageType: "JOIN关联",
          sourceField: pairing.targetRef.column,
          sourceAliases: pairing.sourceAliases,
          peerFields: pairing.peerFields,
          expressionSourceFields: pairing.expressionSourceFields,
          pairingStatus: pairing.pairingStatus,
          relationId: relation.relation_id,
          expressionId: "",
          statementId: relation.statement_id,
          scopeId: detail.scope_id ?? "",
          joinType: detail.join_type ?? "",
          condition: pairing.atomExpression,
          fullCondition: relationCondition(relation),
          conditionPreview: detail.condition_display ?? "",
          conditionTree: detail.condition_tree ?? null,
          additionalConditions: pairing.additionalConditions,
          sourceText: relation.source_text ?? "",
          sourceSpan: relation.source_span ?? detail.span ?? null,
          targetDataset: "",
          targetField: "",
          writeObservationId: "",
          extraction: "FACTS_CONDITION_TREE_ATOM_PAIR",
        });
      }
    } else if (usageType) {
      for (const targetRef of targetRefs) {
        addUsage({
          evidenceKind: "RELATION",
          usageType,
          sourceField: targetRef.column,
          sourceAliases: targetQualifiers(detail),
          peerFields: [],
          expressionSourceFields: [],
          pairingStatus: "NOT_APPLICABLE",
          relationId: relation.relation_id,
          expressionId: "",
          statementId: relation.statement_id,
          scopeId: detail.scope_id ?? "",
          joinType: detail.join_type ?? "",
          condition: relationCondition(relation),
          fullCondition: relationCondition(relation),
          conditionPreview: detail.condition_display ?? detail.predicate_display ?? "",
          conditionTree: detail.condition_tree ?? detail.predicate_tree ?? null,
          additionalConditions: [],
          sourceText: relation.source_text ?? "",
          sourceSpan: relation.source_span ?? detail.span ?? null,
          targetDataset: "",
          targetField: "",
          writeObservationId: "",
          extraction: "FACTS_STRUCTURED",
        });
      }
    }

    if (relationType === "aggregate") {
      const groupRefs = uniqueFieldRefs(physicalFieldRefs(detail.group_by ?? []))
        .filter((ref) => ref.table === TARGET_TABLE);
      const measureRefs = uniqueFieldRefs(physicalFieldRefs(detail.measures ?? []))
        .filter((ref) => ref.table === TARGET_TABLE);
      for (const targetRef of groupRefs) {
        addUsage({
          evidenceKind: "RELATION",
          usageType: "分组键",
          sourceField: targetRef.column,
          sourceAliases: targetQualifiers(detail.group_by ?? []),
          peerFields: [],
          expressionSourceFields: uniqueFieldRefs(physicalFieldRefs(detail.group_by ?? []))
            .filter((ref) => ref.table !== TARGET_TABLE)
            .map((ref) => `${ref.table}.${ref.column}`).sort(),
          pairingStatus: "GROUP_BY_CO_INPUTS",
          relationId: relation.relation_id,
          expressionId: "",
          statementId: relation.statement_id,
          scopeId: detail.scope_id ?? "",
          joinType: "",
          condition: (detail.group_by_exprs_display ?? detail.group_by_exprs ?? []).join("; "),
          sourceSpan: relation.source_span ?? detail.span ?? null,
          targetDataset: "",
          targetField: "",
          writeObservationId: "",
          extraction: "FACTS_STRUCTURED",
        });
      }
      for (const targetRef of measureRefs) {
        addUsage({
          evidenceKind: "RELATION",
          usageType: "聚合取值",
          sourceField: targetRef.column,
          sourceAliases: targetQualifiers(detail.measures ?? []),
          peerFields: [],
          expressionSourceFields: uniqueFieldRefs(physicalFieldRefs(detail.measures ?? []))
            .filter((ref) => ref.table !== TARGET_TABLE)
            .map((ref) => `${ref.table}.${ref.column}`).sort(),
          pairingStatus: "AGGREGATE_CO_INPUTS",
          relationId: relation.relation_id,
          expressionId: "",
          statementId: relation.statement_id,
          scopeId: detail.scope_id ?? "",
          joinType: "",
          condition: (detail.measures ?? []).map((measure) => measure.display_text).filter(Boolean).join("; "),
          sourceSpan: relation.source_span ?? detail.span ?? null,
          targetDataset: "",
          targetField: "",
          writeObservationId: "",
          extraction: "FACTS_STRUCTURED",
        });
      }
    }
  }

  for (const expression of evidence.expressions ?? []) {
    const targetRefs = uniqueFieldRefs(physicalFieldRefs(expression.input_fields ?? []))
      .filter((ref) => ref.table === TARGET_TABLE);
    if (!targetRefs.length) continue;
    const relation = relationById.get(expression.relation_id);
    const relationText = String(relation?.source_text ?? "").trim();
    const wildcardProjection = /^select\s+(?:\w+\.)?\*/i.test(relationText);
    const expressionText = String(expression.expression_text ?? "");
    const conditional = /\b(case|if|nvl|coalesce|decode)\s*\(/i.test(expressionText)
      || /\bcase\b/i.test(expressionText);
    const calculated = conditional || /[+\-*\/]/.test(expressionText) || /\w+\s*\(/.test(expressionText);
    const bindings = bindingsByExpression.get(expression.expression_id) ?? [];

    for (const targetRef of targetRefs) {
      if (bindings.length) {
        for (const binding of bindings) {
          addUsage({
            evidenceKind: "OUTPUT_BINDING",
            usageType: conditional ? "条件/回退取值" : calculated ? "计算取值" : "输出取值",
            sourceField: targetRef.column,
            sourceAliases: expressionAliases(expressionText, targetRef.column),
            peerFields: [],
            expressionSourceFields: uniqueFieldRefs(physicalFieldRefs(expression.input_fields ?? []))
              .filter((ref) => ref.table !== TARGET_TABLE)
              .map((ref) => `${ref.table}.${ref.column}`).sort(),
            pairingStatus: "EXPRESSION_CO_INPUTS",
            relationId: expression.relation_id,
            expressionId: expression.expression_id,
            statementId: expression.statement_id,
            scopeId: relation?.relation?.scope_id ?? "",
            joinType: "",
            condition: expressionText,
            sourceSpan: expression.source_span ?? null,
            targetDataset: binding.target_dataset,
            targetField: binding.target_field,
            writeObservationId: binding.write_observation_id,
            bindingStatus: binding.binding_status,
            inputDependencyStatus: expression.input_dependency_status,
            extraction: "FACTS_STRUCTURED_LINKED",
          });
        }
      } else {
        addUsage({
          evidenceKind: "EXPRESSION",
          usageType: wildcardProjection
            ? "源侧通配投影（未证明下游使用）"
            : conditional ? "条件/回退取值"
              : calculated ? "计算取值" : "中间投影",
          sourceField: targetRef.column,
          sourceAliases: expressionAliases(expressionText, targetRef.column),
          peerFields: [],
          expressionSourceFields: uniqueFieldRefs(physicalFieldRefs(expression.input_fields ?? []))
            .filter((ref) => ref.table !== TARGET_TABLE)
            .map((ref) => `${ref.table}.${ref.column}`).sort(),
          pairingStatus: "EXPRESSION_CO_INPUTS",
          relationId: expression.relation_id,
          expressionId: expression.expression_id,
          statementId: expression.statement_id,
          scopeId: relation?.relation?.scope_id ?? "",
          joinType: "",
          condition: expressionText,
          sourceSpan: expression.source_span ?? null,
          targetDataset: "",
          targetField: expression.output_name ?? "",
          writeObservationId: "",
          extraction: wildcardProjection ? "FACTS_WILDCARD_EXPANSION" : "FACTS_STRUCTURED",
        });
      }
    }
  }

  return usages;
}

function relevantOutputBindingsForTask(evidence, taskId) {
  const expressionById = new Map((evidence.expressions ?? []).map((expression) => [expression.expression_id, expression]));
  const contextualTargets = taskId === "230202" ? new Set(["tdy_yield", "undrl_tdy_yield"]) : new Set();
  return (evidence.bindings ?? []).flatMap((binding) => {
    const expression = expressionById.get(binding.expression_id);
    if (!expression) return [];
    const inputFields = uniqueFieldRefs(physicalFieldRefs(expression.input_fields ?? []));
    if (!inputFields.some((ref) => ref.table === TARGET_TABLE) && !contextualTargets.has(binding.target_field)) return [];
    return [{
      bindingId: binding.binding_id,
      bindingStatus: binding.binding_status,
      inputDependencyStatus: expression.input_dependency_status,
      targetDataset: binding.target_dataset,
      targetField: binding.target_field,
      writeObservationId: binding.write_observation_id,
      expressionId: binding.expression_id,
      expressionText: expression.expression_text,
      inputFields,
      sourceSqlSha256: binding.source_sql_sha256,
      provenance: "FACTS_STRUCTURED_LINKED",
    }];
  });
}

function sqlLocations(evidence) {
  const locations = [];
  for (const source of evidence.sqlSources ?? []) {
    const lines = String(source.content ?? "").split(/\r?\n/);
    lines.forEach((line, index) => {
      if (line.toLowerCase().includes(TARGET_TABLE)) {
        locations.push({ slot: source.slot, line: index + 1, text: line.trim() });
      }
    });
  }
  return locations;
}

function relevantMaterial(evidence) {
  const sources = (evidence.sqlSources ?? []).map((source) => ({
    slot: source.slot,
    sha256: sha256(String(source.content ?? "")),
    bytes: Buffer.byteLength(String(source.content ?? ""), "utf8"),
    containsTargetLiteral: String(source.content ?? "").toLowerCase().includes(TARGET_TABLE),
  }));
  const relevant = sources.filter((source) => source.containsTargetLiteral);
  const material = relevant.length ? relevant : sources;
  return {
    sources,
    relevant,
    groupHash: sha256(material.map((s) => `${s.slot}:${s.sha256}`).sort().join("\n")),
  };
}

function csvValue(value) {
  const text = Array.isArray(value) ? value.join("；") : String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function writeCsv(name, columns, rows) {
  const text = [
    columns.map(([title]) => csvValue(title)).join(","),
    ...rows.map((row) => columns.map(([, key]) => csvValue(row[key])).join(",")),
  ].join("\r\n");
  writeFileSync(join(OUT_DIR, name), `\uFEFF${text}\r\n`, "utf8");
}

const startedAt = new Date();
const baseline = readGzipJson(join(BASELINE_DIR, "baseline-cache.json.gz"));
const annotations = readGzipJson(join(BASELINE_DIR, "metadata-annotations.json.gz"));
if (baseline.graphVersion !== GRAPH_VERSION || annotations.graphVersion !== GRAPH_VERSION) {
  throw new Error("Baseline and metadata versions do not match the fixed pilot version.");
}

const tableById = new Map(baseline.tables.map((table) => [table.id, table]));
const annotationById = new Map(annotations.tables.map((table) => [table.datasetId, table]));
const baselineReadRows = baseline.readRows.filter((row) => row.datasetId === TARGET_DATASET);
const consumerTaskIds = [...new Set(baselineReadRows.map((row) => row.taskId))].sort(
  (a, b) => Number(a) - Number(b),
);
const baselineOccurrenceByTask = new Map();
for (const row of baselineReadRows) {
  const detail = JSON.parse(row.detail);
  if (!baselineOccurrenceByTask.has(row.taskId)) baselineOccurrenceByTask.set(row.taskId, []);
  baselineOccurrenceByTask.get(row.taskId).push(detail.readOccurrenceId);
}

const taskRows = [];
const taskEvidence = new Map();
for (const taskId of consumerTaskIds) {
  const loaded = evidenceForTask(taskId);
  const writes = baseline.writeRows.filter((row) => row.taskId === taskId);
  const targets = writes.map((row) => {
    const table = tableById.get(row.datasetId);
    const annotation = annotationById.get(row.datasetId);
    return {
      datasetId: row.datasetId,
      table: table?.table ?? row.datasetId,
      comment: annotation?.tableComment ?? "未提供中文注释",
      writeObservationId: JSON.parse(row.detail).writeObservationId,
      status: row.status,
    };
  });
  let availability = "MISSING_EVIDENCE";
  let correspondence = "NOT_CHECKED";
  let materialGroupId = "";
  let material = null;
  let taskName = "";
  let factsManifestSha256 = "";
  let factsCurrentWrites = [];
  let factsBindingTargets = [];
  if (loaded) {
    const { evidence, evidencePath } = loaded;
    taskName = evidence.taskName ?? "";
    material = relevantMaterial(evidence);
    materialGroupId = `SQLG-${material.groupHash.slice(0, 16)}`;
    const currentOccurrences = new Set(
      (evidence.datasetIo ?? [])
        .filter((io) => io.physical_dataset?.toLowerCase() === TARGET_TABLE)
        .flatMap((io) => io.read_occurrences ?? [])
        .map((occurrence) => occurrence.occurrence_id),
    );
    const fixedOccurrences = baselineOccurrenceByTask.get(taskId) ?? [];
    correspondence = fixedOccurrences.every((id) => currentOccurrences.has(id))
      ? "FIXED_READ_LOCATORS_PRESENT_IN_CURRENT_FACTS"
      : "FIXED_READ_LOCATOR_MISSING_IN_CURRENT_FACTS";
    factsManifestSha256 = loaded.pointer.cacheKeyParts?.factsManifestSha256 ?? "";
    factsCurrentWrites = (evidence.datasetIo ?? [])
      .filter((io) => io.direction === "WRITE")
      .map((io) => `${io.physical_dataset}|${io.provenance}|${io.statement_id ?? "NO_STATEMENT"}`);
    factsBindingTargets = [...new Set((evidence.bindings ?? []).map((binding) => binding.target_dataset).filter(Boolean))].sort();
    availability = "AVAILABLE";
    taskEvidence.set(taskId, {
      ...loaded,
      material,
      factsManifestSha256,
      correspondence,
      sqlLocations: sqlLocations(evidence),
    });
  }
  const review = REVIEWS[taskId];
  let reviewStatus = "未进入Facts细粒度提取范围（达到20个不同SQL材料组上限）";
  if (review) reviewStatus = "已完成Facts细粒度提取与局部解释";
  if (taskId === "200030") reviewStatus = "复用局部解释（与200078目标引用SQL完全相同）";
  taskRows.push({
    sourceDatasetId: TARGET_DATASET,
    platform: "hive",
    dataSource: "gfhive",
    sourceTable: TARGET_TABLE,
    sourceComment: annotationById.get(TARGET_DATASET)?.tableComment ?? "账簿附加信息表",
    taskId,
    taskName,
    candidateOutputs: targets.map((t) => `${t.table}（${t.comment}）`),
    candidateOutputCount: targets.length,
    concreteWrites: targets.map((t) => t.writeObservationId),
    materialGroupId,
    materialHashes: material?.relevant.map((s) => `${s.slot}:${s.sha256}`) ?? [],
    evidenceAvailability: availability,
    versionCorrespondence: correspondence,
    contentBindingLevel: ["200078", "230202"].includes(taskId)
      ? "FIXED_SQL_AND_FACTS_HASH_MATCH"
      : taskId === "200030"
        ? "CURRENT_SQL_EXACT_REUSE_WITH_200078; CROSS_VERSION_SEMANTICS_UNVERIFIED"
        : "LOCATOR_PRESENCE_ONLY; CROSS_VERSION_SEMANTICS_UNVERIFIED",
    reviewStatus,
    patternIds: review?.patternIds ?? (taskId === "200030" ? REVIEWS["200078"].patternIds : []),
    confirmedOutputs: review?.confirmedOutputs ?? (taskId === "200030" ? ["dm_otc_n.adm_v_risk_daily_bundle_margin"] : []),
    gaps: review?.questions ?? (taskId === "200030" ? REVIEWS["200078"].questions : ["未进入20个SQL材料组核读范围，不能判定具体使用模式或受影响输出"]),
    factsManifestSha256,
    factsCurrentWrites,
    factsBindingTargets,
    evidencePath: loaded?.evidencePath ?? "",
  });
}

const exactReuseGroup = taskRows.find((row) => row.taskId === "200078")?.materialGroupId;
if (!exactReuseGroup || taskRows.find((row) => row.taskId === "200030")?.materialGroupId !== exactReuseGroup) {
  throw new Error("Expected 200030 and 200078 to share the target-reference SQL material group.");
}

const reviewedTaskIds = new Set([...REVIEW_TASKS, "200030"]);
const evidenceRecords = [];
for (const taskId of [...reviewedTaskIds].sort((a, b) => Number(a) - Number(b))) {
  const basisTaskId = taskId === "200030" ? "200078" : taskId;
  const review = REVIEWS[basisTaskId];
  const task = taskRows.find((row) => row.taskId === taskId);
  const loaded = taskEvidence.get(taskId);
  if (!task || !loaded) throw new Error(`Missing reviewed task evidence: ${taskId}`);
  const { evidence } = loaded;
  const factUsages = factUsagesForTask(evidence, taskId);
  const relevantOutputBindings = relevantOutputBindingsForTask(evidence, taskId);
  const targetRelations = (evidence.relations ?? [])
    .filter((relation) => physicalFields(relation).length > 0)
    .map((relation) => ({
      relationId: relation.relation_id,
      relationType: relation.relation_type,
      sourceText: relation.source_text ?? relation.relation?.condition_display ?? relation.relation?.predicate_display ?? "",
      fullCondition: relationCondition(relation),
      conditionPreview: relation.relation?.condition_display ?? relation.relation?.predicate_display ?? "",
      conditionTree: relation.relation?.condition_tree ?? relation.relation?.predicate_tree ?? null,
      joinType: relation.relation?.join_type ?? "",
      targetFields: [...new Set(physicalFields(relation))].sort(),
      sourceSpan: relation.source_span ?? relation.relation?.span ?? null,
      statementId: relation.statement_id,
    }));
  const targetExpressions = (evidence.expressions ?? [])
    .filter((expression) => physicalFields(expression).length > 0)
    .map((expression) => ({
      expressionId: expression.expression_id,
      expressionText: expression.expression_text,
      outputName: expression.output_name,
      targetFields: [...new Set(physicalFields(expression))].sort(),
      relationId: expression.relation_id,
      sourceSpan: expression.source_span ?? null,
    }));
  const readOccurrences = (evidence.datasetIo ?? [])
    .filter((io) => io.physical_dataset?.toLowerCase() === TARGET_TABLE)
    .flatMap((io) => io.read_occurrences ?? [])
    .map((occurrence, index) => ({
      evidenceId: `E-${taskId}-R${String(index + 1).padStart(2, "0")}`,
      ...occurrence,
    }));
  evidenceRecords.push({
    evidenceId: `E-${taskId}`,
    taskId,
    taskName: task.taskName,
    reviewBasis: taskId === "200030"
      ? "EXACT_TARGET_REFERENCE_SQL_REUSE_FROM_200078"
      : "FACTS_STRUCTURED_EXTRACTION_WITH_LOCAL_BUSINESS_INTERPRETATION",
    materialGroupId: task.materialGroupId,
    targetOutputs: task.confirmedOutputs,
    businessInterpretation: {
      uses: review.uses,
      summary: review.summary,
      differences: review.differences,
      provenance: "MODEL_INTERPRETATION_OF_LOCAL_FACTS",
    },
    questions: review.questions,
    sql: {
      slots: loaded.material.sources,
      locations: loaded.sqlLocations,
      evidencePath: loaded.evidencePath,
    },
    facts: {
      factsManifestSha256: loaded.factsManifestSha256,
      correspondence: loaded.correspondence,
      currentWrites: task.factsCurrentWrites,
      bindingTargets: task.factsBindingTargets,
      baselineReadOccurrenceIds: baselineOccurrenceByTask.get(taskId) ?? [],
      readOccurrences,
      targetRelations,
      targetExpressions,
      atomicUsages: factUsages,
      relevantOutputBindings,
    },
    uncertainty: [
      "静态SQL与Facts不证明任务运行成功、数据到达或业务结果正确。",
      "未核数据侧唯一性、匹配率和JOIN前后行数；潜在多匹配不等于已发生倍增。",
    ],
  });
}

function requireFactUsage(taskId, predicate, description) {
  const record = evidenceRecords.find((item) => item.taskId === taskId);
  if (!record?.facts.atomicUsages.some(predicate)) {
    throw new Error(`Facts regression anchor failed for task ${taskId}: ${description}`);
  }
}

for (const record of evidenceRecords) {
  const availableOutputs = new Set([
    ...record.facts.bindingTargets,
    ...record.facts.currentWrites.map((write) => write.split("|")[0]),
  ]);
  const missingOutputs = record.targetOutputs.filter((output) => !availableOutputs.has(output));
  if (missingOutputs.length) {
    throw new Error(`Reviewed output is not present in current Facts for task ${record.taskId}: ${missingOutputs.join(", ")}`);
  }
}

requireFactUsage("200078", (usage) => usage.usageType === "JOIN关联" && usage.joinType === "left" && usage.sourceField === "book_agt_id", "left book join");
requireFactUsage("200078", (usage) => usage.evidenceKind === "OUTPUT_BINDING" && usage.sourceField === "bel_dept" && usage.targetField === "department", "department output binding");
const task209119 = evidenceRecords.find((record) => record.taskId === "209119");
if (task209119?.facts.readOccurrences.length !== 5) throw new Error("Facts regression anchor failed for task 209119: five target reads");
requireFactUsage("209119", (usage) => usage.usageType === "过滤条件" && usage.scopeId?.startsWith("root.(child)") && /busi_date/i.test(usage.condition) && !/src_tbl/i.test(usage.condition), "mapping branch without src_tbl");
requireFactUsage("209119", (usage) => usage.evidenceKind === "OUTPUT_BINDING" && usage.sourceField === "map_undrl_cd" && usage.targetField === "underlying_summary_mapping", "mapping output binding");
requireFactUsage("230202", (usage) => usage.usageType === "JOIN关联" && usage.joinType === "inner" && usage.sourceField === "book_agt_id", "dynamic hedge inner join");
requireFactUsage("230202", (usage) => usage.usageType === "过滤条件" && /DYNAMIC_HEDGING/.test(usage.condition), "dynamic hedge filter");
requireFactUsage("230202", (usage) => usage.usageType === "条件/回退取值" && usage.sourceField === "map_undrl_cd", "mapping fallback expression");
requireFactUsage("230202", (usage) => usage.usageType === "分组键" && usage.sourceField === "map_undrl_cd", "mapped underlying group key");
const task230202 = evidenceRecords.find((record) => record.taskId === "230202");
const yieldBinding = task230202?.facts.relevantOutputBindings.find((binding) => binding.targetField === "undrl_tdy_yield");
if (!yieldBinding?.inputFields.some((field) => field.table === "pdata_n.t98_otc_book_hold_sum" && field.column === "tdy_yield")) {
  throw new Error("Facts regression anchor failed for task 230202: yield value must come from holdings");
}
const allAtomicUsages = evidenceRecords.flatMap((record) => record.facts.atomicUsages);
const fullConditionTruncationCount = allAtomicUsages.filter((usage) => /…|\.\.\./.test(usage.fullCondition ?? "")).length;
const conditionPreviewTruncationCount = allAtomicUsages.filter((usage) => /…|\.\.\./.test(usage.conditionPreview ?? "")).length;
if (fullConditionTruncationCount !== 0) throw new Error("Full Facts conditions must not use truncated display strings");
const task209119NameJoin = task209119.facts.atomicUsages.find((usage) =>
  usage.relationId === "task:209119:statement:0:relation:root.casttable.rb.join.1"
  && usage.sourceField === "book_agt_id"
);
if (JSON.stringify(task209119NameJoin?.peerFields) !== JSON.stringify(["pdata_n.t03_agt_name_h.agt_id"])) {
  throw new Error("JOIN atom pairing regression failed for task 209119 book/name join");
}
const task230202MappedJoin = task230202.facts.atomicUsages.find((usage) =>
  usage.relationId === "task:230202:statement:0:relation:root.casttable.join.5"
  && usage.sourceField === "map_undrl_cd"
);
if (
  JSON.stringify(task230202MappedJoin?.peerFields) !== JSON.stringify(["pdata_n.t98_otc_deri_comp_sale_info.undrl_wd_cd"])
  || JSON.stringify(task230202MappedJoin?.expressionSourceFields) !== JSON.stringify(["pdata_news_n.t02_tit_scr_base_info.undrl_clas"])
) {
  throw new Error("JOIN atom pairing regression failed for task 230202 mapped-underlying join");
}

const factRegressionAnchors = {
  "200078": ["LEFT JOIN book_agt_id", "bel_dept -> output department"],
  "209119": ["five target reads", "mapping branch without src_tbl", "map_undrl_cd -> underlying_summary_mapping"],
  "230202": ["INNER JOIN book_agt_id", "DYNAMIC_HEDGING filter", "IF/NVL fallback", "map_undrl_cd group key", "yield value from t98_otc_book_hold_sum.tdy_yield"],
};
const conditionEvidenceChecks = {
  fullConditionTruncationCount,
  conditionPreviewTruncationCount,
  task209119NameJoin: {
    peerFields: task209119NameJoin.peerFields,
    additionalConditions: task209119NameJoin.additionalConditions.map((condition) => condition.expression),
  },
  task230202MappedJoin: {
    peerFields: task230202MappedJoin.peerFields,
    expressionSourceFields: task230202MappedJoin.expressionSourceFields,
    additionalConditions: task230202MappedJoin.additionalConditions.map((condition) => condition.expression),
  },
};

function patternSlice(record, patternId) {
  const review = REVIEWS[record.taskId === "200030" ? "200078" : record.taskId];
  const config = review.patternSlices?.[patternId] ?? null;
  let factUsages = record.facts.atomicUsages.filter((usage) => ![
    "物理读取定位",
    "源侧通配投影（未证明下游使用）",
    "中间投影",
  ].includes(usage.usageType));
  if (config?.usageTypes) {
    factUsages = factUsages.filter((usage) => config.usageTypes.includes(usage.usageType));
  }
  if (config?.excludeUsageTypes) {
    factUsages = factUsages.filter((usage) => !config.excludeUsageTypes.includes(usage.usageType));
  }
  if (config?.scopePrefixes) {
    factUsages = factUsages.filter((usage) => config.scopePrefixes.some((prefix) => usage.scopeId?.startsWith(prefix)));
  }
  if (config?.excludeScopePrefixes) {
    factUsages = factUsages.filter((usage) => !config.excludeScopePrefixes.some((prefix) => usage.scopeId?.startsWith(prefix)));
  }
  return {
    factUsages,
    businessUses: config?.uses ?? review.uses,
    summary: config?.summary ?? review.summary,
    provenance: config ? "EXPLICIT_PATTERN_FACT_SLICE" : "SINGLE_PATTERN_TASK_FACT_SLICE",
  };
}

const patternRows = [];
for (const [patternId, [name, distinction, groupingLevel]] of Object.entries(PATTERNS)) {
  const memberTasks = evidenceRecords
    .filter((record) => (REVIEWS[record.taskId === "200030" ? "200078" : record.taskId]?.patternIds ?? []).includes(patternId));
  const fields = new Set();
  const structuralUses = new Set();
  const businessUses = new Set();
  const evidenceIds = [];
  const factUsageIds = [];
  const keyConditions = [];
  const sliceProvenance = new Set();
  for (const record of memberTasks) {
    const slice = patternSlice(record, patternId);
    for (const usage of slice.factUsages) {
      if (usage.sourceField) fields.add(usage.sourceField);
      structuralUses.add(usage.usageType);
      factUsageIds.push(usage.factUsageId);
    }
    slice.businessUses.forEach((use) => businessUses.add(use));
    evidenceIds.push(record.evidenceId);
    keyConditions.push(`${record.taskId}: ${slice.summary}`);
    sliceProvenance.add(slice.provenance);
  }
  patternRows.push({
    patternId,
    name,
    members: memberTasks.map((record) => `${record.taskId}->${record.targetOutputs.join("|")}`),
    memberTaskCount: memberTasks.length,
    keyFields: [...fields].sort(),
    structuralUses: [...structuralUses].sort(),
    businessUses: [...businessUses],
    keyConditions,
    distinction,
    evidenceIds,
    factUsageIds: [...new Set(factUsageIds)].sort(),
    sliceProvenance: [...sliceProvenance].sort(),
    groupingLevel,
  });
}

const multiPatternSliceChecks = {};
for (const record of evidenceRecords) {
  const review = REVIEWS[record.taskId === "200030" ? "200078" : record.taskId];
  if ((review.patternIds ?? []).length < 2) continue;
  const slices = review.patternIds.map((patternId) => ({
    patternId,
    ids: new Set(patternSlice(record, patternId).factUsages.map((usage) => usage.factUsageId)),
  }));
  if (slices.some((slice) => slice.ids.size === 0)) {
    throw new Error(`Empty Facts pattern slice for task ${record.taskId}`);
  }
  const overlaps = [];
  for (let left = 0; left < slices.length; left += 1) {
    for (let right = left + 1; right < slices.length; right += 1) {
      for (const id of slices[left].ids) {
        if (slices[right].ids.has(id)) overlaps.push(id);
      }
    }
  }
  if (overlaps.length) throw new Error(`Overlapping Facts pattern slices for task ${record.taskId}: ${overlaps.join(", ")}`);
  multiPatternSliceChecks[record.taskId] = Object.fromEntries(slices.map((slice) => [slice.patternId, slice.ids.size]));
}

const fieldAccumulator = new Map();
for (const record of evidenceRecords) {
  for (const usage of record.facts.atomicUsages.filter((item) => item.sourceField)) {
    const peers = usage.peerFields ?? [];
    const expressionSources = usage.expressionSourceFields ?? [];
    const key = `${usage.sourceField}|${peers.slice().sort().join(";")}|${expressionSources.slice().sort().join(";")}|${usage.usageType}`;
    if (!fieldAccumulator.has(key)) {
      fieldAccumulator.set(key, {
        sourceField: usage.sourceField,
        peerFields: peers,
        expressionSourceFields: expressionSources,
        usageType: usage.usageType,
        sourceAliases: new Set(),
        scopes: new Set(),
        tasks: new Set(),
        groups: new Set(),
        evidenceIds: new Set(),
        factUsageIds: new Set(),
        conditionExamples: new Set(),
      });
    }
    const item = fieldAccumulator.get(key);
    item.tasks.add(record.taskId);
    item.groups.add(record.materialGroupId);
    item.evidenceIds.add(record.evidenceId);
    item.factUsageIds.add(usage.factUsageId);
    (usage.sourceAliases ?? []).forEach((alias) => item.sourceAliases.add(alias));
    if (usage.scopeId) item.scopes.add(usage.scopeId);
    if (usage.condition) item.conditionExamples.add(usage.condition.replace(/\s+/g, " ").slice(0, 240));
  }
}
const sourceFieldComments = annotationById.get(TARGET_DATASET)?.fieldComments ?? {};
const fieldRows = [...fieldAccumulator.values()]
  .map((item) => ({
    sourceField: item.sourceField,
    sourceFieldComment: sourceFieldComments[item.sourceField] ?? "未提供中文注释",
    peerFields: item.peerFields,
    expressionSourceFields: item.expressionSourceFields,
    usageType: item.usageType,
    sourceAliases: [...item.sourceAliases].sort(),
    scopes: [...item.scopes].sort(),
    consumerTaskCount: item.tasks.size,
    sqlGroupCount: item.groups.size,
    taskIds: [...item.tasks].sort((a, b) => Number(a) - Number(b)),
    evidenceIds: [...item.evidenceIds].sort(),
    factUsageIds: [...item.factUsageIds].sort(),
    conditionExamples: [...item.conditionExamples].slice(0, 3),
    denominator: "20个直接核读SQL材料组覆盖的21个任务（含200030对200078的完全相同目标引用SQL复用）；按任务去重",
  }))
  .sort((a, b) => b.consumerTaskCount - a.consumerTaskCount || a.sourceField.localeCompare(b.sourceField) || a.usageType.localeCompare(b.usageType));

const materialGroups = new Map();
for (const row of taskRows) {
  if (!materialGroups.has(row.materialGroupId)) materialGroups.set(row.materialGroupId, []);
  materialGroups.get(row.materialGroupId).push(row.taskId);
}
const selectedGroupIds = new Set(REVIEW_TASKS.map((taskId) => taskRows.find((row) => row.taskId === taskId).materialGroupId));
if (selectedGroupIds.size !== 20) throw new Error(`Review selection must contain 20 distinct SQL material groups, got ${selectedGroupIds.size}.`);

const downstreamDatasetIds = new Set(
  baseline.tablePairs.filter((pair) => pair.source === TARGET_DATASET).map((pair) => pair.target),
);
const targetDegree = baseline.degrees.find((degree) => degree.dataset === TARGET_DATASET);
const totalConcreteWrites = taskRows.reduce((total, row) => total + row.candidateOutputCount, 0);
const fixedHashEvidence = {
  "200078": {
    expectedQuerySha256: "0b5f60959ef74bf1a28a7c9fc438e563f44a75712336a9373a68a0959fc6c582",
    expectedFactsManifestSha256: "71460fa1d55f37d0c47edd8e32d0b0ec61ab8508ddaea68109c487422beffee9",
  },
  "230202": {
    expectedQuerySha256: "fa1695538980201e7f95e5904b39db2115c50872b8aec38a23e0aa239daacb2e",
    expectedFactsManifestSha256: "9677f40654415d13613fd87ef2b2734a271237a521588c5e6bb22de62083f8f5",
  },
};
for (const [taskId, expected] of Object.entries(fixedHashEvidence)) {
  const loaded = taskEvidence.get(taskId);
  const actualQuery = loaded.material.sources.find((source) => source.slot === "query")?.sha256;
  if (actualQuery !== expected.expectedQuerySha256 || loaded.factsManifestSha256 !== expected.expectedFactsManifestSha256) {
    throw new Error(`Fixed prior evidence hash mismatch for task ${taskId}.`);
  }
}

const evidenceJson = {
  documentType: "book-consumption-pilot-evidence",
  generatedAt: new Date().toISOString(),
  target: {
    datasetId: TARGET_DATASET,
    identity: { platform: "hive", dataSource: "gfhive", qualifiedName: TARGET_TABLE },
    tableComment: annotationById.get(TARGET_DATASET)?.tableComment ?? "账簿附加信息表",
    identityStatus: tableById.get(TARGET_DATASET)?.identityStatus,
  },
  version: {
    fixedGraphVersion: GRAPH_VERSION,
    baselineGeneratedAt: baseline.generatedAt,
    metadataAnnotatedAt: annotations.annotatedAt,
    baselineCacheSha256OfUncompressedJson: readJson(join(BASELINE_DIR, "baseline-run.json")).files["baseline-cache.json.gz"].sha256OfUncompressedJson,
    oldBatchManifestStatus: "MISSING_AT_REVIEW_TIME",
    bindingMethod: "The fixed baseline provides the complete task/read-occurrence inventory. Presence of the same readOccurrenceId in current Facts proves locator continuity only, not cross-version semantic equivalence. Tasks 200078 and 230202 additionally match the previously recorded SQL and Facts-manifest hashes exactly.",
    fixedHashEvidence,
  },
  scope: {
    directConsumerTasks: consumerTaskIds.length,
    distinctDownstreamTables: downstreamDatasetIds.size,
    concreteWriteObservations: totalConcreteWrites,
    distinctTargetReferenceSqlMaterialGroups: materialGroups.size,
    reviewedSqlMaterialGroups: selectedGroupIds.size,
    directlyReviewedTasks: REVIEW_TASKS.length,
    exactSqlReuseTasks: 1,
    reviewedTasksIncludingReuse: reviewedTaskIds.size,
    unreviewedTasks: consumerTaskIds.length - reviewedTaskIds.size,
    selectionBasis: "包含既有200078/230202；覆盖14个下游schema、属性/映射/范围/计算/粒度变化候选、简单维表投影、多别名和多输出任务；达到20组上限后停止。",
  },
  evidenceLayers: {
    programmaticFacts: [
      "datasetIo[].read_occurrences and WRITE records",
      "relations[].relation join/filter/aggregate structure and physical columns",
      "expressions[].input_fields/expression_text/output_name",
      "bindings[].target_dataset/target_field/write_observation_id/expression_id",
    ],
    factsTextReadOnDemand: ["relations[].source_text", "expressions[].expression_text"],
    modelInterpretation: ["business pattern name", "business use", "difference explanation", "manual question"],
    notProvableByStaticFacts: ["key uniqueness", "actual row expansion", "match rate", "runtime success", "business correctness"],
  },
  coverage: taskRows,
  patterns: patternRows,
  reviewedEvidence: evidenceRecords,
  manualQuestions: [...new Set(evidenceRecords.flatMap((record) => record.questions))],
  qualityChecks: {
    allBaselineConsumersListed: taskRows.length === consumerTaskIds.length,
    allConsumerEvidenceAvailable: taskRows.every((row) => row.evidenceAvailability === "AVAILABLE"),
    allFixedReadLocatorsPresent: taskRows.every((row) => row.versionCorrespondence === "FIXED_READ_LOCATORS_PRESENT_IN_CURRENT_FACTS"),
    reviewedGroupLimitMet: selectedGroupIds.size === 20,
    existingExampleHashesMatched: true,
    factRegressionAnchors,
    conditionEvidenceChecks,
    multiPatternSliceChecks,
    csvEncoding: "UTF-8 with BOM",
    caveats: [
      "旧固定batch manifest目录已被清理，除200078/230202外，SQL哈希与旧manifest的直接绑定不可恢复；readOccurrenceId匹配只证明固定读取定位仍存在，不证明跨版本语义一致。",
      "未核读任务只表示达到上限，不表示未使用任何字段或模式。",
      "候选输出来自任务级read×write覆盖；已核读样本通过bindings、expressions与relations关联到具体写入，复杂多输出控制路径仍需谨慎。",
      "结构用途由Facts程序提取；业务模式名称与差异是对局部Facts证据的模型解释，不是Facts原生字段。",
    ],
  },
  run: {
    scriptStartedAt: startedAt.toISOString(),
    scriptFinishedAt: new Date().toISOString(),
    scriptElapsedMs: Date.now() - startedAt.getTime(),
    fullSessionElapsed: "不可精确获得（宿主未提供本轮起始墙钟）；不估造",
    tokenUsage: "不可得",
    modelCost: "不可得",
  },
};

writeCsv(
  "consumers.csv",
  [
    ["源物理表ID", "sourceDatasetId"], ["平台", "platform"], ["数据源", "dataSource"], ["源表", "sourceTable"], ["源表中文注释", "sourceComment"],
    ["消费任务ID", "taskId"], ["任务名称", "taskName"], ["候选输出及中文注释", "candidateOutputs"], ["候选具体写入数", "candidateOutputCount"],
    ["候选写入证据ID", "concreteWrites"], ["SQL材料组", "materialGroupId"], ["相关SQL哈希", "materialHashes"], ["证据可用状态", "evidenceAvailability"],
    ["固定读取定位状态", "versionCorrespondence"], ["内容绑定级别", "contentBindingLevel"], ["核读状态", "reviewStatus"], ["使用模式", "patternIds"], ["已确认具体输出", "confirmedOutputs"],
    ["当前Facts写入", "factsCurrentWrites"], ["Facts字段绑定目标", "factsBindingTargets"], ["缺口/待判断", "gaps"],
    ["Facts清单哈希", "factsManifestSha256"], ["证据文件", "evidencePath"],
  ],
  taskRows,
);

writeCsv(
  "usage-patterns.csv",
  [
    ["模式ID", "patternId"], ["使用模式", "name"], ["成员消费者及确认输出", "members"], ["成员任务数", "memberTaskCount"],
    ["关键源字段", "keyFields"], ["Facts结构用途", "structuralUses"], ["关键关联与条件", "keyConditions"], ["业务作用", "businessUses"], ["与其他模式/成员的差异", "distinction"],
    ["模式证据切片方式", "sliceProvenance"], ["归组级别", "groupingLevel"], ["代表证据ID", "evidenceIds"], ["细粒度Facts证据ID", "factUsageIds"],
  ],
  patternRows,
);

writeCsv(
  "field-usage.csv",
  [
    ["源字段", "sourceField"], ["源字段中文注释", "sourceFieldComment"], ["源别名", "sourceAliases"], ["Facts作用域", "scopes"],
    ["JOIN直接对侧字段", "peerFields"], ["同一表达式/分组其他来源字段", "expressionSourceFields"], ["用途", "usageType"],
    ["不同消费任务数", "consumerTaskCount"], ["不同SQL材料组数", "sqlGroupCount"], ["任务ID", "taskIds"], ["条件/表达式示例", "conditionExamples"],
    ["任务级证据ID", "evidenceIds"], ["细粒度Facts证据ID", "factUsageIds"], ["统计口径与分母", "denominator"],
  ],
  fieldRows,
);

writeFileSync(join(OUT_DIR, "evidence.json"), `${JSON.stringify(evidenceJson, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  graphVersion: GRAPH_VERSION,
  directConsumerTasks: consumerTaskIds.length,
  distinctDownstreamTables: downstreamDatasetIds.size,
  concreteWriteObservations: totalConcreteWrites,
  materialGroups: materialGroups.size,
  reviewedGroups: selectedGroupIds.size,
  reviewedTasksIncludingReuse: reviewedTaskIds.size,
  allFixedReadLocatorsPresent: evidenceJson.qualityChecks.allFixedReadLocatorsPresent,
  elapsedMs: Date.now() - startedAt.getTime(),
}, null, 2));

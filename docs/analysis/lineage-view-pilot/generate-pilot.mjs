import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const outputDir = dirname(fileURLToPath(import.meta.url));
const generatedAt = "2026-09-10T00:00:00+08:00";

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

function marker(prefix, status) {
  const color =
    status === "candidate"
      ? "#b0712a"
      : status === "unknown"
        ? "#6d7480"
        : "#236d67";
  return `<marker id="${prefix}-${status}" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="${color}"/></marker>`;
}

function edge(prefix, item) {
  const {
    x1,
    y1,
    x2,
    y2,
    label = "",
    status = "confirmed",
    bend = 0,
    path,
  } = item;
  const color =
    status === "candidate"
      ? "#b0712a"
      : status === "unknown"
        ? "#6d7480"
        : "#236d67";
  const dash = status === "confirmed" ? "" : ' stroke-dasharray="6 5"';
  const d =
    path ??
    `M ${x1} ${y1} C ${x1 + (x2 - x1) * 0.45} ${y1 + bend}, ${x1 + (x2 - x1) * 0.55} ${y2 + bend}, ${x2} ${y2}`;
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2 + bend * 0.45;
  const labelWidth = Math.max(34, [...label].length * 7 + 12);
  return `<g class="lv-edge lv-${status}"><path d="${d}" fill="none" stroke="${color}" stroke-width="2"${dash} marker-end="url(#${prefix}-${status})"/>${label ? `<rect x="${mx - labelWidth / 2}" y="${my - 11}" width="${labelWidth}" height="20" rx="8" fill="var(--lv-label-bg)" stroke="${color}" stroke-width="0.8"/><text x="${mx}" y="${my + 4}" text-anchor="middle" class="lv-edge-label">${escapeHtml(label)}</text>` : ""}</g>`;
}

function node(item) {
  const {
    x,
    y,
    w = 190,
    h = 118,
    title,
    subtitle = [],
    fields = [],
    kind = "table",
    badge,
  } = item;
  const titleY = y + 25;
  const subtitleLines = Array.isArray(subtitle) ? subtitle : [subtitle];
  const fieldStart = y + 51 + subtitleLines.length * 15;
  const subtitleText = subtitleLines
    .map(
      (line, index) =>
        `<text x="${x + 12}" y="${y + 44 + index * 15}" class="lv-node-sub">${escapeHtml(line)}</text>`,
    )
    .join("");
  const fieldText = fields
    .slice(0, 4)
    .map(
      (field, index) =>
        `<text x="${x + 14}" y="${fieldStart + index * 18}" class="lv-field">${escapeHtml(field)}</text>`,
    )
    .join("");
  return `<g class="lv-node lv-node-${kind}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12"/><text x="${x + 12}" y="${titleY}" class="lv-node-title">${escapeHtml(title)}</text>${badge ? `<rect x="${x + w - 78}" y="${y + 8}" width="68" height="20" rx="10" class="lv-badge-box"/><text x="${x + w - 44}" y="${y + 22}" text-anchor="middle" class="lv-badge">${escapeHtml(badge)}</text>` : ""}${subtitleText}${fieldText}</g>`;
}

function diagram({ prefix, height, nodes, edges, note }) {
  return `<svg class="lv-svg" role="img" aria-label="${escapeHtml(note)}" viewBox="0 0 520 ${height}" preserveAspectRatio="xMidYMid meet"><defs>${marker(prefix, "confirmed")}${marker(prefix, "candidate")}${marker(prefix, "unknown")}</defs>${edges.map((item) => edge(prefix, item)).join("")}${nodes.map(node).join("")}<text x="16" y="${height - 12}" class="lv-foot">${escapeHtml(note)}</text></svg>`;
}

function compareBlock({ id, contract, a, b }) {
  return `<section class="lv-compare" data-case="${id}"><div class="lv-contract"><strong>对照合同</strong>　${escapeHtml(contract)}</div><div class="lv-pair"><figure><figcaption><span>A</span> 表为主</figcaption>${diagram({ prefix: `${id}-a`, ...a })}</figure><figure><figcaption><span>B</span> 数据范围为主</figcaption>${diagram({ prefix: `${id}-b`, ...b })}</figure></div></section>`;
}

const sharedStyle = `<style>
html,body{max-width:100%;overflow-x:hidden}
.analytics-top-bar{box-sizing:border-box!important;left:0!important;margin-left:0!important;margin-right:0!important;max-width:100%!important;transform:none!important;width:100%!important}
.lv-scroll-shell{max-height:320px;overflow-y:auto;overflow-x:hidden;padding:2px 12px 24px 0;scrollbar-gutter:stable}.lv-scroll-shell h2{margin-top:24px}.lv-data-table{border-collapse:collapse;width:100%;font-size:12px}.lv-data-table th,.lv-data-table td{border:1px solid #d7dfdd;padding:7px;text-align:left;vertical-align:top;overflow-wrap:anywhere}.lv-data-table th{background:#edf4f2}.lv-compare{--lv-ink:#18262b;--lv-muted:#5f6d72;--lv-line:#236d67;--lv-label-bg:#fbfcfa;margin:10px 0 20px}.lv-contract{margin:0 0 10px;padding:10px 12px;border-left:3px solid #c28a2d;background:#f7f3e8;color:#35464b;font-size:13px}.lv-pair{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px}.lv-pair figure{margin:0;border:1px solid #d7dfdd;border-radius:14px;background:#fbfcfa;overflow:hidden}.lv-pair figcaption{padding:10px 12px;border-bottom:1px solid #d7dfdd;color:#26383d;font-weight:650}.lv-pair figcaption span{display:inline-grid;place-items:center;width:24px;height:24px;margin-right:7px;border-radius:50%;background:#1f6f68;color:white}.lv-svg{display:block;width:100%;height:auto;background:#fbfcfa}.lv-node rect{fill:#fff;stroke:#9db7b2;stroke-width:1.4}.lv-node-table rect,.lv-node-source rect,.lv-node-output rect{fill:#f2f8f6}.lv-node-range rect{fill:#fbf6e9;stroke:#c1913c}.lv-node-task rect{fill:#e7f1ef;stroke:#4d8b85}.lv-node-unknown rect{fill:#f2f3f4;stroke:#7e8790;stroke-dasharray:5 4}.lv-node-title{font:650 13px ui-sans-serif,system-ui,"Microsoft YaHei";fill:#18262b}.lv-node-sub{font:11px ui-sans-serif,system-ui,"Microsoft YaHei";fill:#5f6d72}.lv-field{font:11px ui-monospace,SFMono-Regular,Consolas,monospace;fill:#223b40}.lv-badge-box{fill:#deebe8!important;stroke:none!important}.lv-node-range .lv-badge-box{fill:#f0dfb9!important}.lv-badge{font:10px ui-sans-serif,system-ui,"Microsoft YaHei";fill:#36504f}.lv-edge-label{font:10px ui-sans-serif,system-ui,"Microsoft YaHei";fill:#33484c}.lv-foot{font:10px ui-sans-serif,system-ui,"Microsoft YaHei";fill:#68757a}@media(max-width:760px){.lv-scroll-shell{max-height:120px}.lv-pair{grid-template-columns:1fr}}
@media(prefers-color-scheme:dark){.lv-compare{--lv-label-bg:#202628}.lv-pair figure,.lv-svg{background:#171c1e;border-color:#3b474a}.lv-pair figcaption{color:#e5eceb;border-color:#3b474a}.lv-node rect{fill:#222a2c}.lv-node-table rect,.lv-node-source rect,.lv-node-output rect{fill:#1e302f}.lv-node-range rect{fill:#342d20}.lv-node-task rect{fill:#203331}.lv-node-unknown rect{fill:#282c2f}.lv-node-title,.lv-field{fill:#edf3f2}.lv-node-sub,.lv-foot{fill:#aeb9b7}.lv-edge-label{fill:#e8eeed}.lv-contract{background:#312b20;color:#e6dfcf}}
</style>`;

const startCase = ({ id, taskId, writes, date }) => {
  const baseNodes = [
    {
      x: 16,
      y: 112,
      w: 170,
      h: 112,
      title: "odata_n_tit",
      subtitle: ["d_trd_otc_trade", "读取发生点"],
      fields: ["agt_id", "key_otc_trade_id"],
      kind: "source",
    },
    {
      x: 220,
      y: 118,
      w: 108,
      h: 76,
      title: `任务 ${taskId}`,
      subtitle: ["历史链维护"],
      kind: "task",
    },
    {
      x: 354,
      y: 74,
      w: 150,
      h: 186,
      title: "pdata_n",
      subtitle: ["t03_agt_prd_rela_h", "同一物理表"],
      fields: ["agt_id", "agt_modifr", "end_date", "src_tbl"],
      kind: "table",
      badge: "1 张卡",
    },
  ];
  const baseEdges = [
    { x1: 186, y1: 148, x2: 220, y2: 148, label: "字段取值" },
    { x1: 328, y1: 138, x2: 354, y2: 126, label: writes[0], bend: -18 },
    { x1: 328, y1: 174, x2: 354, y2: 201, label: writes[1], bend: 18 },
    {
      x1: 354,
      y1: 238,
      x2: 274,
      y2: 194,
      label: "历史自读",
      status: "candidate",
      path: "M 354 238 C 330 300, 224 286, 274 194",
    },
  ];
  return {
    id,
    contract: `来源相同；字段 agt_id / agt_modifr / end_date；任务内深度；两次写发生都保留；SQL 日期 ${date}。`,
    a: {
      height: 300,
      nodes: baseNodes,
      edges: baseEdges,
      note: "动态 SRC_TBL；writeId 不同不拆物理表卡",
    },
    b: {
      height: 300,
      nodes: baseNodes.map((item) =>
        item.kind === "table" ? { ...item, badge: "动态范围" } : item,
      ),
      edges: baseEdges,
      note: "范围未形成可比较成员，B 版同样保持一张卡",
    },
  };
};

const cases = [
  startCase({
    id: "S1",
    taskId: "105386",
    writes: ["write :3", "write :6"],
    date: "2026-06-11",
  }),
  startCase({
    id: "S2",
    taskId: "105526",
    writes: ["write :17", "write :33"],
    date: "2026-09-06",
  }),
  {
    id: "S3",
    contract:
      "同一来源、字段 key_leg_id / quantity / value、深度 1、OBSERVED；日期范围保持动态模板。",
    a: {
      height: 270,
      nodes: [
        {
          x: 16,
          y: 78,
          w: 178,
          h: 132,
          title: "odata_n_tit",
          subtitle: ["d_pos_trs_leg_his_pos"],
          fields: ["key_leg_id", "quantity", "value"],
          kind: "source",
        },
        {
          x: 220,
          y: 102,
          w: 112,
          h: 76,
          title: "任务 119640",
          subtitle: ["单来源映射"],
          kind: "task",
        },
        {
          x: 356,
          y: 78,
          w: 148,
          h: 132,
          title: "pdata_nds",
          subtitle: ["pos_trs_leg_his_pos"],
          fields: ["key_leg_id", "quantity", "value"],
          kind: "output",
        },
      ],
      edges: [
        { x1: 194, y1: 143, x2: 220, y2: 140, label: "101 字段" },
        { x1: 332, y1: 140, x2: 356, y2: 143, label: "写入" },
      ],
      note: "busi_date=${YYYY-MM-DD}；无投影 gap",
    },
    b: {
      height: 270,
      nodes: [
        {
          x: 16,
          y: 78,
          w: 178,
          h: 132,
          title: "odata_n_tit",
          subtitle: ["d_pos_trs_leg_his_pos"],
          fields: ["key_leg_id", "quantity", "value"],
          kind: "source",
          badge: "动态日期",
        },
        {
          x: 220,
          y: 102,
          w: 112,
          h: 76,
          title: "任务 119640",
          subtitle: ["单来源映射"],
          kind: "task",
        },
        {
          x: 356,
          y: 78,
          w: 148,
          h: 132,
          title: "pdata_nds",
          subtitle: ["pos_trs_leg_his_pos"],
          fields: ["key_leg_id", "quantity", "value"],
          kind: "range",
          badge: "动态日期",
        },
      ],
      edges: [
        { x1: 194, y1: 143, x2: 220, y2: 140, label: "101 字段" },
        { x1: 332, y1: 140, x2: 356, y2: 143, label: "写入" },
      ],
      note: "只有一条路径且日期是模板；拆卡不增加信息",
    },
  },
  {
    id: "S4",
    contract:
      "4 个生产任务、同一物理表、字段 agt_id / init_nom_prin / book_name、深度 1；grp_id 01–04 明确，日期为动态模板。",
    a: {
      height: 500,
      nodes: [
        ...[
          ["86840", "grp=01"],
          ["86841", "grp=02"],
          ["86842", "grp=03"],
          ["220650", "grp=04"],
        ].map(([task, badge], i) => ({
          x: 18,
          y: 38 + i * 104,
          w: 132,
          h: 70,
          title: `任务 ${task}`,
          subtitle: [badge],
          kind: "task",
        })),
        {
          x: 276,
          y: 122,
          w: 226,
          h: 214,
          title: "pdata_n.t98_otc_…",
          subtitle: ["deri_comp_sale_info", "4 个范围成员"],
          fields: ["agt_id", "init_nom_prin", "book_name"],
          kind: "table",
          badge: "1 张卡",
        },
      ],
      edges: [0, 1, 2, 3].map((i) => ({
        x1: 150,
        y1: 73 + i * 104,
        x2: 276,
        y2: 158 + i * 42,
        label: `grp_id=0${i + 1}`,
        bend: (i - 1.5) * 8,
      })),
      note: "A 用关系标签保留 4 个范围；表资产只出现一次",
    },
    b: {
      height: 500,
      nodes: [
        ...[
          ["86840", "01"],
          ["86841", "02"],
          ["86842", "03"],
          ["220650", "04"],
        ].flatMap(([task, grp], i) => [
          {
            x: 16,
            y: 30 + i * 112,
            w: 118,
            h: 70,
            title: `任务 ${task}`,
            subtitle: [`grp=${grp}`],
            kind: "task",
          },
          {
            x: 252,
            y: 20 + i * 112,
            w: 250,
            h: 92,
            title: "pdata_n.t98_otc_…",
            subtitle: [`grp_id=${grp} · busi_date=动态`],
            fields: ["agt_id · init_nom_prin · book_name"],
            kind: "range",
            badge: `范围 ${grp}`,
          },
        ]),
      ],
      edges: [0, 1, 2, 3].map((i) => ({
        x1: 134,
        y1: 65 + i * 112,
        x2: 252,
        y2: 66 + i * 112,
        label: `写 0${i + 1}`,
      })),
      note: "B 只因 grp_id 是明确路径成员才拆成 4 张范围卡",
    },
  },
  {
    id: "S5",
    contract:
      "字段 dyna_nom_prin、上游深度 2、4 个生产者全部保留、当前发布图均为 CONFIRMED；读取只限定动态 busi_date，未限定 grp_id。",
    a: {
      height: 480,
      nodes: [
        ...["86840", "86841", "86842", "220650"].map((task, i) => ({
          x: 12,
          y: 30 + i * 78,
          w: 108,
          h: 58,
          title: `任务 ${task}`,
          subtitle: [`grp 0${i + 1}`],
          kind: "task",
        })),
        {
          x: 186,
          y: 92,
          w: 188,
          h: 172,
          title: "pdata_n.t98_otc_…",
          subtitle: ["deri_comp_sale_info", "读：busi_date=动态"],
          fields: ["dyna_nom_prin", "成员 01 / 02 / 03 / 04"],
          kind: "table",
          badge: "共同参与",
        },
        {
          x: 398,
          y: 124,
          w: 108,
          h: 82,
          title: "任务 103457",
          subtitle: ["聚合消费"],
          kind: "task",
        },
        {
          x: 330,
          y: 330,
          w: 176,
          h: 104,
          title: "dm_otc_n",
          subtitle: ["wt_otc_trade_dtl"],
          fields: ["dyna_nom_prin"],
          kind: "output",
        },
      ],
      edges: [0, 1, 2, 3]
        .map((i) => ({
          x1: 120,
          y1: 59 + i * 78,
          x2: 186,
          y2: 124 + i * 34,
          label: `0${i + 1}`,
        }))
        .concat([
          { x1: 374, y1: 171, x2: 398, y2: 165, label: "4 个确认来源" },
          { x1: 452, y1: 206, x2: 418, y2: 330, label: "产出" },
        ]),
      note: "A 紧凑，但必须显式写出来源集合=01–04",
    },
    b: {
      height: 480,
      nodes: [
        ...["86840", "86841", "86842", "220650"].map((task, i) => ({
          x: 8,
          y: 22 + i * 82,
          w: 100,
          h: 56,
          title: `任务 ${task}`,
          subtitle: [`grp 0${i + 1}`],
          kind: "task",
        })),
        ...["01", "02", "03", "04"].map((grp, i) => ({
          x: 142,
          y: 16 + i * 82,
          w: 178,
          h: 68,
          title: "t98_sale_info",
          subtitle: [`grp_id=${grp}`, "busi_date=动态"],
          fields: ["dyna_nom_prin"],
          kind: "range",
        })),
        {
          x: 394,
          y: 120,
          w: 112,
          h: 88,
          title: "任务 103457",
          subtitle: ["无 grp_id 限定", "全部成员参与"],
          kind: "task",
        },
        {
          x: 354,
          y: 332,
          w: 152,
          h: 96,
          title: "dm_otc_n",
          subtitle: ["wt_otc_trade_dtl"],
          fields: ["dyna_nom_prin"],
          kind: "output",
        },
      ],
      edges: [0, 1, 2, 3]
        .flatMap((i) => [
          { x1: 108, y1: 50 + i * 82, x2: 142, y2: 50 + i * 82 },
          {
            x1: 320,
            y1: 50 + i * 82,
            x2: 394,
            y2: 143 + i * 14,
            label: "参与",
          },
        ])
        .concat([{ x1: 450, y1: 208, x2: 430, y2: 332, label: "产出" }]),
      note: "B 最直观看出不是单选：4 张范围卡同时进入读取",
    },
  },
  {
    id: "S6",
    contract:
      "字段 init_nom_prin、下游深度 1、生产者 86842、读任务 223867；grp_id=03，当前发布接续为 CONFIRMED。",
    a: {
      height: 300,
      nodes: [
        {
          x: 12,
          y: 96,
          w: 104,
          h: 70,
          title: "任务 86842",
          subtitle: ["写 grp=03"],
          kind: "task",
        },
        {
          x: 154,
          y: 68,
          w: 190,
          h: 128,
          title: "pdata_n.t98_otc_…",
          subtitle: ["deri_comp_sale_info"],
          fields: ["init_nom_prin"],
          kind: "table",
          badge: "表卡",
        },
        {
          x: 388,
          y: 96,
          w: 116,
          h: 70,
          title: "任务 223867",
          subtitle: ["读 grp=03"],
          kind: "task",
        },
      ],
      edges: [
        { x1: 116, y1: 131, x2: 154, y2: 131, label: "写" },
        { x1: 344, y1: 131, x2: 388, y2: 131, label: "CONFIRMED" },
      ],
      note: "A 用关系标签说明本次只消费 grp_id=03",
    },
    b: {
      height: 300,
      nodes: [
        {
          x: 12,
          y: 96,
          w: 104,
          h: 70,
          title: "任务 86842",
          subtitle: ["写 grp=03"],
          kind: "task",
        },
        {
          x: 154,
          y: 68,
          w: 190,
          h: 128,
          title: "pdata_n.t98_otc_…",
          subtitle: ["grp_id=03", "busi_date=动态"],
          fields: ["init_nom_prin"],
          kind: "range",
          badge: "范围 03",
        },
        {
          x: 388,
          y: 96,
          w: 116,
          h: 70,
          title: "任务 223867",
          subtitle: ["读 grp=03"],
          kind: "task",
        },
      ],
      edges: [
        { x1: 116, y1: 131, x2: 154, y2: 131, label: "写" },
        { x1: 344, y1: 131, x2: 388, y2: 131, label: "CONFIRMED" },
      ],
      note: "B 在单个明确成员问题上更省一次关系标签查找",
    },
  },
  {
    id: "S7",
    contract:
      "字段 init_nom_prin、下游深度 1、生产者 86842、读任务 123781；SQL 也限定 grp_id=03，但当前发布接续仅为 ASSUMED/CANDIDATE。",
    a: {
      height: 300,
      nodes: [
        {
          x: 12,
          y: 96,
          w: 104,
          h: 70,
          title: "任务 86842",
          subtitle: ["写 grp=03"],
          kind: "task",
        },
        {
          x: 154,
          y: 68,
          w: 190,
          h: 128,
          title: "pdata_n.t98_otc_…",
          subtitle: ["deri_comp_sale_info"],
          fields: ["init_nom_prin"],
          kind: "table",
          badge: "表卡",
        },
        {
          x: 388,
          y: 96,
          w: 116,
          h: 70,
          title: "任务 123781",
          subtitle: ["读 grp=03"],
          kind: "task",
        },
      ],
      edges: [
        { x1: 116, y1: 131, x2: 154, y2: 131, label: "写" },
        {
          x1: 344,
          y1: 131,
          x2: 388,
          y2: 131,
          label: "ASSUMED",
          status: "candidate",
        },
      ],
      note: "单一匹配来源仍不是确认；虚线状态不能丢",
    },
    b: {
      height: 300,
      nodes: [
        {
          x: 12,
          y: 96,
          w: 104,
          h: 70,
          title: "任务 86842",
          subtitle: ["写 grp=03"],
          kind: "task",
        },
        {
          x: 154,
          y: 68,
          w: 190,
          h: 128,
          title: "pdata_n.t98_otc_…",
          subtitle: ["grp_id=03", "日期模板未对齐"],
          fields: ["init_nom_prin"],
          kind: "range",
          badge: "范围 03",
        },
        {
          x: 388,
          y: 96,
          w: 116,
          h: 70,
          title: "任务 123781",
          subtitle: ["读 grp=03"],
          kind: "task",
        },
      ],
      edges: [
        { x1: 116, y1: 131, x2: 154, y2: 131, label: "写" },
        {
          x1: 344,
          y1: 131,
          x2: 388,
          y2: 131,
          label: "ASSUMED",
          status: "candidate",
        },
      ],
      note: "拆成范围卡不会把候选升级为确认",
    },
  },
  {
    id: "S8",
    contract:
      "任务 93338；字段 index_val / grp_id / status；任务内深度；VALUE 与控制关系分开，控制逻辑不画成字段值来源。",
    a: {
      height: 410,
      nodes: [
        {
          x: 10,
          y: 26,
          w: 190,
          h: 96,
          title: "t98_sale_adtnl_det",
          subtitle: ["值来源"],
          fields: ["dyna_nom_prin"],
          kind: "source",
        },
        {
          x: 10,
          y: 146,
          w: 190,
          h: 112,
          title: "t98_comp_mng_rela",
          subtitle: ["值来源"],
          fields: ["allo_prop_1", "allo_prop_2", "allo_prop_3"],
          kind: "source",
        },
        {
          x: 10,
          y: 282,
          w: 190,
          h: 84,
          title: "dm_index_n.grp_def",
          subtitle: ["值来源"],
          fields: ["grp_id"],
          kind: "source",
        },
        {
          x: 246,
          y: 156,
          w: 108,
          h: 78,
          title: "任务 93338",
          subtitle: ["分支聚合"],
          kind: "task",
        },
        {
          x: 386,
          y: 116,
          w: 126,
          h: 164,
          title: "dm_index_n",
          subtitle: ["index_avg_dyna_…"],
          fields: ["index_val", "grp_id", "status"],
          kind: "output",
        },
      ],
      edges: [
        { x1: 200, y1: 74, x2: 246, y2: 174, label: "dyna" },
        { x1: 200, y1: 202, x2: 246, y2: 194, label: "allo 1–3" },
        { x1: 200, y1: 324, x2: 246, y2: 216, label: "grp_id" },
        { x1: 354, y1: 195, x2: 386, y2: 195, label: "VALUE" },
      ],
      note: "A 关注字段分支；JOIN/FILTER/UNION 留在证据层",
    },
    b: {
      height: 410,
      nodes: [
        {
          x: 10,
          y: 26,
          w: 190,
          h: 96,
          title: "t98_sale_adtnl_det",
          subtitle: ["范围：agt_id 集合"],
          fields: ["dyna_nom_prin"],
          kind: "range",
          badge: "部分键",
        },
        {
          x: 10,
          y: 146,
          w: 190,
          h: 112,
          title: "t98_comp_mng_rela",
          subtitle: ["日期动态 · agt_id 集合"],
          fields: ["allo_prop_1", "allo_prop_2", "allo_prop_3"],
          kind: "range",
          badge: "动态",
        },
        {
          x: 10,
          y: 282,
          w: 190,
          h: 84,
          title: "dm_index_n.grp_def",
          subtitle: ["grp_type=STAFF"],
          fields: ["grp_id"],
          kind: "range",
          badge: "限定",
        },
        {
          x: 246,
          y: 156,
          w: 108,
          h: 78,
          title: "任务 93338",
          subtitle: ["分支聚合"],
          kind: "task",
        },
        {
          x: 386,
          y: 116,
          w: 126,
          h: 164,
          title: "dm_index_n",
          subtitle: ["index_avg_dyna_…"],
          fields: ["index_val", "grp_id", "status"],
          kind: "output",
        },
      ],
      edges: [
        { x1: 200, y1: 74, x2: 246, y2: 174, label: "dyna" },
        { x1: 200, y1: 202, x2: 246, y2: 194, label: "allo 1–3" },
        { x1: 200, y1: 324, x2: 246, y2: 216, label: "grp_id" },
        { x1: 354, y1: 195, x2: 386, y2: 195, label: "VALUE" },
      ],
      note: "B 增加范围文字但没有可拆成员，卡片数量不变",
    },
  },
  {
    id: "S9",
    contract:
      "任务 155157；字段 actl_idx_val / rpt_date；上游深度 4 的实测路径；确认边保持确认，投影 gap 单独显示。",
    a: {
      height: 420,
      nodes: [
        {
          x: 10,
          y: 44,
          w: 190,
          h: 112,
          title: "t98_opt_sub_prcg",
          subtitle: ["经 107480 / 71733"],
          fields: ["pv", "delta", "prcg_date"],
          kind: "source",
        },
        {
          x: 10,
          y: 206,
          w: 190,
          h: 112,
          title: "t98_deri_lmt_idx",
          subtitle: ["经 106216 / 43854"],
          fields: ["actl_idx_val", "rpt_date"],
          kind: "source",
        },
        {
          x: 246,
          y: 138,
          w: 112,
          h: 88,
          title: "任务 155157",
          subtitle: ["UNION + 聚合", "部分范围动态"],
          kind: "task",
        },
        {
          x: 392,
          y: 112,
          w: 118,
          h: 142,
          title: "dm_rsk_n",
          subtitle: ["adm_dtl_otc_…"],
          fields: ["actl_idx_val", "rpt_date"],
          kind: "output",
        },
        {
          x: 246,
          y: 290,
          w: 264,
          h: 62,
          title: "证据缺口",
          subtitle: [
            "FIELD_SOURCE_READ_OCCURRENCE_UNRESOLVED",
            "CONTROL_SIDE_UNRESOLVED",
          ],
          kind: "unknown",
        },
      ],
      edges: [
        { x1: 200, y1: 100, x2: 246, y2: 166, label: "确认路径" },
        { x1: 200, y1: 262, x2: 246, y2: 204, label: "确认路径" },
        { x1: 358, y1: 182, x2: 392, y2: 182, label: "VALUE" },
        {
          x1: 302,
          y1: 226,
          x2: 350,
          y2: 290,
          label: "另列 gap",
          status: "unknown",
        },
      ],
      note: "A 不把普通图可达性包装成精确多跳证明",
    },
    b: {
      height: 420,
      nodes: [
        {
          x: 10,
          y: 44,
          w: 190,
          h: 112,
          title: "t98_opt_sub_prcg",
          subtitle: ["动态/部分键范围"],
          fields: ["pv", "delta", "prcg_date"],
          kind: "range",
          badge: "未拆",
        },
        {
          x: 10,
          y: 206,
          w: 190,
          h: 112,
          title: "t98_deri_lmt_idx",
          subtitle: ["src_tbl 已限定"],
          fields: ["actl_idx_val", "rpt_date"],
          kind: "range",
          badge: "限定",
        },
        {
          x: 246,
          y: 138,
          w: 112,
          h: 88,
          title: "任务 155157",
          subtitle: ["UNION + 聚合", "范围非同一维度"],
          kind: "task",
        },
        {
          x: 392,
          y: 112,
          w: 118,
          h: 142,
          title: "dm_rsk_n",
          subtitle: ["adm_dtl_otc_…"],
          fields: ["actl_idx_val", "rpt_date"],
          kind: "output",
        },
        {
          x: 246,
          y: 290,
          w: 264,
          h: 62,
          title: "证据缺口",
          subtitle: ["不能伪装为具体分区节点", "仍需证据层解释"],
          kind: "unknown",
        },
      ],
      edges: [
        { x1: 200, y1: 100, x2: 246, y2: 166, label: "确认路径" },
        { x1: 200, y1: 262, x2: 246, y2: 204, label: "确认路径" },
        { x1: 358, y1: 182, x2: 392, y2: 182, label: "VALUE" },
        {
          x1: 302,
          y1: 226,
          x2: 350,
          y2: 290,
          label: "保留未知",
          status: "unknown",
        },
      ],
      note: "B 不能把不同谓词维度硬切成同一种 range card",
    },
  },
];

const coverageRows = [
  {
    case: "S1",
    tasks: "105386",
    table: "pdata_n.t03_agt_prd_rela_h",
    structure: "同任务多写 / overwrite / 历史自读 / 动态分区",
    reason: "复现截图主问题；两次最终写均应指向同一表卡",
    evidence: "projection finalWrites :3,:6；query.sql:1,40",
    gap: "具体运行分区实例未证明",
  },
  {
    case: "S2",
    tasks: "105526",
    table: "pdata_n.t03_agt_prd_rela_h",
    structure: "同任务多写 / overwrite / 历史自读 / 动态分区",
    reason: "用第二个真实任务检验规则，避免只修一个漂亮个例",
    evidence: "projection finalWrites :17,:33；query.sql:1,55",
    gap: "具体运行分区实例未证明",
  },
  {
    case: "S3",
    tasks: "119640",
    table: "pdata_nds.pos_trs_leg_his_pos",
    structure: "简单单来源 / 单写入 / 101 字段",
    reason: "验证简单路径不应被范围模型复杂化",
    evidence: "projection；graph detail；query.sql:105",
    gap: "日期是模板，不是运行值",
  },
  {
    case: "S4",
    tasks: "86840,86841,86842,220650",
    table: "pdata_n.t98_otc_deri_comp_sale_info",
    structure: "不同任务写不同 grp_id；多字段多分支",
    reason: "真实检验范围拆卡是否有信息增益",
    evidence: "4 个 task.json partition；graph compare",
    gap: "busi_date 仍为动态模板",
  },
  {
    case: "S5",
    tasks: "103457",
    table: "pdata_n.t98_otc_deri_comp_sale_info",
    structure: "部分分区键读取 / 4 来源共同参与 / 两跳",
    reason: "验证多来源不是歧义，也不能强迫单选",
    evidence: "query.sql:147-148；published trace dyna_nom_prin",
    gap: "静态确认不证明实际运行",
  },
  {
    case: "S6",
    tasks: "223867",
    table: "pdata_n.t98_otc_deri_comp_sale_info",
    structure: "明确 grp_id=03 / 单一确认来源",
    reason: "作为范围拆卡有效的正例",
    evidence: "query.sql:148-150；published CONTINUES",
    gap: "日期是动态模板",
  },
  {
    case: "S7",
    tasks: "123781",
    table: "pdata_n.t98_otc_deri_comp_sale_info",
    structure: "明确 grp_id=03 / 单一候选来源",
    reason: "反证单一来源不自动等于确认",
    evidence: "query.sql:231-233；published CANDIDATE",
    gap: "接续仅 ASSUMED",
  },
  {
    case: "S8",
    tasks: "93338",
    table: "dm_index_n.index_avg_dyna_nom_prin_year",
    structure: "多字段 / 多分支 / UNION 与控制关系",
    reason: "检验范围表达是否掩盖字段值分支",
    evidence: "evidence-v3；graph detail",
    gap: "FIELD_SOURCE_READ_OCCURRENCE_UNRESOLVED",
  },
  {
    case: "S9",
    tasks: "155157",
    table: "dm_rsk_n.adm_dtl_otc_stres_tdy",
    structure: "多字段 / 两三跳 / 动态与部分范围 / gap",
    reason: "验证未知状态和多跳边界能否被读出",
    evidence: "projection；graph trace depth=4",
    gap: "读发生点与控制侧各有未解析项",
  },
];

const evaluationRows = [
  {
    case: "S1/S2",
    fidelityA: "高：一表一卡且保留两次写",
    fidelityB: "高：正确选择不拆",
    readabilityA: "高：重复卡消失",
    readabilityB: "高，但与 A 几乎相同",
    generality: "动态/未知范围不应仅凭 writeId 拆卡",
  },
  {
    case: "S3",
    fidelityA: "高",
    fidelityB: "高",
    readabilityA: "高",
    readabilityB: "无额外收益",
    generality: "简单单路径优先最少节点",
  },
  {
    case: "S4",
    fidelityA: "高，依赖清晰边标签",
    fidelityB: "高",
    readabilityA: "中：需读 4 条关系",
    readabilityB: "高：成员并列可见",
    generality: "明确且可比较的范围适合展开",
  },
  {
    case: "S5",
    fidelityA: "高，必须声明集合完整性",
    fidelityB: "高",
    readabilityA: "中",
    readabilityB: "高：四来源共同参与一眼可见",
    generality: "部分键读取可展开所有匹配成员，不单选",
  },
  {
    case: "S6",
    fidelityA: "高",
    fidelityB: "高",
    readabilityA: "中高",
    readabilityB: "高",
    generality: "问题聚焦具体范围时，范围卡有效",
  },
  {
    case: "S7",
    fidelityA: "高",
    fidelityB: "高，只要保留虚线",
    readabilityA: "高",
    readabilityB: "高",
    generality: "节点拆分不能替代证据状态",
  },
  {
    case: "S8",
    fidelityA: "高",
    fidelityB: "中高：范围文字增加但不宜硬拆",
    readabilityA: "高：字段分支突出",
    readabilityB: "中：范围信息与值来源竞争",
    generality: "关系算子留证据层，主图只画 VALUE",
  },
  {
    case: "S9",
    fidelityA: "高，gap 另列",
    fidelityB: "中：范围维度不统一",
    readabilityA: "中高",
    readabilityB: "中",
    generality: "动态/未知/异构谓词应保留一表卡与 gap",
  },
];

const questionRows = [
  {
    question: "105386/105526 为什么出现多张同表卡？",
    answer:
      "当前适配器以 depth + taskId + writeId + table 分组；两次最终写因此形成两个组。SQL 是动态 PARTITION(SRC_TBL)，应回到同一物理表卡。",
  },
  {
    question: "103457 的 dyna_nom_prin 有几个来源？",
    answer:
      "当前发布 trace 返回 86840/86841/86842/220650 四个 CONFIRMED 来源；读取限定动态 busi_date，未限定 grp_id，因此不是单选。",
  },
  {
    question: "同样 grp_id=03，为什么 223867 与 123781 状态不同？",
    answer:
      "发布图对 223867 是 CONTINUES/CONFIRMED，对 123781 是 CANDIDATE/ASSUMED。展示必须保留状态，不能因卡片相同而抹平。",
  },
  {
    question: "93338 的 index_val 从哪里来？",
    answer:
      "字段值来自 t98_sale_adtnl_det.dyna_nom_prin 与 t98_comp_mng_rela_info.allo_prop_1/2/3；grp_id 另来自 dm_index_n.grp_def。JOIN/FILTER/UNION 不作为字段值来源边。",
  },
  {
    question: "155157 哪些地方不能确认？",
    answer:
      "投影保留 FIELD_SOURCE_READ_OCCURRENCE_UNRESOLVED 与 CONTROL_SIDE_UNRESOLVED；这些是证据问题，不是 A/B 展示模型本身的错误。",
  },
  {
    question: "本次是否验证了无谓词整表读取？",
    answer:
      "没有。对 t98_sale_info 的 8 个直接下游读发生点做了有界检查，均存在日期或其他谓词；因此记录覆盖缺口，不外推到全域。",
  },
];

const displayRuleRows = [
  { rule: "保留单表卡", cases: 5, sampleIds: "S1、S2、S3、S8、S9" },
  { rule: "展开范围子卡", cases: 4, sampleIds: "S4、S5、S6、S7" },
];

function sqlLiteral(value) {
  if (value == null) return "NULL";
  if (typeof value === "number") return String(value);
  return `'${String(value).replaceAll("'", "''")}'`;
}

function derivedRowsSql(rows) {
  const columns = Object.keys(rows[0]);
  const values = rows
    .map(
      (row) =>
        `(${columns.map((column) => sqlLiteral(row[column])).join(", ")})`,
    )
    .join(",\n  ");
  return `SELECT * FROM (VALUES\n  ${values}\n) AS derived(${columns.join(", ")})`;
}

const tableSource = "pilot-evidence";
const title = "字段血缘图谱表达方式：有界验证";

const expandedBlocks = [
  { id: "title", type: "markdown", body: `# ${title}` },
  {
    id: "summary",
    type: "markdown",
    sourceId: tableSource,
    body: "## 结论先行\n\n- **没有单一方案在所有样本上获胜。** 动态或未知范围下，A 的单表卡更忠实；明确且路径上需要比较的范围下，B 更直观。\n- **起始案例不该按 writeId 拆卡。** 105386 与 105526 各有两次最终写，但它们是同表动态分区写；两次写关系应保留，表卡应合并。\n- **推荐的是混合规则，不是两套产品。** 物理表始终是资产锚点；只有查询路径确需区分且范围证据足够时，才在同一视图中展开范围子卡。\n- **本次只支持表达决策，不支持正式重构。** 9 组样本、12 个根任务不能包装成全域正确率；无谓词整表读取仍是覆盖缺口。",
  },
  {
    id: "scope",
    type: "markdown",
    sourceId: tableSource,
    body: "## 样本边界与共同口径\n\n当前发布图版本为 `fd7070…489a`，状态 `READY`。两版对每个案例使用相同来源、字段、深度和证据状态；A/B 只改变范围是否成为可见卡片。静态证据不证明实际运行、分区存在或业务数据正确。",
  },
  {
    id: "rule-distribution-intro",
    type: "markdown",
    body: "## 样本落入的显示规则\n\n这是混合规则的样本分布，不是 A/B 胜负计分，也不代表全域比例。",
  },
  {
    id: "rule-distribution",
    type: "chart",
    chartId: "display_rule_distribution",
  },
  {
    id: "coverage-intro",
    type: "markdown",
    body: "## 9 组真实样本覆盖了什么\n\n覆盖表用于精确查找样本、入选理由、证据位置和缺口；这里不合成总分。",
  },
  { id: "coverage-table", type: "table", tableId: "coverage" },
  {
    id: "rules",
    type: "markdown",
    sourceId: tableSource,
    body: "## 两版固定规则\n\n**A｜表为主：** 完整物理身份默认一张卡；字段端口不变；范围、集合完整性和状态放在关系标签；任务标签避开卡片主体。\n\n**B｜数据范围为主：** 只有明确、可比较且路径上需要区分的范围才拆卡；整表、部分键、具体分区分开表达；动态/未知不伪装成具体分区。\n\n**共同底线：** 多来源可共同参与；单一来源仍可能只是候选；JOIN/FILTER 等控制关系不混成字段值来源。",
  },
  ...cases.flatMap((item, index) => [
    {
      id: `${item.id}-narrative`,
      type: "markdown",
      sourceId: tableSource,
      body: `## ${item.id}｜${coverageRows[index].structure}\n\n${coverageRows[index].reason}。下图只比较表达模型，不改变关系事实。`,
    },
    {
      id: `${item.id}-visual`,
      type: "html",
      sourceId: tableSource,
      body: `${index === 0 ? sharedStyle : ""}${compareBlock(item)}`,
    },
  ]),
  {
    id: "evaluation-intro",
    type: "markdown",
    body: "## 分项评价：忠实度、可读性、通用性\n\n评价基于能否直接找到字段来源、参与范围、多个来源的原因和未确认处；没有用一个总分掩盖差异。",
  },
  { id: "evaluation-table", type: "table", tableId: "evaluation" },
  {
    id: "questions-intro",
    type: "markdown",
    body: "## 给用户的读图问题与独立证据答案\n\n问题用于实际评价；下列证据答案不等于用户已看懂，也不构成验收通过。",
  },
  { id: "questions-table", type: "table", tableId: "questions" },
  {
    id: "limitations",
    type: "markdown",
    sourceId: tableSource,
    body: "## 限制与稳健性检查\n\n- 对同一 `t98_sale_info.init_nom_prin` 的 8 个直接下游读发生点做了有界检查，没有找到完全无谓词读取；这只是覆盖缺口，不是全域不存在。\n- 105386/105526 的两次最终写已核实；按用户澄清，它们属于动态分区并指向同一物理表。现有投影没有提供可用于拆卡的具体运行分区实例。\n- 103457/223867/123781 的接续状态来自当前发布图；图版本变化后应重放同样的有界查询。\n- 关系忠实度评价把现有证据 gap 与展示方案问题分开：A/B 都不能修复未解析的读发生点或控制侧。",
  },
  {
    id: "recommendation",
    type: "markdown",
    sourceId: tableSource,
    body: "## 设计判断：采用单锚点、按需展开范围\n\n**支持：** 物理表一张资产卡；字段端口常驻；范围作为关系标签的默认形态；明确范围在路径视图中按需展开为子卡；多匹配来源同时展开；确认、候选、未知分别编码。\n\n**反对：** 按 writeId 无条件拆卡；把动态模板渲染成具体分区；为了少线强迫多来源单选；用范围卡替代证据状态；把控制关系塞进字段值来源。\n\n**未覆盖：** 无谓词整表读取的真实样本、追加与覆盖的运行先后、同分区多个写发生的运行接续、用户实际读图时间与误读率。\n\n**是否需要混合规则：需要。** 这不是维护 A/B 两套应用，而是一套图上的两级展开规则：资产锚点固定，范围视图按证据与问题触发。",
  },
  {
    id: "next",
    type: "markdown",
    body: "## 等待用户评价\n\n请分别判断：S1/S2 是否已消除“同表多卡却无区别”；S4/S5 中 B 是否真的比 A 更快看出范围成员；S7 的候选状态是否足够醒目；S8/S9 是否仍能顺着字段追踪而不被范围文字打断。用户评价后再决定是否进入正式重构。",
  },
];

function htmlTable(rows, columns) {
  const head = columns
    .map(([field, label]) => `<th>${escapeHtml(label)}</th>`)
    .join("");
  const body = rows
    .map(
      (row) =>
        `<tr>${columns.map(([field]) => `<td>${escapeHtml(row[field])}</td>`).join("")}</tr>`,
    )
    .join("");
  return `<table class="lv-data-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

const detailedBody = `${sharedStyle}<div class="lv-scroll-shell">
<h2>样本边界与固定规则</h2><p>当前发布图版本 <code>fd7070…489a</code>，状态 <code>READY</code>。A/B 使用相同来源、字段、深度和证据状态。A 默认一表一卡；B 只在范围明确、可比较且路径需要区分时展开范围子卡。</p>
<h2>案例覆盖表</h2>${htmlTable(coverageRows, [
  ["case", "案例"],
  ["tasks", "任务"],
  ["table", "主表"],
  ["structure", "结构"],
  ["reason", "入选理由"],
  ["evidence", "证据位置"],
  ["gap", "缺口"],
])}
${cases.map((item, index) => `<h2>${item.id}｜${escapeHtml(coverageRows[index].structure)}</h2><p>${escapeHtml(coverageRows[index].reason)}。下图只比较表达模型，不改变关系事实。</p>${compareBlock(item)}`).join("")}
<h2>分项评价</h2>${htmlTable(evaluationRows, [
  ["case", "案例"],
  ["fidelityA", "忠实度 A"],
  ["fidelityB", "忠实度 B"],
  ["readabilityA", "可读性 A"],
  ["readabilityB", "可读性 B"],
  ["generality", "通用性观察"],
])}
<h2>读图问题与证据答案</h2>${htmlTable(questionRows, [
  ["question", "读图问题"],
  ["answer", "独立证据答案"],
])}
<h2>设计判断</h2><p><strong>支持：</strong>物理表一张资产卡；字段端口常驻；范围默认放在关系上；明确范围按需展开；多来源同时参与；确认、候选、未知分别编码。</p><p><strong>反对：</strong>按 writeId 无条件拆卡；把动态模板渲染成具体分区；强迫多来源单选；用范围卡替代证据状态；把控制关系塞进字段值来源。</p><p><strong>未覆盖：</strong>无谓词整表读取真样本、追加与覆盖的运行先后、同分区多写的运行接续、用户实际误读率。</p>
<h2>等待用户评价</h2><p>请分别判断：S1/S2 是否消除了无区别重复卡；S4/S5 中 B 是否更快看出范围成员；S7 的候选状态是否醒目；S8/S9 是否仍易追踪字段。</p>
</div>`;

const blocks = [
  {
    id: "summary",
    type: "markdown",
    sourceId: tableSource,
    body: "**结论：** 105386/105526 的动态分区写入合并到同一物理表卡；只有明确且路径需要比较的范围才按需展开。9 组样本仅验证表达，不实施正式重构。",
  },
  {
    id: "rule-distribution",
    type: "chart",
    chartId: "display_rule_distribution",
  },
  {
    id: "pilot-detail",
    type: "html",
    sourceId: tableSource,
    body: detailedBody,
  },
];

const artifact = {
  surface: "report",
  manifest: {
    version: 1,
    surface: "report",
    title,
    description:
      "基于 9 组真实任务的小范围字段血缘表达对照，不实施正式图谱重构。",
    generatedAt,
    filters: [],
    cards: [],
    charts: [
      {
        id: "display_rule_distribution",
        title: "9 组样本的显示规则归类",
        subtitle: "保留单表卡 5 组；展开范围子卡 4 组。仅描述本次样本。",
        type: "bar",
        dataset: "displayRules",
        sourceId: tableSource,
        source: {
          label: "案例登记表的派生汇总",
          query: {
            sql: "SELECT '保留单表卡' AS rule, 5 AS cases, 'S1、S2、S3、S8、S9' AS sampleIds UNION ALL SELECT '展开范围子卡', 4, 'S4、S5、S6、S7'",
          },
        },
        encodings: {
          x: { field: "rule", type: "nominal", label: "显示规则" },
          y: {
            field: "cases",
            type: "quantitative",
            label: "案例组数",
            format: "integer",
          },
        },
        settings: { orientation: "horizontal" },
        valueFormat: "integer",
      },
    ],
    tables: [
      {
        id: "coverage",
        title: "案例覆盖表",
        subtitle:
          "9 组样本、12 个根任务；证据位置采用数据根目录下的相对路径或现有 CLI。",
        dataset: "coverage",
        sourceId: tableSource,
        source: {
          label: "核验案例登记行（派生 SQL）",
          query: { sql: derivedRowsSql(coverageRows) },
        },
        defaultSort: { field: "case", direction: "asc" },
        density: "dense",
        columns: [
          { field: "case", label: "案例", type: "text" },
          { field: "tasks", label: "任务", type: "text" },
          { field: "table", label: "主表", type: "text" },
          { field: "structure", label: "结构类型", type: "text" },
          { field: "reason", label: "入选理由", type: "text" },
          { field: "evidence", label: "证据位置", type: "text" },
          { field: "gap", label: "缺口", type: "text" },
        ],
      },
      {
        id: "evaluation",
        title: "A/B 分项评价",
        subtitle: "关系忠实度、可读性与通用性分开判断；不合成总分。",
        dataset: "evaluation",
        sourceId: tableSource,
        source: {
          label: "分项评价登记行（派生 SQL）",
          query: { sql: derivedRowsSql(evaluationRows) },
        },
        defaultSort: { field: "case", direction: "asc" },
        density: "dense",
        columns: [
          { field: "case", label: "案例", type: "text" },
          { field: "fidelityA", label: "忠实度 A", type: "text" },
          { field: "fidelityB", label: "忠实度 B", type: "text" },
          { field: "readabilityA", label: "可读性 A", type: "text" },
          { field: "readabilityB", label: "可读性 B", type: "text" },
          { field: "generality", label: "通用性观察", type: "text" },
        ],
      },
      {
        id: "questions",
        title: "读图问题与证据答案",
        subtitle:
          "答案来自当前代码、Pack、Facts、投影、SQL 与已发布图；不代表用户验收。",
        dataset: "questions",
        sourceId: tableSource,
        source: {
          label: "读图问题登记行（派生 SQL）",
          query: { sql: derivedRowsSql(questionRows) },
        },
        defaultSort: { field: "question", direction: "asc" },
        density: "spacious",
        columns: [
          { field: "question", label: "读图问题", type: "text" },
          { field: "answer", label: "独立证据答案", type: "text" },
        ],
      },
    ],
    sources: [
      {
        id: tableSource,
        label: "有界核验记录",
        path: "docs/analysis/lineage-view-pilot/evidence-record.md",
      },
    ],
    blocks,
  },
  snapshot: {
    version: 1,
    generatedAt,
    status: "ready",
    datasets: {
      coverage: coverageRows,
      evaluation: evaluationRows,
      questions: questionRows,
      displayRules: displayRuleRows,
    },
  },
  sources: [
    {
      id: tableSource,
      label: "有界核验记录",
      path: "docs/analysis/lineage-view-pilot/evidence-record.md",
    },
  ],
};

writeFileSync(
  join(outputDir, "artifact.json"),
  `${JSON.stringify(artifact, null, 2)}\n`,
  "utf8",
);
writeFileSync(
  join(outputDir, "case-evidence.json"),
  `${JSON.stringify({ generatedAt, graphVersion: "fd7070e0a37c10e99ec235fdd0db10f355c581d0a2e5679410d95d9cc984489a", coverageRows, evaluationRows, questionRows }, null, 2)}\n`,
  "utf8",
);
console.log(
  JSON.stringify({
    ok: true,
    cases: coverageRows.length,
    rootTasks: 12,
    outputDir,
  }),
);

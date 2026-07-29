import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateLiveOptions } from "./validate_live_options.mjs";
import { summarizeBranches, scoreBranches } from "./live_price_scoring.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");
const dataPath = path.join(rootDir, "data", "live_price_options.json");
const reportPath = path.join(rootDir, "reports", "2026-09-egypt-live-price-comparison.md");
const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
const validation = validateLiveOptions(data);
const scored = scoreBranches(summarizeBranches(data));

function money(value) {
  return `¥${Math.round(value).toLocaleString("zh-CN")}`;
}

function hours(minutes) {
  return `${(minutes / 60).toFixed(1)} 小时`;
}

function selectedLabel(row) {
  return row.selected === false ? "备选" : "计入总价";
}

function table(rows, columns) {
  const header = `| ${columns.map((column) => column.label).join(" | ")} |`;
  const divider = `| ${columns.map(() => "---").join(" | ")} |`;
  const body = rows.map((row) => `| ${columns.map((column) => String(column.value(row) ?? "").replaceAll("\n", " ")).join(" | ")} |`);
  return [header, divider, ...body].join("\n");
}

function itemTable(title, items, columns) {
  return `## ${title}\n\n${items.length ? table(items, columns) : "暂无公开可见价格。"}\n`;
}

function branchRows() {
  return table(scored, [
    { label: "分支", value: (row) => row.branch_name },
    { label: "总价", value: (row) => money(row.total_trip_cny) },
    { label: "人均参考", value: (row) => money(row.total_trip_cny_per_person) },
    { label: "移动时间", value: (row) => hours(row.total_travel_minutes) },
    { label: "行李待确认航段", value: (row) => row.checked_baggage_risk_count },
    { label: "价格分", value: (row) => row.price_score },
    { label: "时间分", value: (row) => row.time_score },
    { label: "综合分", value: (row) => row.total_score }
  ]);
}

function recommendationText() {
  const [first, second] = scored;
  if (!first || !second) return "暂无足够数据形成推荐。";
  const priceDelta = second.total_trip_cny - first.total_trip_cny;
  return `按价格和时间同权重，当前排序第一的是 **${first.branch_name}**，总价约 **${money(first.total_trip_cny)}**。第二名 **${second.branch_name}** 约 **${money(second.total_trip_cny)}**，比第一名高约 **${money(Math.abs(priceDelta))}**。如果更重视卢克索和古埃及历史完整度，可以接受 S3-HRG 的溢价；如果更重视省钱、省转场和红海度假，S3-SSH 更合适。`;
}

const content = `# 2026 埃及方案 3 实时比价报告

查询时间：${data.metadata.last_checked_at}

价格说明：主币种为人民币。公开网页无法确认的托运行李、餐食或取消政策会标记为 unknown，不默认计为已包含。表中“计入总价”表示当前用于评分的推荐项，“备选”表示可替代候选。

## 结论

${recommendationText()}

## 总价对比

${branchRows()}

## 价格口径

${table(data.metadata.exchange_rates, [
  { label: "汇率", value: (row) => row.pair },
  { label: "取值", value: (row) => row.rate },
  { label: "日期", value: (row) => row.checked_at },
  { label: "来源", value: (row) => row.source }
])}

${itemTable("机票明细", data.flights, [
  { label: "状态", value: selectedLabel },
  { label: "日期", value: (row) => row.date },
  { label: "航段", value: (row) => `${row.origin}-${row.destination}` },
  { label: "平台", value: (row) => row.platform },
  { label: "航司/摘要", value: (row) => row.carrier || row.flight_number_or_summary || "" },
  { label: "价格", value: (row) => money(row.price_cny) },
  { label: "时长", value: (row) => hours(row.duration_minutes) },
  { label: "托运行李", value: (row) => row.checked_baggage_included },
  { label: "置信度", value: (row) => row.confidence_level }
])}

${itemTable("酒店候选", data.hotels, [
  { label: "状态", value: selectedLabel },
  { label: "城市", value: (row) => row.city },
  { label: "酒店", value: (row) => row.hotel_name },
  { label: "平台", value: (row) => row.platform },
  { label: "晚数", value: (row) => row.nights },
  { label: "餐食", value: (row) => row.meal_plan },
  { label: "总价", value: (row) => money(row.price_cny_total) },
  { label: "位置/理由", value: (row) => row.why_candidate || row.location_summary || "" }
])}

${itemTable("当地项目", data.activities, [
  { label: "状态", value: selectedLabel },
  { label: "城市", value: (row) => row.city },
  { label: "项目", value: (row) => row.activity_name },
  { label: "平台", value: (row) => row.platform },
  { label: "时长", value: (row) => row.duration },
  { label: "接送", value: (row) => row.pickup_included || "" },
  { label: "2人价格", value: (row) => money(row.price_cny_total_for_2) },
  { label: "取舍", value: (row) => row.tradeoffs || "" }
])}

${itemTable("地面交通", data.ground_transport, [
  { label: "状态", value: selectedLabel },
  { label: "路线", value: (row) => `${row.from}-${row.to}` },
  { label: "方式", value: (row) => row.mode },
  { label: "时长", value: (row) => hours(row.duration_minutes) },
  { label: "总价", value: (row) => money(row.price_cny_total) },
  { label: "备注", value: (row) => row.notes || "" }
])}

## 校准清单

${validation.warnings.length ? validation.warnings.map((warning) => `- ${warning}`).join("\n") : "- 当前结构校验无警告。"}

## 来源备注

${data.source_notes.map((note) => `- ${note.topic}: ${note.note} ${note.url}`).join("\n")}
`;

fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, content);
console.log(`Wrote ${reportPath}`);

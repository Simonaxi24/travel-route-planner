import assert from "node:assert/strict";
import { validateEgyptItineraryData } from "../scripts/validate_egypt_itinerary.mjs";

const valid = {
  metadata: {
    currency: "CNY",
    fixed_arrival: { city_zh: "开罗", date: "2026-09-30", time: "09:00" },
    fixed_departure: { city_zh: "开罗", date: "2026-10-07", time: "14:45" },
    assistant_query_policy_zh: "待查询表示待助手查询，用户只处理登录、验证码和最终购买确认。"
  },
  options: [
    {
      id: "A1_HRG_BALANCED",
      name_zh: "A1 开罗 + 卢克索 + 赫尔格达",
      positioning_zh: "均衡推荐版",
      route_order_zh: ["开罗", "卢克索", "赫尔格达", "开罗"],
      includes_abu_simbel: false,
      default_recommendation: true,
      risk_level: "medium",
      hotel_nights: { "开罗": 3, "卢克索": 2, "赫尔格达": 1 },
      recommendation_zh: "默认推荐 A1，因为它保留完整红海日，并在 10/6 回开罗，10/7 国际返程风险低。"
    },
    {
      id: "A2_ABU_SIMBEL_HRG",
      name_zh: "A2 开罗 + 阿布辛贝 + 卢克索 + 赫尔格达",
      positioning_zh: "历史强化版",
      route_order_zh: ["开罗", "阿斯旺/阿布辛贝", "卢克索", "赫尔格达", "开罗"],
      includes_abu_simbel: true,
      default_recommendation: false,
      risk_level: "high",
      hotel_nights: { "开罗": 2, "阿斯旺": 1, "卢克索": 2, "赫尔格达": 1 },
      recommendation_zh: "A2 多阿布辛贝，但牺牲红海和缓冲，必须优先确认 10/7 赫尔格达早班飞开罗。"
    }
  ],
  days: [
    {
      option_id: "A1_HRG_BALANCED",
      date: "2026-09-30",
      city_zh: "开罗",
      blocks: [
        { period: "morning", title_zh: "抵达开罗", type: "arrival", risk_level: "low", must_book: false },
        { period: "afternoon", title_zh: "GEM 或市区轻量活动", type: "sight", risk_level: "low", must_book: false },
        { period: "evening", title_zh: "开罗入住休整", type: "hotel", risk_level: "low", must_book: true }
      ]
    },
    {
      option_id: "A2_ABU_SIMBEL_HRG",
      date: "2026-10-02",
      city_zh: "阿斯旺",
      blocks: [
        { period: "morning", title_zh: "阿布辛贝早出发", type: "sight", risk_level: "high", must_book: true },
        { period: "afternoon", title_zh: "阿布辛贝返回阿斯旺", type: "transfer", risk_level: "high", must_book: true },
        { period: "evening", title_zh: "阿斯旺休整", type: "hotel", risk_level: "medium", must_book: true }
      ]
    }
  ],
  query_tasks: [
    {
      id: "a2-hrg-cai-1007-early",
      option_ids: ["A2_ABU_SIMBEL_HRG"],
      category: "transport",
      title_zh: "10/7 赫尔格达 → 开罗早班",
      why_it_matters_zh: "决定 A2 是否可以当天衔接 14:45 国际航班",
      success_criteria_zh: "到达开罗不晚于 11:00",
      priority: "high",
      status: "assistant_pending",
      owner: "assistant"
    }
  ],
  researched_candidates: []
};

assert.deepEqual(validateEgyptItineraryData(valid), { ok: true, warnings: [] });

const domesticLeak = structuredClone(valid);
domesticLeak.days[0].blocks[0].title_zh = "北京到兰州";
assert.throws(() => validateEgyptItineraryData(domesticLeak), /China domestic segment leaked/);

const userOwnedTask = structuredClone(valid);
userOwnedTask.query_tasks[0].owner = "user";
assert.throws(() => validateEgyptItineraryData(userOwnedTask), /query task.*owner.*assistant/);

const wrongA2Order = structuredClone(valid);
wrongA2Order.options[1].route_order_zh = ["开罗", "卢克索", "阿斯旺/阿布辛贝", "赫尔格达", "开罗"];
assert.throws(() => validateEgyptItineraryData(wrongA2Order), /A2.*route order/);

const missingAbuSimbelDay = structuredClone(valid);
missingAbuSimbelDay.days = missingAbuSimbelDay.days.filter((day) => day.option_id !== "A2_ABU_SIMBEL_HRG");
assert.throws(() => validateEgyptItineraryData(missingAbuSimbelDay), /A2.*阿布辛贝/);

const badFixedDeparture = structuredClone(valid);
badFixedDeparture.metadata.fixed_departure.time = "15:00";
assert.throws(() => validateEgyptItineraryData(badFixedDeparture), /fixed_departure.*14:45/);

const badBlockLink = structuredClone(valid);
badBlockLink.days[0].blocks[0].query_task_ids = ["missing-task"];
assert.throws(() => validateEgyptItineraryData(badBlockLink), /unknown query task link/);

const aswanWithoutAbuSimbel = structuredClone(valid);
aswanWithoutAbuSimbel.options.push({
  id: "A3_ASWAN_ONLY",
  name_zh: "A3 开罗 + 阿斯旺 + 卢克索",
  positioning_zh: "错误测试方案",
  route_order_zh: ["开罗", "阿斯旺", "卢克索", "开罗"],
  includes_abu_simbel: false,
  default_recommendation: false,
  risk_level: "high",
  hotel_nights: { "开罗": 2, "阿斯旺": 1, "卢克索": 2 },
  recommendation_zh: "阿斯旺停留但不去阿布辛贝。"
});
aswanWithoutAbuSimbel.days.push({
  option_id: "A3_ASWAN_ONLY",
  date: "2026-10-02",
  city_zh: "阿斯旺",
  blocks: [
    { period: "morning", title_zh: "阿斯旺市区活动", type: "activity", risk_level: "medium", must_book: true }
  ]
});
assert.throws(() => validateEgyptItineraryData(aswanWithoutAbuSimbel), /A3_ASWAN_ONLY.*阿斯旺.*阿布辛贝/);

const smsBlockedTask = structuredClone(valid);
smsBlockedTask.query_tasks[0].status = "blocked_by_sms";
assert.deepEqual(validateEgyptItineraryData(smsBlockedTask), { ok: true, warnings: [] });

const noResultWithoutFallback = structuredClone(valid);
noResultWithoutFallback.query_tasks[0].status = "no_result_found";
assert.throws(() => validateEgyptItineraryData(noResultWithoutFallback), /10\/6.*回开罗/);

const noResultWithFallback = structuredClone(noResultWithoutFallback);
noResultWithFallback.options[1].fallback_zh = "若无可行 10/7 赫尔格达早班到开罗结果，建议 10/6 回开罗。";
assert.deepEqual(validateEgyptItineraryData(noResultWithFallback), { ok: true, warnings: [] });

console.log("egypt_itinerary_validation tests passed");

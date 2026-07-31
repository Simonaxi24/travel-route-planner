const periodOrder = { morning: 1, afternoon: 2, evening: 3 };

function clone(data) {
  return structuredClone(data);
}

function timeToMinutes(time) {
  const [hour, minute] = String(time || "00:00").split(":").map(Number);
  return hour * 60 + minute;
}

function selectedCandidatesForOption(data, optionId) {
  const taskIds = new Set(data.query_tasks.filter((task) => task.option_ids.includes(optionId)).map((task) => task.id));
  return data.researched_candidates.filter((candidate) => taskIds.has(candidate.task_id));
}

function deriveOptionRisks(data, option) {
  const risks = [];
  if (option.id === "A2_ABU_SIMBEL_HRG") {
    risks.push("A2 依赖 10/7 赫尔格达 → 开罗早班，必须优先确认。");
    risks.push("阿布辛贝会压缩红海时间。");
  }
  const hrgCaiTask = data.query_tasks.find((task) => task.id === "a2-hrg-cai-1007-early");
  if (option.id === "A2_ABU_SIMBEL_HRG" && hrgCaiTask?.status === "no_result_found") {
    risks.push("未找到 10/7 赫尔格达早班到开罗结果，建议 10/6 回开罗。");
  }
  const candidates = selectedCandidatesForOption(data, option.id);
  const hasLateHrgCai = candidates
    .filter((candidate) => candidate.task_id === "a2-hrg-cai-1007-early")
    .some((candidate) => candidate.arrival_time_local && timeToMinutes(candidate.arrival_time_local) > timeToMinutes("11:00"));
  if (hasLateHrgCai) {
    risks.push("10/7 到达开罗晚于 11:00，衔接 14:45 国际航班高风险。");
  }
  return risks;
}

function scoreOption(option, risks) {
  const stability = option.id === "A1_HRG_BALANCED" ? 90 : 68;
  const experience = option.includes_abu_simbel ? 96 : 84;
  const transfer = option.id === "A1_HRG_BALANCED" ? 82 : 62;
  const cost = option.id === "A1_HRG_BALANCED" ? 80 : 72;
  const riskPenalty = risks.some((risk) => risk.includes("晚于 11:00")) ? 18 : 0;
  return Math.round(stability * 0.35 + experience * 0.35 + transfer * 0.2 + cost * 0.1 - riskPenalty);
}

export function getDaysForOption(data, optionId) {
  return data.days
    .filter((day) => day.option_id === optionId)
    .map((day) => ({
      ...day,
      blocks: [...day.blocks].sort((a, b) => periodOrder[a.period] - periodOrder[b.period])
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function getQueryTasksForOption(data, optionId) {
  return data.query_tasks
    .filter((task) => task.option_ids.includes(optionId))
    .sort((a, b) => {
      if (a.priority === b.priority) return a.id.localeCompare(b.id);
      return a.priority === "high" ? -1 : 1;
    });
}

export function getOptionSummaries(data) {
  return data.options.map((option) => {
    const days = getDaysForOption(data, option.id);
    const tasks = getQueryTasksForOption(data, option.id);
    const candidates = selectedCandidatesForOption(data, option.id);
    const risks = deriveOptionRisks(data, option);
    const score = scoreOption(option, risks);
    const riskLevel = risks.some((risk) => risk.includes("晚于 11:00")) ? "high" : option.risk_level;
    return {
      ...option,
      risk_level: riskLevel,
      day_count: days.length,
      query_task_count: tasks.length,
      researched_candidate_count: candidates.length,
      risks,
      score,
      red_sea_time_level_zh: option.id === "A1_HRG_BALANCED" ? "完整" : "压缩"
    };
  }).sort((a, b) => {
    if (a.default_recommendation !== b.default_recommendation) return a.default_recommendation ? -1 : 1;
    return b.score - a.score;
  });
}

export function getRecommendation(data) {
  const summaries = getOptionSummaries(data);
  const recommended = summaries.find((summary) => summary.default_recommendation) || summaries[0];
  return {
    recommended_option_id: recommended.id,
    reason_zh: "推荐 A1，因为它保留完整红海日，并在 10/6 回开罗，10/7 国际返程风险低。",
    tradeoff_zh: "A2 可以覆盖阿布辛贝，但会压缩红海，并依赖 10/7 赫尔格达早班飞开罗。",
    next_action_zh: "如果更想要阿布辛贝，优先由助手查询 10/7 赫尔格达 → 开罗早班和阿布辛贝一日交通。"
  };
}

export function applyTransportCandidate(data, taskId, candidate) {
  const next = clone(data);
  const task = next.query_tasks.find((item) => item.id === taskId);
  if (!task) throw new Error(`Unknown query task ${taskId}`);
  const existingIndex = next.researched_candidates.findIndex((item) => item.id === candidate.id);
  const normalized = {
    ...candidate,
    task_id: taskId,
    status: "found_candidates"
  };
  if (existingIndex >= 0) next.researched_candidates[existingIndex] = normalized;
  else next.researched_candidates.push(normalized);
  task.status = "found_candidates";
  return next;
}

export function createEgyptItineraryExportPayload(data) {
  return JSON.stringify(data, null, 2);
}

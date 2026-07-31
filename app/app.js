import {
  createItineraryExportPayload,
  getAirportLabel,
  getDirectLabel,
  getFlightRouteLabel,
  scoreFeasibleScenarios,
  setCandidatePrice,
  summarizeScenarios
} from "./itinerary-core.js";
import {
  getOptionSummaries,
  getRecommendation,
  getDaysForOption,
  getQueryTasksForOption,
  applyTransportCandidate,
  createEgyptItineraryExportPayload
} from "./egypt-itinerary-core.js";

const isEgyptPlanner = Boolean(window.EGYPT_ITINERARY_DATA);
const state = {
  data: isEgyptPlanner ? structuredClone(window.EGYPT_ITINERARY_DATA) : null,
  activeOptionId: isEgyptPlanner ? window.EGYPT_ITINERARY_DATA.options.find((option) => option.default_recommendation)?.id || window.EGYPT_ITINERARY_DATA.options[0].id : null,
  focusedTaskId: null,
  draftByTaskId: {},
  noticeByTaskId: {},
  lastSavedCandidateId: null
};

const optionTabsEl = document.querySelector("#option-tabs");
const recommendationEl = document.querySelector("#recommendation");
const queryWorkbenchEl = document.querySelector("#query-workbench");
const dailyItineraryEl = document.querySelector("#daily-itinerary");
const queryTaskListEl = document.querySelector("#query-task-list");
const riskPanelEl = document.querySelector("#risk-panel");
const exportButton = document.querySelector("#export-json");

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDateZh(date) {
  const [, month, day] = date.split("-");
  return `${Number(month)}月${Number(day)}日`;
}

function statusLabel(status) {
  const labels = {
    assistant_pending: "待我查询",
    searching: "我正在查询",
    blocked_by_login: "需要你完成登录后继续",
    blocked_by_captcha: "需要你完成验证后继续",
    blocked_by_sms: "需要你完成短信验证后继续",
    no_result_found: "未找到可用结果",
    found_candidates: "已查到候选",
    selected: "已纳入方案",
    needs_retry: "助手需要换来源重试"
  };
  return labels[status] || status;
}

function verificationLabel(level) {
  const labels = {
    final_verified: "指定日实时价",
    live_search: "近实时价格",
    schedule_cross_checked: "班期已核",
    baseline: "基准价",
    blocked: "查询受阻"
  };
  return labels[level] || "待分级";
}

function priceStatusLabel(status) {
  const labels = {
    exact_live: "指定日实时价格",
    live_price_blocked: "价格被出票页拦住",
    reference_only: "仅参考价",
    date_price_needed: "需点日期核价",
    unknown: "价格待查"
  };
  return labels[status] || "价格待查";
}

function baggageLabel(status) {
  const labels = {
    included: "含行李",
    unknown: "行李待确认",
    not_included: "不含托运"
  };
  return labels[status] || "行李待确认";
}

function activeSummary() {
  return getOptionSummaries(state.data).find((summary) => summary.id === state.activeOptionId);
}

function queryValue(form, name) {
  return form.querySelector(`[name='${name}']`)?.value?.trim() || "";
}

const bookingSourceMap = {
  "a1-cai-lxr-1002": [
    ["Trip.com", "https://www.trip.com/flights/cairo-to-luxor/airfares-cai-lxr/"],
    ["Skyscanner", "https://www.skyscanner.com/routes/cai/lxr/cairo-to-luxor.html"],
    ["Expedia", "https://www.expedia.com/Flights-Search?trip=oneway&leg1=from:CAI,to:LXR,departure:10/2/2026TANYT&passengers=adults:1&mode=search"],
    ["EgyptAir", "https://www.egyptair.com/en/Pages/Booking.aspx"]
  ],
  "a1-hrg-cai-1006": [
    ["Trip.com", "https://www.trip.com/flights/hurghada-to-cairo/airfares-hrg-cai/"],
    ["Skyscanner", "https://www.skyscanner.com/routes/hrg/cai/hurghada-to-cairo.html"],
    ["Expedia", "https://www.expedia.com/Flights-Search?trip=oneway&leg1=from:HRG,to:CAI,departure:10/6/2026TANYT&passengers=adults:1&mode=search"],
    ["EgyptAir", "https://www.egyptair.com/en/Pages/Booking.aspx"],
    ["Air Cairo", "https://aircairo.com/en-gl/book-flight"]
  ],
  "a2-hrg-cai-1007-early": [
    ["Trip.com", "https://www.trip.com/flights/hurghada-to-cairo/airfares-hrg-cai/"],
    ["Skyscanner", "https://www.skyscanner.com/routes/hrg/cai/hurghada-to-cairo.html"],
    ["Expedia", "https://www.expedia.com/Flights-Search?trip=oneway&leg1=from:HRG,to:CAI,departure:10/7/2026TANYT&passengers=adults:1&mode=search"],
    ["EgyptAir", "https://www.egyptair.com/en/Pages/Booking.aspx"],
    ["Air Cairo", "https://aircairo.com/en-gl/book-flight"]
  ],
  "a2-cai-asw-1001": [
    ["Trip.com", "https://www.trip.com/flights/cairo-to-aswan/airfares-cai-asw/"],
    ["Skyscanner", "https://www.skyscanner.com/routes/cai/asw/cairo-to-aswan.html"],
    ["Expedia", "https://www.expedia.com/Flights-Search?trip=oneway&leg1=from:CAI,to:ASW,departure:10/1/2026TANYT&passengers=adults:1&mode=search"],
    ["EgyptAir", "https://www.egyptair.com/en/Pages/Booking.aspx"]
  ],
  "a1-lxr-hrg-1004": [
    ["Daytrip", "https://daytrip.com/en/transfers/luxor-eg/hurghada-eg"],
    ["12Go", "https://12go.asia/en/travel/luxor/hurghada"],
    ["TripsPoint", "https://www.tripspoint.com/egypt/luxor/tour/transfers-round-trips/private-transfer-from-luxor-to-hurghada/8607"]
  ],
  "a2-lxr-hrg-1005": [
    ["Daytrip", "https://daytrip.com/en/transfers/luxor-eg/hurghada-eg"],
    ["12Go", "https://12go.asia/en/travel/luxor/hurghada"],
    ["TripsPoint", "https://www.tripspoint.com/egypt/luxor/tour/transfers-round-trips/private-transfer-from-luxor-to-hurghada/8607"]
  ],
  "a2-asw-lxr-1003": [
    ["Egypt Trains", "https://egypttrains.com/aswan/luxor?lang=en"],
    ["12Go", "https://12go.asia/en/travel/aswan/luxor"],
    ["Daytrip", "https://daytrip.com/en/transfers/aswan-eg/luxor-eg"]
  ],
  "a2-abu-simbel-1002": [
    ["GetYourGuide", "https://www.getyourguide.com/aswan-l543/abu-simbel-tc218/"],
    ["Viator", "https://www.viator.com/Aswan-tourism/d796-r17141147813-s218"],
    ["Klook", "https://www.klook.com/search/result/?query=Abu%20Simbel%20Aswan"]
  ],
  "a1-red-sea-day-trip": [
    ["GetYourGuide", "https://www.getyourguide.com/hurghada-l403/snorkeling-tc57/"],
    ["Viator", "https://www.viator.com/Hurghada-tours/Snorkeling/d800-g17-c58"],
    ["Klook", "https://www.klook.com/search/result/?query=Hurghada%20snorkeling"]
  ],
  "a2-red-sea-half-day": [
    ["GetYourGuide", "https://www.getyourguide.com/hurghada-l403/snorkeling-tc57/"],
    ["Viator", "https://www.viator.com/Hurghada-tours/Snorkeling/d800-g17-c58"],
    ["Klook", "https://www.klook.com/search/result/?query=Hurghada%20speedboat"]
  ]
};

function hotelBookingSources(task) {
  const isHurghada = task.id.includes("hurghada");
  const isLuxor = task.id.includes("luxor");
  const city = isHurghada ? "Hurghada" : isLuxor ? "Luxor" : "Cairo";
  return [
    ["Booking", `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(city)}&group_adults=1&no_rooms=1&group_children=0`],
    ["Trip.com", `https://www.trip.com/hotels/list?city=${encodeURIComponent(city)}`],
    ["Agoda", `https://www.agoda.com/search?city=${encodeURIComponent(city)}`]
  ];
}

function bookingSourcesForTask(task) {
  if (bookingSourceMap[task.id]) return bookingSourceMap[task.id];
  if (task.category === "hotel") return hotelBookingSources(task);
  if (task.category === "activity") {
    return [
      ["GetYourGuide", "https://www.getyourguide.com/egypt-l169049/"],
      ["Viator", "https://www.viator.com/Egypt/d722"]
    ];
  }
  return [["Trip.com", "https://www.trip.com/flights/"], ["Skyscanner", "https://www.skyscanner.com/transport/flights/"]];
}

function renderBookingSourceLinks(task, extraClass = "") {
  return bookingSourcesForTask(task).map(([label, url]) => `
    <a class="${escapeHtml(extraClass)}" href="${escapeHtml(url)}" target="_blank" rel="noopener">
      ${escapeHtml(label)}
    </a>
  `).join("");
}

function candidatesForTask(taskId) {
  return state.data.researched_candidates
    .filter((candidate) => candidate.task_id === taskId)
    .sort((a, b) => {
      if (a.id === state.lastSavedCandidateId) return -1;
      if (b.id === state.lastSavedCandidateId) return 1;
      return String(b.searched_at || "").localeCompare(String(a.searched_at || ""));
    });
}

function taskById(taskId) {
  return state.data.query_tasks.find((task) => task.id === taskId);
}

function candidateById(candidateId) {
  return state.data.researched_candidates.find((candidate) => candidate.id === candidateId);
}

function draftValue(taskId, field) {
  return state.draftByTaskId[taskId]?.[field] || "";
}

function candidateToDraft(candidate) {
  return {
    candidate_id: candidate.id,
    candidate_title_zh: candidate.title_zh || "",
    source_platform: candidate.source_platform || "",
    source_url: candidate.source_url || "",
    flight_numbers: formatFlightNumbers(candidate),
    price_cny: candidate.price_cny || "",
    departure_time_local: candidate.departure_time_local || "",
    arrival_time_local: candidate.arrival_time_local || "",
    duration_minutes: candidate.duration_minutes || "",
    notes_zh: candidate.notes_zh || "",
    verification_level: candidate.verification_level,
    price_status: candidate.price_status,
    checked_baggage_included: candidate.checked_baggage_included,
    is_nonstop: candidate.is_nonstop,
    date: candidate.date,
    arrival_date_offset: candidate.arrival_date_offset
  };
}

function bestCandidateForTask(taskId) {
  const candidates = candidatesForTask(taskId);
  return candidates.find((candidate) => candidate.verification_level !== "baseline") || candidates[0];
}

function prefillDraftFromCandidate(candidate, notice) {
  state.focusedTaskId = candidate.task_id;
  state.draftByTaskId[candidate.task_id] = candidateToDraft(candidate);
  state.noticeByTaskId[candidate.task_id] = notice;
}

function formatFlightNumbers(candidate) {
  return Array.isArray(candidate.flight_numbers) && candidate.flight_numbers.length
    ? candidate.flight_numbers.join(" / ")
    : "";
}

function formatCandidatePrice(candidate) {
  if (candidate.price_cny) return `CNY ${candidate.price_cny}`;
  return priceStatusLabel(candidate.price_status);
}

function formatCandidateTime(candidate) {
  if (!candidate.departure_time_local && !candidate.arrival_time_local) return "";
  const arrivalOffset = candidate.arrival_date_offset ? `+${candidate.arrival_date_offset}` : "";
  return `${candidate.departure_time_local || "待查"} → ${candidate.arrival_time_local || "待查"}${arrivalOffset}`;
}

function renderCandidate(candidate, mode = "normal", withActions = false) {
  const flightNumbers = formatFlightNumbers(candidate);
  const time = formatCandidateTime(candidate);
  const title = candidate.title_zh || candidate.source_platform || "候选";
  const details = [
    candidate.date,
    flightNumbers ? `航班 ${flightNumbers}` : "",
    candidate.is_nonstop ? "直飞" : "",
    time,
    candidate.duration_minutes ? `${candidate.duration_minutes} 分钟` : "",
    baggageLabel(candidate.checked_baggage_included)
  ].filter(Boolean);
  return `
    <div class="candidate-item ${escapeHtml(mode)}">
      <div class="candidate-topline">
        <strong>${escapeHtml(title)}</strong>
        <span class="candidate-price">${escapeHtml(formatCandidatePrice(candidate))}</span>
      </div>
      <div class="candidate-badges">
        <span>${escapeHtml(verificationLabel(candidate.verification_level))}</span>
        <span>${escapeHtml(priceStatusLabel(candidate.price_status))}</span>
      </div>
      <p class="candidate-meta">${escapeHtml(details.join(" · "))}</p>
      ${candidate.notes_zh ? `<p class="candidate-note">${escapeHtml(candidate.notes_zh)}</p>` : ""}
      ${withActions ? `
        <div class="candidate-actions">
          ${candidate.source_url ? `<a href="${escapeHtml(candidate.source_url)}" target="_blank" rel="noopener">打开来源</a>` : ""}
          <button type="button" data-action="prefill-candidate" data-candidate-id="${escapeHtml(candidate.id)}">填入表单</button>
        </div>
      ` : ""}
    </div>
  `;
}

function renderBlockQuerySummary(block) {
  const taskIds = block.query_task_ids || [];
  if (!state.focusedTaskId || !taskIds.includes(state.focusedTaskId)) return "";
  const task = taskById(state.focusedTaskId);
  const candidates = candidatesForTask(state.focusedTaskId);
  return `
    <div class="block-query-summary">
      <div>
        <strong>${escapeHtml(task?.title_zh || "当前查询")}</strong>
        <span>${escapeHtml(statusLabel(task?.status || "assistant_pending"))}</span>
      </div>
      ${candidates.length ? candidates.slice(0, 3).map((candidate) => renderCandidate(candidate, "compact")).join("") : `<p class="muted">这段还没有写入候选，我会继续查。</p>`}
    </div>
  `;
}

function renderRecommendation() {
  const recommendation = getRecommendation(state.data);
  const active = activeSummary();
  recommendationEl.innerHTML = `
    <article class="summary-card">
      <div>
        <p class="summary-title">${escapeHtml(active.name_zh)}</p>
        <p>${escapeHtml(active.recommendation_zh || recommendation.reason_zh)}</p>
        <p class="muted">${escapeHtml(recommendation.tradeoff_zh)}</p>
      </div>
      <div class="score-pill">行程适配分 ${escapeHtml(active.score)}</div>
    </article>
  `;
}

function renderTabs() {
  optionTabsEl.innerHTML = getOptionSummaries(state.data).map((summary) => `
    <button type="button" class="${summary.id === state.activeOptionId ? "active" : ""}" data-option-id="${escapeHtml(summary.id)}">
      <strong>${escapeHtml(summary.name_zh)}</strong>
      <span>${escapeHtml(summary.positioning_zh)} · 红海${escapeHtml(summary.red_sea_time_level_zh)}</span>
    </button>
  `).join("");
}

function renderQueryWorkbench() {
  const activeTasks = getQueryTasksForOption(state.data, state.activeOptionId);
  const focusedTask = taskById(state.focusedTaskId);
  const priorityTasks = activeTasks
    .filter((task) => task.priority === "high")
    .filter((task) => task.id !== state.focusedTaskId)
    .slice(0, 4);
  const tasksToShow = focusedTask?.option_ids.includes(state.activeOptionId)
    ? [focusedTask, ...priorityTasks].slice(0, 4)
    : priorityTasks;
  queryWorkbenchEl.innerHTML = `
    <div class="workbench-head">
      <div>
        <h2>查询工作台</h2>
        <p class="muted">${focusedTask ? "当前关联行程：" : "我会优先查这些会直接影响结论的项目；查到后由我把候选写进右侧任务卡。"}${focusedTask ? escapeHtml(focusedTask.title_zh) : ""}</p>
      </div>
      <span class="workbench-badge">当前方案 ${escapeHtml(state.activeOptionId.startsWith("A1") ? "A1" : "A2")}</span>
    </div>
    <div class="workbench-actions">
      ${tasksToShow.map((task) => `
        <div class="workbench-source-card ${task.id === state.focusedTaskId ? "is-focused" : ""}">
          <strong>${escapeHtml(task.title_zh)}</strong>
          <span>实际订票/预订入口</span>
          <div class="source-links">${renderBookingSourceLinks(task)}</div>
        </div>
      `).join("")}
    </div>
  `;
}

function renderDailyItinerary() {
  const days = getDaysForOption(state.data, state.activeOptionId);
  dailyItineraryEl.innerHTML = days.map((day) => `
    <article class="day-card">
      <div class="day-head">
        <strong>${escapeHtml(formatDateZh(day.date))}</strong>
        <span>${escapeHtml(day.city_zh)}</span>
      </div>
      <div class="day-blocks">
        ${day.blocks.map((block) => `
          <div class="day-block risk-${escapeHtml(block.risk_level)} ${(block.query_task_ids || []).includes(state.focusedTaskId) ? "is-focused" : ""}">
            <span>${block.period === "morning" ? "上午" : block.period === "afternoon" ? "下午" : "晚上"}</span>
            <strong>${escapeHtml(block.title_zh)}</strong>
            <em>${block.must_book ? "需预订" : "可现场/灵活"}</em>
            ${(block.query_task_ids || []).map((taskId) => `
              <button type="button" class="block-query-button" data-task-id="${escapeHtml(taskId)}">助手查这段</button>
            `).join("")}
            ${renderBlockQuerySummary(block)}
          </div>
        `).join("")}
      </div>
    </article>
  `).join("");
}

function renderFocusedTaskPanel(task) {
  if (!task?.option_ids.includes(state.activeOptionId)) return "";
  const candidates = candidatesForTask(task.id);
  return `
    <article class="focused-query-panel" data-focused-task-id="${escapeHtml(task.id)}">
      <div class="focused-query-head">
        <div>
          <span>当前行程关联查询</span>
          <strong>${escapeHtml(task.title_zh)}</strong>
          <p>${escapeHtml(task.success_criteria_zh)}</p>
        </div>
        <span class="status-chip">${escapeHtml(statusLabel(task.status))}</span>
      </div>
      <div class="focused-candidates">
        ${candidates.length ? candidates.map((candidate) => renderCandidate(candidate, "normal", true)).join("") : `<p class="muted">还没有写入候选。我会查航班号、起降时间、价格和行李状态。</p>`}
      </div>
    </article>
  `;
}

function renderQueryTasks() {
  const tasks = getQueryTasksForOption(state.data, state.activeOptionId);
  const orderedTasks = state.focusedTaskId
    ? [
        ...tasks.filter((task) => task.id === state.focusedTaskId),
        ...tasks.filter((task) => task.id !== state.focusedTaskId)
      ]
    : tasks;
  const focusedTask = taskById(state.focusedTaskId);
  queryTaskListEl.innerHTML = `
    ${renderFocusedTaskPanel(focusedTask)}
    ${orderedTasks.map((task) => `
    <article class="task-card priority-${escapeHtml(task.priority)} ${task.id === state.focusedTaskId ? "is-focused" : ""}" data-task-id="${escapeHtml(task.id)}">
      <div class="task-main">
        <div class="task-head">
          <div>
            <strong>${escapeHtml(task.title_zh)}</strong>
            <p>${escapeHtml(task.why_it_matters_zh)}</p>
            <p class="muted">${escapeHtml(task.success_criteria_zh)}</p>
          </div>
          <span>${escapeHtml(statusLabel(task.status))}</span>
        </div>
        <div class="query-actions">
          ${renderBookingSourceLinks(task)}
          <button type="button" data-action="mark-no-result" data-task-id="${escapeHtml(task.id)}">标记未找到</button>
        </div>
        <p class="assistant-entry-note">候选录入区由助手填写；需要登录、验证码或付款确认时才交给你。</p>
        ${state.noticeByTaskId[task.id] ? `<p class="form-notice">${escapeHtml(state.noticeByTaskId[task.id])}</p>` : ""}
        <form class="candidate-form" data-task-id="${escapeHtml(task.id)}" data-category="${escapeHtml(task.category)}">
          <input name="candidate_title_zh" value="${escapeHtml(draftValue(task.id, "candidate_title_zh"))}" placeholder="候选名称，例如 EgyptAir 早班 / 红海度假村" aria-label="候选名称">
          <input name="source_platform" value="${escapeHtml(draftValue(task.id, "source_platform"))}" placeholder="来源平台" aria-label="来源平台">
          <input name="source_url" value="${escapeHtml(draftValue(task.id, "source_url"))}" placeholder="来源链接" aria-label="来源链接">
          <input name="flight_numbers" value="${escapeHtml(draftValue(task.id, "flight_numbers"))}" placeholder="航班号，例如 MS43 / SM8043" aria-label="航班号">
          <input name="price_cny" value="${escapeHtml(draftValue(task.id, "price_cny"))}" type="number" min="0" step="1" placeholder="价格 CNY" aria-label="价格 CNY">
          <input name="departure_time_local" value="${escapeHtml(draftValue(task.id, "departure_time_local"))}" placeholder="出发/开始 HH:MM" aria-label="出发或开始时间">
          <input name="arrival_time_local" value="${escapeHtml(draftValue(task.id, "arrival_time_local"))}" placeholder="到达/结束 HH:MM" aria-label="到达或结束时间">
          <input name="duration_minutes" value="${escapeHtml(draftValue(task.id, "duration_minutes"))}" type="number" min="0" step="1" placeholder="分钟" aria-label="时长分钟">
          <input name="notes_zh" value="${escapeHtml(draftValue(task.id, "notes_zh"))}" placeholder="备注，例如含托运行李/早晚饭/到达晚于 11:00" aria-label="备注">
          <button type="submit">助手保存候选</button>
        </form>
        <div class="candidate-list">
          ${candidatesForTask(task.id).map((candidate) => `
            ${renderCandidate(candidate, "normal", true)}
          `).join("")}
        </div>
      </div>
    </article>
  `).join("")}
  `;
}

function scrollFocusedTaskIntoView() {
  if (!state.focusedTaskId) return;
  const card =
    document.querySelector(`.focused-query-panel[data-focused-task-id="${state.focusedTaskId}"]`) ||
    document.querySelector(`.task-card[data-task-id="${state.focusedTaskId}"]`);
  card?.scrollIntoView?.({ block: "start", behavior: "smooth" });
}

function initLegacyItineraryApp() {
  const legacyState = {
    data: structuredClone(window.ITINERARY_DATA),
    activeScenarioId: null
  };
  const summaryEl = document.querySelector("#summary");
  const controlsEl = document.querySelector("#scenario-controls");
  const timelineEl = document.querySelector("#itinerary-timeline");
  const candidatePanelEl = document.querySelector("#candidate-panel");
  const riskListEl = document.querySelector("#risk-list");
  const legacyExportButton = document.querySelector("#export-json");

  function legacySummaries() {
    return scoreFeasibleScenarios(summarizeScenarios(legacyState.data));
  }

  function activeLegacySummary() {
    const summaries = legacySummaries();
    if (!legacyState.activeScenarioId) legacyState.activeScenarioId = summaries[0]?.id;
    return summaries.find((summary) => summary.id === legacyState.activeScenarioId) || summaries[0];
  }

  function formatMoney(value) {
    return value ? `¥${Number(value).toLocaleString("zh-CN")}` : "待查询";
  }

  function formatMonthDaySlash(date) {
    const [, month, day] = date.split("-");
    return `${Number(month)}/${Number(day)}`;
  }

  function renderLegacySummary() {
    const active = activeLegacySummary();
    if (!summaryEl || !active) return;
    summaryEl.innerHTML = `
      <article class="summary-card">
        <div>
          <p class="summary-title">当前推荐：${escapeHtml(active.label_zh)}</p>
          <p>${active.total_score === null ? "不可评分" : `综合分 ${active.total_score}`}</p>
        </div>
        <div class="score-pill">${escapeHtml(formatMoney(active.total_trip_cny))}</div>
      </article>
    `;
  }

  function renderLegacyControls() {
    if (!controlsEl) return;
    controlsEl.innerHTML = legacySummaries().map((summary) => `
      <button type="button" class="${summary.id === legacyState.activeScenarioId ? "active" : ""}" data-scenario-id="${escapeHtml(summary.id)}">${escapeHtml(summary.label_zh)}</button>
    `).join("");
  }

  function renderLegacyTimeline() {
    const active = activeLegacySummary();
    if (!timelineEl || !active) return;
    const rows = [
      ...active.selected_flights.map((flight) => ({ kind: "flight", date: flight.date, flight })),
      ...active.missing_segments.map((segment) => ({ kind: "missing", date: segment.date, segment }))
    ].sort((a, b) => a.date.localeCompare(b.date));
    timelineEl.innerHTML = rows.map((row) => {
      const date = formatDateZh(row.date);
      if (row.kind === "missing") {
        return `
          <article class="timeline-item missing">
            <div class="timeline-date">${escapeHtml(date)}</div>
            <div>
              <h3>${escapeHtml(`${row.segment.from_city_zh} → ${row.segment.to_city_zh}`)}</h3>
              <p>${escapeHtml(row.segment.status_zh)} · ${escapeHtml(row.segment.reason_zh)}</p>
            </div>
            <strong>待查询</strong>
          </article>
        `;
      }
      const flight = row.flight;
      return `
        <article class="timeline-item">
          <div class="timeline-date">${escapeHtml(date)}</div>
          <div>
            <h3>${escapeHtml(getFlightRouteLabel(flight))}</h3>
            <p>${escapeHtml(getAirportLabel(flight, "origin"))} → ${escapeHtml(getAirportLabel(flight, "destination"))}</p>
            <p>${escapeHtml(flight.departure_time_local)} → ${escapeHtml(flight.arrival_time_local)} · ${escapeHtml(getDirectLabel(flight))}</p>
          </div>
          <strong>${escapeHtml(formatMoney(flight.price_cny))}</strong>
        </article>
      `;
    }).join("");
  }

  function renderLegacyCandidates() {
    const active = activeLegacySummary();
    if (!candidatePanelEl || !active) return;
    candidatePanelEl.innerHTML = active.selected_flights.map((flight) => `
      <div class="candidate-row" data-candidate-id="${escapeHtml(flight.id)}">
        <div>
          <strong>${escapeHtml(getFlightRouteLabel(flight))}</strong>
          <p>${escapeHtml(flight.source_platform)} · ${escapeHtml(flight.flight_numbers.join(" / "))}</p>
        </div>
        <input class="itinerary-price-input" value="${escapeHtml(flight.price_cny)}" aria-label="价格">
        <span>${escapeHtml(formatMoney(flight.price_cny))}</span>
      </div>
    `).join("");
  }

  function renderLegacyRisks() {
    const active = activeLegacySummary();
    if (!riskListEl || !active) return;
    const risks = [
      ...active.selected_flights
        .filter((flight) => flight.direct_search_result === "not_found")
        .map((flight) => `${formatMonthDaySlash(flight.date)} ${getFlightRouteLabel(flight)} 未找到直飞`),
      ...active.missing_segments.map((segment) => {
        const noDirect = segment.reason_zh.includes("无直飞") || segment.reason_zh.includes("未找到直飞");
        return `${formatMonthDaySlash(segment.date)} ${segment.from_city_zh} → ${segment.to_city_zh} ${noDirect ? "未找到直飞 · " : ""}待查询`;
      })
    ];
    riskListEl.innerHTML = risks.map((risk) => `<p class="risk-line">${escapeHtml(risk)}</p>`).join("");
  }

  function renderLegacy() {
    renderLegacySummary();
    renderLegacyControls();
    renderLegacyTimeline();
    renderLegacyCandidates();
    renderLegacyRisks();
  }

  controlsEl?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-scenario-id]");
    if (!button) return;
    legacyState.activeScenarioId = button.dataset.scenarioId;
    renderLegacy();
  });

  candidatePanelEl?.addEventListener("input", (event) => {
    if (!event.target.classList?.contains("itinerary-price-input")) return;
    const row = event.target.closest("[data-candidate-id]");
    legacyState.data = setCandidatePrice(legacyState.data, row.dataset.candidateId, event.target.value);
    renderLegacySummary();
    renderLegacyTimeline();
    renderLegacyRisks();
  });

  legacyExportButton?.addEventListener("click", () => {
    const blob = new Blob([createItineraryExportPayload(legacyState.data)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "itinerary.updated.json";
    link.click();
    URL.revokeObjectURL(url);
  });

  renderLegacy();
}

function renderRisks() {
  const active = activeSummary();
  riskPanelEl.innerHTML = active.risks.map((risk) => `<p class="risk-line">${escapeHtml(risk)}</p>`).join("");
}

function render() {
  renderRecommendation();
  renderQueryWorkbench();
  renderTabs();
  renderDailyItinerary();
  renderQueryTasks();
  renderRisks();
}

if (!isEgyptPlanner) {
  initLegacyItineraryApp();
} else {
optionTabsEl.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-option-id]");
  if (!button) return;
  state.activeOptionId = button.dataset.optionId;
  state.focusedTaskId = null;
  render();
});

dailyItineraryEl.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-task-id]");
  if (!button) return;
  state.focusedTaskId = button.dataset.taskId;
  const candidate = bestCandidateForTask(button.dataset.taskId);
  if (candidate && !state.draftByTaskId[button.dataset.taskId]) {
    prefillDraftFromCandidate(candidate, "已自动填入当前候选；你可以补价格/行李后保存。");
  }
  render();
  scrollFocusedTaskIntoView();
});

queryTaskListEl.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.target;
  const taskId = form.dataset.taskId;
  const draft = state.draftByTaskId[taskId] || {};
  const flightNumbersValue = queryValue(form, "flight_numbers");
  const priceValue = Number(queryValue(form, "price_cny")) || undefined;
  const hasMeaningfulInput = [
    queryValue(form, "candidate_title_zh"),
    queryValue(form, "source_platform"),
    queryValue(form, "source_url"),
    flightNumbersValue,
    queryValue(form, "price_cny"),
    queryValue(form, "departure_time_local"),
    queryValue(form, "arrival_time_local"),
    queryValue(form, "duration_minutes"),
    queryValue(form, "notes_zh")
  ].some(Boolean);

  if (!hasMeaningfulInput) {
    state.noticeByTaskId[taskId] = "没有保存：先点候选卡的“填入表单”，或至少填写一个候选字段。";
    state.focusedTaskId = taskId;
    render();
    scrollFocusedTaskIntoView();
    return;
  }

  const candidate = {
    id: draft.candidate_id || `${taskId}-${Date.now()}`,
    title_zh: queryValue(form, "candidate_title_zh"),
    source_platform: queryValue(form, "source_platform"),
    source_url: queryValue(form, "source_url"),
    searched_at: new Date().toISOString(),
    type: form.dataset.category || "unknown",
    flight_numbers: flightNumbersValue ? flightNumbersValue.split("/").map((item) => item.trim()).filter(Boolean) : undefined,
    departure_time_local: queryValue(form, "departure_time_local"),
    arrival_time_local: queryValue(form, "arrival_time_local"),
    duration_minutes: Number(queryValue(form, "duration_minutes")) || undefined,
    price_cny: priceValue,
    verification_level: priceValue ? "live_search" : draft.verification_level || "live_search",
    price_status: priceValue ? "exact_live" : draft.price_status || "unknown",
    checked_baggage_included: draft.checked_baggage_included || "unknown",
    is_nonstop: draft.is_nonstop,
    date: draft.date,
    arrival_date_offset: draft.arrival_date_offset,
    notes_zh: queryValue(form, "notes_zh")
  };
  state.data = applyTransportCandidate(state.data, taskId, candidate);
  state.focusedTaskId = taskId;
  state.lastSavedCandidateId = candidate.id;
  delete state.draftByTaskId[taskId];
  state.noticeByTaskId[taskId] = "已保存候选，并已在本任务候选列表置顶。";
  render();
  scrollFocusedTaskIntoView();
});

queryTaskListEl.addEventListener("click", (event) => {
  const actionButton = event.target.closest("button[data-action]");
  if (!actionButton) return;

  if (actionButton.dataset.action === "prefill-candidate") {
    const candidate = candidateById(actionButton.dataset.candidateId);
    if (!candidate) return;
    prefillDraftFromCandidate(candidate, "已把这条候选填入表单；你可以补价格/行李后保存。");
    render();
    scrollFocusedTaskIntoView();
    return;
  }

  if (actionButton.dataset.action !== "mark-no-result") return;
  const task = state.data.query_tasks.find((item) => item.id === actionButton.dataset.taskId);
  if (!task) return;
  task.status = "no_result_found";
  render();
});

exportButton.addEventListener("click", () => {
  const blob = new Blob([createEgyptItineraryExportPayload(state.data)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "egypt_itinerary.updated.json";
  link.click();
  URL.revokeObjectURL(url);
});

render();
}

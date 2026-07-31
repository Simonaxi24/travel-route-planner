import assert from "node:assert/strict";
import fs from "node:fs";

class FakeElement {
  constructor(selector) {
    this.selector = selector;
    this.innerHTML = "";
    this.textContent = "";
    this.listeners = {};
    this.dataset = {};
    this.download = "";
    this.clicked = false;
    this.scrolled = false;
  }
  addEventListener(type, handler) {
    this.listeners[type] = handler;
  }
  querySelector() {
    return null;
  }
  closest() {
    return null;
  }
  click() {
    this.clicked = true;
  }
  scrollIntoView() {
    this.scrolled = true;
  }
}

class FakeDocument {
  constructor() {
    this.createdElements = [];
    this.elements = new Map([
      ["#option-tabs", new FakeElement("#option-tabs")],
      ["#recommendation", new FakeElement("#recommendation")],
      ["#query-workbench", new FakeElement("#query-workbench")],
      ["#daily-itinerary", new FakeElement("#daily-itinerary")],
      ["#query-task-list", new FakeElement("#query-task-list")],
      ["#risk-panel", new FakeElement("#risk-panel")],
      ["#export-json", new FakeElement("#export-json")]
    ]);
  }
  querySelector(selector) {
    if (selector.startsWith(".task-card")) return new FakeElement(selector);
    return this.elements.get(selector) || null;
  }
  createElement(selector) {
    const element = new FakeElement(selector);
    this.createdElements.push(element);
    return element;
  }
}

const data = JSON.parse(fs.readFileSync("data/egypt_itinerary_options.json", "utf8"));
assert.deepEqual(data.options.map((option) => option.id).sort(), ["A1_HRG_BALANCED", "A2_ABU_SIMBEL_HRG"]);
assert.equal(data.query_tasks.every((task) => task.owner === "assistant"), true);
data.query_tasks.find((task) => task.option_ids.includes("A1_HRG_BALANCED")).status = "blocked_by_sms";
const document = new FakeDocument();
const previousGlobals = {
  document: globalThis.document,
  window: globalThis.window,
  Blob: globalThis.Blob,
  URL: globalThis.URL
};
const OriginalURL = globalThis.URL;
globalThis.document = document;
globalThis.window = { EGYPT_ITINERARY_DATA: structuredClone(data) };
globalThis.Blob = class {
  constructor(parts, options) {
    this.parts = parts;
    this.options = options;
  }
};
globalThis.URL = class FakeURL extends OriginalURL {
  static createObjectURL() {
    return "blob:egypt-itinerary";
  }
  static revokeObjectURL() {}
};

try {
  await import(`../app/app.js?egypt-test=${Date.now()}`);

  const tabs = document.querySelector("#option-tabs");
  const recommendation = document.querySelector("#recommendation");
  const workbench = document.querySelector("#query-workbench");
  const daily = document.querySelector("#daily-itinerary");
  const tasks = document.querySelector("#query-task-list");
  const risks = document.querySelector("#risk-panel");
  const exportButton = document.querySelector("#export-json");

  assert.match(tabs.innerHTML, /A1 开罗 \+ 卢克索 \+ 赫尔格达/);
  assert.match(tabs.innerHTML, /A2 开罗 \+ 阿布辛贝 \+ 卢克索 \+ 赫尔格达/);
  assert.match(recommendation.innerHTML, /默认推荐 A1/);
  assert.match(recommendation.innerHTML, /完整红海日/);
  assert.match(workbench.innerHTML, /查询工作台/);
  assert.match(workbench.innerHTML, /实际订票\/预订入口/);
  assert.match(workbench.innerHTML, /Trip\.com/);
  assert.match(workbench.innerHTML, /Skyscanner/);
  assert.match(workbench.innerHTML, /10\/2 开罗 → 卢克索交通/);
  assert.match(daily.innerHTML, /9月30日/);
  assert.match(daily.innerHTML, /金字塔/);
  assert.match(daily.innerHTML, /助手查这段/);
  assert.match(daily.innerHTML, /data-task-id="a1-cai-lxr-1002"/);
  assert.match(tasks.innerHTML, /待我查询/);
  assert.match(tasks.innerHTML, /需要你完成短信验证后继续/);
  assert.match(tasks.innerHTML, /Trip\.com/);
  assert.match(tasks.innerHTML, /Skyscanner/);
  assert.match(tasks.innerHTML, /Expedia/);
  assert.match(tasks.innerHTML, /助手保存候选/);
  assert.match(tasks.innerHTML, /候选录入区由助手填写/);
  assert.match(tasks.innerHTML, /标记未找到/);
  assert.match(tasks.innerHTML, /name="price_cny"/);
  assert.match(tasks.innerHTML, /name="source_url"/);
  assert.match(tasks.innerHTML, /name="flight_numbers"/);
  assert.match(tasks.innerHTML, /班期已核/);
  assert.doesNotMatch(`${workbench.innerHTML}\n${tasks.innerHTML}`, /google\.com\/search/);
  assert.doesNotMatch(`${tabs.innerHTML}\n${recommendation.innerHTML}\n${daily.innerHTML}\n${tasks.innerHTML}\n${risks.innerHTML}`, /用户自行查询|你自己查|请自行查询/);

  daily.listeners.click({
    target: {
      dataset: { taskId: "a1-hrg-cai-1006" },
      closest() {
        return this;
      }
    }
  });

  assert.match(tasks.innerHTML, /class="focused-query-panel" data-focused-task-id="a1-hrg-cai-1006"/);
  assert.match(tasks.innerHTML, /MS43/);
  assert.match(tasks.innerHTML, /06:30 → 07:40/);
  assert.match(tasks.innerHTML, /已自动填入当前候选/);
  assert.match(tasks.innerHTML, /value="EgyptAir MS43 赫尔格达 → 开罗早班"/);
  assert.match(tasks.innerHTML, /value="MS43 \/ SM8043"/);
  assert.match(tasks.innerHTML, /<article class="task-card[^>]*data-task-id="a1-hrg-cai-1006"/);
  assert.match(tasks.innerHTML, /task-card[^"]*is-focused/);
  assert.match(workbench.innerHTML, /当前关联行程/);
  assert.match(daily.innerHTML, /block-query-summary/);

  tasks.listeners.submit({
    preventDefault() {},
    target: {
      dataset: { taskId: "a1-cairo-hotel", category: "hotel" },
      querySelector() {
        return { value: "" };
      }
    }
  });
  assert.match(tasks.innerHTML, /没有保存/);

  tabs.listeners.click({
    target: {
      dataset: { optionId: "A2_ABU_SIMBEL_HRG" },
      closest() {
        return this;
      }
    }
  });

  assert.match(daily.innerHTML, /阿布辛贝/);
  assert.match(workbench.innerHTML, /10\/7 赫尔格达 → 开罗早班/);
  assert.match(risks.innerHTML, /10\/7 赫尔格达.*开罗|早班/);
  assert.match(tasks.innerHTML, /10\/7 赫尔格达 → 开罗早班/);
  assert.doesNotMatch(`${tabs.innerHTML}\n${recommendation.innerHTML}\n${daily.innerHTML}\n${tasks.innerHTML}\n${risks.innerHTML}`, /用户自行查询|你自己查|请自行查询/);

  const candidateValues = new Map([
    ["[name='candidate_title_zh']", "埃及航空早班"],
    ["[name='source_platform']", "EgyptAir"],
    ["[name='source_url']", "https://example.com/hrg-cai"],
    ["[name='price_cny']", "820"],
    ["[name='departure_time_local']", "10:35"],
    ["[name='arrival_time_local']", "11:35"],
    ["[name='duration_minutes']", "60"],
    ["[name='notes_zh']", "到达晚于 11:00"]
  ]);
  tasks.listeners.submit({
    preventDefault() {},
    target: {
      dataset: { taskId: "a2-hrg-cai-1007-early", category: "transport" },
      querySelector(selector) {
        return { value: candidateValues.get(selector) || "" };
      }
    }
  });

  assert.match(tasks.innerHTML, /已查到候选/);
  assert.match(tasks.innerHTML, /埃及航空早班/);
  assert.match(tasks.innerHTML, /820/);
  assert.match(risks.innerHTML, /晚于 11:00/);

  tasks.listeners.click({
    target: {
      dataset: { action: "mark-no-result", taskId: "a2-hrg-cai-1007-early" },
      closest() {
        return this;
      }
    }
  });

  assert.match(tasks.innerHTML, /未找到可用结果/);
  assert.match(risks.innerHTML, /建议 10\/6 回开罗/);

  exportButton.listeners.click();
  const exportedLink = document.createdElements.find((item) => item.download === "egypt_itinerary.updated.json");
  assert.ok(exportedLink);
  assert.equal(exportedLink.clicked, true);
} finally {
  globalThis.document = previousGlobals.document;
  globalThis.window = previousGlobals.window;
  globalThis.Blob = previousGlobals.Blob;
  globalThis.URL = previousGlobals.URL;
}

console.log("egypt_itinerary_app tests passed");

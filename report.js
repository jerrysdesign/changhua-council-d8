"use strict";

const historicalNames = ["謝淑如", "洪子超", "吳淑娟", "蔡家豪", "洪騰明", "張國棟", "陳一惇"];
const historicalParties = ["國民黨", "民進黨", "無黨籍", "無黨籍", "民進黨", "國民黨", "國民黨"];
const elected2022 = new Set(["洪子超", "吳淑娟", "洪騰明", "張國棟", "陳一惇"]);
const townships = [
  ["二林鎮", 25094, 3244, 4863, 2738, 1968, 3564, 5674, 3043],
  ["芳苑鄉", 17342, 2602, 3415, 1615, 1749, 3388, 1917, 2656],
  ["大城鄉", 8790, 873, 1402, 2996, 1096, 847, 653, 923],
  ["竹塘鄉", 8575, 676, 1554, 1263, 1346, 1145, 998, 1593]
];
// Registered voters and ballots cast, in the same order as townships.
const turnout = [[40855, 26094], [27305, 18098], [13596, 9171], [12020, 8969]];
const candidates2026 = [
  ["張國棟", "中國國民黨"], ["洪騰明", "民主進步黨"], ["謝淑如", "無黨籍"],
  ["黃淑儀", "無黨籍"], ["洪雅婷", "台灣民眾黨"], ["吳淑娟", "無黨籍"],
  ["曾温泉", "中國國民黨"], ["洪子超", "民主進步黨"], ["洪建興", "無黨籍"]
];
const sums = townships[0].slice(1).map((_, i) =>
  townships.reduce((sum, row) => sum + row[i + 1], 0)
);
const totalVotes = sums[0];
const numbers = new Intl.NumberFormat("zh-TW");
const percentages = new Intl.NumberFormat("zh-TW", {style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2});
const first = document.querySelector("#first");
const second = document.querySelector("#second");
const metric = document.querySelector("#metric");
const modelInput = document.querySelector("#total");
const heatMetric = document.querySelector("#heat-metric");
const rankedCandidates = historicalNames.map((_, index) => index)
  .sort((left, right) => sums[right + 1] - sums[left + 1]);

function element(tag, value, className) {
  const node = document.createElement(tag);
  if (value !== undefined) node.textContent = value;
  if (className) node.className = className;
  return node;
}

function barRow(label, value, fraction, series = "") {
  const row = element("li", undefined, series);
  const track = element("span", undefined, "track");
  const fill = element("span", undefined, "fill");
  fill.style.setProperty("--width", (100 * fraction) + "%");
  track.setAttribute("aria-hidden", "true");
  track.append(fill);
  row.append(element("span", label), track, element("strong", value));
  return row;
}

function candidateLink(index, label) {
  const link = element("a", label);
  link.href = "#compare";
  link.setAttribute("aria-label", "查看" + historicalNames[index] + "的 2022 年得票");
  link.addEventListener("click", () => {
    first.value = String(index);
    if (first.value === second.value) second.value = "";
    drawComparison();
  });
  return link;
}

function renderRoster() {
  const roster = document.querySelector("#roster");
  candidates2026.forEach(([name, party], index) => {
    const card = element("article", undefined, "candidate-card");
    const ballot = element("span", String(index + 1), "ballot");
    ballot.setAttribute("aria-label", String(index + 1) + " 號");
    const content = element("div");
    content.append(element("h3", name), element("p", party, "candidate-party"));
    const previousIndex = historicalNames.indexOf(name);
    const detail = element("p", undefined, "candidate-history");
    if (previousIndex === -1) {
      detail.textContent = "未列於 2022 年同區名單";
    } else {
      const link = candidateLink(previousIndex, "上屆 " + numbers.format(sums[previousIndex + 1]) + " 票");
      detail.append(link, elected2022.has(name) ? " ／ 當選" : " ／ 未當選");
    }
    content.append(detail);
    card.append(ballot, content);
    roster.append(card);
  });
}

function drawComparison() {
  const selections = [...new Set([first.value, second.value].filter(Boolean))].map(Number);
  const mode = metric.value;
  const scale = mode === "votes" ? 6000 : 1;
  const legend = selections.map((index, series) =>
    element("span", historicalNames[index] + " ／ 全區 " + numbers.format(sums[index + 1]) + " 票", "series-key series-" + series)
  );
  document.querySelector("#chart-summary").replaceChildren(...legend);
  document.querySelector("#chart-scale").textContent = mode === "votes"
    ? "全圖共用同一尺度，橫條滿格為 6,000 票。"
    : "橫條滿格為 100%。分母為" + (mode === "local" ? "該鄉鎮有效票。" : "各候選人的全區得票。");

  const charts = townships.map(([town, valid, ...votes]) => {
    const group = element("section");
    const bars = element("ul", undefined, "bars");
    const label = element("h3", town);
    selections.forEach((index, series) => {
      const amount = votes[index];
      const value = mode === "votes" ? amount : amount / (mode === "local" ? valid : sums[index + 1]);
      bars.append(barRow(historicalNames[index], mode === "votes" ? numbers.format(value) : percentages.format(value), value / scale, "series-" + series));
    });
    group.append(label, bars);
    return group;
  });
  document.querySelector("#comparison").replaceChildren(...charts);
}

function appendTableRow(section, values, header = false) {
  const row = element("tr");
  values.forEach((value, index) => {
    const cell = element(header || index === 0 ? "th" : "td", typeof value === "number" ? numbers.format(value) : value);
    if (header) cell.scope = "col";
    else if (index === 0) cell.scope = "row";
    row.append(cell);
  });
  section.append(row);
  return row;
}

function renderRanking() {
  const maxVotes = sums[rankedCandidates[0] + 1];
  const rows = rankedCandidates.map(index => {
    const name = historicalNames[index];
    const votes = sums[index + 1];
    const elected = elected2022.has(name);
    const row = barRow(name, numbers.format(votes), votes / maxVotes, elected ? "rank-elected" : "rank-unelected");
    const identity = element("span", undefined, "rank-identity");
    identity.append(candidateLink(index, name), element("small", historicalParties[index]));
    row.firstElementChild.replaceWith(identity);
    const result = element("span", undefined, "rank-result");
    result.append(row.lastElementChild, element("small", percentages.format(votes / totalVotes) + " ／ " + (elected ? "當選" : "未當選")));
    row.append(result);
    return row;
  });
  document.querySelector("#ranking").replaceChildren(...rows);
}

function renderTurnout() {
  const totalElectors = turnout.reduce((sum, [electors]) => sum + electors, 0);
  const totalBallots = turnout.reduce((sum, [, ballots]) => sum + ballots, 0);
  const bars = document.querySelector("#turnout-bars");
  const table = document.querySelector("#turnout-table");
  const districtRate = totalBallots / totalElectors;
  bars.append(barRow("全區", percentages.format(districtRate), districtRate, "district-turnout"));
  appendTableRow(table.tHead, ["鄉鎮", "選舉人數", "投票數", "投票率", "有效票", "無效票"], true);
  townships.forEach(([town, valid], index) => {
    const [electors, ballots] = turnout[index];
    const rate = ballots / electors;
    bars.append(barRow(town, percentages.format(rate), rate));
    appendTableRow(table.tBodies[0], [town, electors, ballots, percentages.format(rate), valid, ballots - valid]);
  });
  appendTableRow(table.tFoot, ["全區合計", totalElectors, totalBallots, percentages.format(districtRate), totalVotes, totalBallots - totalVotes]);
}

function drawHeatmap() {
  const local = heatMetric.value === "local";
  const table = document.querySelector("#heat-table");
  const body = table.tBodies[0];
  body.replaceChildren();
  const rows = rankedCandidates.map(index => townships.map(([, valid, ...votes]) =>
    votes[index] / (local ? valid : sums[index + 1])
  ));
  const maxShare = Math.max(...rows.flat());
  rows.forEach((shares, rank) => {
    const row = appendTableRow(body, [historicalNames[rankedCandidates[rank]], ...shares.map(share => percentages.format(share))]);
    shares.forEach((share, column) => {
      row.cells[column + 1].style.setProperty("--heat", (10 + 44 * share / maxShare) + "%");
    });
  });
  document.querySelector("#heat-note").textContent = (local
    ? "每欄以該鄉鎮有效票為分母。"
    : "每列以該候選人的全區得票為分母，四鄉鎮加總約為 100%。") +
    "顏色越深，數值越高。";
}

function allocateVotes(total) {
  const allocations = townships.map(([town, valid], index) => {
    const scaled = valid * total;
    return {town, index, votes: Math.floor(scaled / totalVotes), remainder: scaled % totalVotes};
  });
  const remainder = total - allocations.reduce((sum, entry) => sum + entry.votes, 0);
  const ranked = [...allocations].sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  ranked.slice(0, remainder).forEach(entry => { entry.votes += 1; });
  return allocations;
}

function drawAllocation(total) {
  const rows = allocateVotes(total).map(entry =>
    barRow(entry.town, numbers.format(entry.votes) + " 票", entry.votes / total)
  );
  document.querySelector("#model-results").replaceChildren(...rows);
  document.querySelector("#model-summary").textContent = "四鄉鎮合計 " + numbers.format(total) + " 票";
}

historicalNames.forEach((name, index) => {
  first.add(new Option(name, String(index)));
  second.add(new Option(name, String(index)));
});
second.add(new Option("單人檢視", ""), 0);
first.value = "1";
second.value = "4";
first.addEventListener("change", () => {
  if (first.value === second.value) second.value = "";
  drawComparison();
});
second.addEventListener("change", () => {
  if (first.value === second.value) second.value = "";
  drawComparison();
});
metric.addEventListener("change", drawComparison);
appendTableRow(document.querySelector("#vote-table thead"), ["鄉鎮", "有效票", ...historicalNames], true);
townships.forEach(row => appendTableRow(document.querySelector("#vote-table tbody"), row));
appendTableRow(document.querySelector("#vote-table tfoot"), ["全區合計", ...sums]);
document.querySelector("#model-form").addEventListener("submit", event => {
  event.preventDefault();
  if (modelInput.validity.valid) drawAllocation(modelInput.valueAsNumber);
});
document.querySelector("#reset").addEventListener("click", () => {
  modelInput.value = totalVotes;
  drawAllocation(totalVotes);
});
appendTableRow(document.querySelector("#heat-table thead"), ["候選人", ...townships.map(([town]) => town)], true);
heatMetric.addEventListener("change", drawHeatmap);
renderRoster();
renderRanking();
renderTurnout();
drawHeatmap();
drawComparison();
drawAllocation(totalVotes);

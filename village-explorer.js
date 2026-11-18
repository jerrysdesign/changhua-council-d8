"use strict";

const villageTown = document.querySelector("#village-town");
const villageMetric = document.querySelector("#village-metric");
const villageFirst = document.querySelector("#village-first");
const villageSecond = document.querySelector("#village-second");
const villageSort = document.querySelector("#village-sort");
const villageName = document.querySelector("#village-name");
const dotTab = document.querySelector("#village-dots-tab");
const heatTab = document.querySelector("#village-heat-tab");
const dotPanel = document.querySelector("#village-dots");
const heatPanel = document.querySelector("#village-heat");
const villageTable = document.querySelector("#village-full-table");
const villageHeat = document.querySelector("#village-heat-table");
const villageGroups = Object.fromEntries(Object.entries(villageResults).map(([town, rows]) => [
  town, rows.map(([name, electors, ballots, valid, ...votes]) => ({name, electors, ballots, valid, votes}))
]));

function villageFormat(value) {
  return villageMetric.value === "votes" ? numbers.format(value) : percentages.format(value);
}

function villageChartValues(villages) {
  const counts = villageMetric.value === "votes";
  return villages.map(village => ({
    ...village,
    values: counts ? village.votes : village.votes.map(votes => votes / village.valid)
  }));
}

function drawVillageComparison() {
  const places = villageChartValues(villageGroups[villageTown.value]);
  const selections = [Number(villageFirst.value), Number(villageSecond.value)];
  const names = selections.map(index => historicalNames[index]);
  const upper = Math.max(...places.flatMap(place => place.values));
  const rows = places.map(({name, valid, values}) => {
    const pairs = selections.map(index => values[index]);
    return {name, valid, values: pairs, gap: Math.abs(pairs[0] - pairs[1])};
  });
  const sorts = {
    gap: (a, b) => b.gap - a.gap,
    valid: (a, b) => b.valid - a.valid,
    name: (a, b) => a.name.localeCompare(b.name, "zh-TW")
  };
  rows.sort(sorts[villageSort.value]);
  document.querySelector("#village-legend").replaceChildren(...names.map((name, i) =>
    element("span", name, "series-key series-" + i)
  ));
  const counts = villageMetric.value === "votes";
  document.querySelector("#village-plot-note").textContent = villageTown.value + "共 " + rows.length + " 個村里。" +
    (counts ? "連線長度表示票差。" : "得票率以各村里有效票為分母，差距以百分點表示。");
  drawDotPlot(document.querySelector("#village-plot"), rows, chartAxis(upper), villageFormat, names,
    counts ? value => numbers.format(value) + "票" : percentagePoint);
}

function drawVillageHeat() {
  const rows = villageChartValues(villageGroups[villageTown.value]).sort((a, b) => b.valid - a.valid);
  const counts = villageMetric.value === "votes";
  const upper = chartAxis(Math.max(...rows.flatMap(place => place.values))).domain()[1];
  const color = drawHeatKey(document.querySelector("#village-heat-key"), upper, villageFormat);
  villageHeat.tBodies[0].replaceChildren();
  rows.forEach(({name, values}) => {
    const row = appendTableRow(villageHeat.tBodies[0], [name, ...values.map(villageFormat)]);
    const high = Math.max(...values);
    values.forEach((value, index) => {
      const cell = row.cells[index + 1];
      cell.style.background = color(value);
      cell.classList.toggle("village-leader", value === high);
    });
  });
  document.querySelector("#village-heat-note").textContent = villageTown.value + "共 " + rows.length + " 個村里，按有效票數排列。" +
    (counts ? "色階表示得票數。" : "色階表示占該村里有效票的比例。") + "底線標示該村里最高票。";
}

function drawVillageDetail() {
  const village = villageGroups[villageTown.value].find(place => place.name === villageName.value);
  const {name, electors, ballots, valid, votes} = village;
  const data = [
    name,
    "投票率 " + percentages.format(ballots / electors),
    "有效票 " + numbers.format(valid),
    "無效票 " + numbers.format(ballots - valid)
  ];
  document.querySelector("#village-detail-note").textContent = data.join(" ／ ");
  const rows = votes.map((vote, i) => ({name: historicalNames[i], vote})).sort((a,b) => b.vote - a.vote);
  document.querySelector("#village-detail-bars").replaceChildren(...rows.map(row =>
    barRow(row.name, numbers.format(row.vote) + " 票 ／ " + percentages.format(row.vote / valid), row.vote / rows[0].vote)
  ));
}

function drawVillageTable() {
  const town = villageTown.value;
  const rows = villageGroups[town];
  const body = villageTable.tBodies[0];
  const head = townships.find(row => row[0] === town);
  const [electors, ballots] = turnout[townships.indexOf(head)];
  const totals = [town + "合計", electors, ballots, percentages.format(ballots / electors),
    head[1], ballots - head[1], ...head.slice(2)];
  body.replaceChildren();
  villageTable.tFoot.replaceChildren();
  rows.forEach(({name, electors, ballots, valid, votes}) => {
    appendTableRow(body, [name, electors, ballots, percentages.format(ballots / electors), valid, ballots - valid, ...votes]);
  });
  appendTableRow(villageTable.tFoot, totals);
}

function drawVillageView() {
  if (heatPanel.hidden) drawVillageComparison();
  else drawVillageHeat();
}

function switchVillageView(showHeat) {
  dotPanel.hidden = showHeat;
  heatPanel.hidden = !showHeat;
  dotTab.setAttribute("aria-pressed", String(!showHeat));
  heatTab.setAttribute("aria-pressed", String(showHeat));
  drawVillageView();
}

function changeVillageTown() {
  const town = villageTown.value;
  const rows = villageGroups[town];
  villageName.replaceChildren(...rows.map(row => new Option(row.name, row.name)));
  villageName.value = rows.reduce((largest, row) => row.valid > largest.valid ? row : largest).name;
  const sourceLink = document.querySelector("#village-source-link");
  sourceLink.href = "https://votetw.com/wiki/" + encodeURIComponent("2022年彰化縣議員選舉" + town + "投票結果");
  sourceLink.textContent = "VoteTW｜" + town + "村里開票原始資料 ↗";
  drawVillageView();
  drawVillageDetail();
  drawVillageTable();
}

Object.keys(villageGroups).forEach(town => villageTown.add(new Option(town, town)));
historicalNames.forEach((name, i) => {
  villageFirst.add(new Option(name, String(i)));
  villageSecond.add(new Option(name, String(i)));
});
villageTown.value = "芳苑鄉";
villageFirst.value = "1";
villageSecond.value = "4";
[villageFirst, villageSecond].forEach((field, index, fields) => {
  field.addEventListener("change", () => {
    const other = fields[1 - index];
    if (field.value === other.value) other.selectedIndex = (field.selectedIndex + 1) % historicalNames.length;
    drawVillageComparison();
  });
});
villageTown.addEventListener("change", changeVillageTown);
villageMetric.addEventListener("change", drawVillageView);
villageSort.addEventListener("change", drawVillageComparison);
villageName.addEventListener("change", drawVillageDetail);
dotTab.addEventListener("click", () => switchVillageView(false));
heatTab.addEventListener("click", () => switchVillageView(true));
appendTableRow(villageHeat.tHead, ["村里", ...historicalNames], true);
appendTableRow(villageTable.tHead, ["村里", "選舉人數", "投票數", "投票率", "有效票", "無效票", ...historicalNames], true);
document.querySelectorAll("[data-village-town]").forEach(link => {
  link.addEventListener("click", () => {
    villageTown.value = link.dataset.villageTown;
    changeVillageTown();
  });
});
changeVillageTown();

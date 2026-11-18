"use strict";

const electionMap = {
  svg: document.querySelector("#election-map-svg"),
  metric: document.querySelector("#map-metric"),
  town: document.querySelector("#map-town"),
  first: document.querySelector("#map-first"),
  second: document.querySelector("#map-second"),
  place: document.querySelector("#map-place"),
  legend: document.querySelector("#map-legend"),
  caption: document.querySelector("#map-caption"),
  detail: document.querySelector("#map-detail")
};
const mapColors = {
  first: "#2c6497", second: "#b56836", neutral: "#eef1ed", tie: "#63717e",
  sequential: ["#edf4f8", "#245d90"], symbol: "#285c91"
};
const winnerColors = ["#b57a12", "#2b7797", "#86538f", "#8b6350", "#17766c", "#a74053", "#4b58a0"];
const mapRecords = electionMapGeometry.villages.map(geometry => {
  const {town, name} = geometry;
  const [population, households] = villagePopulation2026[town][name];
  return {
    ...villageGroups[town].find(village => village.name === name),
    ...geometry, population, households,
    key: town + "/" + name
  };
});
const mapByKey = new Map(mapRecords.map(record => [record.key, record]));

function svgMark(name, attributes, text) {
  const mark = document.createElementNS("http://www.w3.org/2000/svg", name);
  Object.entries(attributes).forEach(([key, value]) => mark.setAttribute(key, value));
  if (text !== undefined) mark.textContent = text;
  return mark;
}

function mapOptions() {
  const mode = electionMap.metric.value;
  const a = Number(electionMap.first.value);
  const b = Number(electionMap.second.value);
  return {mode, a, b, first: historicalNames[a], second: historicalNames[b]};
}

function villageWinners(votes) {
  const most = Math.max(...votes);
  return votes.flatMap((vote, index) => vote === most ? [index] : []);
}

function signedPoints(value) {
  return ((value > 0 ? "+" : "") + (100 * value).toFixed(2)) + " 個百分點";
}

function mapScale(options) {
  const {mode, a, b} = options;
  const symbol = ["votes", "valid", "population"].includes(mode);
  const value = {
    margin: record => (record.votes[a] - record.votes[b]) / record.valid,
    share: record => record.votes[a] / record.valid,
    votes: record => record.votes[a],
    winner: record => villageWinners(record.votes),
    turnout: record => record.ballots / record.electors,
    valid: record => record.valid,
    population: record => record.population
  }[mode];
  const symbolUnit = mode === "population" ? " 人" : " 票";
  const format = symbol ? number => numbers.format(number) + symbolUnit : number => percentages.format(number);

  if (mode === "winner") {
    return {
      value,
      color: indices => indices.length > 1 ? mapColors.tie : winnerColors[indices[0]],
      format: indices => indices.map(index => historicalNames[index]).join("、") + (indices.length > 1 ? " 並列" : ""),
      legend: [...historicalNames.map((name, index) => [name, winnerColors[index]]), ["最高票並列", mapColors.tie]]
    };
  }

  if (mode === "margin") {
    const highest = Math.max(...mapRecords.map(record => Math.abs(value(record))));
    const max = Math.ceil(highest * 20) / 20;
    const colors = [mapColors.second, mapColors.neutral, mapColors.first];
    const color = chartScales.scaleLinear().domain([-max, 0, max]).range(colors).clamp(true);
    return {
      value, color, format: signedPoints,
      gradient: colors,
      labels: [options.second + " +" + Math.round(max * 100) + " 個百分點", "持平", options.first + " +" + Math.round(max * 100) + " 個百分點"]
    };
  }

  const values = mapRecords.map(value);
  const maxValue = Math.max(...values);
  if (symbol) {
    const basis = 10 ** Math.floor(Math.log10(maxValue));
    const max = Math.ceil(maxValue / basis) * basis;
    const radius = count => Math.sqrt(count / max) * 16;
    return {value, radius, format, sizes: [max / 4, max / 2, max], color: () => "#e8ece8"};
  }

  const min = mode === "turnout" ? Math.floor(Math.min(...values) * 20) / 20 : 0;
  const max = Math.ceil(maxValue * 20) / 20;
  const color = chartScales.scaleLinear().domain([min, max]).range(mapColors.sequential).clamp(true);
  return {value, color, format, gradient: mapColors.sequential, labels: [format(min), format(max)]};
}

function mapVisibleRecords() {
  const town = electionMap.town.value;
  return town ? mapRecords.filter(record => record.town === town) : mapRecords;
}

function mapViewBox() {
  const town = electionMap.town.value;
  const bounds = town ? [electionMapGeometry.towns[town].bounds] :
    Object.values(electionMapGeometry.towns).map(shape => shape.bounds);
  const minX = Math.min(...bounds.map(box => box[0]));
  const minY = Math.min(...bounds.map(box => box[1]));
  const maxX = Math.max(...bounds.map(box => box[2]));
  const maxY = Math.max(...bounds.map(box => box[3]));
  const pad = town ? 17 : 13;
  return [minX-pad, minY-pad, maxX-minX+pad*2, maxY-minY+pad*2].join(" ");
}

function mapTitle(record, scale, options) {
  const score = scale.value(record);
  if (options.mode === "margin") {
    const lead = score === 0 ? "持平" : (score > 0 ? options.first : options.second) + "領先 " + signedPoints(Math.abs(score));
    return record.name + "・" + lead;
  }
  return record.name + "・" + scale.format(score);
}

function renderMapShape(records, scale, options) {
  const land = svgMark("g", {class: "map-villages"});
  const symbols = svgMark("g", {class: "map-symbols"});
  records.forEach(record => {
    const score = scale.value(record);
    const landPath = svgMark("path", {d: record.path, fill: scale.color(score), "data-map-key": record.key});
    landPath.append(svgMark("title", {}, mapTitle(record, scale, options)));
    land.append(landPath);
    if (scale.radius && score > 0) {
      const circle = svgMark("circle", {
        cx: record.pin[0], cy: record.pin[1], r: scale.radius(score), fill: mapColors.symbol, "data-map-key": record.key
      });
      circle.append(svgMark("title", {}, mapTitle(record, scale, options)));
      symbols.append(circle);
    }
  });
  const outlines = svgMark("g", {class: "map-outlines", "aria-hidden": "true"});
  const placeNames = svgMark("g", {class: "map-town-labels", "aria-hidden": "true"});
  const town = electionMap.town.value;
  Object.entries(electionMapGeometry.towns).filter(([name]) => !town || town === name).forEach(([name, shape]) => {
    outlines.append(svgMark("path", {d: shape.path}));
    if (!town) placeNames.append(svgMark("text", {x: shape.pin[0], y: shape.pin[1]}, name));
  });
  const selection = svgMark("g", {id: "map-selection", "aria-hidden": "true"});
  electionMap.svg.setAttribute("viewBox", mapViewBox());
  electionMap.svg.replaceChildren(land, outlines, symbols, placeNames, selection);
}

function renderMapLegend(scale) {
  if (scale.legend) {
    const keys = scale.legend.map(([label, color]) => {
      const key = element("span", undefined, "map-key");
      const swatch = element("i");
      swatch.style.background = color;
      swatch.setAttribute("aria-hidden", "true");
      key.append(swatch, document.createTextNode(label));
      return key;
    });
    electionMap.legend.replaceChildren(...keys);
  } else if (scale.sizes) {
    const keys = scale.sizes.map(value => {
      const key = element("span", undefined, "map-key");
      const circle = element("i", undefined, "map-circle-key");
      const diameter = scale.radius(value) * 1.4;
      circle.style.inlineSize = circle.style.blockSize = diameter + "px";
      circle.setAttribute("aria-hidden", "true");
      key.append(circle, document.createTextNode(scale.format(value)));
      return key;
    });
    electionMap.legend.replaceChildren(...keys);
  } else {
    const ramp = element("div", undefined, "map-ramp");
    ramp.style.background = "linear-gradient(to right, " + scale.gradient.join(", ") + ")";
    ramp.setAttribute("aria-hidden", "true");
    const labels = element("div", undefined, "map-ramp-labels");
    labels.append(...scale.labels.map(label => element("span", label)));
    electionMap.legend.replaceChildren(ramp, labels);
  }
}

function renderMapDetail() {
  const record = mapByKey.get(electionMap.place.value);
  const {mode, a, b, first, second} = mapOptions();
  const selection = document.querySelector("#map-selection");
  selection.replaceChildren(
    svgMark("path", {class: "map-selected", d: record.path}),
    svgMark("circle", {class: "map-pin", cx: record.pin[0], cy: record.pin[1], r: 4})
  );

  const votesLabel = index => numbers.format(record.votes[index]) + " 票（" + percentages.format(record.votes[index] / record.valid) + "）";
  const margin = (record.votes[a] - record.votes[b]) / record.valid;
  const rows = {
    margin: [[first, votesLabel(a)], [second, votesLabel(b)]],
    share: [[first, votesLabel(a)]],
    votes: [[first, votesLabel(a)]],
    winner: villageWinners(record.votes).map(index => [historicalNames[index], votesLabel(index)]),
    turnout: [["投票人數", numbers.format(record.ballots) + " 人"], ["選舉人數", numbers.format(record.electors) + " 人"]],
    valid: [["有效票", numbers.format(record.valid) + " 票"], ["無效票", numbers.format(record.ballots - record.valid) + " 票"]],
    population: [["戶數", numbers.format(record.households) + " 戶"]]
  }[mode];
  const headline = {
    margin: margin === 0 ? "兩人同票" : (margin > 0 ? first : second) + " " + signedPoints(Math.abs(margin)),
    share: percentages.format(record.votes[a] / record.valid),
    votes: numbers.format(record.votes[a]) + " 票",
    winner: "村里最高票",
    turnout: percentages.format(record.ballots / record.electors),
    valid: numbers.format(record.valid) + " 票",
    population: numbers.format(record.population) + " 人"
  }[mode];
  const footnote = mode === "population" ? "2026 年 10 月 31 日戶籍統計" :
    "村里有效票 " + numbers.format(record.valid) + " ／ 投票率 " + percentages.format(record.ballots / record.electors);
  const breakdown = element("dl", undefined, "map-breakdown");
  rows.forEach(([label, value]) => {
    const row = element("div");
    row.append(element("dt", label), element("dd", value));
    breakdown.append(row);
  });
  electionMap.detail.replaceChildren(
    element("p", record.town, "map-town-name"),
    element("h3", record.name),
    element("p", headline, "map-stat"),
    breakdown,
    element("p", footnote, "caption")
  );
}

function renderPopulationTable(records) {
  const table = document.querySelector("#map-population-table");
  const body = table.querySelector("tbody");
  const rows = [...records].sort((a, b) => b.population - a.population || a.key.localeCompare(b.key, "zh-Hant-TW"));
  const summary = document.querySelector("#map-population-summary");
  const scope = electionMap.town.value || "全選區";
  const people = records.reduce((total, record) => total + record.population, 0);
  const households = records.reduce((total, record) => total + record.households, 0);
  summary.textContent = `${scope} ${records.length} 個村里・${numbers.format(people)} 人・${numbers.format(households)} 戶`;
  const nextRows = document.createDocumentFragment();
  rows.forEach(record => appendTableRow(nextRows, [record.name, record.town, record.population, record.households]));
  body.replaceChildren(nextRows);
}

function renderElectionMap() {
  const options = mapOptions();
  const scale = mapScale(options);
  const population = options.mode === "population";
  const records = mapVisibleRecords();
  document.querySelector("#map-first-field").hidden = !["margin", "share", "votes"].includes(options.mode);
  document.querySelector("#map-second-field").hidden = options.mode !== "margin";
  document.querySelector("#map-population-table").hidden = !population;
  document.querySelector("#map-population-source").hidden = !population;
  document.querySelector("#map-votes-source").hidden = population;
  const notes = {
    margin: "用同一村里的有效票算兩人得票率之差。色階以持平為中心，色深表示差距。",
    share: "顏色越深，這位候選人占該村里有效票的比例越高。",
    votes: "圓點面積與這位候選人在該村里的票數成正比。",
    winner: "顏色標示該村里得票最多的候選人。並列村里以灰色標記。",
    turnout: "投票率為該村里投票數除以選舉人數。色階以全選區村里的數值範圍設定。",
    valid: "圓點面積與該村里有效票數成正比。",
    population: "圓點面積與各村里 2026 年 10 月底的戶籍人口成正比。"
  };
  electionMap.caption.textContent = notes[options.mode];
  renderMapShape(records, scale, options);
  renderMapLegend(scale);
  renderMapDetail();
  if (population) renderPopulationTable(records);
}

function syncMapPlaces() {
  const previous = electionMap.place.value;
  electionMap.place.replaceChildren();
  const visible = mapVisibleRecords();
  Object.keys(villageGroups).forEach(town => {
    const rows = visible.filter(record => record.town === town);
    if (!rows.length) return;
    const group = element("optgroup");
    group.label = town;
    group.append(...rows.map(record => new Option(record.name, record.key)));
    electionMap.place.append(group);
  });
  const fallback = electionMap.town.value ? visible.reduce((a,b) => b.valid > a.valid ? b : a).key : "芳苑鄉/芳苑村";
  electionMap.place.value = visible.some(record => record.key === previous) ? previous : fallback;
  renderElectionMap();
}

Object.keys(villageGroups).forEach(town => electionMap.town.add(new Option(town, town)));
historicalNames.forEach((name, index) => {
  electionMap.first.add(new Option(name, String(index)));
  electionMap.second.add(new Option(name, String(index)));
});
electionMap.first.value = "1";
electionMap.second.value = "4";
[electionMap.first, electionMap.second].forEach((field, index, fields) => {
  field.addEventListener("change", () => {
    const other = fields[1 - index];
    if (field.value === other.value) other.selectedIndex = (field.selectedIndex + 1) % historicalNames.length;
    renderElectionMap();
  });
});
electionMap.metric.addEventListener("change", renderElectionMap);
electionMap.town.addEventListener("change", syncMapPlaces);
electionMap.place.addEventListener("change", renderMapDetail);
electionMap.svg.addEventListener("click", event => {
  const shape = event.target.closest("[data-map-key]");
  if (!shape) return;
  electionMap.place.value = shape.dataset.mapKey;
  renderMapDetail();
});
document.querySelector("#map-detail-link").addEventListener("click", () => {
  const record = mapByKey.get(electionMap.place.value);
  villageTown.value = record.town;
  changeVillageTown();
  villageName.value = record.name;
  drawVillageDetail();
});
if (new URLSearchParams(location.search).get("map") === "population") electionMap.metric.value = "population";
syncMapPlaces();

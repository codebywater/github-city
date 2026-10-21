const test = require("node:test");
const assert = require("node:assert/strict");
const data = require("../examples/data.json");
const { render, layout, shade, plural } = require("../src/render");

test("склонение «коммит»", () => {
  assert.deepEqual([1, 2, 5, 11, 21, 22, 25, 112].map((n) => plural(n, "коммит", "коммита", "коммитов")),
    ["коммит", "коммита", "коммитов", "коммитов", "коммит", "коммита", "коммитов", "коммитов"]);
});

test("раскладка: самый высокий дом в глубине, всем хватает клеток", () => {
  const { n, placed, free } = layout(data.repos);
  assert.equal(n, 3);
  assert.equal(placed.length + free.length, 9);
  assert.equal(placed[0].repo.name, "web");
  assert.equal(placed[0].i + placed[0].j, 0);
  const depths = placed.map((p) => p.i + p.j);
  assert.deepEqual(depths, [...depths].sort((a, b) => a - b));
});

test("SVG: корректная разметка, подписи и подсказки для каждого дома", () => {
  for (const theme of ["light", "dark"]) {
    const svg = render(data, { theme });
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    assert.match(svg, /<\/svg>\n$/);
    assert.match(svg, /5 репозиториев · 1110 коммитов/);
    for (const r of data.repos) assert.ok(svg.includes(`>${r.name}</text>`), r.name);
    assert.equal((svg.match(/<g>/g) || []).length, 5);
    assert.equal((svg.match(/<g>/g) || []).length, (svg.match(/<\/g>/g) || []).length);
    assert.doesNotMatch(svg, /NaN|undefined/);
  }
});

test("SVG детерминирован и экранирует имена", () => {
  assert.equal(render(data), render(data));
  const svg = render({ user: "a<b", repos: [{ name: "x&y", language: null, commits: 1 }] });
  assert.match(svg, /a&lt;b/);
  assert.match(svg, /x&amp;y/);
});

test("высота дома растёт с числом коммитов", () => {
  const svg = render({ user: "u", repos: [{ name: "big", language: "Go", commits: 100 }, { name: "small", language: "Go", commits: 1 }] });
  const y = (name) => Number(new RegExp(`y="([\\d.]+)" text-anchor="middle">${name}<`).exec(svg)[1]);
  assert.ok(y("big") < y("small"));
});

test("цвета: осветление и затемнение", () => {
  assert.equal(shade("#808080", 0), "#808080");
  assert.equal(shade("#000000", 1), "#ffffff");
  assert.equal(shade("#ffffff", -1), "#000000");
});

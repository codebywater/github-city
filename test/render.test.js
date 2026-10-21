const test = require("node:test");
const assert = require("node:assert/strict");
const data = require("../examples/data.json");
const { render, layout, shade, plural, fit, textWidth } = require("../src/render");

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
    const svg = render(data, { theme, lang: "ru" });
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

const width = (svg) => Number(/width="(\d+)"/.exec(svg)[1]);
const many = (count) => Array.from({ length: count }, (_, k) => ({ name: `repo-${k}`, language: "Go", commits: 1000 - k }));

test("много репозиториев: рисуются 36 самых больших, холст не растёт", () => {
  const svg = render({ user: "u", repos: many(100) }, { lang: "ru" });
  assert.equal((svg.match(/<g>/g) || []).length, 36);
  assert.equal(width(svg), width(render({ user: "u", repos: many(36) })));
  assert.ok(width(svg) < 1000, `ширина ${width(svg)}`);
  assert.ok(svg.includes(">repo-0</text>") && svg.includes(">repo-35</text>") && !svg.includes(">repo-36</text>"));
  assert.match(svg, />100 репозиториев · \d+ коммитов</);
  assert.match(svg, />на картинке 36 крупнейших</);
  // max: 0 — без ограничения.
  assert.equal((render({ user: "u", repos: many(40) }, { max: 0 }).match(/<g>/g) || []).length, 40);
});

/*
 * Ширина считается грубо: 0.62em на символ, без оценщика из render.js, чтобы тест от него
 * не зависел. Для этих строк (строчная латиница и дефисы) это не меньше реальной ширины;
 * точная проверка через getBBox в браузере делалась отдельно.
 */
test("длинные имена не вылезают за край и не заходят на солнце", () => {
  const long = "awesome-machine-learning-interview-questions";
  const repos = [["web", 500], ["api", 400], ["cli", 300], ["dotfiles", 200], [long, 100], ["notes", 50]]
    .map(([name, commits]) => ({ name, language: "Go", commits }));
  const login = "a".repeat(10) + "-very-long-login-name-xyz-12";
  for (const [user, list] of [["alice", repos], [login, repos.slice(0, 1)]]) {
    const svg = render({ user, repos: list });
    const W = width(svg);
    for (const m of svg.matchAll(/<text class="lbl" x="([\d.]+)"[^>]*>([^<]*)</g)) {
      const half = Array.from(m[2]).length * 11 * 0.62 / 2;
      assert.ok(Number(m[1]) - half >= 0 && Number(m[1]) + half <= W, `${m[2]} за краем ${W}`);
    }
    const [, x, text] = /<text x="([\d.]+)" y="34"[^>]*>([^<]*)</.exec(svg);
    const sunLeft = W - 40 - 10 - 26;
    assert.ok(Number(x) + Array.from(text).length * 18 * 0.62 <= sunLeft, `заголовок «${text}» заходит на солнце`);
    // Полные имена остаются в подсказках.
    for (const r of list) assert.ok(svg.includes(`<title>${r.name}:`), r.name);
  }
  assert.ok(render({ user: "alice", repos }).includes(">awesome-machine-l…</text>"));
});

test("fit: обрезает с многоточием, короткие строки не трогает", () => {
  assert.equal(fit("web", 100, 11), "web");
  const cut = fit("x".repeat(100), 100, 11, true);
  assert.ok(cut.endsWith("…") && textWidth(cut, 11, true) <= 100);
  assert.ok(!fit("🚀".repeat(40), 50, 11).includes("�"));  // суррогатные пары не разрываются
});

test("регрессия: пометка «на картинке N крупнейших» — отдельной строкой и не обрезается", () => {
  const repos = Array.from({ length: 6 }, (_, i) => ({ name: `repo${i}`, language: "Go", commits: 10 + i }));
  const svg = render({ user: "u", repos }, { max: 2, lang: "ru" });
  assert.match(svg, />на картинке 2 крупнейших</);
  assert.doesNotMatch(svg, /крупнейш[^<]*…/);
});

test("регрессия: --max без значения — ошибка, а не отключение лимита", () => {
  const { spawnSync } = require("node:child_process");
  const path = require("node:path");
  const r = spawnSync("node", [path.join(__dirname, "../src/cli.js"), "--data", path.join(__dirname, "../examples/data.json"), "--out", require("node:os").tmpdir(), "--max", ""], { encoding: "utf8" });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /--max/);
});

test("английские подписи по умолчанию, русские по lang: ru, неизвестный язык — ошибка", () => {
  const svg = render(data);
  assert.match(svg, />5 repositories · 1110 commits</);
  assert.match(svg, /example's repository city: 5 buildings, 1110 commits/);
  assert.doesNotMatch(svg, /[а-яё]/i);
  const one = render({ user: "u", repos: [{ name: "x", language: "Go", commits: 1 }] });
  assert.match(one, />1 repository · 1 commit</);
  assert.match(render(data, { lang: "ru" }), />5 репозиториев · 1110 коммитов</);
  assert.throws(() => render(data, { lang: "de" }), /Unknown lang/);
  const repos = Array.from({ length: 6 }, (_, i) => ({ name: `repo${i}`, language: "Go", commits: 10 + i }));
  assert.match(render({ user: "u", repos }, { max: 2 }), />showing the 2 largest</);
});

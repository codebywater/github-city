const test = require("node:test");
const assert = require("node:assert/strict");
const { fetchCity, hostRepo } = require("../src/github");
const { render } = require("../src/render");

// Подменяем GitHub API: список репозиториев и число коммитов через заголовок Link.
function mockApi(commits) {
  return async (url) => {
    const u = new URL(url);
    const reply = (status, body, link) => ({
      ok: status < 400, status,
      headers: { get: (k) => (k.toLowerCase() === "link" ? link || null : null) },
      json: async () => body, text: async () => JSON.stringify(body),
    });
    if (/^\/users\/[^/]+\/repos$/.test(u.pathname)) {
      return reply(200, Object.keys(commits).map((name) => ({ name, private: false, fork: false, archived: false, language: "Go", stargazers_count: 0 })));
    }
    const m = /^\/repos\/[^/]+\/([^/]+)\/commits$/.exec(u.pathname);
    if (m) return reply(200, [{}], `<https://api.github.com/x?per_page=1&page=${commits[m[1]]}>; rel="last"`);
    return reply(404, {});
  };
}

test("hostRepo: только репозиторий того же владельца, регистр не важен", () => {
  assert.equal(hostRepo("alice", "Alice/city-host"), "city-host");
  assert.equal(hostRepo("alice", "bob/city-host"), null);
  assert.equal(hostRepo("alice", undefined), null);
  assert.equal(hostRepo("alice", "garbage"), null);
});

// Каждый день: рисуем город; если картинка изменилась — action коммитит в host-репозиторий.
for (const [user, host] of [["alice", "alice"], ["alice", "city-host"], ["acme", ".github"]]) {
  test(`нет ежедневных коммитов, когда action работает в ${user}/${host}`, async (t) => {
    const commits = { web: 120, [host]: 10 };
    t.mock.method(global, "fetch", mockApi(commits));
    const days = [];
    let prev = null;
    for (let d = 0; d < 4; d++) {
      const data = await fetchCity(user, { token: "x", host: `${user}/${host}` });
      assert.ok(!data.repos.some((r) => r.name === host), "host-репозиторий не должен быть домом");
      const svg = render(data);
      days.push(svg !== prev);
      if (svg !== prev) commits[host] += 1;
      prev = svg;
    }
    assert.deepEqual(days, [true, false, false, false]);
  });
}

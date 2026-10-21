/*
 * Шаг Commit из action.yml, запущенный как в GitHub Actions (bash -eo pipefail),
 * против локального «удалённого» репозитория.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync, spawnSync } = require("child_process");

// Вырезает run-скрипт шага с данным именем из action.yml (без YAML-парсера).
function stepScript(name) {
  const lines = fs.readFileSync(path.join(__dirname, "..", "action.yml"), "utf8").split("\n");
  const s = lines.findIndex((l) => l.trim() === `- name: ${name}`);
  const r = lines.findIndex((l, i) => i > s && /^\s+run: \|/.test(l));
  const ind = lines[r].search(/\S/);
  const body = [];
  for (let i = r + 1; i < lines.length && (!lines[i].trim() || lines[i].search(/\S/) > ind); i++) body.push(lines[i]);
  const pad = Math.min(...body.filter((l) => l.trim()).map((l) => l.search(/\S/)));
  return body.map((l) => l.slice(pad)).join("\n") + "\n";
}

const ENV = { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t",
  GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" };
const git = (cwd, ...args) => execFileSync("git", args, { cwd, env: ENV, stdio: "pipe" }).toString().trim();
const write = (file, text) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };

function runStep(cwd, env = {}) {
  const file = path.join(cwd, "..", "step.sh");
  fs.writeFileSync(file, stepScript("Commit"));
  return spawnSync("bash", ["--noprofile", "--norc", "-eo", "pipefail", file],
    { cwd, env: { ...ENV, CITY_OUT: "assets", GITHUB_REF_NAME: "main", ...env }, encoding: "utf8" });
}

// remote.git с одним коммитом и клон runner (как actions/checkout, --depth 1).
function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "city-"));
  git(dir, "init", "-q", "--bare", "-b", "main", "remote.git");
  const seed = path.join(dir, "seed");
  git(dir, "clone", "-q", "remote.git", "seed");
  write(path.join(seed, "assets/city-light.svg"), "old\n");
  write(path.join(seed, "assets/city-dark.svg"), "old\n");
  write(path.join(seed, "README.md"), "hi\n");
  git(seed, "add", "-A"); git(seed, "commit", "-qm", "init"); git(seed, "push", "-q", "origin", "main");
  git(dir, "clone", "-q", "--depth", "1", `file://${dir}/remote.git`, "runner");
  return { dir, seed, runner: path.join(dir, "runner"), remote: path.join(dir, "remote.git") };
}

for (const scenario of ["README", "svg"]) {
  test(`push не падает, если во время запуска в ветку запушили (${scenario})`, (t) => {
    const { dir, seed, runner, remote } = setup();
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    // Пока action рисует, человек правит README — или параллельный запуск уже закоммитил свой город.
    if (scenario === "README") write(path.join(seed, "README.md"), "edited\n");
    else write(path.join(seed, "assets/city-light.svg"), "other\n");
    git(seed, "commit", "-qam", scenario === "README" ? "Edit README" : "Update GitHub City");
    git(seed, "push", "-q", "origin", "main");

    write(path.join(runner, "assets/city-light.svg"), "new\n");
    const res = runStep(runner);
    assert.equal(res.status, 0, res.stdout + res.stderr);
    const log = git(remote, "log", "--format=%s", "main").split("\n");
    assert.deepEqual(log, ["Update GitHub City", scenario === "README" ? "Edit README" : "Update GitHub City", "init"]);
    assert.equal(git(remote, "show", "main:assets/city-light.svg"), "new");
  });
}

test("предупреждает, когда расписание скоро отключится (50+ дней без коммитов)", (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "city-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const repo = path.join(dir, "repo");
  git(dir, "init", "-q", "-b", "main", "repo");
  write(path.join(repo, "assets/city-light.svg"), "same\n");
  write(path.join(repo, "assets/city-dark.svg"), "same\n");
  git(repo, "add", "-A");
  const when = `@${Math.floor(Date.now() / 1000) - 55 * 86400}`;
  execFileSync("git", ["commit", "-qm", "init"], { cwd: repo, env: { ...ENV, GIT_AUTHOR_DATE: when, GIT_COMMITTER_DATE: when } });
  const res = runStep(repo);
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stdout, /Город не изменился/);
  assert.match(res.stdout, /::warning title=GitHub City::.*55 дн/);

  // Свежий коммит — предупреждения нет.
  write(path.join(repo, "README.md"), "x\n");
  git(repo, "add", "-A"); git(repo, "commit", "-qm", "fresh");
  assert.doesNotMatch(runStep(repo).stdout, /::warning/);
});

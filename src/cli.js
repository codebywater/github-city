#!/usr/bin/env node
/*
 * Использование:
 *   node src/cli.js <пользователь> [--out папка] [--exclude repo1,repo2] [--forks] [--max 36]
 *                   [--lang en|ru] [--host владелец/репо] [--data data.json]
 * Создаёт city-light.svg и city-dark.svg. Токен берётся из GITHUB_TOKEN или INPUT_TOKEN.
 * --lang   язык подписей на картинке: en (по умолчанию) или ru.
 * --max    сколько домов рисовать (самые большие по коммитам), 0 — без ограничения.
 * --host   репозиторий, куда коммитится картинка: он не попадает в город (см. github.js).
 * --data   читает данные из JSON вместо GitHub API (для офлайн-проверки).
 */
"use strict";
const fs = require("fs");
const path = require("path");
const { render } = require("./render");
const { fetchCity } = require("./github");

async function main() {
  const argv = process.argv.slice(2);
  const opt = { out: ".", exclude: [], forks: false, lang: "en" };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--out") opt.out = argv[++i];
    else if (argv[i] === "--exclude") opt.exclude = argv[++i].split(",").map((s) => s.trim()).filter(Boolean);
    else if (argv[i] === "--forks") opt.forks = true;
    else if (argv[i] === "--data") opt.data = argv[++i];
    else if (argv[i] === "--host") opt.host = argv[++i];
    else if (argv[i] === "--lang") opt.lang = (argv[++i] || "").trim() || "en";
    else if (argv[i] === "--max") {
      // Пустое значение (например, max-repos: "" в action) — ошибка, а не «без ограничения».
      const v = argv[++i];
      opt.max = v === undefined || v.trim() === "" ? NaN : Number(v);
    }
    else rest.push(argv[i]);
  }
  const user = rest[0];
  if (!user && !opt.data) {
    console.error("Give a GitHub user: node src/cli.js codebywater");
    process.exit(1);
  }
  if (opt.max !== undefined && !(Number.isInteger(opt.max) && opt.max >= 0)) {
    console.error("--max must be an integer ≥ 0 (0 = no limit).");
    process.exit(1);
  }
  const data = opt.data
    ? JSON.parse(fs.readFileSync(opt.data, "utf8"))
    : await fetchCity(user, { token: process.env.GITHUB_TOKEN || process.env.INPUT_TOKEN, includeForks: opt.forks, exclude: opt.exclude, host: opt.host });
  if (!data.repos.length) throw new Error("No public repositories found.");
  if (!["en", "ru"].includes(opt.lang)) throw new Error(`--lang must be en or ru, got "${opt.lang}".`);
  fs.mkdirSync(opt.out, { recursive: true });
  for (const theme of ["light", "dark"]) {
    const file = path.join(opt.out, `city-${theme}.svg`);
    fs.writeFileSync(file, render(data, { theme, max: opt.max, lang: opt.lang }));
    console.log(`Written: ${file}`);
  }
  console.log(data.repos.map((r) => `  ${r.name}: ${r.commits}`).join("\n"));
}

main().catch((e) => {
  console.error(`Error: ${e.message}`);
  process.exit(1);
});

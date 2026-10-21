#!/usr/bin/env node
/*
 * Использование:
 *   node src/cli.js <пользователь> [--out папка] [--exclude repo1,repo2] [--forks] [--data data.json]
 * Создаёт city-light.svg и city-dark.svg. Токен берётся из GITHUB_TOKEN или INPUT_TOKEN.
 * --data читает данные из JSON вместо GitHub API (для офлайн-проверки).
 */
"use strict";
const fs = require("fs");
const path = require("path");
const { render } = require("./render");
const { fetchCity } = require("./github");

async function main() {
  const argv = process.argv.slice(2);
  const opt = { out: ".", exclude: [], forks: false };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--out") opt.out = argv[++i];
    else if (argv[i] === "--exclude") opt.exclude = argv[++i].split(",").map((s) => s.trim()).filter(Boolean);
    else if (argv[i] === "--forks") opt.forks = true;
    else if (argv[i] === "--data") opt.data = argv[++i];
    else rest.push(argv[i]);
  }
  const user = rest[0];
  if (!user && !opt.data) {
    console.error("Укажите пользователя GitHub: node src/cli.js codebywater");
    process.exit(1);
  }
  const data = opt.data
    ? JSON.parse(fs.readFileSync(opt.data, "utf8"))
    : await fetchCity(user, { token: process.env.GITHUB_TOKEN || process.env.INPUT_TOKEN, includeForks: opt.forks, exclude: opt.exclude });
  if (!data.repos.length) throw new Error("Не нашёл ни одного публичного репозитория.");
  fs.mkdirSync(opt.out, { recursive: true });
  for (const theme of ["light", "dark"]) {
    const file = path.join(opt.out, `city-${theme}.svg`);
    fs.writeFileSync(file, render(data, { theme }));
    console.log(`Готово: ${file}`);
  }
  console.log(data.repos.map((r) => `  ${r.name}: ${r.commits}`).join("\n"));
}

main().catch((e) => {
  console.error(`Ошибка: ${e.message}`);
  process.exit(1);
});

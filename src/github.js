/*
 * Данные из GitHub API: публичные репозитории пользователя и число коммитов
 * в основной ветке каждого. Токен необязателен, но без него лимит — 60 запросов в час.
 */
"use strict";

async function api(url, token) {
  const res = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "github-city",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status} for ${url}: ${(await res.text()).slice(0, 200)}`);
  return res;
}

// Число коммитов без выкачивания истории: просим по одному на страницу
// и берём номер последней страницы из заголовка Link.
async function countCommits(owner, repo, token) {
  try {
    const res = await api(`https://api.github.com/repos/${owner}/${repo}/commits?per_page=1`, token);
    const link = res.headers.get("link") || "";
    const m = /[?&]page=(\d+)>; rel="last"/.exec(link);
    if (m) return Number(m[1]);
    return (await res.json()).length;
  } catch (e) {
    // Пустой репозиторий отдаёт 409.
    if (/ 409 /.test(e.message)) return 0;
    throw e;
  }
}

/*
 * Репозиторий, в который action коммитит картинку (host = "владелец/репо", обычно GITHUB_REPOSITORY).
 * Если он принадлежит тому же пользователю, его нужно исключить: иначе каждый коммит
 * «Update GitHub City» меняет число коммитов в нём, картинка меняется — и так каждый день.
 * Вычитать только коммиты бота нельзя надёжно: API не фильтрует по сообщению,
 * а при фильтре по автору заголовок Link отдаёт rel="last" с page=0.
 */
function hostRepo(user, host) {
  const [owner, repo] = String(host || "").split("/");
  return owner && repo && owner.toLowerCase() === String(user).toLowerCase() ? repo : null;
}

async function fetchCity(user, { token, includeForks = false, includeArchived = true, exclude = [], host } = {}) {
  const repos = [];
  for (let page = 1; ; page++) {
    const res = await api(`https://api.github.com/users/${user}/repos?type=owner&per_page=100&page=${page}`, token);
    const batch = await res.json();
    repos.push(...batch);
    if (batch.length < 100) break;
  }
  const self = hostRepo(user, host);
  const skip = new Set([user.toLowerCase(), ...exclude, ...(self ? [self] : [])].map((x) => x.toLowerCase()));
  const picked = repos.filter((r) => !r.private && (includeForks || !r.fork) && (includeArchived || !r.archived) &&
    !skip.has(r.name.toLowerCase()));
  const out = [];
  for (const r of picked) {
    out.push({ name: r.name, language: r.language, stars: r.stargazers_count, commits: await countCommits(user, r.name, token) });
  }
  // Пустые репозитории (0 коммитов) домом не становятся.
  return { user, repos: out.filter((r) => r.commits > 0) };
}

module.exports = { fetchCity, countCommits, hostRepo };

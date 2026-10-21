/*
 * Рисует изометрический город в SVG. Каждый репозиторий — дом:
 * высота зависит от числа коммитов, цвет — от основного языка.
 * Без зависимостей; результат детерминирован (одинаковые данные → одинаковый SVG).
 */
"use strict";

const LANG_COLORS = {
  JavaScript: "#f1e05a", TypeScript: "#3178c6", Python: "#3572a5", C: "#6e7681", "C++": "#f34b7d",
  "C#": "#178600", Go: "#00add8", Rust: "#dea584", Java: "#b07219", Kotlin: "#a97bff", Swift: "#f05138",
  HTML: "#e34c26", CSS: "#663399", Shell: "#89e051", Ruby: "#cc342d", PHP: "#4f5d95", Dart: "#00b4ab",
  Vue: "#41b883", Svelte: "#ff3e00", Lua: "#000080", "Jupyter Notebook": "#da5b0b",
};
const FALLBACK = "#8b949e";

const THEMES = {
  light: {
    skyTop: "#dbe9ff", skyBottom: "#f6f8fb", ground: "#e7ebe2", groundEdge: "#cdd3c6", road: "#d5dacd",
    plot: "#f2f4ee", text: "#1f2328", muted: "#59636e", halo: "#f6f8fb", window: "#ffffff", windowOn: "#ffe08a",
    tree: "#3f9b5a", treeDark: "#2d7444", trunk: "#8a6a4a", star: "none",
  },
  dark: {
    skyTop: "#05070d", skyBottom: "#131a2a", ground: "#1b2230", groundEdge: "#0f141d", road: "#232c3b",
    plot: "#2a3445", text: "#e6edf3", muted: "#9198a1", halo: "#0d1117", window: "#2b3446", windowOn: "#ffd866",
    tree: "#2f7a49", treeDark: "#215a35", trunk: "#5c4632", star: "#ffffff",
  },
};

// Детерминированный генератор псевдослучайных чисел (mulberry32).
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(str) {
  let h = 2166136261;
  for (const ch of str) h = Math.imul(h ^ ch.codePointAt(0), 16777619);
  return h >>> 0;
}

function shade(hex, amount) {
  // amount > 0 — светлее, < 0 — темнее.
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) =>
    Math.round(amount > 0 ? c + (255 - c) * amount : c * (1 + amount)));
  return "#" + ch.map((c) => c.toString(16).padStart(2, "0")).join("");
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const r1 = (n) => Math.round(n * 10) / 10;
const pts = (list) => list.map(([x, y]) => `${r1(x)},${r1(y)}`).join(" ");

function plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

/*
 * Раскладка: самые высокие дома — в глубине, низкие — впереди,
 * чтобы ничего не загораживало. Клетки обходятся по диагоналям.
 */
function layout(repos) {
  const sorted = [...repos].sort((a, b) => b.commits - a.commits || a.name.localeCompare(b.name));
  const n = Math.max(2, Math.ceil(Math.sqrt(sorted.length)));
  const cells = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) cells.push([i, j]);
  // Внутри одной диагонали — от центра к краям.
  cells.sort((a, b) => (a[0] + a[1]) - (b[0] + b[1]) || Math.abs(a[0] - a[1]) - Math.abs(b[0] - b[1]) || a[0] - b[0]);
  return { n, placed: sorted.map((repo, k) => ({ repo, i: cells[k][0], j: cells[k][1] })), free: cells.slice(sorted.length) };
}

function render(data, { theme = "light", title = true } = {}) {
  const t = THEMES[theme];
  const repos = data.repos;
  const { n, placed, free } = layout(repos);
  const U = 46;            // половина ширины клетки в пикселях
  const CELL = 1.6;        // размер клетки в единицах сетки
  const FOOT = 0.95;       // сторона дома
  const maxCommits = Math.max(1, ...repos.map((r) => r.commits));
  const heightOf = (c) => 22 + 150 * Math.sqrt(c / maxCommits);
  const tallest = heightOf(maxCommits);

  const pad = 40;
  const ox = n * CELL * U + pad;
  const oy = tallest + pad + (title ? 52 : 18);
  const P = (x, y, z = 0) => [ox + (x - y) * U, oy + (x + y) * U / 2 - z];

  const W = ox * 2;
  const H = oy + n * CELL * U + pad + 8;
  const out = [];
  const seed = hash(data.user + ":" + repos.map((r) => r.name).join(","));
  const rand = rng(seed);

  out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(W)}" height="${Math.round(H)}" viewBox="0 0 ${Math.round(W)} ${Math.round(H)}" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" role="img" aria-labelledby="city-title">`);
  const totalCommits = repos.reduce((a, r) => a + r.commits, 0);
  out.push(`<title id="city-title">Город репозиториев ${esc(data.user)}: ${repos.length} ${plural(repos.length, "дом", "дома", "домов")}, ${totalCommits} ${plural(totalCommits, "коммит", "коммита", "коммитов")}</title>`);
  out.push(`<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t.skyTop}"/><stop offset="1" stop-color="${t.skyBottom}"/></linearGradient>`);
  out.push(`<style>.lbl{font-size:11px;font-weight:600;fill:${t.text};paint-order:stroke;stroke:${t.halo};stroke-width:3px;stroke-linejoin:round}.cnt{font-size:10px;font-weight:500;fill:${t.muted}}` +
    (theme === "dark" ? `@keyframes blink{0%,100%{opacity:1}50%{opacity:.35}}.on{animation:blink 4s ease-in-out infinite}.tw{animation:blink 3s ease-in-out infinite}` : "") +
    `@media (prefers-reduced-motion:reduce){.on,.tw{animation:none}}</style></defs>`);
  out.push(`<rect width="100%" height="100%" rx="12" fill="url(#sky)"/>`);

  // Звёзды в тёмной теме.
  if (t.star !== "none") {
    for (let k = 0; k < 40; k++) {
      const x = rand() * W, y = rand() * (oy - 20);
      out.push(`<circle class="${k % 3 ? "" : "tw"}" style="animation-delay:${r1(rand() * 3)}s" cx="${r1(x)}" cy="${r1(y)}" r="${r1(0.5 + rand())}" fill="${t.star}" opacity="${r1(0.3 + rand() * 0.6)}"/>`);
    }
  }

  // Солнце днём, луна ночью.
  const cx = W - pad - 10, cy = pad + 10;
  if (theme === "dark") {
    out.push(`<circle cx="${r1(cx)}" cy="${r1(cy)}" r="16" fill="#f4f1de"/><circle cx="${r1(cx + 7)}" cy="${r1(cy - 5)}" r="14" fill="${t.skyTop}"/>`);
  } else {
    out.push(`<circle cx="${r1(cx)}" cy="${r1(cy)}" r="26" fill="#ffd866" opacity=".25"/><circle cx="${r1(cx)}" cy="${r1(cy)}" r="15" fill="#ffc83d"/>`);
  }

  if (title) {
    out.push(`<text x="${pad - 16}" y="34" font-size="18" font-weight="700" fill="${t.text}">${esc(data.user)}</text>`);
    out.push(`<text x="${pad - 16}" y="54" font-size="12" fill="${t.muted}">${repos.length} ${plural(repos.length, "репозиторий", "репозитория", "репозиториев")} · ${totalCommits} ${plural(totalCommits, "коммит", "коммита", "коммитов")}</text>`);
  }

  // Земля: плита толщиной 10px.
  const S = n * CELL;
  const g = [P(0, 0), P(S, 0), P(S, S), P(0, S)];
  out.push(`<polygon points="${pts([g[3], g[2], [g[2][0], g[2][1] + 10], [g[3][0], g[3][1] + 10]])}" fill="${t.groundEdge}"/>`);
  out.push(`<polygon points="${pts([g[1], g[2], [g[2][0], g[2][1] + 10], [g[1][0], g[1][1] + 10]])}" fill="${shade(t.groundEdge, -0.15)}"/>`);
  out.push(`<polygon points="${pts(g)}" fill="${t.road}"/>`);

  // Участки под домами и деревья на свободных клетках.
  const plotOf = (i, j, inset) => {
    const x0 = i * CELL + inset, y0 = j * CELL + inset, s = CELL - inset * 2;
    return [P(x0, y0), P(x0 + s, y0), P(x0 + s, y0 + s), P(x0, y0 + s)];
  };
  for (const { i, j } of placed) out.push(`<polygon points="${pts(plotOf(i, j, 0.18))}" fill="${t.plot}"/>`);
  for (const [i, j] of free) out.push(`<polygon points="${pts(plotOf(i, j, 0.18))}" fill="${shade(t.tree, theme === "dark" ? -0.55 : 0.55)}"/>`);

  // Всё объёмное рисуем сзади вперёд.
  const items = [];
  for (const p of placed) items.push({ depth: p.i + p.j, kind: "house", p });
  for (const [i, j] of free) {
    for (let k = 0; k < 3; k++) {
      const x = i * CELL + 0.35 + rand() * (CELL - 0.7), y = j * CELL + 0.35 + rand() * (CELL - 0.7);
      items.push({ depth: (x + y) / CELL - 1, kind: "tree", x, y, h: 14 + rand() * 10 });
    }
  }
  items.sort((a, b) => a.depth - b.depth);
  const labels = [];

  for (const it of items) {
    if (it.kind === "tree") {
      const [bx, by] = P(it.x, it.y);
      out.push(`<rect x="${r1(bx - 1.5)}" y="${r1(by - 5)}" width="3" height="6" fill="${t.trunk}"/>`);
      out.push(`<polygon points="${pts([[bx, by - 5 - it.h], [bx + 7, by - 4], [bx, by - 2]])}" fill="${t.treeDark}"/>`);
      out.push(`<polygon points="${pts([[bx, by - 5 - it.h], [bx - 7, by - 4], [bx, by - 2]])}" fill="${t.tree}"/>`);
      continue;
    }
    const { repo, i, j } = it.p;
    const base = LANG_COLORS[repo.language] || FALLBACK;
    const h = heightOf(repo.commits);
    const x0 = i * CELL + (CELL - FOOT) / 2, y0 = j * CELL + (CELL - FOOT) / 2, x1 = x0 + FOOT, y1 = y0 + FOOT;
    const left = [P(x0, y1), P(x1, y1), P(x1, y1, h), P(x0, y1, h)];
    const right = [P(x1, y1), P(x1, y0), P(x1, y0, h), P(x1, y1, h)];
    const top = [P(x0, y0, h), P(x1, y0, h), P(x1, y1, h), P(x0, y1, h)];
    out.push(`<g><title>${esc(repo.name)}: ${repo.commits} ${plural(repo.commits, "коммит", "коммита", "коммитов")}${repo.language ? ", " + esc(repo.language) : ""}</title>`);
    out.push(`<polygon points="${pts(left)}" fill="${shade(base, theme === "dark" ? -0.25 : -0.08)}"/>`);
    out.push(`<polygon points="${pts(right)}" fill="${shade(base, theme === "dark" ? -0.5 : -0.3)}"/>`);
    out.push(`<polygon points="${pts(top)}" fill="${shade(base, 0.3)}"/>`);

    // Окна: ряды по 13px, по два окна на каждой стене.
    const wr = rng(hash(repo.name));
    for (let z = 10; z + 6 < h - 4; z += 13) {
      for (const [face, along] of [["left", [x0, x1]], ["right", [y1, y0]]]) {
        for (const f of [0.22, 0.58]) {
          const a = along[0] + (along[1] - along[0]) * f, b = along[0] + (along[1] - along[0]) * (f + 0.2);
          const quad = face === "left"
            ? [P(a, y1, z), P(b, y1, z), P(b, y1, z + 6), P(a, y1, z + 6)]
            : [P(x1, a, z), P(x1, b, z), P(x1, b, z + 6), P(x1, a, z + 6)];
          const lit = wr() < (theme === "dark" ? 0.45 : 0.15);
          const cls = lit && theme === "dark" && wr() < 0.3 ? ` class="on" style="animation-delay:${r1(wr() * 4)}s"` : "";
          out.push(`<polygon${cls} points="${pts(quad)}" fill="${lit ? t.windowOn : t.window}" opacity="${theme === "dark" ? 1 : 0.75}"/>`);
        }
      }
    }
    out.push(`</g>`);

    // Подписи — после всех домов, чтобы передние дома их не закрывали.
    const [lx, ly] = P(x0 + FOOT / 2, y0 + FOOT / 2, h);
    labels.push(`<text class="lbl" x="${r1(lx)}" y="${r1(ly - 16)}" text-anchor="middle">${esc(repo.name)}</text>`);
    labels.push(`<text class="lbl cnt" x="${r1(lx)}" y="${r1(ly - 4)}" text-anchor="middle">${repo.commits} ${plural(repo.commits, "коммит", "коммита", "коммитов")}</text>`);
  }
  out.push(...labels);

  out.push(`</svg>`);
  return out.join("\n") + "\n";
}

module.exports = { render, layout, shade, plural, LANG_COLORS };

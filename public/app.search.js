// ===== Config =====
const API_BASE = ""; // same-origin
const ALL_PLATFORMS = [
  "YouTube",
  "Reddit",
  "Facebook",
  "Instagram",
  "TikTok",
  "LinkedIn",
  "Twitter",
  "Web",
];
const PLATFORM_COLORS = {
  YouTube: "#ef4444",
  Reddit: "#ff4500",
  Facebook: "#1877f2",
  Instagram: "#e1306c",
  TikTok: "#111111",
  LinkedIn: "#0a66c2",
  Twitter: "#1d9bf0",
  Web: "#10b981",
};

const STATE = {
  all: [],
  filtered: [],
  includedPlatforms: new Set(ALL_PLATFORMS),
  range: "all",
  sortBy: "date_desc",
  lastUpdated: null,
  errors: {},
  kpiLast: { posts: 0, likes: 0, comments: 0, shares: 0, views: 0 },
};

// ===== Helpers =====
const $ = (id) => document.getElementById(id);
const isMobile = matchMedia("(max-width: 640px)").matches;

const showLoading = (on) => {
  const el = $("loading");
  if (el) el.classList[on ? "add" : "remove"]("show");
  document.body.classList.toggle("loading", !!on);
};
function addRipple(e) {
  const btn = e.currentTarget;
  const span = document.createElement("span");
  span.className = "ripple";
  const rect = btn.getBoundingClientRect();
  span.style.left = e.clientX - rect.left + "px";
  span.style.top = e.clientY - rect.top + "px";
  btn.appendChild(span);
  setTimeout(() => span.remove(), 650);
}
function attachMagnet(el, strength = 12) {
  if (isMobile) return;
  let raf = 0;
  const onMove = (e) => {
    const r = el.getBoundingClientRect();
    const x = e.clientX - (r.left + r.width / 2);
    const y = e.clientY - (r.top + r.height / 2);
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      el.style.transform = `translate(${x / strength}px, ${y / strength}px)`;
    });
  };
  const reset = () => {
    cancelAnimationFrame(raf);
    el.style.transform = "translate(0,0)";
  };
  el.addEventListener("mousemove", onMove);
  el.addEventListener("mouseleave", reset);
}
function initParallax() {
  if (isMobile) return;
  window.addEventListener("mousemove", (e) => {
    const x = (e.clientX / window.innerWidth - 0.5) * 30;
    document.documentElement.style.setProperty("--mx", `${x}px`);
  });
}

// ===== Theme =====
function initTheme() {
  const root = document.documentElement,
    btn = $("themeToggle");
  const apply = (e) => {
    if (e) addRipple(e);
    if (root.classList.contains("dark")) {
      root.classList.remove("dark");
      localStorage.setItem("theme", "light");
      btn.classList.remove("pill-on");
      btn.classList.add("pill-off");
    } else {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
      btn.classList.remove("pill-off");
      btn.classList.add("pill-on");
    }
    renderCharts();
  };
  if ((localStorage.getItem("theme") || "dark") === "dark") {
    root.classList.add("dark");
    btn.classList.add("pill-on");
  } else btn.classList.add("pill-off");
  btn.addEventListener("click", apply);
  btn.classList.add("magnet");
  attachMagnet(btn);
}

// ===== Utils =====
const parseDateFlexible = (raw) => {
  if (!raw && raw !== 0) return null;
  if (typeof raw === "number") return new Date(raw > 1e12 ? raw : raw * 1000);
  const d = new Date(String(raw).trim());
  return isNaN(d) ? null : d;
};
const textShort = (s, n = 100) => {
  s = s || "";
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
};
const fmtDate = (d) => (d ? d.toISOString().slice(0, 10) : "—");
function inDateRange(d, range) {
  if (!d) return range === "all";
  const now = new Date(),
    start = new Date(now);
  if (range === "d7") {
    start.setDate(now.getDate() - 7);
    return d >= start && d <= now;
  }
  if (range === "d30") {
    start.setDate(now.getDate() - 30);
    return d >= start && d <= now;
  }
  if (range === "d90") {
    start.setDate(now.getDate() - 90);
    return d >= start && d <= now;
  }
  if (range === "y2024") return d.getFullYear() === 2024;
  return true;
}
let REVEAL_IO = null;
function initReveal() {
  const els = [...document.querySelectorAll(".reveal")];
  if (!REVEAL_IO) {
    REVEAL_IO = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("show");
            REVEAL_IO.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12 }
    );
  }
  els.forEach((el, i) => {
    el.style.transitionDelay = `${Math.min(i * 60, 420)}ms`;
    REVEAL_IO.observe(el);
  });
}
function attachRevealTo(selector) {
  document.querySelectorAll(selector).forEach((n) => {
    if (!n.classList.contains("reveal")) {
      n.classList.add("reveal");
      REVEAL_IO && REVEAL_IO.observe(n);
    }
  });
}

// URL state
function pushState() {
  const u = new URL(location.href);
  u.searchParams.set("q", $("q").value.trim());
  u.searchParams.set("range", STATE.range);
  u.searchParams.set("sort", STATE.sortBy);
  history.replaceState({}, "", u);
}
function restoreState() {
  const u = new URL(location.href);
  const q = u.searchParams.get("q") || "";
  const range = u.searchParams.get("range") || "all";
  const sort = u.searchParams.get("sort") || "date_desc";
  $("q").value = q;
  STATE.range = range;
  STATE.sortBy = sort;
}

// ===== Data shaping =====
function applyFilter() {
  STATE.filtered = STATE.all.filter(
    (x) =>
      STATE.includedPlatforms.has(x.platform) &&
      inDateRange(x.date, STATE.range)
  );
}
function computeByPlatform(rows) {
  const by = {};
  for (const r of rows) {
    if (!by[r.platform])
      by[r.platform] = { posts: 0, likes: 0, comments: 0, shares: 0, views: 0 };
    const p = by[r.platform];
    p.posts++;
    p.likes += r.likes;
    p.comments += r.comments;
    p.shares += r.shares;
    p.views += r.views;
  }
  for (const k in by)
    by[k].engagement =
      by[k].likes + by[k].comments + by[k].shares + by[k].views;
  return by;
}

// ===== Renderers =====
function renderPlatformPills() {
  const wrap = $("platformFilters");
  wrap.innerHTML = "";
  for (const p of ALL_PLATFORMS) {
    const on = STATE.includedPlatforms.has(p);
    const btn = document.createElement("button");
    btn.className = "btn pill " + (on ? "pill-on" : "pill-off");
    const color = PLATFORM_COLORS[p] || "#64748b";
    btn.style.borderColor = on ? color : "#334155";
    if (on) {
      btn.style.background = color;
      btn.style.color = "#fff";
    } else {
      btn.style.color = color;
    }
    btn.textContent = p;
    btn.onclick = (e) => {
      addRipple(e);
      if (STATE.includedPlatforms.has(p)) STATE.includedPlatforms.delete(p);
      else STATE.includedPlatforms.add(p);
      updateUI();
    };
    wrap.appendChild(btn);
  }
}

// Short format
const fmtShort = (n) =>
  n >= 1e9
    ? (n / 1e9).toFixed(1) + "B"
    : n >= 1e6
    ? (n / 1e6).toFixed(1) + "M"
    : n >= 1e3
    ? (n / 1e3).toFixed(1) + "k"
    : String(n);

// KPI count-up
function animateNumber(el, from, to, dur = 700) {
  const start = performance.now();
  function step(t) {
    const p = Math.min(1, (t - start) / dur);
    const eased = 1 - Math.pow(1 - p, 3);
    const val = Math.round(from + (to - from) * eased);
    el.textContent = fmtShort(val);
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}
function renderKPIs(rows) {
  const t = rows.reduce(
    (a, r) => {
      a.posts++;
      a.likes += r.likes;
      a.comments += r.comments;
      a.shares += r.shares;
      a.views += r.views;
      return a;
    },
    { posts: 0, likes: 0, comments: 0, shares: 0, views: 0 }
  );
  const ids = {
    posts: "kpiPosts",
    likes: "kpiLikes",
    comments: "kpiComments",
    shares: "kpiShares",
    views: "kpiViews",
  };
  for (const k of Object.keys(ids)) {
    const el = $(ids[k]);
    if (!el) continue;
    animateNumber(el, STATE.kpiLast[k] || 0, t[k] || 0, 800);
  }
  STATE.kpiLast = t;
}

// Charts
let engagementChart = null,
  stackedChart = null;
function chartTheme() {
  const dark = document.documentElement.classList.contains("dark");
  return {
    gridColor:
      getComputedStyle(document.documentElement)
        .getPropertyValue("--grid")
        .trim() || (dark ? "#334155" : "#e5e7eb"),
    tickColor:
      getComputedStyle(document.documentElement)
        .getPropertyValue("--tick")
        .trim() || (dark ? "#94a3b8" : "#334155"),
    bgColor:
      getComputedStyle(document.documentElement)
        .getPropertyValue("--canvas")
        .trim() || (dark ? "#0b1220" : "#ffffff"),
    txtColor:
      getComputedStyle(document.documentElement)
        .getPropertyValue("--fg")
        .trim() || (dark ? "#e5e7eb" : "#0f172a"),
  };
}
const withAlpha = (hex, a = 0.25) => {
  const c = hex.replace("#", "");
  const n = parseInt(c, 16);
  const r = (n >> 16) & 255,
    g = (n >> 8) & 255,
    b = n & 255;
  return `rgba(${r},${g},${b},${a})`;
};
const colorFor = (p) => PLATFORM_COLORS[p] || "#64748b";

function niceTooltip() {
  const { bgColor, txtColor } = chartTheme();
  return {
    backgroundColor: bgColor,
    titleColor: txtColor,
    bodyColor: txtColor,
    callbacks: {
      title: (items) => items[0]?.label || "",
      label: (ctx) =>
        `${ctx.dataset.label || "Value"}: ${Number(
          (typeof ctx.parsed.y === "number" ? ctx.parsed.y : ctx.parsed) || 0
        ).toLocaleString()}`,
    },
    displayColors: false,
  };
}
function renderEngagementChart(by) {
  const el = $("engagementChart");
  if (!el) return;
  const ctx = el.getContext("2d");

  const labels = Object.keys(by);
  const vals = labels.map((k) => by[k].engagement);

  if (engagementChart) engagementChart.destroy();

  engagementChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{ label: "Engagement", data: vals }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 800, easing: "easeOutQuart" },
      plugins: { legend: { display: false }, tooltip: niceTooltip() },
      scales: {
        x: {
          grid: { color: "transparent" },
          ticks: { color: chartTheme().tickColor },
        },
        y: {
          beginAtZero: true,
          grid: { color: chartTheme().gridColor },
          ticks: { color: chartTheme().tickColor },
        },
      },
    },
  });
}

function renderStackedChart(by) {
  const el = $("stackedChart");
  if (!el) return;
  const ctx = el.getContext("2d");

  const labels = Object.keys(by);
  const likes = labels.map((k) => by[k].likes);
  const comments = labels.map((k) => by[k].comments);
  const shares = labels.map((k) => by[k].shares);
  const views = labels.map((k) => by[k].views);

  if (stackedChart) stackedChart.destroy();

  stackedChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "Likes", data: likes },
        { label: "Comments", data: comments },
        { label: "Shares", data: shares },
        { label: "Views", data: views },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 800, easing: "easeOutQuart" },
      plugins: { legend: { position: "top" }, tooltip: niceTooltip() },
      scales: {
        x: {
          stacked: true,
          grid: { color: "transparent" },
          ticks: { color: chartTheme().tickColor },
        },
        y: {
          stacked: true,
          beginAtZero: true,
          grid: { color: chartTheme().gridColor },
          ticks: { color: chartTheme().tickColor },
        },
      },
    },
  });
}
function renderCharts() {
  const by = computeByPlatform(STATE.filtered);
  renderEngagementChart(by);
  renderStackedChart(by);
}

function sortRows(rows, sortBy) {
  const keyed = rows.map((r) => ({
    ...r,
    engagement: r.likes + r.comments + r.shares + r.views,
    _ts: r.date ? r.date?.getTime?.() || 0 : -1,
  }));
  const map = {
    engagement_desc: (a, b) => b.engagement - a.engagement,
    date_desc: (a, b) => b._ts - a._ts,
    likes_desc: (a, b) => b.likes - a.likes,
    comments_desc: (a, b) => b.comments - a.comments,
    views_desc: (a, b) => b.views - a.views,
  };
  return keyed.sort(map[sortBy] || map.date_desc).slice(0, 50);
}
function pillForSentiment(s) {
  const map = { positive: "#16a34a", negative: "#ef4444", neutral: "#64748b" };
  const txt = s?.charAt(0).toUpperCase() + s?.slice(1) || "—";
  return `<span class="px-2 py-1 rounded-md text-xs" style="border:1px solid var(--card-border); color:${
    map[s] || "var(--muted)"
  }">${txt}</span>`;
}
function renderTopTable(rows) {
  const table = $("topTable");
  const tbody = table.querySelector("tbody");
  tbody.innerHTML = "";
  const sorted = sortRows(rows, STATE.sortBy);
  if (!sorted.length) {
    tbody.innerHTML = `<tr><td colspan="10">
      <div class="p-6 text-center">
        <div class="text-lg font-semibold">Илэрц алга</div>
        <div class="text-sm" style="color:var(--fg-soft)">Фильтер эсвэл түлхүүр үгээ өөрчлөөд дахин оролдоно уу.</div>
      </div></td></tr>`;
    return;
  }
  sorted.forEach((r, i) => {
    const tr = document.createElement("tr");
    tr.style.borderBottom = `1px solid var(--card-border)`;
    tr.style.animationDelay = `${i * 18}ms`;
    tr.innerHTML = `<td class="px-3 py-2">${r.platform}</td>
      <td class="px-3 py-2">${textShort(r.text, 140)}</td>
      <td class="px-3 py-2 text-right">${fmtDate(r.date)}</td>
      <td class="px-3 py-2 text-right">${r.likes.toLocaleString()}</td>
      <td class="px-3 py-2 text-right">${r.comments.toLocaleString()}</td>
      <td class="px-3 py-2 text-right">${r.shares.toLocaleString()}</td>
      <td class="px-3 py-2 text-right">${r.views.toLocaleString()}</td>
      <td class="px-3 py-2 text-right">${(
        r.likes +
        r.comments +
        r.shares +
        r.views
      ).toLocaleString()}</td>
      <td class="px-3 py-2">${pillForSentiment(r.sentiment)}</td>
      <td class="px-3 py-2 text-right">${
        r.url
          ? `<a class="text-blue-600 dark:text-blue-400 hover:underline" href="${r.url}" target="_blank" rel="noopener">Нээх</a>`
          : "—"
      }</td>`;
    tbody.appendChild(tr);
  });
}
function renderStatus() {
  const parts = [];
  if (STATE.lastUpdated)
    parts.push(`Шинэчлэгдсэн: ${STATE.lastUpdated.toLocaleTimeString()}`);
  $("status").textContent = parts.join(" · ");
}

// Images
function renderPublicImages(urls = []) {
  const wrap = $("publicImages");
  const thumbCol = $("thumbCol");
  if (thumbCol)
    thumbCol.style.display = $("publicImages").children.length
      ? "block"
      : "none";
  if (!wrap) return;
  wrap.innerHTML = "";

  const BAD_URL = /(logo|favicon)\b|\.svg($|\?)/i;

  // 1-р дамжлага: зөөлөн шүүлт
  let shown = 0;
  urls.forEach((u) => {
    if (!u || BAD_URL.test(u) || shown >= 8) return;

    const a = document.createElement("a");
    a.href = u;
    a.target = "_blank";
    a.rel = "noopener";

    const img = new Image();
    img.className = "img-thumb reveal";
    img.alt = "img";
    img.loading = "lazy";
    img.decoding = "async";
    img.referrerPolicy = "no-referrer";
    img.src = u;

    img.onload = () => {
      const w = img.naturalWidth,
        h = img.naturalHeight;
      const ratio = w / (h || 1);
      const tooSmall = w < 160 || h < 120;
      const oddRatio = ratio < 0.6 || ratio > 2.4; // 16:9 орчим + жаахан хэлбэлзэл OK
      if (tooSmall || oddRatio) {
        a.remove();
        return;
      }
    };
    img.onerror = () => a.remove();

    a.appendChild(img);
    wrap.appendChild(a);
    shown++;
  });

  // 2-р дамжлага: хэрвээ нэг ч зураг үлдээгүй бол (шүүлт хэтэрсэн) fallback — эхний 6-г (svg биш) шууд үзүүлнэ
  if (wrap.children.length === 0) {
    urls
      .filter((u) => u && !/\.svg($|\?)/i.test(u))
      .slice(0, 6)
      .forEach((u) => {
        const a = document.createElement("a");
        a.href = u;
        a.target = "_blank";
        a.rel = "noopener";
        const img = new Image();
        img.className = "img-thumb";
        img.alt = "img";
        img.loading = "lazy";
        img.decoding = "async";
        img.referrerPolicy = "no-referrer";
        img.src = u;
        a.appendChild(img);
        wrap.appendChild(a);
      });
  }

  // Хоосон байвал баганыг нуух, эс тэгвээс харуулах
  if (thumbCol)
    thumbCol.style.display = wrap.children.length ? "block" : "none";

  attachRevealTo("#publicImages img");
}

// Confetti
function fireConfetti() {
  const root = $("confetti");
  if (!root) return;
  const colors = [
    "#7c3aed",
    "#06b6d4",
    "#22d3ee",
    "#f59e0b",
    "#ef4444",
    "#10b981",
    "#6366f1",
  ];
  for (let i = 0; i < 24; i++) {
    const p = document.createElement("span");
    p.className = "p";
    const x = window.innerWidth / 2,
      y = 80;
    const dx = (Math.random() * 2 - 1) * (120 + Math.random() * 60);
    const dy = 200 + Math.random() * 140;
    p.style.setProperty("--x", x + "px");
    p.style.setProperty("--y", y + "px");
    p.style.setProperty("--dx", dx + "px");
    p.style.setProperty("--dy", dy + "px");
    p.style.left = 0;
    p.style.top = 0;
    p.style.background = colors[Math.floor(Math.random() * colors.length)];
    root.appendChild(p);
    setTimeout(() => p.remove(), 1000);
  }
}

// ===== Update flow =====
function updateUI() {
  applyFilter();
  renderKPIs(STATE.filtered);
  renderCharts();
  renderTopTable(STATE.filtered);
  renderPlatformPills();
  $("range").value = STATE.range;
  $("sortBy").value = STATE.sortBy;
  renderStatus();
  initReveal();
  pushState();
}

const BAD_HERO = /(logo|favicon)\b|\.svg($|\?)/i;
function pickHero(urls = []) {
  for (const u of urls) {
    if (!u) continue;
    if (BAD_HERO.test(u)) continue; // logo/svg мэтийг алгасна
    return u; // эхний зөв зураг
  }
  return null;
}

// ===== Fetch =====
async function runSearch(e) {
  if (e && e.type === "click") addRipple(e);
  const qv = $("q").value.trim();
  if (!qv) {
    $("status").textContent = "Түлхүүр үгээ оруулна уу";
    return;
  }
  $("status").textContent = "Loading…";
  showLoading(true);

  try {
    // MN тааруулалт: mn=1
    const r = await fetch(
      `${API_BASE}/api/search?q=${encodeURIComponent(qv)}&news=1&mn=1`,
      { headers: { Accept: "application/json" } }
    );
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
    const j = await r.json();

    const rows = (j.data || []).map((x) => ({
      ...x,
      date: x.date ? parseDateFlexible(x.date) : null,
    }));
    STATE.all = rows;
    STATE.errors = j.errors || {};
    STATE.lastUpdated = new Date();

    // AI panels
    const aiBadge = $("aiBadge"),
      newsWrap = $("newsWrap"),
      newsSources = $("newsSources"),
      toggle = $("newsToggle");
    const hero = $("aiHero");
    const insightPanel = $("newsBox"); // <<< зөв ID
    // const sourcesPanel = $("sourcesPanel"); // <<< устгана

    insightPanel.innerHTML = "";
    newsSources.innerHTML = "";
    hero.classList.add("hidden");

    if (j.news && (j.news.summary || j.news.assistant)) {
      const md = (j.news.summary || j.news.assistant || "").trim();
      insightPanel.innerHTML = marked.parse(md || "_(No insight content)_");
      (Array.isArray(j.news.sources) ? j.news.sources : []).forEach((s) => {
        const li = document.createElement("li");
        li.innerHTML = `<a class="hover:underline" href="${s}" target="_blank" rel="noopener">${s}</a>`;
        newsSources.appendChild(li);
      });
      if (aiBadge) aiBadge.textContent = "AI: enabled (MN)";
    } else {
      insightPanel.innerHTML = marked.parse(
        "_AI news/insights disabled — set PPLX_API_KEY to enable._"
      );
      if (aiBadge) aiBadge.textContent = "AI: stub";
    }

    requestAnimationFrame(() => {
      newsWrap.classList.remove("clamp");
      const tooTall = newsWrap.scrollHeight > 360;
      if (tooTall) {
        newsWrap.classList.add("clamp");
        toggle.classList.remove("hidden");
        toggle.textContent = "Дэлгэрэнгүй ▾";
      } else {
        toggle.classList.add("hidden");
      }
    });
    toggle.onclick = (ev) => {
      addRipple(ev);
      const isClamp = newsWrap.classList.toggle("clamp");
      toggle.textContent = isClamp ? "Дэлгэрэнгүй ▾" : "Хураах ▴";
    };

    // Images
    const uniq = Array.isArray(j.images) ? j.images : [];
    const heroUrl = pickHero(uniq);
    if (heroUrl) {
      hero.src = heroUrl;
      hero.referrerPolicy = "no-referrer";
      hero.onload = () => {
        hero.classList.remove("hidden");
        // Дүрсний бодит өндөр → 260px-аас том бол 260-д “тавиад” дуусгана
        const naturalH =
          hero.naturalHeight || hero.getBoundingClientRect().height || 260;
        const h = Math.min(naturalH, 260);
        document.documentElement.style.setProperty("--hero-h", `${h}px`);
      };
      hero.onerror = () => {
        hero.classList.add("hidden");
      };
    } else {
      hero.classList.add("hidden");
    }
    renderPublicImages(uniq.slice(1));

    updateUI();
    fireConfetti();
    $("status").textContent = `OK · ${
      rows.length
    } items · ${STATE.lastUpdated.toLocaleTimeString()}`;
  } catch (e) {
    console.error("SEARCH ERROR:", e);
    $("status").textContent = `⚠️ ${String(e?.message || e)}`;
  } finally {
    showLoading(false);
  }
}

// ===== Init =====
function init() {
  restoreState();
  initTheme();
  if (!isMobile) initParallax();

  const searchBtn = $("searchBtn");
  searchBtn.addEventListener("click", runSearch);
  searchBtn.addEventListener("click", addRipple);
  searchBtn.classList.add("magnet");
  attachMagnet(searchBtn);

  $("q").addEventListener("keydown", (e) => {
    if (e.key === "Enter") runSearch(e);
  });

  $("range").addEventListener("change", (e) => {
    STATE.range = e.target.value;
    updateUI();
  });
  $("sortBy").addEventListener("change", (e) => {
    STATE.sortBy = e.target.value;
    updateUI();
  });
  const density = $("density");
  if (density) {
    density.addEventListener("change", (e) => {
      const compact = e.target.value === "compact";
      $("topTable").classList.toggle("table-compact", compact);
    });
  }

  // Shortcuts
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.key.toLowerCase() === "k") {
      e.preventDefault();
      $("q").focus();
    }
  });

  initReveal();
  renderPlatformPills();
  updateUI();
}
document.addEventListener("DOMContentLoaded", init);

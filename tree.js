/* sqli://cheatsheet — tree.js
   Guided sequential flow:
   injection point → detection → observe → fingerprint → db → leaf (checklist + crafter + banner)
*/

/* ── STATE ── */
const S = {
  point: null, // selected injection point id
  observe: null, // selected observation id
  db: null, // selected db id
  payloads: [], // loaded payload lines for current leaf
  unionPayloads: [], // union payloads (error path only)
  activeTab: "checklist", // checklist | crafter | union
  crafterValue: "",
};

const LS_PREFIX = "sqli_cs_";

/* ── LOCALSTORAGE ── */
function lsKey() {
  if (!S.point || !S.observe || !S.db) return null;
  return `${LS_PREFIX}${S.point}_${S.observe}_${S.db}`;
}

function loadChecked() {
  const k = lsKey();
  if (!k) return new Set();
  try {
    return new Set(JSON.parse(localStorage.getItem(k) || "[]"));
  } catch {
    return new Set();
  }
}

function saveChecked(checked) {
  const k = lsKey();
  if (!k) return;
  localStorage.setItem(k, JSON.stringify([...checked]));
}

function resetNode() {
  const k = lsKey();
  if (k) localStorage.removeItem(k);
  renderMain();
}

function resetAll() {
  Object.keys(localStorage)
    .filter((k) => k.startsWith(LS_PREFIX))
    .forEach((k) => localStorage.removeItem(k));
  S.point = null;
  S.observe = null;
  S.db = null;
  S.payloads = [];
  S.unionPayloads = [];
  S.activeTab = "checklist";
  S.crafterValue = "";
  renderTree();
  renderMain();
}

/* ── PAYLOAD FETCH ── */
async function fetchPayloads(filePath) {
  try {
    const r = await fetch(filePath);
    if (!r.ok) throw new Error("not found");
    const text = await r.text();
    return text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
  } catch {
    return [`# could not load ${filePath} — add payload file to repo`];
  }
}

/* ── TREE RENDER ── */
function renderTree() {
  const panel = document.getElementById("tree-panel");
  panel.innerHTML = "";

  // Section: injection point
  panel.appendChild(sectionLabel("① injection point"));
  INJECTION_POINTS.forEach((pt) => {
    const active = S.point === pt.id;
    panel.appendChild(
      treeNode({
        label: pt.label,
        icon: active ? "▾" : "▸",
        depth: 0,
        lane: "neutral",
        active,
        onClick: () => selectPoint(pt.id),
      }),
    );

    if (active) {
      // detection sub-node
      panel.appendChild(
        treeNode({
          label: "detection payloads",
          icon: "●",
          depth: 1,
          lane: "neutral",
          active: !S.observe,
          onClick: () => {
            S.observe = null;
            S.db = null;
            renderTree();
            renderMain();
          },
        }),
      );

      if (S.observe) {
        const obs = OBSERVE_OPTIONS.find((o) => o.id === S.observe);
        panel.appendChild(
          treeNode({
            label: obs.label,
            icon: obs.icon,
            depth: 1,
            lane: obs.lane,
            active: true,
            onClick: () => {
              S.db = null;
              renderTree();
              renderMain();
            },
          }),
        );

        if (S.db) {
          const db = DB_OPTIONS.find((d) => d.id === S.db);
          panel.appendChild(
            treeNode({
              label: db.label,
              icon: "●",
              depth: 2,
              lane: obs.lane,
              active: true,
              selected: true,
              onClick: () => {},
            }),
          );
        }
      }
    }
  });
}

function sectionLabel(text) {
  const el = document.createElement("div");
  el.className = "tree-section-label";
  el.textContent = text;
  return el;
}

function treeNode({ label, icon, depth, lane, active, selected, onClick }) {
  const el = document.createElement("div");
  el.className = [
    "tree-node",
    `tree-depth-${depth}`,
    `lane-${lane}`,
    active ? "active" : "",
    selected ? "selected" : "",
  ].join(" ");
  el.tabIndex = 0;
  el.innerHTML = `<span class="tree-node-icon">${icon}</span><span class="tree-node-label">${label}</span>`;
  el.addEventListener("click", onClick);
  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick();
    }
  });
  return el;
}

/* ── POINT SELECT ── */
function selectPoint(id) {
  if (S.point === id) {
    S.point = null;
    S.observe = null;
    S.db = null;
  } else {
    S.point = id;
    S.observe = null;
    S.db = null;
  }
  S.payloads = [];
  S.unionPayloads = [];
  renderTree();
  renderMain();
}

/* ── OBSERVE SELECT ── */
function selectObserve(id) {
  S.observe = id;
  S.db = null;
  S.payloads = [];
  S.unionPayloads = [];
  renderTree();
  renderMain();
}

/* ── DB SELECT ── */
async function selectDb(id) {
  S.db = id;
  S.activeTab = "checklist";

  const entry = PAYLOAD_MAP[S.observe]?.[id];
  S.payloads = entry ? await fetchPayloads(entry.file) : [];

  if (S.observe === "error" && UNION_PAYLOAD_MAP[id]) {
    S.unionPayloads = await fetchPayloads(UNION_PAYLOAD_MAP[id].file);
  } else {
    S.unionPayloads = [];
  }

  renderTree();
  renderMain();
}

/* ── MAIN PANEL ── */
function renderMain() {
  const main = document.getElementById("main-panel");
  main.innerHTML = "";

  if (!S.point) {
    main.innerHTML = `
      <div class="welcome">
        <div class="welcome-arrow">←</div>
        <p class="welcome-title">select an injection point</p>
        <p class="welcome-sub">pick where you found a potentially injectable value and the cheatsheet will guide you step by step</p>
      </div>`;
    return;
  }

  const pt = INJECTION_POINTS.find((p) => p.id === S.point);

  // breadcrumb
  main.appendChild(buildBreadcrumb(pt));

  if (!S.observe) {
    // STEP 1: detection payloads
    renderDetectionStep(main, pt);
    return;
  }

  const obs = OBSERVE_OPTIONS.find((o) => o.id === S.observe);

  if (!S.db) {
    // STEP 2: fingerprint
    renderFingerprintStep(main, obs);
    return;
  }

  // STEP 3: leaf — checklist + crafter + banner
  renderLeaf(main, obs);
}

/* ── BREADCRUMB ── */
function buildBreadcrumb(pt) {
  const el = document.createElement("div");
  el.className = "breadcrumb";
  const parts = [pt.label];
  if (S.observe) {
    const obs = OBSERVE_OPTIONS.find((o) => o.id === S.observe);
    parts.push(obs.label);
  }
  if (S.db) {
    const db = DB_OPTIONS.find((d) => d.id === S.db);
    parts.push(db.label);
  }
  el.innerHTML = parts
    .map(
      (p, i) =>
        `<span class="breadcrumb-item ${i === parts.length - 1 ? "active" : ""}">${p}</span>${i < parts.length - 1 ? '<span class="breadcrumb-sep">/</span>' : ""}`,
    )
    .join("");
  return el;
}

/* ── STEP 1: DETECTION ── */
function renderDetectionStep(main, pt) {
  // step header
  main.appendChild(
    stepHeader(
      "01",
      "Run detection payloads",
      `You identified a potential injection point in the <strong>${pt.label}</strong>. Run these universal probes and observe what happens.`,
    ),
  );

  // hint about the injection point
  if (pt.hint) {
    const hint = document.createElement("div");
    hint.style.cssText =
      "font-size:11px;color:var(--text-muted);font-style:italic;padding:0 2px;";
    hint.textContent = pt.hint;
    main.appendChild(hint);
  }

  // detection payload card
  const card = document.createElement("div");
  card.className = "card card-scroll";
  card.innerHTML = `
    <div class="card-header">
      <div class="card-title">☑ detection payloads</div>
      <div class="card-meta">payloads/detection.txt</div>
    </div>
    <div class="card-body" id="detection-body">
      <div class="loading-row">loading payloads…</div>
    </div>`;
  main.appendChild(card);

  fetchPayloads(DETECTION_PAYLOADS.file).then((lines) => {
    const body = document.getElementById("detection-body");
    if (!body) return;
    body.innerHTML = "";
    const checked = loadDetectionChecked();
    body.appendChild(
      buildChecklist(lines, checked, "detection", () =>
        saveDetectionChecked(checked),
      ),
    );
  });

  // step 2 prompt
  main.appendChild(
    stepHeader(
      "02",
      "What did you observe?",
      "After running the detection payloads above, pick the outcome that best matches what you saw.",
    ),
  );

  const grid = document.createElement("div");
  grid.className = "observe-grid";
  OBSERVE_OPTIONS.forEach((opt) => {
    const btn = document.createElement("button");
    btn.className = `observe-btn lane-${opt.lane}`;
    btn.innerHTML = `
      <span class="observe-btn-icon">${opt.icon}</span>
      <div>
        <div class="observe-btn-label">${opt.label}</div>
        <div class="observe-btn-hint">${opt.hint}</div>
      </div>`;
    btn.addEventListener("click", () => selectObserve(opt.id));
    grid.appendChild(btn);
  });
  main.appendChild(grid);
}

function loadDetectionChecked() {
  try {
    return new Set(
      JSON.parse(localStorage.getItem(`${LS_PREFIX}detection`) || "[]"),
    );
  } catch {
    return new Set();
  }
}
function saveDetectionChecked(checked) {
  localStorage.setItem(`${LS_PREFIX}detection`, JSON.stringify([...checked]));
}

/* ── STEP 2: FINGERPRINT ── */
function renderFingerprintStep(main, obs) {
  main.appendChild(
    stepHeader(
      "02",
      `Confirmed: ${obs.label}`,
      `Good. Now identify which database you're dealing with. Run the fingerprint queries below and pick the DB that matches.`,
    ),
  );

  // fingerprint payloads card
  const fpCard = document.createElement("div");
  fpCard.className = "card card-scroll";
  fpCard.innerHTML = `
    <div class="card-header">
      <div class="card-title">◈ fingerprint queries</div>
      <div class="card-meta">payloads/fingerprint.txt</div>
    </div>
    <div class="card-body" id="fp-body">
      <div class="loading-row">loading…</div>
    </div>`;
  main.appendChild(fpCard);

  fetchPayloads(FINGERPRINT_PAYLOADS.file).then((lines) => {
    const body = document.getElementById("fp-body");
    if (!body) return;
    body.innerHTML = "";
    const checked = loadFpChecked();
    body.appendChild(
      buildChecklist(lines, checked, "fingerprint", () =>
        saveFpChecked(checked),
      ),
    );
  });

  // DB indicators
  const dbCard = document.createElement("div");
  dbCard.className = "card card-scroll";
  dbCard.innerHTML = `<div class="card-header"><div class="card-title">◈ db identification hints</div></div><div class="card-body" id="db-hints"></div>`;
  main.appendChild(dbCard);

  const hintsBody = document.getElementById("db-hints");
  if (hintsBody) {
    DB_OPTIONS.forEach((db) => {
      const section = document.createElement("div");
      section.style.marginBottom = "12px";
      section.innerHTML = `<div style="font-family:var(--font-mono);font-size:10px;font-weight:700;color:var(--text-secondary);margin-bottom:6px;">${db.label}</div>`;
      db.fingerprint.indicators.forEach((ind, i) => {
        const row = document.createElement("div");
        row.className = "fp-row";
        row.innerHTML = `
          <div class="fp-query">${db.fingerprint.queries[i] || ""}</div>
          <div class="fp-indicator">${ind}</div>`;
        section.appendChild(row);
      });
      hintsBody.appendChild(section);
    });
  }

  // DB select prompt
  main.appendChild(
    stepHeader(
      "03",
      "Which database did you confirm?",
      "Pick the database based on what the fingerprint queries revealed.",
    ),
  );

  const dbGrid = document.createElement("div");
  dbGrid.className = "db-grid";
  DB_OPTIONS.forEach((db) => {
    const btn = document.createElement("button");
    btn.className = "db-btn";
    btn.textContent = db.label;
    btn.addEventListener("click", () => selectDb(db.id));
    dbGrid.appendChild(btn);
  });
  main.appendChild(dbGrid);
}

function loadFpChecked() {
  try {
    return new Set(
      JSON.parse(localStorage.getItem(`${LS_PREFIX}fingerprint`) || "[]"),
    );
  } catch {
    return new Set();
  }
}
function saveFpChecked(checked) {
  localStorage.setItem(`${LS_PREFIX}fingerprint`, JSON.stringify([...checked]));
}

/* ── STEP 3: LEAF ── */
function renderLeaf(main, obs) {
  const db = DB_OPTIONS.find((d) => d.id === S.db);
  const payloadEntry = PAYLOAD_MAP[S.observe]?.[S.db];
  const unionEntry = UNION_PAYLOAD_MAP[S.db];
  const psRef = payloadEntry?.psRef;

  main.appendChild(
    stepHeader(
      "03",
      `${db.label} · ${obs.label}`,
      "You have confirmed the injection type and database. Use the checklist below to track your payload attempts, and the crafter to build ready-to-inject strings.",
    ),
  );

  // TABS
  const hasTabs = S.observe === "error" && S.unionPayloads.length;
  const tabs = ["checklist", "crafter"];
  if (hasTabs) tabs.splice(1, 0, "union");

  const tabBar = document.createElement("div");
  tabBar.className = "tabs";
  tabs.forEach((t) => {
    const btn = document.createElement("button");
    btn.className = `tab-btn ${S.activeTab === t ? "active" : ""}`;
    btn.textContent = t === "union" ? "union-based" : t;
    btn.addEventListener("click", () => {
      S.activeTab = t;
      renderLeaf(main, obs);
    });
    tabBar.appendChild(btn);
  });

  // WAF bypass tab
  const wafBtn = document.createElement("button");
  wafBtn.className = `tab-btn ${S.activeTab === "waf" ? "active" : ""}`;
  wafBtn.textContent = "waf bypass";
  wafBtn.addEventListener("click", () => {
    S.activeTab = "waf";
    renderLeaf(main, obs);
  });
  tabBar.appendChild(wafBtn);

  // Banner tab
  const bannerBtn = document.createElement("button");
  bannerBtn.className = `tab-btn ${S.activeTab === "banner" ? "active" : ""}`;
  bannerBtn.textContent = "banner extract";
  bannerBtn.style.opacity = "0.6";
  bannerBtn.addEventListener("click", () => {
    S.activeTab = "banner";
    renderLeaf(main, obs);
  });
  tabBar.appendChild(bannerBtn);

  // Clear main and re-add breadcrumb + tab bar (avoid full re-render loop)
  main.innerHTML = "";
  main.appendChild(
    buildBreadcrumb(INJECTION_POINTS.find((p) => p.id === S.point)),
  );
  main.appendChild(
    stepHeader(
      "03",
      `${db.label} · ${obs.label}`,
      "Confirmed. Use the tabs below — work through the checklist, craft injections with your real value, then move to banner extraction.",
    ),
  );
  main.appendChild(tabBar);

  if (S.activeTab === "checklist") {
    renderChecklistCard(main, payloadEntry);
  } else if (S.activeTab === "union") {
    renderChecklistCard(main, unionEntry, "union-based");
  } else if (S.activeTab === "waf") {
    renderChecklistCard(main, WAF_PAYLOADS, "waf bypass");
  } else if (S.activeTab === "crafter") {
    renderCrafterCard(main);
  } else if (S.activeTab === "banner") {
    renderBannerCard(main);
  }

  // PS ref
  if (psRef && S.activeTab !== "banner") {
    const ref = document.createElement("div");
    ref.className = "ps-ref";
    ref.innerHTML = `<span>↗ theory reference →</span><a href="${psRef}" target="_blank" rel="noopener noreferrer">PortSwigger SQLi cheat sheet</a>`;
    main.appendChild(ref);
  }
}

/* ── CHECKLIST CARD ── */
function renderChecklistCard(main, payloadEntry, label = "payload checklist") {
  const card = document.createElement("div");
  card.className = "card card-scroll";

  const storageKey = payloadEntry?.file || "unknown";
  let checked = loadChecked();

  const payloadLines =
    payloadEntry?.file === PAYLOAD_MAP[S.observe]?.[S.db]?.file
      ? S.payloads
      : payloadEntry?.file === UNION_PAYLOAD_MAP[S.db]?.file
        ? S.unionPayloads
        : [];

  card.innerHTML = `
    <div class="card-header">
      <div class="card-title">☑ ${label}</div>
      <div class="card-meta">${payloadEntry?.file || "—"}</div>
    </div>
    <div class="card-body">
      <div class="checklist-controls">
        <span class="cl-stats" id="cl-stats">— / — tried</span>
        <button class="btn-sm" id="cl-reset">↺ reset node</button>
      </div>
      <div class="cl-source">source: <em>${payloadEntry?.file || "built-in"}</em></div>
      <div id="cl-list"></div>
    </div>`;
  main.appendChild(card);

  card.querySelector("#cl-reset").addEventListener("click", () => {
    resetNode();
  });

  // use already-fetched payloads or fetch now
  const lines = payloadLines.length
    ? Promise.resolve(payloadLines)
    : fetchPayloads(payloadEntry?.file || "");
  lines.then((ls) => {
    const listEl = card.querySelector("#cl-list");
    const statsEl = card.querySelector("#cl-stats");
    if (!listEl) return;

    // re-use checked from localStorage each render
    checked = loadChecked();
    listEl.appendChild(
      buildChecklist(ls, checked, null, () => {
        saveChecked(checked);
        const total = ls.filter((l) => !l.startsWith("#")).length;
        const done = [...checked].length;
        if (statsEl) statsEl.innerHTML = `<em>${done}</em> / ${total} tried`;
      }),
    );

    const total = ls.filter((l) => !l.startsWith("#")).length;
    const done = [...checked].length;
    if (statsEl) statsEl.innerHTML = `<em>${done}</em> / ${total} tried`;
  });
}

/* ── BUILD CHECKLIST DOM ── */
function buildChecklist(lines, checked, storageKey, onChange) {
  const frag = document.createDocumentFragment();
  lines.forEach((line, idx) => {
    if (line.startsWith("#")) {
      const el = document.createElement("div");
      el.className = "comment-row";
      el.textContent = line;
      frag.appendChild(el);
      return;
    }
    const key = idx.toString();
    const isChecked = checked.has(key);

    const row = document.createElement("div");
    row.className = `payload-row ${isChecked ? "checked" : ""}`;

    // hidden native checkbox (for semantics)
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = isChecked;

    // custom visual checkbox
    const box = document.createElement("span");
    box.className = "cb-box";
    box.textContent = isChecked ? "✓" : "";
    box.setAttribute("aria-hidden", "true");

    const toggle = () => {
      const nowChecked = !cb.checked;
      cb.checked = nowChecked;
      box.textContent = nowChecked ? "✓" : "";
      row.classList.toggle("checked", nowChecked);
      if (nowChecked) checked.add(key);
      else checked.delete(key);
      onChange && onChange();
    };

    row.addEventListener("click", (e) => {
      // don't toggle when clicking copy button
      if (e.target.classList.contains("copy-pill")) return;
      toggle();
    });

    const text = document.createElement("span");
    text.className = "payload-text";
    text.textContent = line;

    const copy = document.createElement("button");
    copy.className = "copy-pill";
    copy.textContent = "copy";
    copy.addEventListener("click", (e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(line).then(() => {
        copy.textContent = "copied!";
        copy.classList.add("copied");
        setTimeout(() => {
          copy.textContent = "copy";
          copy.classList.remove("copied");
        }, 1500);
      });
    });

    row.appendChild(cb);
    row.appendChild(box);
    row.appendChild(text);
    row.appendChild(copy);
    frag.appendChild(row);
  });
  return frag;
}

/* ── CRAFTER CARD ── */
function renderCrafterCard(main) {
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `
    <div class="card-header">
      <div class="card-title">⌗ payload crafter</div>
      <div class="card-meta">value + payload → ready to inject</div>
    </div>
    <div class="card-body">
      <div class="crafter-row">
        <span class="crafter-label">vulnerable value</span>
        <input class="crafter-input" id="crafter-input" type="text"
          placeholder="e.g. Mozilla/5.0  or  1  or  admin"
          value="${escHtml(S.crafterValue)}">
      </div>
      <div class="crafter-hint">paste only the raw value the parameter currently holds — payloads append to it below</div>
      <div id="crafted-list"></div>
    </div>`;
  main.appendChild(card);

  const input = card.querySelector("#crafter-input");
  const list = card.querySelector("#crafted-list");

  function rebuild() {
    S.crafterValue = input.value;
    list.innerHTML = "";
    if (!S.crafterValue) {
      list.innerHTML =
        '<div class="loading-row">type a value above to see crafted payloads</div>';
      return;
    }
    const lines = S.payloads.filter((l) => !l.startsWith("#") && l.length > 0);
    lines.forEach((payload) => {
      const row = document.createElement("div");
      row.className = "crafted-row";

      const text = document.createElement("span");
      text.className = "crafted-text";
      text.innerHTML = `<span class="crafted-val">${escHtml(S.crafterValue)}</span><span class="crafted-pld">${escHtml(payload)}</span>`;

      const copy = document.createElement("button");
      copy.className = "copy-pill";
      copy.textContent = "copy";
      const full = S.crafterValue + payload;
      copy.addEventListener("click", () => {
        navigator.clipboard.writeText(full).then(() => {
          copy.textContent = "copied!";
          copy.classList.add("copied");
          setTimeout(() => {
            copy.textContent = "copy";
            copy.classList.remove("copied");
          }, 1500);
        });
      });

      row.appendChild(text);
      row.appendChild(copy);
      list.appendChild(row);
    });
  }

  input.addEventListener("input", rebuild);
  rebuild();
}

/* ── BANNER CARD ── */
function renderBannerCard(main) {
  const card = document.createElement("div");
  card.className = "card card-dev";
  card.innerHTML = `
    <div class="card-header">
      <div class="card-title">$ banner extraction</div>
      <div class="card-meta"><span class="dev-badge">under development</span></div>
    </div>
    <div class="card-body">
      <div class="dev-card">
        <div class="dev-icon">⚙</div>
        <div class="dev-body">
          <h4>Python script generator <span class="dev-badge">coming in v2</span></h4>
          <p>Enter your target details and get a ready-to-run Python script that performs banner extraction via your confirmed technique — including char-by-char blind exfiltration for time-based paths.</p>
          <div class="dev-code">planned: <em>python3 extract_banner.py --url target --param header --db ${S.db || "postgresql"} --technique ${S.observe || "time"}</em></div>
        </div>
      </div>
    </div>`;
  main.appendChild(card);
}

/* ── STEP HEADER ── */
function stepHeader(num, title, desc) {
  const el = document.createElement("div");
  el.className = "step-header";
  el.innerHTML = `
    <span class="step-num">STEP ${num}</span>
    <div class="step-text">
      <h3>${title}</h3>
      <p>${desc}</p>
    </div>`;
  return el;
}

/* ── UTILS ── */
function escHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ── INIT ── */
document.getElementById("btn-reset-all").addEventListener("click", resetAll);
document.addEventListener("DOMContentLoaded", () => {
  renderTree();
  renderMain();
});

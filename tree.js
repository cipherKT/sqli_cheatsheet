/* sqli://cheatsheet — tree.js
   Interactive Mind Map Traverser with Slide-out Exploitation Companion
*/

/* ── STATE ── */
const S = {
  point: null,           // selected injection point id (col 1)
  observe: null,         // selected observation behavior id (col 2)
  db: null,              // selected database id (col 3)
  payloads: [],          // loaded payload lines for current leaf
  unionPayloads: [],     // union payloads (error path only)
  activeTab: "checklist", // checklist | crafter | union | WAF | banner
  crafterValue: "",
  crafterEncoding: "raw", // raw | url | double
  searchQuery: "",        // checklist filter query
};

const LS_PREFIX = "sqli_cs_";

const dragState = {
  isDragging: false,
  startX: 0,
  startY: 0,
  panX: 0,          // Current translation X
  panY: 0,          // Current translation Y
  startPanX: 0,     // Drag start translation X
  startPanY: 0,     // Drag start translation Y
  hasMoved: false,
};

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
  renderDrawer();
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
  S.crafterEncoding = "raw";
  S.searchQuery = "";

  closeDrawer();
  renderMindmap();
  autoPan();
  updateStatusTip();
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

/* ── CLAMP UTILITY ── */
function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

/* ── DYNAMIC MIND MAP RENDER ── */
function renderMindmap() {
  const canvas = document.getElementById("mindmap-canvas");
  const svg = document.getElementById("mindmap-svg");

  // Remove existing HTML nodes
  canvas.querySelectorAll(".mindmap-node").forEach((n) => n.remove());
  svg.innerHTML = "";

  const visibleNodes = [];

  // 1. ROOT NODE (Col 0)
  const rootNode = {
    id: "root",
    label: "SQL Injection",
    hint: "Click path nodes to drill down target parameter & response details.",
    icon: "⚡",
    x: 100,
    y: 600, // Centered on the 1200px tall canvas
    type: "root",
    active: true,
  };
  visibleNodes.push(rootNode);

  // Determine dimming states
  const anyPtActive = S.point !== null;

  // 2. COL 1 NODES: Injection Points (Col 1, x: 320)
  const ptIcons = {
    get: "🌐",
    post: "📥",
    header: "📂",
    cookie: "🍪",
    json: "⚙",
  };
  INJECTION_POINTS.forEach((pt, idx) => {
    const active = S.point === pt.id;
    const dimmed = anyPtActive && !active;
    visibleNodes.push({
      id: pt.id,
      label: pt.label,
      hint: pt.hint,
      icon: ptIcons[pt.id] || "📁",
      x: 320,
      y: 300 + idx * 150, // Stacked symmetrically: (300, 450, 600, 750, 900)
      parent: "root",
      active,
      dimmed,
      lane: "neutral",
      onClick: () => selectPoint(pt.id),
    });
  });

  // 3. COL 2 NODES: Observable Behaviors (Col 2, x: 540)
  if (S.point) {
    const anyObsActive = S.observe !== null;
    const ptIdx = INJECTION_POINTS.findIndex((p) => p.id === S.point);
    const ptY = 300 + ptIdx * 150;

    OBSERVE_OPTIONS.forEach((opt, idx) => {
      const active = S.observe === opt.id;
      const dimmed = anyObsActive && !active;
      visibleNodes.push({
        id: opt.id,
        label: opt.label,
        hint: opt.hint,
        icon: opt.icon,
        x: 540,
        y: ptY + (idx - 1.5) * 100, // Centered symmetrically around parent ptY (unclamped to prevent overlap)
        parent: S.point,
        active,
        dimmed,
        lane: opt.lane,
        onClick: () => selectObserve(opt.id),
      });
    });
  }

  // 4. COL 3 NODES: Databases (Col 3, x: 760)
  if (S.observe) {
    const activeObsOpt = OBSERVE_OPTIONS.find((o) => o.id === S.observe);
    const obsLane = activeObsOpt ? activeObsOpt.lane : "neutral";
    const anyDbActive = S.db !== null;

    const ptIdx = INJECTION_POINTS.findIndex((p) => p.id === S.point);
    const ptY = 300 + ptIdx * 150;
    const obsIdx = OBSERVE_OPTIONS.findIndex((o) => o.id === S.observe);
    const obsY = ptY + (obsIdx - 1.5) * 100;

    DB_OPTIONS.forEach((db, idx) => {
      const active = S.db === db.id;
      const dimmed = anyDbActive && !active;
      visibleNodes.push({
        id: db.id,
        label: db.label,
        hint: `Extract data using specific ${db.label} payloads`,
        icon: "🛢",
        x: 760,
        y: obsY + (idx - 2) * 90, // Centered symmetrically around parent obsY (unclamped to prevent overlap)
        parent: S.observe,
        active,
        dimmed,
        lane: obsLane,
        onClick: () => selectDb(db.id),
      });
    });
  }

  // Render DOM nodes
  visibleNodes.forEach((node) => {
    canvas.appendChild(createNodeDom(node));
  });

  // Render SVG Paths (connecting lines)
  visibleNodes.forEach((node) => {
    if (!node.parent) return;
    const parentNode = visibleNodes.find((n) => n.id === node.parent);
    if (!parentNode) return;

    // Output anchor of parent (Right Edge)
    const pWidth = parentNode.type === "root" ? 140 : 195;
    const ox = parentNode.x + pWidth / 2;
    const oy = parentNode.y;

    // Input anchor of child (Left Edge)
    const cWidth = node.type === "root" ? 140 : 195;
    const ix = node.x - cWidth / 2;
    const iy = node.y;

    // Curve layout: Cubic Bezier S-Curve
    const mx = (ox + ix) / 2;
    const dStr = `M ${ox} ${oy} C ${mx} ${oy}, ${mx} ${iy}, ${ix} ${iy}`;

    // Determine path styling classes
    const pathClasses = ["connection-line"];
    const isPathActive = parentNode.active && node.active;

    if (isPathActive) {
      pathClasses.push("active");
      if (node.lane) {
        pathClasses.push(`lane-${node.lane}`);
      }
    }

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", dStr);
    path.setAttribute("class", pathClasses.join(" "));
    svg.appendChild(path);
  });
}

function createNodeDom(n) {
  const el = document.createElement("div");
  el.className = [
    "mindmap-node",
    n.type === "root" ? "root-node" : "",
    n.active ? "active" : "",
    n.dimmed ? "dimmed" : "",
    n.lane ? `lane-${n.lane}` : "",
  ].join(" ");

  el.style.left = `${n.x}px`;
  el.style.top = `${n.y}px`;
  el.tabIndex = n.dimmed ? -1 : 0;

  let hintHtml = "";
  if (n.hint) {
    hintHtml = `<div class="mindmap-node-hint">${n.hint}</div>`;
  }

  el.innerHTML = `
    <div class="mindmap-node-title-row">
      <span class="mindmap-node-icon">${n.icon}</span>
      <span class="mindmap-node-label">${n.label}</span>
    </div>
    ${hintHtml}
  `;

  if (n.onClick) {
    el.addEventListener("click", (e) => {
      if (dragState.hasMoved) return; // Prevent clicks during drags
      n.onClick();
    });
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        n.onClick();
      }
    });
  }

  return el;
}

/* ── SELECTION FLOW ACTIONS ── */
function selectPoint(id) {
  if (S.point === id) {
    // Toggle off
    S.point = null;
    S.observe = null;
    S.db = null;
    closeDrawer();
  } else {
    S.point = id;
    S.observe = null;
    S.db = null;
    openDrawer();
  }
  S.payloads = [];
  S.unionPayloads = [];
  S.searchQuery = "";
  renderMindmap();
  renderDrawer();
  autoPan();
  updateStatusTip();
}

function selectObserve(id) {
  if (S.observe === id) {
    S.observe = null;
    S.db = null;
    // Fallback drawer to point detection
    renderDrawer();
  } else {
    S.observe = id;
    S.db = null;
    openDrawer();
  }
  S.payloads = [];
  S.unionPayloads = [];
  S.searchQuery = "";
  renderMindmap();
  renderDrawer();
  autoPan();
  updateStatusTip();
}

async function selectDb(id) {
  if (S.db === id) {
    // Toggle drawer state on re-clicking selected database
    toggleDrawer();
    return;
  }
  S.db = id;
  S.activeTab = "checklist";
  S.searchQuery = "";

  const entry = PAYLOAD_MAP[S.observe]?.[id];
  S.payloads = entry ? await fetchPayloads(entry.file) : [];

  if (S.observe === "error" && UNION_PAYLOAD_MAP[id]) {
    S.unionPayloads = await fetchPayloads(UNION_PAYLOAD_MAP[id].file);
  } else {
    S.unionPayloads = [];
  }

  openDrawer();
  renderMindmap();
  renderDrawer();
  autoPan();
  updateStatusTip();
}

/* ── STATUS BAR TIP UTILITY ── */
function updateStatusTip() {
  const el = document.getElementById("status-tip");
  if (!el) return;

  if (!S.point) {
    el.textContent = "Select an injection point to begin traversing the rabbit hole";
  } else if (!S.observe) {
    const pt = INJECTION_POINTS.find((p) => p.id === S.point);
    el.innerHTML = `Active Surface: <strong>${pt.label}</strong>. Execute detection payloads and select your observation behavior.`;
  } else if (!S.db) {
    const obs = OBSERVE_OPTIONS.find((o) => o.id === S.observe);
    el.innerHTML = `Observation: <strong>${obs.label}</strong>. Perform fingerprinting checks to identify the target database.`;
  } else {
    const db = DB_OPTIONS.find((d) => d.id === S.db);
    const obs = OBSERVE_OPTIONS.find((o) => o.id === S.observe);
    el.innerHTML = `Exploitation: <strong>${db.label}</strong> via <strong>${obs.label}</strong>. Companion panel is armed.`;
  }
}

/* ── DRAWER TRANSITIONS ── */
function openDrawer() {
  document.getElementById("drawer-panel").classList.add("open");
}
function closeDrawer() {
  document.getElementById("drawer-panel").classList.remove("open");
}
function toggleDrawer() {
  document.getElementById("drawer-panel").classList.toggle("open");
}

function autoPan() {
  const viewport = document.getElementById("mindmap-viewport");
  const canvas = document.getElementById("mindmap-canvas");
  if (!viewport || !canvas) return;

  const viewportWidth = viewport.clientWidth;
  const viewportHeight = viewport.clientHeight;
  const drawerOpen = document.getElementById("drawer-panel").classList.contains("open");
  const visibleWidth = drawerOpen ? (viewportWidth - 580) : viewportWidth;

  let targetX = 0;
  let targetY = 0;

  if (S.db) {
    targetX = visibleWidth / 2 - 760;
    const ptIdx = INJECTION_POINTS.findIndex(p => p.id === S.point);
    const ptY = 300 + ptIdx * 150;
    const obsIdx = OBSERVE_OPTIONS.findIndex(o => o.id === S.observe);
    const obsY = ptY + (obsIdx - 1.5) * 100;
    const dbIdx = DB_OPTIONS.findIndex(d => d.id === S.db);
    const dbY = obsY + (dbIdx - 2) * 90;
    targetY = viewportHeight / 2 - dbY;
  } else if (S.observe) {
    targetX = visibleWidth / 2 - 540;
    const ptIdx = INJECTION_POINTS.findIndex(p => p.id === S.point);
    const ptY = 300 + ptIdx * 150;
    const obsIdx = OBSERVE_OPTIONS.findIndex(o => o.id === S.observe);
    const obsY = ptY + (obsIdx - 1.5) * 100;
    targetY = viewportHeight / 2 - obsY;
  } else if (S.point) {
    targetX = visibleWidth / 2 - 340;
    const ptIdx = INJECTION_POINTS.findIndex(p => p.id === S.point);
    const ptY = 300 + ptIdx * 150;
    targetY = viewportHeight / 2 - ptY;
  } else {
    // Welcoming state
    targetX = visibleWidth / 2 - 210;
    targetY = viewportHeight / 2 - 600; // Center around root y=600
  }

  // Update drag state and clamp to keep canvas within screen boundaries
  dragState.panX = clamp(targetX, -1200, 600);
  dragState.panY = clamp(targetY, -1100, 500);

  // Apply CSS transition pan
  canvas.style.transition = "transform 0.4s cubic-bezier(0.25, 0.8, 0.25, 1)";
  canvas.style.transform = `translate(${dragState.panX}px, ${dragState.panY}px)`;
}

/* ── COMPANION DRAWER CONTENT ENGINE ── */
function renderDrawer() {
  const titleEl = document.getElementById("drawer-title");
  const subtitleEl = document.getElementById("drawer-subtitle");
  const bodyEl = document.getElementById("drawer-body");

  bodyEl.innerHTML = "";

  if (!S.point) {
    titleEl.textContent = "Payload Companion";
    subtitleEl.textContent = "traversal offline";
    bodyEl.innerHTML = `
      <div class="loading-row" style="padding-top:40px;">
        <p style="font-size:12px;color:var(--text-muted);">Please click a node on the mind map to mount the payload assistant.</p>
      </div>`;
    return;
  }

  const pt = INJECTION_POINTS.find((p) => p.id === S.point);

  if (!S.observe) {
    // STEP 1: DETECTION PAYLOAD DRAWER
    titleEl.textContent = "01 // Detection Phase";
    subtitleEl.textContent = `${pt.label}`;
    renderDetectionDrawer(bodyEl, pt);
    return;
  }

  const obs = OBSERVE_OPTIONS.find((o) => o.id === S.observe);

  if (!S.db) {
    // STEP 2: FINGERPRINT DRAWER
    titleEl.textContent = "02 // Fingerprint Phase";
    subtitleEl.textContent = `${obs.label}`;
    renderFingerprintDrawer(bodyEl, obs);
    return;
  }

  // STEP 3: EXPLOITATION LEAF DRAWER
  const db = DB_OPTIONS.find((d) => d.id === S.db);
  titleEl.textContent = "03 // Exploitation Phase";
  subtitleEl.textContent = `${db.label} · ${obs.label}`;
  renderExploitationDrawer(bodyEl, obs);
}

/* ── PHASE 1: DETECTION DRAW ── */
function renderDetectionDrawer(container, pt) {
  // Description Card
  const descCard = document.createElement("div");
  descCard.style.cssText = "font-size:11px; color:var(--text-secondary); line-height:1.5; padding: 2px 0;";
  descCard.innerHTML = `Deploy universal injection probes into the <strong>${pt.label}</strong> parameter. Run the check list below and observe response differences.`;
  container.appendChild(descCard);

  // Detection List Card
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `
    <div class="card-header">
      <div class="card-title">☑ Detection Probes</div>
      <div class="card-meta">detection.txt</div>
    </div>
    <div class="card-body">
      <div class="search-container">
        <span class="search-icon">🔍</span>
        <input type="text" id="payload-search" placeholder="Filter payloads..." class="search-input" value="${escHtml(S.searchQuery)}">
      </div>
      <div class="checklist-controls" style="margin-top:10px;">
        <span class="cl-stats" id="cl-stats">— / — tried</span>
        <button class="btn-sm" id="cl-reset">↺ reset</button>
      </div>
      <div id="cl-list">
        <div class="loading-row">loading payloads…</div>
      </div>
    </div>`;
  container.appendChild(card);

  card.querySelector("#cl-reset").addEventListener("click", () => {
    localStorage.removeItem(`${LS_PREFIX}detection`);
    renderDrawer();
  });

  fetchPayloads(DETECTION_PAYLOADS.file).then((lines) => {
    const listEl = card.querySelector("#cl-list");
    const statsEl = card.querySelector("#cl-stats");
    const searchInput = card.querySelector("#payload-search");

    if (!listEl) return;

    function buildFilteredList() {
      listEl.innerHTML = "";
      const checked = loadDetectionChecked();
      listEl.appendChild(
        buildChecklist(lines, checked, "detection", () => {
          saveDetectionChecked(checked);
          updateStats();
        })
      );

      function updateStats() {
        const total = lines.filter((l) => !l.startsWith("#")).length;
        const done = [...checked].length;
        if (statsEl) statsEl.innerHTML = `<em>${done}</em> / ${total} tried`;
      }
      updateStats();
    }

    searchInput.addEventListener("input", (e) => {
      S.searchQuery = e.target.value;
      buildFilteredList();
    });

    buildFilteredList();
  });

  // Action instructions card
  const promptCard = document.createElement("div");
  promptCard.className = "card card-dev";
  promptCard.style.padding = "12px";
  promptCard.innerHTML = `
    <div style="font-size:11px;font-weight:700;color:var(--color-green);margin-bottom:4px;">→ Dynamic Progression</div>
    <div style="font-size:10px;color:var(--text-secondary);line-height:1.4;">
      Once you notice a change in the server response (an error, a time delay, or altered text content), select the corresponding observation node on the mind map canvas.
    </div>
  `;
  container.appendChild(promptCard);
}

function loadDetectionChecked() {
  try {
    return new Set(
      JSON.parse(localStorage.getItem(`${LS_PREFIX}detection`) || "[]")
    );
  } catch {
    return new Set();
  }
}
function saveDetectionChecked(checked) {
  localStorage.setItem(`${LS_PREFIX}detection`, JSON.stringify([...checked]));
}

/* ── PHASE 2: FINGERPRINT DRAW ── */
function renderFingerprintDrawer(container, obs) {
  // Description Card
  const descCard = document.createElement("div");
  descCard.style.cssText = "font-size:12px; color:var(--text-secondary); line-height:1.5; margin-bottom: 12px;";
  descCard.innerHTML = `Run database-specific signature queries. Copy a payload below to execute, and observe if the target matches the behavioral indicator.`;
  container.appendChild(descCard);

  // DB Signatures Card
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `
    <div class="card-header">
      <div class="card-title">◈ Database Fingerprint Signatures</div>
      <div class="card-meta">fingerprint indicators</div>
    </div>
    <div class="card-body" style="display:flex; flex-direction:column; gap:14px;" id="db-signatures-list">
      <!-- Loaded dynamically -->
    </div>`;
  container.appendChild(card);

  const listEl = card.querySelector("#db-signatures-list");
  DB_OPTIONS.forEach((db) => {
    const section = document.createElement("div");
    section.className = "fp-section-card";
    
    // Header for each DB
    const header = document.createElement("div");
    header.className = "fp-section-header";
    header.innerHTML = `🛢 ${db.label}`;
    // Give different colors depending on DB
    if (db.id === "mysql") header.style.color = "var(--color-green)";
    else if (db.id === "mssql") header.style.color = "var(--color-bool)";
    else if (db.id === "postgresql") header.style.color = "var(--color-time)";
    else if (db.id === "oracle") header.style.color = "var(--color-oob)";
    section.appendChild(header);

    const body = document.createElement("div");
    body.className = "fp-section-body";

    db.fingerprint.queries.forEach((query, i) => {
      const row = document.createElement("div");
      row.className = "fp-row-new";

      const codeRow = document.createElement("div");
      codeRow.className = "fp-query-code";
      
      const code = document.createElement("code");
      code.textContent = query;
      codeRow.appendChild(code);

      const copyBtn = document.createElement("button");
      copyBtn.className = "copy-pill";
      copyBtn.textContent = "copy";
      copyBtn.addEventListener("click", () => {
        navigator.clipboard.writeText(query).then(() => {
          copyBtn.textContent = "copied!";
          copyBtn.classList.add("copied");
          setTimeout(() => {
            copyBtn.textContent = "copy";
            copyBtn.classList.remove("copied");
          }, 1200);
        });
      });
      codeRow.appendChild(copyBtn);
      row.appendChild(codeRow);

      const indRow = document.createElement("div");
      indRow.className = "fp-query-indicator";
      indRow.innerHTML = `<span>Indicator:</span> ${escHtml(db.fingerprint.indicators[i] || "")}`;
      row.appendChild(indRow);

      body.appendChild(row);
    });

    section.appendChild(body);
    listEl.appendChild(section);
  });
}

function loadFpChecked() {
  try {
    return new Set(
      JSON.parse(localStorage.getItem(`${LS_PREFIX}fingerprint`) || "[]")
    );
  } catch {
    return new Set();
  }
}
function saveFpChecked(checked) {
  localStorage.setItem(`${LS_PREFIX}fingerprint`, JSON.stringify([...checked]));
}

/* ── PHASE 3: EXPLOITATION DRAW ── */
function renderExploitationDrawer(container, obs) {
  const payloadEntry = PAYLOAD_MAP[S.observe]?.[S.db];
  const unionEntry = UNION_PAYLOAD_MAP[S.db];
  const psRef = payloadEntry?.psRef;

  // TAB SELECTORS
  const hasTabs = S.observe === "error" && S.unionPayloads.length;
  const tabs = ["checklist", "crafter"];
  if (hasTabs) tabs.splice(1, 0, "union");
  tabs.push("waf bypass", "banner extract");

  const tabBar = document.createElement("div");
  tabBar.className = "tabs";
  tabs.forEach((t) => {
    const btn = document.createElement("button");
    btn.className = `tab-btn ${S.activeTab === t ? "active" : ""}`;
    btn.textContent = t === "union" ? "union" : t === "waf bypass" ? "waf" : t === "banner extract" ? "banner" : t;
    btn.addEventListener("click", () => {
      S.activeTab = t;
      renderDrawer();
    });
    tabBar.appendChild(btn);
  });
  container.appendChild(tabBar);

  // Tab Content Switch
  if (S.activeTab === "checklist") {
    renderDrawerChecklistCard(container, payloadEntry, "Payload Checklist");
  } else if (S.activeTab === "union") {
    renderDrawerChecklistCard(container, unionEntry, "Union Exploitation");
  } else if (S.activeTab === "waf bypass") {
    renderDrawerChecklistCard(container, WAF_PAYLOADS, "WAF Bypass Filters");
  } else if (S.activeTab === "crafter") {
    renderDrawerCrafterCard(container);
  } else if (S.activeTab === "banner") {
    renderDrawerBannerCard(container);
  }

  // PS Reference Link
  if (psRef && S.activeTab !== "banner") {
    const ref = document.createElement("div");
    ref.className = "ps-ref";
    ref.innerHTML = `<span>↗ PortSwigger:</span><a href="${psRef}" target="_blank" rel="noopener noreferrer">SQLi Lab Reference</a>`;
    container.appendChild(ref);
  }
}

/* ── COMPANION EXPLOIT LIST CARD ── */
function renderDrawerChecklistCard(container, payloadEntry, label) {
  const card = document.createElement("div");
  card.className = "card";

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
      <div class="search-container">
        <span class="search-icon">🔍</span>
        <input type="text" id="payload-search" placeholder="Filter payloads..." class="search-input" value="${escHtml(S.searchQuery)}">
      </div>
      <div class="checklist-controls" style="margin-top:10px;">
        <span class="cl-stats" id="cl-stats">— / — tried</span>
        <button class="btn-sm" id="cl-reset">↺ reset current</button>
      </div>
      <div class="cl-source">source: <em>${payloadEntry?.file || "built-in"}</em></div>
      <div id="cl-list">
        <div class="loading-row">loading payloads…</div>
      </div>
    </div>`;
  container.appendChild(card);

  card.querySelector("#cl-reset").addEventListener("click", () => {
    resetNode();
  });

  const linesPromise = payloadLines.length
    ? Promise.resolve(payloadLines)
    : fetchPayloads(payloadEntry?.file || "");

  linesPromise.then((ls) => {
    const listEl = card.querySelector("#cl-list");
    const statsEl = card.querySelector("#cl-stats");
    const searchInput = card.querySelector("#payload-search");

    if (!listEl) return;

    function buildFilteredList() {
      listEl.innerHTML = "";
      const checked = loadChecked();
      listEl.appendChild(
        buildChecklist(ls, checked, null, () => {
          saveChecked(checked);
          updateStats();
        })
      );

      function updateStats() {
        const total = ls.filter((l) => !l.startsWith("#")).length;
        const done = [...checked].length;
        if (statsEl) statsEl.innerHTML = `<em>${done}</em> / ${total} tried`;
      }
      updateStats();
    }

    searchInput.addEventListener("input", (e) => {
      S.searchQuery = e.target.value;
      buildFilteredList();
    });

    buildFilteredList();
  });
}

/* ── CHECKLIST LIST BUILDER ── */
function buildChecklist(lines, checked, storageKey, onChange) {
  const frag = document.createDocumentFragment();

  lines.forEach((line, idx) => {
    if (line.startsWith("#")) {
      // Only append comments if search query is empty
      if (!S.searchQuery) {
        const el = document.createElement("div");
        el.className = "comment-row";
        el.textContent = line;
        frag.appendChild(el);
      }
      return;
    }

    // Filter list items
    if (S.searchQuery && !line.toLowerCase().includes(S.searchQuery.toLowerCase())) {
      return;
    }

    const key = idx.toString();
    const isChecked = checked.has(key);

    const row = document.createElement("div");
    row.className = `payload-row ${isChecked ? "checked" : ""}`;

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = isChecked;

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
        }, 1200);
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

/* ── COMPANION PAYLOAD CRAFTER DRAW ── */
function renderDrawerCrafterCard(container) {
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `
    <div class="card-header">
      <div class="card-title">⌗ Payload Crafter</div>
      <div class="card-meta">modify variables live</div>
    </div>
    <div class="card-body">
      <div class="crafter-row">
        <span class="crafter-label">vulnerable value</span>
        <input class="crafter-input" id="crafter-input" type="text"
          placeholder="e.g. 1  or  admin  or  cookie_val"
          value="${escHtml(S.crafterValue)}">
      </div>
      <div class="crafter-hint">Input the vulnerable value standard payload appends onto</div>
      
      <!-- Encoding Modifiers -->
      <div class="encoding-selector">
        <button class="enc-btn ${S.crafterEncoding === 'raw' ? 'active' : ''}" data-enc="raw">Raw</button>
        <button class="enc-btn ${S.crafterEncoding === 'url' ? 'active' : ''}" data-enc="url">URL Enc</button>
        <button class="enc-btn ${S.crafterEncoding === 'double' ? 'active' : ''}" data-enc="double">Db URL</button>
      </div>

      <div id="crafted-list"></div>
    </div>`;
  container.appendChild(card);

  const input = card.querySelector("#crafter-input");
  const list = card.querySelector("#crafted-list");
  const encButtons = card.querySelectorAll(".enc-btn");

  function encodeString(str) {
    if (S.crafterEncoding === "url") {
      return encodeURIComponent(str);
    }
    if (S.crafterEncoding === "double") {
      return encodeURIComponent(encodeURIComponent(str));
    }
    return str;
  }

  function rebuild() {
    S.crafterValue = input.value;
    list.innerHTML = "";
    if (!S.crafterValue) {
      list.innerHTML =
        '<div class="loading-row">type a value above to see crafted payloads</div>';
      return;
    }

    const payloadLines = S.payloads.filter((l) => !l.startsWith("#") && l.length > 0);
    if (!payloadLines.length) {
      list.innerHTML = '<div class="loading-row">No payloads available to craft</div>';
      return;
    }

    payloadLines.forEach((payload) => {
      const row = document.createElement("div");
      row.className = "crafted-row";

      const encVal = encodeString(S.crafterValue);
      const encPld = encodeString(payload);

      const text = document.createElement("span");
      text.className = "crafted-text";
      text.innerHTML = `<span class="crafted-val">${escHtml(encVal)}</span><span class="crafted-pld">${escHtml(encPld)}</span>`;

      const copy = document.createElement("button");
      copy.className = "copy-pill";
      copy.textContent = "copy";
      const fullPayloadResult = encVal + encPld;

      copy.addEventListener("click", () => {
        navigator.clipboard.writeText(fullPayloadResult).then(() => {
          copy.textContent = "copied!";
          copy.classList.add("copied");
          setTimeout(() => {
            copy.textContent = "copy";
            copy.classList.remove("copied");
          }, 1200);
        });
      });

      row.appendChild(text);
      row.appendChild(copy);
      list.appendChild(row);
    });
  }

  input.addEventListener("input", rebuild);

  encButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      encButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      S.crafterEncoding = btn.getAttribute("data-enc");
      rebuild();
    });
  });

  rebuild();
}

/* ── COMPANION BANNER EXTRACT DRAW ── */
function renderDrawerBannerCard(container) {
  const card = document.createElement("div");
  card.className = "card card-dev";
  card.innerHTML = `
    <div class="card-header">
      <div class="card-title">$ Banner Exfiltration</div>
      <div class="card-meta"><span class="dev-badge">under development</span></div>
    </div>
    <div class="card-body">
      <div class="dev-card">
        <div class="dev-icon">⚙</div>
        <div class="dev-body">
          <h4>Python Script Generator <span class="dev-badge">coming in v2</span></h4>
          <p>Configure script attributes and download a functional Python exploit customized for: <strong>${S.db || "SQLi"}</strong> via <strong>${S.observe || "blind timing"}</strong>.</p>
          <div class="dev-code">python3 extract.py --url target --param header --db ${S.db || "postgresql"} --mode ${S.observe || "time"}</div>
        </div>
      </div>
    </div>`;
  container.appendChild(card);
}

/* ── HTML ESCAPE UTILITY ── */
function escHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ── DRAG TO PAN CANVAS ── */
function initDragPan() {
  const viewport = document.getElementById("mindmap-viewport");
  const canvas = document.getElementById("mindmap-canvas");
  if (!viewport || !canvas) return;

  viewport.addEventListener("mousedown", (e) => {
    // Only drag-pan on left click, and do not trigger if clicking an input, button or node
    if (e.button !== 0) return;
    if (e.target.closest("input, button, .mindmap-node")) return;

    dragState.isDragging = true;
    dragState.hasMoved = false;
    dragState.startX = e.pageX;
    dragState.startY = e.pageY;
    dragState.startPanX = dragState.panX;
    dragState.startPanY = dragState.panY;
    viewport.classList.add("grabbing");
    
    // Disable smooth transition while dragging for instant responsiveness
    canvas.style.transition = "none";
  });

  viewport.addEventListener("mousemove", (e) => {
    if (!dragState.isDragging) return;
    e.preventDefault();
    
    const deltaX = e.pageX - dragState.startX;
    const deltaY = e.pageY - dragState.startY;

    if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
      dragState.hasMoved = true;
    }

    // Accumulate translations and update transform matrix (clamped to prevent losing map)
    dragState.panX = clamp(dragState.startPanX + deltaX, -1200, 600);
    dragState.panY = clamp(dragState.startPanY + deltaY, -1100, 500);

    canvas.style.transform = `translate(${dragState.panX}px, ${dragState.panY}px)`;
  });

  window.addEventListener("mouseup", () => {
    if (dragState.isDragging) {
      dragState.isDragging = false;
      viewport.classList.remove("grabbing");
      
      // Re-enable transition timing for subsequent clicks / autoPan
      canvas.style.transition = "transform 0.4s cubic-bezier(0.25, 0.8, 0.25, 1)";
      
      setTimeout(() => {
        dragState.hasMoved = false;
      }, 50);
    }
  });
}

/* ── INIT EVENT BINDINGS ── */
document.getElementById("btn-reset-all").addEventListener("click", resetAll);
document.getElementById("drawer-close").addEventListener("click", closeDrawer);

document.addEventListener("DOMContentLoaded", () => {
  renderMindmap();
  renderDrawer();
  updateStatusTip();
  initDragPan();
  autoPan();
});

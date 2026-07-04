# sqli://cheatsheet — Product Plan

**Author:** cipherKT  
**Handle:** @r00t3d_kt  
**Repo:** standalone GitHub Pages repo (separate from portfolio)  
**Portfolio:** links to the tool via URL, does not embed it  
**License:** MIT — open knowledge, open source  
**Status:** pre-build, design approved

---

## What this is

An interactive, graphical SQL injection cheatsheet structured as an expandable tree. It is hunt-ready (open it mid-engagement, navigate to your context, grab payloads) and educational (hints for newcomers at each decision point). It lives on GitHub Pages with zero build step — plain HTML + CSS + JS.

---

## Tech stack

- Pure HTML / CSS / JavaScript — no framework, no build step
- GitHub Pages serves `index.html` directly from `main` branch
- `data.js` — all tree structure, node metadata, and payload-file mappings in one config file
- Payloads fetched live at runtime from `raw.githubusercontent.com/coffinxp/loxs/main/payloads/sqli/`
- localStorage for checklist persistence across sessions
- No backend, no auth, no dependencies

---

## Source references

### Payloads
Base payload files from **coffinxp/loxs** (MIT):
```
https://raw.githubusercontent.com/coffinxp/loxs/main/payloads/sqli/generic.txt
https://raw.githubusercontent.com/coffinxp/loxs/main/payloads/sqli/mysql.txt
https://raw.githubusercontent.com/coffinxp/loxs/main/payloads/sqli/oracle.txt
https://raw.githubusercontent.com/coffinxp/loxs/main/payloads/sqli/postgresql.txt
https://raw.githubusercontent.com/coffinxp/loxs/main/payloads/sqli/xor.txt
https://raw.githubusercontent.com/coffinxp/loxs/main/payloads/sqli/mssql/  (folder — enumerate files)
```

### Theory references
PortSwigger Web Security Academy SQLi cheatsheet linked at relevant leaf nodes:
`https://portswigger.net/web-security/sql-injection/cheat-sheet`

---

## Tree structure (context-first)

Navigation flows top-down. User picks their context at each level, expanding only the relevant branch.

```
ROOT: SQL Injection
│
├── Level 1 — Injection Point (where are you injecting?)
│   ├── GET parameter
│   ├── POST body
│   ├── HTTP header  (User-Agent, Referer, X-Forwarded-For, etc.)
│   ├── Cookie
│   └── JSON / XML body
│
└── Level 2 — Observable Behavior (what can you see?) [expands under chosen L1]
    ├── Error visible          → SQL syntax / DB error in response body
    ├── Response differs       → true/false conditions give different page or content-length
    ├── Timing delay           → response time changes with sleep payloads
    └── OOB / nothing          → no visible difference; use DNS or HTTP callback
        │
        └── Level 3 — DB Identification (fingerprint the database)
            ├── MySQL
            ├── MSSQL
            ├── Oracle
            ├── PostgreSQL
            └── Generic / Unknown
                │
                └── Level 4 — LEAF: Payload Panel (see below)
```

**Fingerprint queries shown at Level 3 (how to identify DB):**
- `SELECT @@version` → MySQL / MSSQL
- `SELECT version()` → PostgreSQL  
- `SELECT banner FROM v$version` → Oracle
- Error message patterns per DB shown as hints

---

## Leaf node — Payload Panel

This is the terminal destination. Every path through the tree ends here. The panel has three sections:

### Section A — Payload Checklist

- Payloads fetched live from the relevant coffinxp `.txt` file (based on DB + technique)
- Each payload rendered as a row with:
  - Checkbox (tried / not tried)
  - Payload text in monospace
  - Copy button (copies raw payload to clipboard, flashes "COPIED")
- **Reset button** at the top of the checklist — clears all checkboxes for this node
- **Persistence:** checkbox state saved to localStorage keyed by `node_id` (e.g. `sqli_header_timebased_mysql`)
- State survives page refresh and tab close
- Reset only affects the current node's checklist, not the whole app
- Global reset option in top bar settings (resets all nodes)

### Section B — Payload Crafter

- Single text input: "paste your vulnerable value here"
  - Label: `vulnerable value`
  - Placeholder: `e.g. Mozilla/5.0` or `e.g. 1` depending on injection point context
  - Dead simple — just the raw value the parameter currently holds, nothing else
- As user types, all payloads in the checklist update live to show:
  ```
  [user_value][payload]
  ```
  Example: user types `Mozilla/5.0`, payload `' OR SLEEP(5)-- -` becomes:
  ```
  Mozilla/5.0' OR SLEEP(5)-- -
  ```
- Each crafted payload has its own copy button
- No auto-prefixing of header names, parameter names, or context — just value + payload

### Section C — Banner Extraction

- Present in the tree as a sibling technique node under Level 2 (alongside error-based, boolean, time-based, OOB)
- **Marked visually as "under development"** with a distinct badge
- Planned feature: Python script generator
  - User will enter their target details
  - Tool generates a ready-to-run Python script that performs banner extraction via the confirmed technique
  - Script handles char-by-char blind exfiltration for time-based paths
- For now: shows a placeholder card explaining what's coming

---

## Visual design

### Color language (consistent through the whole tree)
- Error-based path: red (`#ff6b6b`, bg `#1a0a0a`, border `#5a1a1a`)
- Boolean blind path: blue (`#5b9bd5`, bg `#0a1628`, border `#1a3a6e`)
- Time-based path: amber (`#e8a427`, bg `#1a120a`, border `#4a2e0a`)
- OOB path: purple (`#b57bee`, bg `#120a1a`, border `#3a1a5a`)
- Success / active / copied: green (`#00c97a`)
- Under development: muted gray badge, dashed border

### Typography
- `JetBrains Mono` — all payloads, node labels, code, the logo
- `Inter` — hints, descriptions, metadata

### Branding
- Top bar: `sqli://cheatsheet` with green dot
- Version + handle + MIT license in top bar
- PortSwigger refs shown as subtle `↗` links at relevant nodes

### Node states
- Default: collapsed, shows label only
- Expanded: children visible, node border turns green
- Active path: full path from root to current node highlighted
- Under development: dashed border, gray badge

---

## File structure (planned repo layout)

```
sqli-cheatsheet/
├── index.html          — single file, the whole UI
├── data.js             — tree config (nodes, labels, hints, payload file mappings)
├── style.css           — all styles
├── tree.js             — tree expand/collapse logic, localStorage, fetch logic
├── crafter.js          — payload crafter logic (value + payload concatenation)
└── README.md           — credits coffinxp, links PortSwigger, explains the tool
```

---

## Future features (not in v1)

| Feature | Notes |
|---|---|
| Python script generator | Banner extraction via confirmed SQLi technique. Generates runnable `.py` script. Planned for Section C of leaf panel. |
| NoSQL injection | Separate branch or sibling root node. MongoDB, CouchDB patterns. |
| Second-order injection | Advanced branch — injection stored, triggered elsewhere. |
| GraphQL SQLi | Separate injection point type under Level 1. |
| WAF bypass layer | Additional sub-branch under any technique — applies WAF evasion to payloads. `xor.txt` already available from coffinxp. |
| SQLMap command generator | Like the crafter but outputs a ready `sqlmap -u` command. |
| Dark/light toggle | Currently dark-only. Light mode for daytime use. |
| Search | Fuzzy search across all nodes and payloads. |
| Export checklist | Download tried/untried payloads as a `.txt` report. |

---

## Open decisions (resolved)

| Decision | Choice | Reason |
|---|---|---|
| Framework | None — plain HTML/JS | Zero build step, GitHub Pages serves directly, easy to edit mid-hunt |
| Payload storage | Fetched live from raw.githubusercontent.com | Always current with upstream, no hardcoding |
| Checklist persistence | localStorage | No backend needed, survives refresh |
| Tree structure | Context-first (injection point → observable behavior → DB) | Mirrors actual hunt thought process |
| Payload crafter | Dead simple — value in, value+payload out | No auto-prefixing, no complexity |
| Banner extraction | Under development placeholder | Python script generator planned for v2 |
| Hosting | GitHub Pages, standalone repo | Free, fast CI/CD, independent of portfolio |

---

## Credits

- Payloads: [coffinxp/loxs](https://github.com/coffinxp/loxs) — MIT license
- Theory: [PortSwigger Web Security Academy](https://portswigger.net/web-security/sql-injection)
- Built by: cipherKT

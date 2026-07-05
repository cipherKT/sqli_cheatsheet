# sqli://cheatsheet

An interactive, graphical SQL injection cheatsheet structured as an expandable mind map. Hunt-ready for engagements and designed to guide both newcomers and experienced pentesters through the SQLi exploitation process.

**Live demo:** [https://cipherKT.github.io/sqli-cheatsheet](https://cipherKT.github.io/sqli-cheatsheet)

---

## Features

- **Context-first navigation** — choose your injection point, observable behavior, and database type by clicking nodes on the mind map
- **Payload checklist** — load tested payloads per technique/DB with checkboxes persisted in `localStorage`
- **Payload crafter** — paste your vulnerable value and see crafted payloads in real time, with URL/double-URL encoding
- **Fingerprint signatures** — database-specific probe queries with behavioral indicators to identify MySQL, MSSQL, PostgreSQL, Oracle, or Generic
- **WAF bypass & Union tabs** — additional payload sets available on exploitation leaf nodes
- **Zero build step** — pure HTML + CSS + JS, served directly from GitHub Pages

## Usage

1. Open the live page
2. Click an **injection point** node (GET, POST, Header, Cookie, JSON/XML)
3. Run the detection probes from the drawer panel
4. Click the **observation** node that matches the response (error, timing, response change, nothing)
5. Run fingerprint queries to identify the database
6. Click the **database** node to open the exploitation panel with relevant payloads

## Tree structure

```
SQL Injection
├── Injection Point
│   ├── GET parameter
│   ├── POST body
│   ├── HTTP header
│   ├── Cookie
│   └── JSON / XML body
└── Observable Behavior
    ├── Error visible
    ├── Response differs
    ├── Timing delay
    └── OOB / nothing
        └── DB Identification
            ├── MySQL / MariaDB
            ├── MSSQL
            ├── PostgreSQL
            ├── Oracle
            └── Generic / Unknown
```

## Project structure

```
├── index.html       — single-file UI shell
├── data.js           — tree config, node metadata, payload mappings
├── style.css         — cyberpunk-themed styles
├── tree.js           — mind map renderer, drawer logic, localStorage
├── payloads/         — standalone payload .txt files
│   ├── detection.txt
│   ├── fingerprint.txt
│   ├── mysql/
│   ├── mssql/
│   ├── postgresql/
│   ├── oracle/
│   ├── generic/
│   └── waf/
└── README.md
```

## Deployment

This is a static site. To deploy your own copy on GitHub Pages:

```bash
# Create a new repo on GitHub, then:
git remote add origin https://github.com/YOUR_USER/sqli-cheatsheet.git
git push -u origin main
```

In the GitHub repo **Settings → Pages**, set the source to **Deploy from branch `main`** at the root `/` directory. The site will be live at `https://YOUR_USER.github.io/sqli-cheatsheet/`.

> **Note:** The app fetches payload files locally from the repo itself, so ensure all `payloads/` files are pushed.

## Credits

- Payloads curated from [coffinxp/loxs](https://github.com/coffinxp/loxs) (MIT)
- Theory references from [PortSwigger Web Security Academy](https://portswigger.net/web-security/sql-injection)
- Built by [@cipherKT](https://github.com/cipherKT)



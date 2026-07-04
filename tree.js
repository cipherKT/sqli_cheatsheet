/* ============================================================
   sqli://cheatsheet — tree.js
   Phase 1: stub — tree rendering added in Phase 2
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {
  const btnResetAll = document.getElementById("btn-reset-all");
  if (btnResetAll) {
    btnResetAll.addEventListener("click", () => {
      /* Phase 3: will clear all localStorage keys for this tool */
      console.log("[sqli] reset all triggered");
    });
  }
});

/* BiZouk — code pays (ISO 3166-1 alpha-2) -> emoji drapeau */
(function () {
  function drapeau(code) {
    if (!code || code.length !== 2) return "";
    const base = 0x1F1E6;
    const A = "A".charCodeAt(0);
    const c = code.toUpperCase();
    if (c < "AA" || c > "ZZ") return "";
    return String.fromCodePoint(base + (c.charCodeAt(0) - A)) + String.fromCodePoint(base + (c.charCodeAt(1) - A));
  }
  window.BiZoukDrapeau = { drapeau };
})();

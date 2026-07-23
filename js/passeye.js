/* Œil afficher/masquer — s'applique à tous les champs type=password */
(function () {
  const EYE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>';
  const EYE_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9.9 4.2A9.5 9.5 0 0 1 12 4c6.5 0 10 7 10 7a15 15 0 0 1-3 3.7"/><path d="M6.5 6.5A15 15 0 0 0 2 11s3.5 7 10 7a9.5 9.5 0 0 0 4-.9"/><path d="M9.5 9.5a3 3 0 0 0 4 4"/><path d="M3 3l18 18"/></svg>';

  function equiper(input) {
    if (input.dataset.eye) return;
    input.dataset.eye = "1";
    // envelopper l'input
    const wrap = document.createElement("div");
    wrap.className = "pass-wrap";
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);
    // bouton œil
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "pass-eye";
    btn.setAttribute("aria-label", "Afficher le mot de passe");
    btn.innerHTML = EYE;
    wrap.appendChild(btn);
    btn.addEventListener("click", () => {
      const montre = input.type === "text";
      input.type = montre ? "password" : "text";
      btn.innerHTML = montre ? EYE : EYE_OFF;
      btn.setAttribute("aria-label", montre ? "Afficher le mot de passe" : "Masquer le mot de passe");
      input.focus();
    });
  }

  function lancer() {
    document.querySelectorAll('input[type="password"]').forEach(equiper);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", lancer);
  else lancer();
  // Re-scanner si des champs apparaissent plus tard (formulaires dynamiques)
  setTimeout(lancer, 400);
  setTimeout(lancer, 1200);
})();

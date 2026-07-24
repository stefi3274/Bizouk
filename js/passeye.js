/* Œil afficher/masquer le mot de passe — s'applique à tous les champs type=password */
(function () {
  const EYE = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display:block"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>';
  const EYE_OFF = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display:block"><path d="M9.9 4.2A9.5 9.5 0 0 1 12 4c6.5 0 10 7 10 7a15 15 0 0 1-3 3.7"/><path d="M6.5 6.5A15 15 0 0 0 2 11s3.5 7 10 7a9.5 9.5 0 0 0 4-.9"/><path d="M9.5 9.5a3 3 0 0 0 4 4"/><path d="M3 3l18 18"/></svg>';

  const NORMAL = "#a09aae";
  const SURVOL = "#a78bfa";

  function equiper(input) {
    if (input.dataset.eye) return;
    input.dataset.eye = "1";

    const wrap = document.createElement("div");
    wrap.style.position = "relative";
    wrap.style.display = "block";
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);
    input.style.paddingRight = "48px";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.setAttribute("aria-label", "Afficher ou masquer le mot de passe");
    btn.style.position = "absolute";
    btn.style.right = "6px";
    btn.style.top = "50%";
    btn.style.transform = "translateY(-50%)";
    btn.style.background = "none";
    btn.style.border = "0";
    btn.style.cursor = "pointer";
    btn.style.padding = "0";
    btn.style.width = "36px";
    btn.style.height = "36px";
    btn.style.display = "flex";
    btn.style.alignItems = "center";
    btn.style.justifyContent = "center";
    btn.style.borderRadius = "8px";
    btn.style.color = NORMAL;
    btn.style.transition = "color .2s, background .2s";
    btn.innerHTML = EYE;
    wrap.appendChild(btn);

    btn.addEventListener("mouseenter", () => {
      btn.style.color = SURVOL;
      btn.style.background = "rgba(255,255,255,.07)";
    });
    btn.addEventListener("mouseleave", () => {
      btn.style.color = NORMAL;
      btn.style.background = "none";
    });

    btn.addEventListener("click", () => {
      const visible = input.type === "text";
      input.type = visible ? "password" : "text";
      btn.innerHTML = visible ? EYE : EYE_OFF;
      input.focus();
    });
  }

  function lancer() {
    document.querySelectorAll('input[type="password"]').forEach(equiper);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", lancer);
  else lancer();
  setTimeout(lancer, 400);
  setTimeout(lancer, 1200);
})();

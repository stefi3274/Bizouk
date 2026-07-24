/* BiZouk — bouton retour : revient à la page précédente, ou à un repli logique */
(function () {
  /* Page de repli selon l'endroit où on se trouve */
  function repli() {
    const p = location.pathname.split("/").pop() || "index.html";
    const carte = {
      "jeu.html": "parcours.html",
      "bombe.html": "parcours.html",
      "duel.html": "duels.html",
      "duels.html": "index.html",
      "defi.html": "index.html",
      "parcours.html": "index.html",
      "compte.html": "index.html",
      "classement.html": "index.html",
      "contact.html": "index.html",
      "a-propos.html": "index.html",
      "mentions-legales.html": "index.html",
      "connexion.html": "index.html",
      "inscription.html": "index.html",
      "nouveau-mot-de-passe.html": "connexion.html",
      "admin.html": "index.html"
    };
    return carte[p] || "index.html";
  }

  function poser() {
    const nav = document.querySelector("header .nav");
    if (!nav || document.getElementById("btnRetour")) return;

    // Pas de bouton sur l'accueil
    const page = location.pathname.split("/").pop() || "index.html";
    if (page === "index.html" || page === "") return;

    const b = document.createElement("button");
    b.id = "btnRetour";
    b.className = "btn-retour";
    b.type = "button";
    b.setAttribute("aria-label", "Revenir à la page précédente");
    b.title = "Retour";
    b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" '
      + 'stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>';

    b.addEventListener("click", () => {
      // Si on vient d'une page du site, on revient en arrière
      const memeSite = document.referrer && document.referrer.indexOf(location.origin) === 0;
      if (memeSite && history.length > 1) history.back();
      else location.href = repli();
    });

    nav.insertBefore(b, nav.firstChild);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", poser);
  else poser();
})();

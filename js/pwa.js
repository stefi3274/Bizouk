/* BiZouk — enregistrement du Service Worker (rend le site installable) */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

/* Bouton "Installer BiZouk" sur l'accueil, avec la flèche qui rebondit */
let bizoukPromptDiffere = null;

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  bizoukPromptDiffere = e;
  const b = document.getElementById("btnInstall");
  if (b) b.style.display = "inline-flex";
});

window.addEventListener("appinstalled", () => {
  bizoukPromptDiffere = null;
  const b = document.getElementById("btnInstall");
  if (b) b.style.display = "none";
});

document.addEventListener("DOMContentLoaded", () => {
  const b = document.getElementById("btnInstall");
  if (!b) return;

  // Déjà installée (ouverte en mode application) : rien à proposer
  if (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) return;

  b.addEventListener("click", async () => {
    if (!bizoukPromptDiffere) return;
    bizoukPromptDiffere.prompt();
    await bizoukPromptDiffere.userChoice;
    bizoukPromptDiffere = null;
    b.style.display = "none";
  });

  // iOS Safari ne propose pas beforeinstallprompt : on affiche une astuce à la place
  const iOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
  const safari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  if (iOS && safari) {
    b.style.display = "inline-flex";
    const txt = b.querySelector(".install-txt");
    if (txt) txt.textContent = "Ajoute-moi à l'écran d'accueil";
    b.onclick = () => alert("Appuie sur le bouton Partager de Safari, puis « Sur l'écran d'accueil ».");
  }
});

/* Mode application : quand BiZouk tourne installée (standalone), le footer complet
   (À propos, Contact, Mentions légales...) laisse place à un simple bouton "Infos". */
function initModeApp() {
  const enApp = (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches)
    || window.navigator.standalone === true;
  if (!enApp) return;

  document.documentElement.classList.add("mode-app");

  const footer = document.querySelector("footer");
  if (!footer) return; // rien à consolider sur cette page (jeu, admin, connexion...)
  footer.style.display = "none";

  const bouton = document.createElement("button");
  bouton.className = "info-app-btn";
  bouton.type = "button";
  bouton.setAttribute("aria-label", "Informations");
  bouton.textContent = "ⓘ Infos";
  document.body.appendChild(bouton);

  const fenetre = document.createElement("div");
  fenetre.className = "info-app-fenetre";
  fenetre.innerHTML =
    '<div class="info-app-carte">'
    + '<button type="button" class="info-app-fermer" aria-label="Fermer">✕</button>'
    + '<h3>BiZouk</h3>'
    + '<a href="a-propos.html">À propos</a>'
    + '<a href="contact.html">Contact</a>'
    + '<a href="mentions-legales.html">Mentions légales</a>'
    + '<a href="mailto:Bizouk7@gmail.com">Bizouk7@gmail.com</a>'
    + '<p class="info-app-signature">Conçu par <a href="https://stefi-services.vercel.app/" target="_blank" rel="noopener">SteFi Services</a></p>'
    + '</div>';
  document.body.appendChild(fenetre);

  bouton.onclick = () => fenetre.classList.add("on");
  fenetre.addEventListener("click", (e) => { if (e.target === fenetre) fenetre.classList.remove("on"); });
  const fermer = fenetre.querySelector(".info-app-fermer");
  if (fermer) fermer.onclick = () => fenetre.classList.remove("on");
}

document.addEventListener("DOMContentLoaded", initModeApp);

/* Rappel de série : si activé et que la série est en danger aujourd'hui,
   une notification locale s'affiche à l'ouverture du site (une fois par jour). */
async function verifierRappelSerie() {
  try {
    if (localStorage.getItem("bizouk_rappels") !== "1") return;
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const auj = new Date().toISOString().slice(0, 10);
    if (localStorage.getItem("bizouk_rappel_fait") === auj) return;
    if (!window.Progression) return;

    await window.Progression.init();
    const P = window.Progression;
    const serie = P.serie ? P.serie() : 0;
    if (serie <= 0) return;
    if (P.aJoueAujourdhui && P.aJoueAujourdhui()) return;
    if (!(P.serieEnDanger && P.serieEnDanger())) return;

    localStorage.setItem("bizouk_rappel_fait", auj);
    const corps = "Ta série de " + serie + " jours est en danger ! Joue une grille avant minuit.";
    if (navigator.serviceWorker && navigator.serviceWorker.ready) {
      const reg = await navigator.serviceWorker.ready;
      reg.showNotification("BiZouk 🔥", { body: corps, icon: "icons/icon-192.png" });
    } else {
      new Notification("BiZouk 🔥", { body: corps, icon: "icons/icon-192.png" });
    }
  } catch (e) { /* silencieux */ }
}
document.addEventListener("DOMContentLoaded", verifierRappelSerie);

/* Mode contraste élevé / daltonien — disponible partout, mémorisé sur l'appareil */
(function () {
  const CLE = "bizouk_contraste";
  function appliquer(actif) { document.documentElement.classList.toggle("mode-contraste", actif); }
  appliquer(localStorage.getItem(CLE) === "1");

  document.addEventListener("DOMContentLoaded", () => {
    const b = document.createElement("button");
    b.className = "contraste-btn";
    b.type = "button";
    b.setAttribute("aria-label", "Contraste élevé / daltonien");
    b.title = "Contraste élevé / daltonien";
    b.textContent = "◐";
    document.body.appendChild(b);
    b.classList.toggle("actif", localStorage.getItem(CLE) === "1");

    b.onclick = () => {
      const nouveau = localStorage.getItem(CLE) !== "1";
      localStorage.setItem(CLE, nouveau ? "1" : "0");
      appliquer(nouveau);
      b.classList.toggle("actif", nouveau);
    };
  });
})();

/* Mode clair pour la grille (façon papier), uniquement sur les pages de jeu.
   N'affecte que l'apparence de la grille — le reste du site reste identique. */
(function () {
  const CLE = "bizouk_grille_claire";
  function appliquer(actif) { document.documentElement.classList.toggle("grille-claire", actif); }

  document.addEventListener("DOMContentLoaded", () => {
    if (!document.querySelector(".grille-box")) return; // seulement sur une page de jeu
    appliquer(localStorage.getItem(CLE) === "1");

    const b = document.createElement("button");
    b.className = "clair-btn";
    b.type = "button";
    b.setAttribute("aria-label", "Grille claire façon papier");
    b.title = "Grille claire façon papier";
    b.textContent = "☀️";
    document.body.appendChild(b);
    b.classList.toggle("actif", localStorage.getItem(CLE) === "1");

    b.onclick = () => {
      const nouveau = localStorage.getItem(CLE) !== "1";
      localStorage.setItem(CLE, nouveau ? "1" : "0");
      appliquer(nouveau);
      b.classList.toggle("actif", nouveau);
    };
  });
})();

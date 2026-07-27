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

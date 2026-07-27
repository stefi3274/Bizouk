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

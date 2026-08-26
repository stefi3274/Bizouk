/* BiZouk — duel Bombe : l'adversaire joue la même grille, le même mot cible */
(function () {
  const $ = id => document.getElementById(id);
  async function db() { return window.DB || (window.attendreDB ? await window.attendreDB(8000) : null); }
  const esc = s => (s || "").replace(/[&<>"']/g, c => (
    { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
  const fmt = s => Math.floor(s/60) + ":" + String(Math.max(0,s)%60).padStart(2,"0");

  const DUREE = 60;
  const code = new URLSearchParams(location.search).get("code");
  let duel = null, monId = null, monNom = "", jeu = null, reste = DUREE, minuteur = null, termine = false;

  async function init() {
    if (!code) { erreur("Duel introuvable"); return; }
    const base = await db();
    if (!base) { erreur("Connexion impossible"); return; }
    const { data: sess } = await base.auth.getSession();
    if (sess.session) {
      monId = sess.session.user.id;
      monNom = (sess.session.user.user_metadata && sess.session.user.user_metadata.nom) || "";
      const nav = $("navAuth");
      if (nav) { nav.textContent = "Mon compte"; nav.href = "compte.html"; }
    }

    duel = await window.BiZoukDuelBombe.lire(code);
    if (!duel) { erreur("Ce duel n'existe pas ou plus."); return; }

    $("defiTitre").textContent = esc(duel.lanceur_nom) + " te défie !";
    $("defiSous").textContent = duel.chapitre_nom ? "Sur « " + duel.chapitre_nom + " »" : "";

    if (duel.statut === "termine") { afficherResultat(); return; }
    if (monNom) $("duelNom").value = monNom;

    $("btnRelever").onclick = () => {
      const nom = ($("duelNom").value || "").trim();
      if (nom.length < 2) { alert("Indique ton nom pour relever le défi."); return; }
      monNom = nom;
      $("ecranDefi").style.display = "none";
      rebours(() => lancer());
    };
  }

  function erreur(msg) {
    $("defiTitre").textContent = "Duel Bombe";
    $("defiSous").textContent = "";
    document.querySelector("#ecranDefi .form-carte").innerHTML =
      '<p style="color:var(--texte-doux)">' + esc(msg) + '</p>'
      + '<a href="duels.html" class="btn btn-v btn-sm" style="margin-top:14px">Retour aux duels</a>';
  }

  function rebours(surFin) {
    const zone = $("rebours"), nb = $("reboursNb"), txt = $("reboursTxt");
    zone.classList.add("on");
    let n = 3;
    nb.textContent = n;
    const t = setInterval(() => {
      n--;
      if (n > 0) { nb.textContent = n; }
      else if (n === 0) { nb.textContent = "GO"; txt.textContent = "Désamorce-le !"; }
      else { clearInterval(t); zone.classList.remove("on"); surFin(); }
    }, 700);
  }

  function lancer() {
    $("ecranJeu").style.display = "block";

    jeu = window.BiZouk.creerJeu({
      conteneur: $("grille"),
      listeMots: $("motsListe"),
      surTrouve: () => {},
      surVictoire: () => neutralisee()
    });

    const puzzle = jeu.charger(duel.mots, 9, null, 10);
    jeu.definirCibles([duel.cible]);
    $("motsListe").innerHTML = '<span class="mot">' + duel.cible + '</span>';

    reste = DUREE; termine = false;
    $("chrono").textContent = fmt(reste);
    minuteur = setInterval(() => {
      if (termine) return;
      reste--;
      $("chrono").textContent = fmt(Math.max(0, reste));
      $("chrono").classList.toggle("danger", reste <= 20);
      if (reste <= 0) { clearInterval(minuteur); explosion(); }
    }, 1000);
  }

  async function neutralisee() {
    if (termine) return;
    termine = true;
    clearInterval(minuteur);
    const t = DUREE - Math.max(0, reste);
    if (window.BiZoukSon) window.BiZoukSon.jouer("victoire");

    duel = await window.BiZoukDuelBombe.repondre(code, { userId: monId, joueur: monNom, temps: t, reussi: true });
    afficherResultat();
  }

  async function explosion() {
    if (termine) return;
    termine = true;
    duel = await window.BiZoukDuelBombe.repondre(code, { userId: monId, joueur: monNom, temps: null, reussi: false });
    afficherResultat();
  }

  function afficherResultat() {
    $("ecranDefi").style.display = "none";
    $("ecranJeu").style.display = "none";

    const moiGagnant = estGagnant(duel.joueur_reussi, duel.joueur_temps, duel.lanceur_reussi, duel.lanceur_temps);
    const luiGagnant = estGagnant(duel.lanceur_reussi, duel.lanceur_temps, duel.joueur_reussi, duel.joueur_temps);

    $("resEmoji").textContent = moiGagnant ? "🏆" : (luiGagnant ? "💥" : "🤝");
    $("resTitre").textContent = moiGagnant ? "Tu gagnes ce duel !" : (luiGagnant ? "Défaite cette fois" : "Égalité");

    const ligne = (nom, reussi, temps, gagnant) =>
      '<div class="res-ligne ' + (gagnant ? 'gagnant' : 'perdant') + '">'
      + '<span class="res-info"><span class="res-nom">' + esc(nom) + '</span></span>'
      + '<span class="res-temps">' + (reussi ? fmt(temps) : "💥 raté") + '</span>'
      + '<span class="res-medaille">' + (gagnant ? '🏆' : '') + '</span></div>';

    $("resContenu").innerHTML =
      ligne(duel.joueur_nom + " (toi)", duel.joueur_reussi, duel.joueur_temps, moiGagnant)
      + ligne(duel.lanceur_nom, duel.lanceur_reussi, duel.lanceur_temps, luiGagnant);

    if (window.BiZoukConfetti && moiGagnant) window.BiZoukConfetti.lancer(1600, 0.9);
    if (window.BiZoukAnalytics) window.BiZoukAnalytics.evenement("partie_terminee", { mode: "duel_bombe" });
    $("resultat").classList.add("on");
  }

  function estGagnant(monReussi, monTemps, sonReussi, sonTemps) {
    if (monReussi && !sonReussi) return true;
    if (!monReussi && sonReussi) return false;
    if (!monReussi && !sonReussi) return false; // égalité (les deux ratés)
    return monTemps < sonTemps;
  }

  init();
})();

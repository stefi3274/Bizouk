/* BiZouk — duel Mode Classique : l'ami reçoit les mêmes mots, révèle le même style de message mystère */
(function () {
  const $ = id => document.getElementById(id);
  async function db() { return window.DB || (window.attendreDB ? await window.attendreDB(8000) : null); }
  const esc = s => (s || "").replace(/[&<>"']/g, c => (
    { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
  const fmt = s => Math.floor(s/60) + ":" + String(Math.max(0,s)%60).padStart(2,"0");

  const code = new URLSearchParams(location.search).get("code");
  let duel = null, monId = null, monNom = "", jeu = null, mysterePlat = null;
  let debut = null, minuteur = null, termine = false;

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

    duel = await window.BiZoukDuelClassique.lire(code);
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
    $("defiTitre").textContent = "Duel Mode classique";
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
      else if (n === 0) { nb.textContent = "GO"; txt.textContent = "Trouve les mots !"; }
      else { clearInterval(t); zone.classList.remove("on"); surFin(); }
    }, 700);
  }

  function lancer() {
    $("ecranJeu").style.display = "block";

    jeu = window.BiZouk.creerJeu({
      conteneur: $("grille"),
      listeMots: $("motsListe"),
      surTrouve: (m, tr, total) => { $("motsProgres").textContent = tr + " / " + total + " mots trouvés"; },
      surVictoire: () => terminer(),
      surMotsTermines: (mystere) => afficherBanniere(mystere),
      surLettreMystere: (idx) => remplirLettre(idx)
    });

    const puzzle = jeu.charger(duel.mots, 9, null, null, true);
    $("motsProgres").textContent = "0 / " + (puzzle ? puzzle.placements.length : duel.mots.length) + " mots trouvés";

    termine = false;
    debut = Date.now();
    clearInterval(minuteur);
    minuteur = setInterval(() => {
      if (termine) return;
      $("chrono").textContent = fmt(Math.floor((Date.now() - debut) / 1000));
    }, 1000);
  }

  function afficherBanniere(mystere) {
    mysterePlat = [];
    mystere.mots.forEach((mot, mi) => {
      mot.split("").forEach((l, li) => {
        mysterePlat.push({ lettre: l, revele: false, finMot: li === mot.length - 1 && mi < mystere.mots.length - 1 });
      });
    });
    $("mystereBanniere").style.display = "block";
    redessiner();
  }

  function remplirLettre(idx) {
    if (!mysterePlat || !mysterePlat[idx]) return;
    mysterePlat[idx].revele = true;
    redessiner();
  }

  function redessiner() {
    if (!mysterePlat) return;
    $("mystereTexte").textContent = mysterePlat.map(l =>
      (l.revele ? l.lettre : "_") + (l.finMot ? "  " : " ")
    ).join("");
  }

  async function terminer() {
    if (termine) return;
    termine = true;
    clearInterval(minuteur);
    const t = Math.floor((Date.now() - debut) / 1000);
    if (window.BiZoukSon) window.BiZoukSon.jouer("victoire");

    duel = await window.BiZoukDuelClassique.repondre(code, { userId: monId, joueur: monNom, temps: t });
    afficherResultat();
  }

  function afficherResultat() {
    $("ecranDefi").style.display = "none";
    $("ecranJeu").style.display = "none";

    const aDeuxTemps = duel.joueur_temps != null && duel.lanceur_temps != null;
    const moiGagnant = aDeuxTemps && duel.joueur_temps < duel.lanceur_temps;
    const luiGagnant = aDeuxTemps && duel.lanceur_temps < duel.joueur_temps;

    $("resEmoji").textContent = moiGagnant ? "🏆" : (luiGagnant ? "💪" : "🤝");
    $("resTitre").textContent = moiGagnant ? "Tu gagnes ce duel !" : (luiGagnant ? "Défaite cette fois" : "Résultat");

    const ligne = (nom, temps, gagnant) =>
      '<div class="res-ligne ' + (gagnant ? 'gagnant' : 'perdant') + '">'
      + '<span class="res-info"><span class="res-nom">' + esc(nom) + '</span></span>'
      + '<span class="res-temps">' + (temps != null ? fmt(temps) : "—") + '</span>'
      + '<span class="res-medaille">' + (gagnant ? '🏆' : '') + '</span></div>';

    $("resContenu").innerHTML =
      ligne((duel.joueur_nom || monNom) + " (toi)", duel.joueur_temps, moiGagnant)
      + ligne(duel.lanceur_nom, duel.lanceur_temps, luiGagnant);

    if (window.BiZoukConfetti && moiGagnant) window.BiZoukConfetti.lancer(1600, 0.9);
    if (window.BiZoukAnalytics) window.BiZoukAnalytics.evenement("partie_terminee", { mode: "duel_classique" });
    $("resultat").classList.add("on");
  }

  init();
})();

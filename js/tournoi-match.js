/* BiZouk — match éliminatoire de championnat (même grille, meilleur temps) */
(function () {
  const $ = id => document.getElementById(id);
  async function db() { return window.DB || (window.attendreDB ? await window.attendreDB(8000) : null); }
  const esc = s => (s || "").replace(/[&<>"']/g, c => (
    { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
  const fmt = s => Math.floor(s/60) + ":" + String(Math.max(0,s)%60).padStart(2,"0");

  const matchId = new URLSearchParams(location.search).get("match");
  let match = null, monId = null, monCote = null; // "joueur1" | "joueur2"
  let debut = null, minuteur = null, fini = false, totalMots = 0;

  async function init() {
    if (!matchId) { erreur("Match introuvable"); return; }
    const base = await db();
    const { data: sess } = await base.auth.getSession();
    if (!sess.session) { location.href = "connexion.html?retour=" + encodeURIComponent(location.href); return; }
    monId = sess.session.user.id;
    const nav = $("navAuth");
    if (nav) { nav.textContent = "Mon compte"; nav.href = "compte.html"; }

    const { data: m } = await base.from("tournoi_matchs").select("*").eq("id", matchId).single();
    if (!m) { erreur("Match introuvable"); return; }
    match = m;

    if (m.joueur1_id === monId) monCote = "joueur1";
    else if (m.joueur2_id === monId) monCote = "joueur2";
    else { erreur("Tu ne fais pas partie de ce match."); return; }

    $("matchTitre").textContent = esc(m.joueur1_nom) + " vs " + esc(m.joueur2_nom || "adversaire");
    $("matchSous").textContent = "Ronde : " + m.ronde;

    if (m.statut === "termine") { afficherResultat(); return; }

    const monTemps = monCote === "joueur1" ? m.temps1_sec : m.temps2_sec;
    if (monTemps != null) {
      $("matchZone").innerHTML = '<div class="form-carte"><p style="color:var(--vert);font-weight:600">Tu as déjà joué.</p>'
        + '<p style="font-family:var(--serif);font-size:1.4rem;margin:8px 0">' + fmt(monTemps) + '</p>'
        + '<p style="color:var(--texte-doux);font-size:.88rem">En attente que ton adversaire joue son match.</p></div>';
      return;
    }

    $("matchZone").innerHTML = '<div class="form-carte">'
      + '<p style="color:var(--texte-doux);margin-bottom:16px">Une seule tentative compte. Prêt ?</p>'
      + '<button class="btn btn-v" id="btnDemarrer" style="width:100%">Démarrer le chrono et jouer</button></div>';
    $("btnDemarrer").onclick = () => lancer(m.mots);
  }

  function erreur(msg) {
    $("matchTitre").textContent = "Match";
    $("matchZone").innerHTML = '<div class="cls-vide"><h3>' + esc(msg) + '</h3>'
      + '<a href="championnats.html" class="btn btn-v btn-sm" style="margin-top:16px">Retour aux championnats</a></div>';
  }

  function lancer(mots) {
    $("ecranInfo").style.display = "none";
    $("ecranJeu").style.display = "block";

    const jeu = window.BiZouk.creerJeu({
      conteneur: $("grille"),
      listeMots: $("motsListe"),
      surTrouve: (m, tr, total) => { majStats(tr, total); },
      surVictoire: () => terminer()
    });

    const pz = jeu.charger(mots, 11, null, 12);
    totalMots = pz ? pz.placements.length : mots.length;
    majStats(0, totalMots);

    debut = Date.now(); fini = false;
    minuteur = setInterval(() => {
      if (fini) return;
      $("chrono").textContent = fmt(Math.floor((Date.now() - debut) / 1000));
    }, 1000);
  }

  function majStats(tr, total) {
    $("statTrouves").textContent = tr;
    $("statRestants").textContent = total - tr;
  }

  async function terminer() {
    if (fini) return;
    fini = true;
    clearInterval(minuteur);
    const t = Math.floor((Date.now() - debut) / 1000);

    const base = await db();
    const champTemps = monCote === "joueur1" ? "temps1_sec" : "temps2_sec";
    await base.from("tournoi_matchs").update({ [champTemps]: t }).eq("id", matchId);

    // Relire le match : si l'adversaire a déjà joué, on détermine le vainqueur
    const { data: frais } = await base.from("tournoi_matchs").select("*").eq("id", matchId).single();
    match = frais;

    if (match.temps1_sec != null && match.temps2_sec != null && match.statut !== "termine") {
      const gagnantId = match.temps1_sec <= match.temps2_sec ? match.joueur1_id : match.joueur2_id;
      await base.from("tournoi_matchs").update({ gagnant_id: gagnantId, statut: "termine" }).eq("id", matchId);
      const { data: relu } = await base.from("tournoi_matchs").select("*").eq("id", matchId).single();
      match = relu;
    }

    if (window.BiZoukAnalytics) window.BiZoukAnalytics.evenement("partie_terminee", { mode: "tournoi_match" });

    $("ecranJeu").style.display = "none";
    if (match.statut === "termine") { afficherResultat(); return; }

    $("resEmoji").textContent = "⏱️";
    $("resTitre").textContent = "Temps enregistré";
    $("resContenu").innerHTML = '<p style="font-family:var(--serif);font-size:1.6rem;color:var(--blanc);margin-bottom:10px">' + fmt(t) + '</p>'
      + '<p style="color:var(--texte-doux)">En attente que ton adversaire joue son match. Reviens plus tard voir le résultat.</p>';
    if (window.BiZoukSon) window.BiZoukSon.jouer("victoire");
    $("resultat").classList.add("on");
  }

  function afficherResultat() {
    $("ecranInfo").style.display = "none";
    $("ecranJeu").style.display = "none";
    const jeGagne = match.gagnant_id === monId;
    $("resEmoji").textContent = jeGagne ? "🏆" : "💪";
    $("resTitre").innerHTML = jeGagne
      ? 'Tu <b style="color:var(--vert)">remportes</b> ce match !'
      : 'Défaite cette fois';

    $("resContenu").innerHTML =
      [{nom: match.joueur1_nom, temps: match.temps1_sec, id: match.joueur1_id},
       {nom: match.joueur2_nom, temps: match.temps2_sec, id: match.joueur2_id}]
      .filter(j => j.nom)
      .sort((a,b) => (a.id === match.gagnant_id ? -1 : 1))
      .map(j => '<div class="res-ligne ' + (j.id === match.gagnant_id ? 'gagnant' : 'perdant') + '">'
        + '<span class="res-info"><span class="res-nom">' + esc(j.nom) + (j.id === monId ? ' (toi)' : '') + '</span></span>'
        + '<span class="res-temps">' + (j.temps != null ? fmt(j.temps) : '—') + '</span>'
        + '<span class="res-medaille">' + (j.id === match.gagnant_id ? '🏆' : '') + '</span></div>').join("");

    if (window.BiZoukConfetti && jeGagne) window.BiZoukConfetti.lancer(1300, 0.5);
    $("resultat").classList.add("on");
  }

  init();
})();

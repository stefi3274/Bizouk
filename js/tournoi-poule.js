/* BiZouk — phase de poule d'un championnat (grille commune, chrono, temps enregistré une fois) */
(function () {
  const $ = id => document.getElementById(id);
  async function db() { return window.DB || (window.attendreDB ? await window.attendreDB(8000) : null); }
  const fmt = s => Math.floor(s/60) + ":" + String(Math.max(0,s)%60).padStart(2,"0");

  const tournoiId = new URLSearchParams(location.search).get("tournoi");

  let jeu = null, debut = null, minuteur = null, fini = false;
  let tournoi = null, monId = null;

  async function init() {
    if (!tournoiId) { $("jeuTitre").textContent = "Championnat introuvable"; return; }
    const base = await db();
    if (!base) { $("jeuTitre").textContent = "Connexion impossible"; return; }

    const { data: sess } = await base.auth.getSession();
    if (!sess.session) { location.href = "connexion.html?retour=" + encodeURIComponent(location.href); return; }
    monId = sess.session.user.id;

    const { data: t } = await base.from("tournois").select("*").eq("id", tournoiId).single();
    if (!t) { $("jeuTitre").textContent = "Championnat introuvable"; return; }
    tournoi = t;
    $("jeuTitre").textContent = t.nom;

    const { data: inscription } = await base.from("tournoi_joueurs")
      .select("*").eq("tournoi_id", tournoiId).eq("user_id", monId).maybeSingle();
    if (!inscription) {
      $("ecranPrevenance").innerHTML = '<p style="color:var(--texte-doux)">Tu n\'es pas inscrit à ce championnat.</p>'
        + '<a class="btn btn-v" href="championnats.html">Retour</a>';
      return;
    }
    if (inscription.temps_poule_sec != null) {
      $("ecranPrevenance").innerHTML = '<p style="color:var(--vert);font-weight:600">Tu as déjà joué ta grille de poule.</p>'
        + '<p style="color:var(--texte-doux);font-size:1.3rem;font-family:var(--serif);margin:10px 0">' + fmt(inscription.temps_poule_sec) + '</p>'
        + '<a class="btn btn-v" href="championnats.html">Retour aux championnats</a>';
      return;
    }

    $("btnDemarrer").onclick = () => lancer(t.mots_poule);
  }

  function lancer(mots) {
    $("ecranPrevenance").style.display = "none";
    $("zoneJeu").style.display = "";
    $("statChrono").parentElement.style.display = "flex";

    jeu = window.BiZouk.creerJeu({
      conteneur: $("grille"),
      listeMots: $("motsListe"),
      surTrouve: (m, tr, total) => { majStats(tr, total); },
      surVictoire: () => terminer()
    });

    const pz = jeu.charger(mots, 11, null, 12);
    majStats(0, pz ? pz.placements.length : mots.length);

    afficherApercu(pz ? pz.placements.map(p => p.mot) : mots);
  }

  function afficherApercu(mots) {
    const tries = mots.slice().sort((a, b) => a.localeCompare(b, "fr"));
    $("apercuSous").textContent = tries.length + " mot" + (tries.length > 1 ? "s" : "") + " à repérer dans la grille";
    $("apercuListe").innerHTML = tries.map(m => '<span class="mot">' + m + '</span>').join("");
    $("apercuMots").classList.add("on");

    $("btnCommencer").onclick = () => {
      $("apercuMots").classList.remove("on");
      demarrerChrono();
    };
  }

  function demarrerChrono() {
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

    $("vicTemps").textContent = fmt(t);
    $("victoire").classList.add("on");
    if (window.BiZoukSon) window.BiZoukSon.jouer("victoire");
    if (window.BiZoukConfetti) window.BiZoukConfetti.lancer(1300, 0.5);
    if (window.BiZoukAnalytics) window.BiZoukAnalytics.evenement("partie_terminee", { mode: "tournoi_poule", tournoi: tournoiId });

    if (window.BiZoukPartage) {
      const zone = document.createElement("div");
      zone.style.marginTop = "12px";
      zone.innerHTML = '<button type="button" class="btn btn-g btn-sm" id="btnPartagerPoule">Partager</button>';
      $("vicSous").insertAdjacentElement("afterend", zone);
      document.getElementById("btnPartagerPoule").onclick = () => window.BiZoukPartage.partagerNiveau({
        chapitre: tournoi.nom, niveau: "Poule", temps: fmt(t), mots: 15
      });
    }

    const base = await db();
    await base.from("tournoi_joueurs").update({ temps_poule_sec: t }).eq("tournoi_id", tournoiId).eq("user_id", monId);
  }

  init();
})();

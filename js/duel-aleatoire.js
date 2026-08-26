/* BiZouk — duel aléatoire : matche avec un adversaire en attente, ou joue et attend à ton tour */
(function () {
  const $ = id => document.getElementById(id);
  async function db() { return window.DB || (window.attendreDB ? await window.attendreDB(8000) : null); }
  const esc = s => (s || "").replace(/[&<>"']/g, c => (
    { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
  const fmt = s => Math.floor(s/60) + ":" + String(Math.max(0,s)%60).padStart(2,"0");

  let monId = null, monNom = "";
  let debut = null, minuteur = null, fini = false, mesMots = null, monChapitre = null;
  let sondage = null;

  async function moi() {
    const base = await db();
    if (!base) return;
    const { data } = await base.auth.getSession();
    if (data.session) {
      monId = data.session.user.id;
      monNom = (data.session.user.user_metadata && data.session.user.user_metadata.nom) || "";
      const nav = $("navAuth");
      if (nav) { nav.textContent = "Mon compte"; nav.href = "compte.html"; }
    }
  }

  function melanger(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
    return a;
  }

  async function init() {
    await moi();
    $("btnChercher").onclick = () => chercherAdversaire();
  }

  async function chercherAdversaire() {
    if (!monId) { location.href = "connexion.html?retour=duel-aleatoire.html"; return; }
    $("btnChercher").disabled = true; $("btnChercher").textContent = "Recherche…";

    const base = await db();
    const ent = await window.entrepriseId();

    // Quelqu'un attend déjà ?
    const { data: attente } = await base.from("duel_file_attente")
      .select("*").eq("entreprise_id", ent).eq("statut", "attente").neq("user_id", monId)
      .order("created_at", { ascending: true }).limit(1).maybeSingle();

    if (attente) {
      const { error } = await base.from("duel_file_attente").update({ statut: "matche" }).eq("id", attente.id).eq("statut", "attente");
      if (!error) { location.href = "duel.html?code=" + attente.duel_code; return; }
    }

    // Personne : je joue une grille aléatoire, puis je me mets en attente
    await jouerEtAttendre(ent);
  }

  async function jouerEtAttendre(ent) {
    const base = await db();
    const { data: chaps } = await base.from("chapitres").select("id, theme_id, nom, mots")
      .eq("entreprise_id", ent).eq("publie", true);
    const valides = (chaps || []).filter(c => Array.isArray(c.mots) && c.mots.length >= 10);
    if (!valides.length) { alert("Aucune grille disponible pour l'instant."); $("btnChercher").disabled = false; $("btnChercher").textContent = "Chercher un adversaire"; return; }

    monChapitre = valides[Math.floor(Math.random() * valides.length)];
    const niveau = 1 + Math.floor(Math.random() * 5);
    const MOTS_NIV = { 1:6, 2:7, 3:8, 4:9, 5:10 };
    mesMots = melanger(monChapitre.mots).slice(0, MOTS_NIV[niveau] || 8);

    $("ecranIntro").style.display = "none";
    $("ecranJeu").style.display = "block";
    $("jeuTitre").textContent = monChapitre.nom;
    $("jeuMeta").textContent = "Duel aléatoire · Niveau " + niveau;

    const jeu = window.BiZouk.creerJeu({
      conteneur: $("grille"),
      listeMots: $("motsListe"),
      surTrouve: (m, tr, total) => { $("statTrouves").textContent = tr; $("statRestants").textContent = total - tr; },
      surVictoire: () => finDePartie()
    });

    const pz = jeu.charger(mesMots, 8, null, 12);
    mesMots = pz ? pz.placements.map(p => p.mot) : mesMots;
    $("statRestants").textContent = mesMots.length;

    debut = Date.now(); fini = false;
    minuteur = setInterval(() => { if (!fini) $("chrono").textContent = fmt(Math.floor((Date.now()-debut)/1000)); }, 1000);
  }

  async function finDePartie() {
    if (fini) return;
    fini = true;
    clearInterval(minuteur);
    const t = Math.floor((Date.now() - debut) / 1000);
    $("ecranJeu").style.display = "none";

    const duel = await window.BiZoukDuel.creer({
      chapitreId: monChapitre.id, chapitreNom: monChapitre.nom,
      niveau: null, mots: mesMots, joueur: monNom || "Un joueur", temps: t
    });
    if (!duel) { alert("Erreur de création du duel."); return; }

    const base = await db();
    const ent = await window.entrepriseId();
    await base.from("duel_file_attente").insert({
      entreprise_id: ent, duel_code: duel.code, user_id: monId, joueur: monNom || "Un joueur", statut: "attente"
    });

    if (window.BiZoukAnalytics) window.BiZoukAnalytics.evenement("partie_terminee", { mode: "duel_aleatoire" });

    $("ecranAttente").style.display = "block";
    $("attenteTexte").textContent = "Ton temps (" + fmt(t) + ") est enregistré. Dès qu'un autre joueur cherche un duel aléatoire, vous serez mis en relation.";

    sondage = setInterval(async () => {
      const { data: ligne } = await base.from("duel_file_attente")
        .select("statut").eq("duel_code", duel.code).eq("user_id", monId).maybeSingle();
      if (ligne && ligne.statut === "matche") {
        clearInterval(sondage);
        afficherResultatFinal(duel.code);
      }
    }, 5000);
  }

  async function afficherResultatFinal(code) {
    const base = await db();
    const { data: duel } = await base.from("duels").select("*").eq("code", code).maybeSingle();
    if (!duel || duel.statut !== "termine") { setTimeout(() => afficherResultatFinal(code), 4000); return; }

    $("ecranAttente").style.display = "none";
    if (window.BiZoukDuelRecompense) window.BiZoukDuelRecompense.verifierEtCrediter(duel, monId);
    const jeGagne = duel.lanceur_temps < duel.adversaire_temps;
    $("resEmoji").textContent = jeGagne ? "🏆" : "💪";
    $("resTitre").textContent = jeGagne ? "Tu as gagné ce duel !" : "Cette fois, ton adversaire gagne";
    $("resContenu").innerHTML =
      '<div class="res-ligne ' + (jeGagne?'gagnant':'perdant') + '"><span class="res-info"><span class="res-nom">'
      + esc(duel.lanceur_nom) + ' (toi)</span></span><span class="res-temps">' + fmt(duel.lanceur_temps) + '</span>'
      + '<span class="res-medaille">' + (jeGagne?'🏆':'') + '</span></div>'
      + '<div class="res-ligne ' + (!jeGagne?'gagnant':'perdant') + '"><span class="res-info"><span class="res-nom">'
      + esc(duel.adversaire_nom) + '</span></span><span class="res-temps">' + fmt(duel.adversaire_temps) + '</span>'
      + '<span class="res-medaille">' + (!jeGagne?'🏆':'') + '</span></div>';

    if (window.BiZoukConfetti && jeGagne) window.BiZoukConfetti.lancer(1800, 1);
    $("resultat").classList.add("on");
  }

  init();
})();

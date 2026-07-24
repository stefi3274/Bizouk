/* BiZouk — page Mon compte : profil, trésor, progression, meilleurs temps */
(function () {
  const $ = id => document.getElementById(id);
  async function db() { return window.DB || (window.attendreDB ? await window.attendreDB(8000) : null); }
  const esc = s => (s || "").replace(/[&<>"']/g, c => (
    { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
  const fmt = s => Math.floor(s/60) + ":" + String(Math.max(0,s)%60).padStart(2,"0");

  let user = null, monNom = "";

  async function init() {
    // Message d'attente immédiat pour éviter une page vide
    const attente = document.createElement("p");
    attente.id = "attenteCompte";
    attente.style.cssText = "text-align:center;color:var(--texte-faible);font-style:italic;padding:40px";
    attente.textContent = "Chargement de ton compte…";
    document.querySelector("main.page").appendChild(attente);

    const base = await db();
    attente.remove();

    if (!base) {
      $("nonConnecte").style.display = "block";
      $("nonConnecte").querySelector("h3").textContent = "Connexion impossible";
      $("nonConnecte").querySelector("p").textContent = "Vérifie ta connexion internet, puis recharge la page.";
      return;
    }

    const { data } = await base.auth.getSession();
    if (!data.session) { $("nonConnecte").style.display = "block"; return; }

    user = data.session.user;
    monNom = (user.user_metadata && user.user_metadata.nom)
      ? user.user_metadata.nom : (user.email || "").split("@")[0];

    $("connecte").style.display = "block";
    afficherProfil();
    await chargerProgression();
    await chargerTemps();
    await chargerDuels();
  }

  function afficherProfil() {
    $("profilNom").textContent = monNom;
    $("profilMail").textContent = user.email || "";

    // Avatar : celui choisi à l'inscription, sinon déduit du nom
    if (window.BiZoukAvatar) {
      const enc = user.user_metadata && user.user_metadata.avatar;
      const c = window.BiZoukAvatar.decoder(enc, monNom);
      $("profilAv").innerHTML = window.BiZoukAvatar.avatar(c, 92);
    }

    if (user.created_at) {
      const d = new Date(user.created_at);
      $("profilDepuis").textContent = "Membre depuis le "
        + d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
    }
  }

  function afficherSerie() {
    const P = window.Progression;
    const zone = $("carteSerie");
    if (!zone) return;

    const s = P.serie();
    const rec = P.record();
    const prochain = P.prochainPalier();
    const danger = P.serieEnDanger();

    zone.innerHTML = '<div class="serie-carte">'
      + '<div style="font-size:2.2rem;line-height:1">' + (s >= 7 ? "🔥" : (s > 0 ? "✨" : "💤")) + '</div>'
      + '<div class="sc-nb">' + s + '</div>'
      + '<div class="sc-lab">' + (s > 1 ? "jours de suite" : (s === 1 ? "jour" : "aucune série en cours")) + '</div>'
      + (rec > 0 ? '<div class="sc-record">Ton record : ' + rec + (rec > 1 ? " jours" : " jour") + '</div>' : '')
      + (P.aJoueAujourdhui()
          ? '<div class="sc-prochain" style="color:var(--vert)">✓ Tu as déjà joué aujourd\'hui</div>'
          : '<div class="sc-prochain">Joue une grille aujourd\'hui pour ' + (s > 0 ? "continuer" : "démarrer") + ' ta série</div>')
      + (prochain
          ? '<div class="sc-prochain">Prochain bonus dans <b>' + prochain.reste
            + (prochain.reste > 1 ? " jours" : " jour") + '</b> : <b>+' + prochain.bonus + ' pierres</b></div>'
          : '')
      + (danger
          ? '<div class="serie-danger"><b>Ta série est en danger !</b><br>'
            + 'Tu as manqué hier. Dépense ' + P.prixSauvetage() + ' pierre pour la sauver.'
            + '<br><button class="btn btn-v btn-sm" id="btnSauver" style="margin-top:10px"'
            + (P.peutSauverSerie() ? '' : ' disabled') + '>Sauver ma série</button></div>'
          : '')
      + '</div>';

    const bs = $("btnSauver");
    if (bs) bs.onclick = async () => {
      bs.disabled = true;
      const ok = await P.sauverSerie();
      if (ok) { afficherSerie(); chargerProgression(); }
      else bs.disabled = false;
    };
  }

  async function chargerProgression() {
    await window.Progression.init();
    const P = window.Progression;
    const etat = P.etat();
    afficherSerie();

    // Trésor
    const d = P.detail();
    const noms = { vert: "Découverte", jaune: "Confirmé", rose: "Bombes" };
    $("tresor").innerHTML = ["vert","jaune","rose"].map(c =>
      '<div class="tresor-c">'
      + (window.BiZoukPierre ? window.BiZoukPierre.pierre(c, 40) : "")
      + '<div class="tc-nb" style="color:var(--' + (c === "jaune" ? "or" : c) + ')">' + d[c] + '</div>'
      + '<div class="tc-lab">' + noms[c] + '</div></div>'
    ).join("");
    $("tresorTotal").textContent = P.total();

    // Statistiques
    const niveaux = (etat.niveaux_reussis || []).length;
    const chapitres = (etat.bombes_reussies_ids || []).length;
    $("statNiveaux").textContent = niveaux;
    $("statChapitres").textContent = chapitres;

    // Détail de la progression par chapitre
    const base = await db();
    const ent = await entrepriseId();
    if (!base || !ent) { $("progression").innerHTML = "<p style='color:var(--texte-faible)'>Indisponible.</p>"; return; }

    const [rC, rT] = await Promise.all([
      base.from("chapitres").select("id, theme_id, nom, ordre").eq("entreprise_id", ent).eq("publie", true).order("ordre"),
      base.from("themes").select("id, nom").eq("entreprise_id", ent).eq("publie", true)
    ]);
    const chaps = rC.data || [];
    const themes = {};
    (rT.data || []).forEach(t => themes[t.id] = t.nom);

    if (!chaps.length) {
      $("progression").innerHTML = "<p style='color:var(--texte-faible);font-style:italic'>Aucun chapitre disponible.</p>";
      return;
    }

    const commences = chaps.filter(c =>
      P.reussi(c.id, 15) || P.reussi(c.id, 20) || P.bombeFaite(c.id));

    if (!commences.length) {
      $("progression").innerHTML = '<p style="color:var(--texte-faible);font-style:italic">'
        + 'Tu n\'as pas encore commencé de chapitre. '
        + '<a href="parcours.html" style="color:var(--violet-c)">Voir le parcours →</a></p>';
      return;
    }

    $("progression").innerHTML = commences.map(c => {
      const fini = P.chapitreFini(c.id);
      const etapes = [P.reussi(c.id,15), P.reussi(c.id,20), P.bombeFaite(c.id)].filter(Boolean).length;
      return '<div class="prog-ligne">'
        + '<span class="prog-nom">' + esc(c.nom)
        + '<span style="font-size:.78rem;color:var(--texte-faible);display:block">'
        + esc(themes[c.theme_id] || "") + '</span></span>'
        + '<span class="prog-etat ' + (fini ? 'fait' : 'encours') + '">'
        + (fini ? '✓ terminé' : etapes + '/3') + '</span></div>';
    }).join("");
  }

  async function chargerTemps() {
    const base = await db();
    if (!base || !user) return;
    const { data } = await base.from("parties").select("*")
      .eq("user_id", user.id).order("temps_sec", { ascending: true }).limit(30);

    if (!data || !data.length) {
      $("mesTemps").innerHTML = '<p style="color:var(--texte-faible);font-style:italic">'
        + 'Aucune partie enregistrée pour l\'instant.</p>';
      return;
    }

    // Meilleur temps par chapitre+niveau
    const meilleurs = {};
    data.forEach(p => {
      const cle = (p.chapitre_nom || p.theme_nom || "?") + "|" + p.niveau;
      if (!meilleurs[cle] || p.temps_sec < meilleurs[cle].temps_sec) meilleurs[cle] = p;
    });
    const liste = Object.values(meilleurs).sort((a,b) => a.temps_sec - b.temps_sec).slice(0, 10);

    $("mesTemps").innerHTML = liste.map(p =>
      '<div class="prog-ligne">'
      + '<span class="prog-nom">' + esc(p.chapitre_nom || p.theme_nom || "Grille")
      + '<span style="font-size:.78rem;color:var(--texte-faible);display:block">'
      + (p.niveau === 20 ? "Confirmé" : "Découverte") + ' · ' + p.mots_total + ' mots</span></span>'
      + '<span style="font-family:var(--serif);font-weight:700;color:var(--or);font-size:1.05rem">'
      + fmt(p.temps_sec) + '</span></div>'
    ).join("");
  }

  async function chargerDuels() {
    if (!window.BiZoukDuel) return;
    const duels = await window.BiZoukDuel.mesDuels();
    const gagnes = duels.filter(d => {
      if (d.statut !== "termine") return false;
      const jeSuisLanceur = d.lanceur_id === user.id;
      const monT = jeSuisLanceur ? d.lanceur_temps : d.adversaire_temps;
      const sonT = jeSuisLanceur ? d.adversaire_temps : d.lanceur_temps;
      return monT < sonT;
    }).length;
    $("statDuels").textContent = gagnes;
  }

  // Déconnexion
  $("btnDeconnexion").addEventListener("click", async () => {
    if (!confirm("Te déconnecter ?")) return;
    const base = await db();
    if (base) await base.auth.signOut();
    location.href = "index.html";
  });

  init();
})();

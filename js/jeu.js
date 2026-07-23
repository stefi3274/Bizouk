/* BiZouk — page de jeu */
(function () {
  const $ = id => document.getElementById(id);
  async function db() { return window.DB || (window.attendreDB ? await window.attendreDB(8000) : null); }

  const params = new URLSearchParams(location.search);
  const niveau = parseInt(params.get("niveau"), 10) || 15;
  const themeId = params.get("theme");

  const NIVEAUX = {
    15: { nom: "Découverte", tailleMin: 10, mots: 15 },
    20: { nom: "Confirmé",   tailleMin: 12, mots: 20 },
    25: { nom: "Expert",     tailleMin: 13, mots: 25 }
  };
  const conf = NIVEAUX[niveau] || NIVEAUX[15];

  let jeu = null, debut = null, minuteur = null, themeCourant = null, fini = false;

  function fmt(s) {
    const m = Math.floor(s / 60), r = s % 60;
    return m + ":" + String(r).padStart(2, "0");
  }

  function demarrerChrono() {
    debut = Date.now(); fini = false;
    clearInterval(minuteur);
    minuteur = setInterval(() => {
      if (fini) return;
      const s = Math.floor((Date.now() - debut) / 1000);
      $("chrono").textContent = fmt(s);
    }, 1000);
  }
  function tempsEcoule() { return Math.floor((Date.now() - debut) / 1000); }

  function majStats(tr, total) {
    $("statTrouves").textContent = tr;
    $("statRestants").textContent = total - tr;
  }

  // ---------- Chargement des mots ----------
  async function motsDuTheme() {
    const base = await db();
    if (!base) return null;
    const ent = await entrepriseId();
    if (!ent) return null;

    let req = base.from("themes").select("*").eq("entreprise_id", ent).eq("publie", true);
    if (themeId) req = req.eq("id", themeId);
    const { data, error } = await req;
    if (error || !data || !data.length) return null;

    // Si aucun thème précis demandé, on en prend un au hasard
    const theme = themeId ? data[0] : data[Math.floor(Math.random() * data.length)];
    themeCourant = theme;
    let mots = Array.isArray(theme.mots) ? theme.mots.slice() : [];
    // Mélanger puis prendre le nombre voulu
    for (let i = mots.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [mots[i], mots[j]] = [mots[j], mots[i]];
    }
    return { theme, mots: mots.slice(0, conf.mots) };
  }

  async function lancer() {
    const res = await motsDuTheme();

    if (!res || !res.mots.length) {
      $("jeuTitre").textContent = "Aucun thème disponible";
      $("jeuMeta").textContent = "Les grilles arrivent bientôt.";
      $("grille").innerHTML = '<p style="padding:30px;text-align:center;color:var(--texte-faible);font-style:italic">'
        + 'Aucun thème n\'a encore été publié.<br>Reviens bientôt !</p>';
      $("motsListe").innerHTML = "";
      $("motsProgres").textContent = "—";
      return;
    }

    $("jeuTitre").textContent = res.theme.nom;
    $("jeuMeta").textContent = conf.nom + " · " + res.mots.length + " mots à trouver";

    if (!jeu) {
      jeu = window.BiZouk.creerJeu({
        conteneur: $("grille"),
        listeMots: $("motsListe"),
        surTrouve: (m, tr, total) => majStats(tr, total),
        surVictoire: () => victoire()
      });
    }
    const puzzle = jeu.charger(res.mots, conf.tailleMin);
    if (puzzle) {
      majStats(0, puzzle.placements.length);
      if (puzzle.nonPlaces && puzzle.nonPlaces.length) {
        $("jeuMeta").textContent = conf.nom + " · " + puzzle.placements.length + " mots à trouver";
      }
    }
    demarrerChrono();
  }

  // ---------- Victoire ----------
  async function victoire() {
    fini = true;
    clearInterval(minuteur);
    const t = tempsEcoule();
    $("vicTemps").textContent = fmt(t);
    const et = jeu.etat();
    $("vicSous").textContent = et.total + " mots trouvés · niveau " + conf.nom;

    // Enregistrer si connecté
    const base = await db();
    let connecte = false;
    if (base) {
      const { data } = await base.auth.getSession();
      connecte = !!data.session;
      if (connecte) {
        const u = data.session.user;
        const nom = (u.user_metadata && u.user_metadata.nom) ? u.user_metadata.nom : (u.email||"").split("@")[0];
        const ent = await entrepriseId();
        await base.from("parties").insert({
          entreprise_id: ent, user_id: u.id, joueur: nom,
          theme_id: themeCourant ? themeCourant.id : null,
          theme_nom: themeCourant ? themeCourant.nom : null,
          niveau: niveau, temps_sec: t, mots_total: et.total
        });
      }
    }

    $("vicInvite").innerHTML = connecte
      ? 'Ton temps a été enregistré. <b>Va voir le classement !</b><br>'
        + '<a href="classement.html" style="color:var(--violet-c);font-weight:600">Voir le classement →</a>'
      : 'Tu joues sans compte : ce temps ne sera pas enregistré.<br><br>'
        + '<b>Avec un compte</b>, tes performances comptent pour le classement et les concours.<br>'
        + '<a href="inscription.html" style="color:var(--violet-c);font-weight:600">Créer un compte →</a>';

    $("victoire").classList.add("on");
  }

  // ---------- Actions ----------
  $("btnNouvelle").addEventListener("click", () => { $("victoire").classList.remove("on"); lancer(); });
  $("vicRejouer").addEventListener("click", () => { $("victoire").classList.remove("on"); lancer(); });
  $("btnRecommencer").addEventListener("click", () => {
    if (jeu) { jeu.recommencer(); const e = jeu.etat(); if (e) majStats(0, e.total); demarrerChrono(); }
  });
  $("btnImprimer").addEventListener("click", () => window.print());
  $("victoire").addEventListener("click", e => { if (e.target === $("victoire")) $("victoire").classList.remove("on"); });

  // Lien de connexion adapté
  (async () => {
    const base = await db();
    if (!base) return;
    const { data } = await base.auth.getSession();
    if (data.session) {
      const nav = $("navAuth");
      if (nav) { nav.textContent = "Mon compte"; nav.href = "compte.html"; }
    }
  })();

  lancer();
})();

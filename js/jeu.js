/* BiZouk — page de jeu */
(function () {
  const $ = id => document.getElementById(id);
  async function db() { return window.DB || (window.attendreDB ? await window.attendreDB(8000) : null); }

  const params = new URLSearchParams(location.search);
  const niveau = parseInt(params.get("niveau"), 10) || 15;
  const chapitreId = params.get("chapitre");   // null = jeu libre
  const themeId = params.get("theme");

  const NIVEAUX = {
    15: { nom: "Découverte", tailleMin: 10, mots: 15 },
    20: { nom: "Confirmé",   tailleMin: 12, mots: 20 }
  };
  const conf = NIVEAUX[niveau] || NIVEAUX[15];

  let jeu = null, debut = null, minuteur = null, themeCourant = null, chapitreCourant = null, fini = false;

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
  function melanger(liste) {
    const a = liste.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  async function motsDuTheme() {
    const base = await db();
    if (!base) return null;
    const ent = await entrepriseId();
    if (!ent) return null;

    // Mode parcours : les mots viennent d'un chapitre précis
    if (chapitreId) {
      const { data: chap } = await base.from("chapitres").select("*").eq("id", chapitreId).maybeSingle();
      if (!chap) return null;
      const { data: th } = await base.from("themes").select("nom").eq("id", chap.theme_id).maybeSingle();
      chapitreCourant = chap;
      themeCourant = { id: chap.theme_id, nom: (th && th.nom) || "" };
      const mots = melanger(Array.isArray(chap.mots) ? chap.mots : []);
      return { theme: themeCourant, chapitre: chap, mots: mots.slice(0, conf.mots) };
    }

    // Mode libre : on pioche dans un thème (via ses chapitres)
    let reqC = base.from("chapitres").select("*").eq("entreprise_id", ent).eq("publie", true);
    if (themeId) reqC = reqC.eq("theme_id", themeId);
    const { data: chaps } = await reqC;
    if (!chaps || !chaps.length) return null;
    const chap = chaps[Math.floor(Math.random() * chaps.length)];
    const { data: th } = await base.from("themes").select("nom").eq("id", chap.theme_id).maybeSingle();
    chapitreCourant = chap;
    themeCourant = { id: chap.theme_id, nom: (th && th.nom) || "" };
    const mots = melanger(Array.isArray(chap.mots) ? chap.mots : []);
    return { theme: themeCourant, chapitre: chap, mots: mots.slice(0, conf.mots) };
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

    $("jeuTitre").textContent = res.chapitre ? res.chapitre.nom : res.theme.nom;
    $("jeuMeta").textContent = (res.theme.nom ? res.theme.nom + " · " : "")
      + conf.nom + " · " + res.mots.length + " mots à trouver";

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

    // Attribuer les pierres BiZouk si c'est un niveau du parcours
    let gain = null;
    if (chapitreId && window.Progression) {
      await window.Progression.init();
      gain = await window.Progression.gagnerNiveau(chapitreId, niveau);
    }

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
          niveau: niveau, temps_sec: t, mots_total: et.total,
          chapitre_id: chapitreCourant ? chapitreCourant.id : null,
          chapitre_nom: chapitreCourant ? chapitreCourant.nom : null
        });
      }
    }

    let bloc = "";
    if (gain && gain.nouveau) {
      const cl = { vert:"var(--vert)", jaune:"var(--or)", rose:"var(--rose)" }[gain.couleur] || "var(--violet-c)";
      const svg = window.BiZoukPierre ? window.BiZoukPierre.pierre(gain.couleur, 42) : "";
      bloc = '<div class="gain-bizouk"><span class="pierre-gain">' + svg + '</span>'
        + '<span class="gb-nb" style="color:' + cl + '">+' + gain.gain + '</span>'
        + '<span class="gb-txt">pierres BiZouk<br><b style="color:' + cl + '">' + gain.couleur + '</b></span></div>';
    } else if (gain && !gain.nouveau) {
      bloc = '<div class="gain-bizouk"><span class="gb-txt" style="text-align:center">'
        + 'Niveau déjà réussi : pas de nouvelles pierres.</span></div>';
    }

    $("vicInvite").innerHTML = bloc + (connecte
      ? 'Ton temps a été enregistré. <b>Va voir le classement !</b><br>'
        + '<a href="classement.html" style="color:var(--violet-c);font-weight:600">Voir le classement →</a>'
      : 'Tu joues sans compte : ce temps ne compte pas au classement.<br><br>'
        + '<b>Avec un compte</b>, tes pierres et ta progression te suivent partout.<br>'
        + '<a href="inscription.html" style="color:var(--violet-c);font-weight:600">Créer un compte →</a>');

    // Bouton retour au parcours si on y est
    if (chapitreId) {
      const act = document.querySelector(".vic-actions");
      if (act && !document.getElementById("vicParcours")) {
        const a = document.createElement("a");
        a.id = "vicParcours"; a.className = "btn btn-v btn-sm";
        a.href = "parcours.html"; a.textContent = "Retour au parcours";
        act.insertBefore(a, act.firstChild);
      }
    }

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

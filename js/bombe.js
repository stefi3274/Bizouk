/* BiZouk — La Bombe : 10 mots cachés, 1 à trouver, 1 minute */
(function () {
  const $ = id => document.getElementById(id);
  async function db() { return window.DB || (window.attendreDB ? await window.attendreDB(6000) : null); }
  const esc = s => (s || "").replace(/[&<>"']/g, c => (
    { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));

  const DUREE = 60;           // 1 minute
  const NB_MOTS_GRILLE = 10;  // mots cachés (rebrassage des mots du chapitre)
  const NB_CIBLES = 1;        // un seul mot à trouver

  const params = new URLSearchParams(location.search);
  const chapitreId = params.get("chapitre");

  let jeu = null, reste = DUREE, minuteur = null, cibles = [], termine = false;
  let chapitreCourant = null, themeNomCourant = "";

  function fmt(s) { return Math.floor(s/60) + ":" + String(s%60).padStart(2,"0"); }

  function majCompteur() {
    const d = window.Progression.detail();
    ["vert","jaune","rose"].forEach(c => {
      const badge = $("badge" + c.charAt(0).toUpperCase() + c.slice(1));
      const nb = $("bz" + c.charAt(0).toUpperCase() + c.slice(1));
      if (badge && window.BiZoukPierre && !badge.querySelector("svg")) {
        badge.insertAdjacentHTML("afterbegin", window.BiZoukPierre.pierre(c, 17));
      }
      if (nb) nb.textContent = d[c];
    });
  }

  function majCibles() {
    const et = jeu ? jeu.etat() : null;
    $("cibles").innerHTML = cibles.map(m =>
      '<span class="cible" data-mot="' + esc(m) + '">' + esc(m) + '</span>').join("");
  }

  function marquerCible(mot) {
    const el = $("cibles").querySelector('[data-mot="' + mot + '"]');
    if (el) el.classList.add("trouve");
  }

  // ---------- Chrono ----------
  function demarrer() {
    reste = DUREE;
    $("chrono").textContent = fmt(reste);
    clearInterval(minuteur);
    minuteur = setInterval(() => {
      if (termine) return;
      reste--;
      $("chrono").textContent = fmt(Math.max(0, reste));
      $("chrono").classList.toggle("danger", reste <= 20);
      if (reste <= 0) { clearInterval(minuteur); explosion(); }
    }, 1000);
  }

  /* Le mot à trouver devient plus long à mesure que le joueur progresse.
     0-5 niveaux réussis : mot court · 6-15 : moyen · 16+ : le plus long. */
  function choisirCible(places) {
    if (!places.length) return null;
    const tries = places.slice().sort((a, b) => a.length - b.length);
    const n = tries.length;

    let reussis = 0;
    if (window.Progression && window.Progression.totalNiveauxReussis) {
      reussis = window.Progression.totalNiveauxReussis();
    }

    let vivier;
    if (reussis <= 5)        vivier = tries.slice(0, Math.max(1, Math.ceil(n * 0.4)));       // les plus courts
    else if (reussis <= 15)  vivier = tries.slice(Math.floor(n * 0.3), Math.ceil(n * 0.8));  // les moyens
    else                     vivier = tries.slice(Math.max(0, n - Math.ceil(n * 0.4)));      // les plus longs

    if (!vivier.length) vivier = tries;
    return vivier[Math.floor(Math.random() * vivier.length)];
  }

  function paliersDifficulte() {
    let r = 0;
    if (window.Progression && window.Progression.totalNiveauxReussis) {
      r = window.Progression.totalNiveauxReussis();
    }
    if (r <= 5) return "Échauffement";
    if (r <= 15) return "Ça se corse";
    return "Niveau expert";
  }

  // ---------- Chargement ----------
  async function mots() {
    const base = await db();
    if (!base) return null;
    const ent = await entrepriseId();
    if (!ent) return null;

    let chap = null;
    if (chapitreId) {
      const { data } = await base.from("chapitres").select("*").eq("id", chapitreId).maybeSingle();
      chap = data;
    } else {
      const { data } = await base.from("chapitres").select("*")
        .eq("entreprise_id", ent).eq("publie", true);
      if (data && data.length) chap = data[Math.floor(Math.random() * data.length)];
    }
    if (!chap) return null;

    const { data: th } = await base.from("themes").select("nom").eq("id", chap.theme_id).maybeSingle();
    // Rebrassage : on mélange tous les mots du chapitre et on en prend 10
    let liste = Array.isArray(chap.mots) ? chap.mots.slice() : [];
    for (let i = liste.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [liste[i], liste[j]] = [liste[j], liste[i]];
    }
    return { chapitre: chap, themeNom: (th && th.nom) || "", mots: liste.slice(0, NB_MOTS_GRILLE) };
  }

  async function lancer() {
    await window.Progression.init();
    majCompteur();

    // Déjà bloqué par une explosion précédente ?
    if (window.Progression.bloque()) { afficherBlocage(); return; }

    const res = await mots();
    if (!res || res.mots.length < 5) {
      $("bombeSous").textContent = "Aucun thème disponible pour l'instant.";
      $("grille").innerHTML = '<p style="padding:30px;text-align:center;color:var(--texte-faible);font-style:italic">'
        + 'Reviens quand des thèmes auront été publiés.</p>';
      return;
    }

    if (!jeu) {
      jeu = window.BiZouk.creerJeu({
        conteneur: $("grille"),
        listeMots: $("motsListe"),
        surTrouve: (m) => { marquerCible(m.mot); },
        surVictoire: () => neutralisee()
      });
    }

    // Générer la grille, puis choisir LE mot cible selon la difficulté du joueur
    const puzzle = jeu.charger(res.mots, 9, null, 10);
    const places = puzzle.placements.map(p => p.mot);
    cibles = [choisirCible(places)];
    jeu.definirCibles(cibles);

    chapitreCourant = res.chapitre;
    themeNomCourant = res.themeNom || "";
    $("bombeSous").textContent = res.chapitre.nom + (res.themeNom ? " · " + res.themeNom : "")
      + " · " + paliersDifficulte() + " · 1 mot à trouver";
    majCibles();
    termine = false;
    afficherApercuBombe(cibles[0]);
  }

  function afficherApercuBombe(mot) {
    $("apercuSous").textContent = "Le mot à trouver avant l'explosion :";
    $("apercuListe").innerHTML = '<span class="mot" style="font-size:1.1rem;padding:10px 18px">' + mot + '</span>';
    $("apercuMots").classList.add("on");
    $("btnCommencer").onclick = () => {
      $("apercuMots").classList.remove("on");
      demarrer();
    };
  }

  // ---------- Fin ----------
  async function neutralisee() {
    if (termine) return;
    termine = true;
    clearInterval(minuteur);

    const resteAffiche = fmt(Math.max(0, reste));
    $("bfCarte").className = "bf-carte reussi";
    $("bfEmoji").textContent = "🎉";
    $("bfTitre").innerHTML = "Bombe <b style='color:var(--vert)'>neutralisée</b>";
    $("bfSous").textContent = "Tu assures ! Il te restait " + resteAffiche + ".";
    $("bfContenu").innerHTML = '<p style="font-size:.85rem;color:var(--texte-faible)">Calcul des récompenses…</p>';

    // Le panneau apparaît ici, immédiatement — pas d'attente réseau avant la célébration.
    $("bombeFin").classList.add("on");
    if (window.BiZoukSon) window.BiZoukSon.jouer("victoire");
    if (window.BiZoukConfetti) window.BiZoukConfetti.lancer(1300, 0.45);
    if (window.BiZoukAnalytics) window.BiZoukAnalytics.evenement("partie_terminee", { mode: "bombe" });

    // ---------- À partir d'ici : le travail réseau, en arrière-plan ----------
    const rb = await window.Progression.bombeReussie(chapitreId);
    const serieB = await window.Progression.marquerJour();
    majCompteur();

    const nom = window.Progression.connecte() ? await nomJoueur() : null;
    if (nom) {
      $("bfSous").innerHTML = "Bravo <b>" + esc(nom) + "</b>, tu assures ! Il te restait " + resteAffiche + ".";
    }

    $("bfContenu").innerHTML =
      (rb && rb.gain
        ? '<div class="gain-bizouk" style="flex-direction:column;gap:8px">'
          + '<div style="display:flex;gap:10px;align-items:center;justify-content:center">'
          + ["vert","jaune","rose"].map(c =>
              '<span class="pierre-gain" style="display:inline-flex;align-items:center;gap:3px">'
              + (window.BiZoukPierre ? window.BiZoukPierre.pierre(c, 34) : "")
              + '<b style="font-family:var(--serif);color:var(--' + (c==="jaune"?"or":c) + ')">+2</b></span>').join("")
          + '</div>'
          + '<span class="gb-txt" style="text-align:center">6 pierres gagnées<br>'
          + '<b style="color:var(--violet-c)">chapitre terminé</b></span></div>'
        : '')
      + (serieB && !serieB.deja && serieB.bonus
          ? '<div class="gain-bizouk" style="margin-top:8px">'
            + '<span class="pierre-gain">' + (window.BiZoukPierre ? window.BiZoukPierre.pierre("rose", 36) : "") + '</span>'
            + '<span class="gb-nb" style="color:var(--rose)">+' + serieB.bonus + '</span>'
            + '<span class="gb-txt">bonus série<br><b style="color:var(--rose)">' + serieB.palier + ' jours</b></span></div>'
          : '')
      + '<div class="bf-options" id="bfBoutons">'
      + '<a class="btn btn-v" href="parcours.html" id="btnSuite">Continuer le parcours</a>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:4px">'
      + '<button class="btn btn-g btn-sm" id="btnPartager">Partager</button>'
      + (nom ? '' : '<a class="btn btn-g btn-sm" href="inscription.html">Créer un compte</a>')
      + '</div>'
      + '</div>'
      + '<div class="partage-liens" id="partageLiens"></div>';

    if (serieB && serieB.bonus && window.BiZoukConfetti) window.BiZoukConfetti.lancer();

    // Proposer directement le chapitre suivant s'il existe
    chapitreSuivant().then(suiv => {
      const b = $("btnSuite");
      if (b && suiv) {
        b.href = "jeu.html?chapitre=" + suiv.id + "&niveau=1";
        b.textContent = "Continuer · " + suiv.nom;
      }
    });

    // Bouton de partage
    const bp = $("btnPartager");
    if (bp) bp.onclick = async () => {
      const info = {
        chapitre: chapitreCourant ? chapitreCourant.nom : "",
        theme: themeNomCourant || "",
        pierres: 9,
        joueur: nom || null
      };
      const avant = bp.textContent;
      bp.textContent = "Préparation…"; bp.disabled = true;
      let r = "telecharge";
      try { r = await window.BiZoukPartage.partager(info); } catch (e) { r = "telecharge"; }
      bp.textContent = (r === "telecharge") ? "Image téléchargée" : avant;
      if (r === "telecharge") afficherLiensPartage(info);
      setTimeout(() => { bp.textContent = avant; bp.disabled = false; }, 2200);
    };
  }

  function afficherLiensPartage(info) {
    const zone = $("partageLiens");
    if (!zone || zone.innerHTML) return;
    const l = window.BiZoukPartage.liens(info);
    zone.innerHTML =
      '<p style="font-size:.82rem;color:var(--texte-faible);margin:14px 0 8px;font-style:italic">'
      + 'L\'image a été téléchargée : joins-la à ton message.</p>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center">'
      + '<a class="share-btn share-wa" href="' + l.whatsapp + '" target="_blank" rel="noopener">WhatsApp</a>'
      + '<a class="share-btn share-fb" href="' + l.facebook + '" target="_blank" rel="noopener">Facebook</a>'
      + '<a class="share-btn share-x" href="' + l.x + '" target="_blank" rel="noopener">X</a>'
      + '<a class="share-btn share-tg" href="' + l.telegram + '" target="_blank" rel="noopener">Telegram</a>'
      + '</div>';
  }


  /* Cherche le chapitre suivant dans le même thème */
  async function chapitreSuivant() {
    if (!chapitreCourant) return null;
    const base = await db();
    if (!base) return null;
    const { data } = await base.from("chapitres")
      .select("id, nom, ordre")
      .eq("theme_id", chapitreCourant.theme_id)
      .eq("publie", true)
      .order("ordre");
    if (!data || !data.length) return null;
    const idx = data.findIndex(c => c.id === chapitreCourant.id);
    if (idx < 0 || idx + 1 >= data.length) return null;
    return data[idx + 1];
  }

  async function nomJoueur() {
    const base = await db(); if (!base) return null;
    const { data } = await base.auth.getSession();
    if (!data.session) return null;
    const u = data.session.user;
    return (u.user_metadata && u.user_metadata.nom) ? u.user_metadata.nom : (u.email||"").split("@")[0];
  }

  async function explosion() {
    if (termine) return;
    termine = true;
    clearInterval(minuteur);
    const presque = !!(jeu && jeu.enCours && jeu.enCours());
    await window.Progression.bombeRatee();
    majCompteur();
    afficherBlocage(true, presque);
  }

  function afficherBlocage(vientDExploser, presque) {
    const P = window.Progression;
    $("bfCarte").className = "bf-carte rate";
    $("bfEmoji").textContent = "💥";
    $("bfTitre").innerHTML = vientDExploser ? "La bombe a <b style='color:var(--rouge)'>explosé</b>" : "Bombe explosée";
    $("bfSous").textContent = vientDExploser
      ? (presque
          ? "Si près du but ! Tu étais en plein tracé quand le temps s'est écoulé. Retente, tu vas l'avoir."
          : "Tu n'as pas trouvé le mot à temps.")
      : "Tu dois attendre, ou dépenser des pierres pour continuer.";

    function rendre() {
      const ms = P.resteBlocageMs();
      const s = Math.ceil(ms / 1000);
      const peut = P.peutPayer();
      $("bfContenu").innerHTML =
        (ms > 0 ? '<div class="bf-attente" id="bfAttente">' + fmt(s) + '</div>'
                + '<p style="font-size:.85rem;color:var(--texte-faible);margin-bottom:16px">avant de pouvoir réessayer</p>'
                : '<p style="color:var(--vert);margin-bottom:16px">Tu peux réessayer maintenant !</p>')
        + '<div class="bf-options">'
        + (ms > 0
            ? '<button class="bf-opt" id="optPayer"' + (peut ? '' : ' disabled') + '>'
              + '<b>Dépenser ' + P.prix() + ' pierres BiZouk</b>'
              + '<span>' + (peut ? 'Tu en as ' + P.total() + ' · continue tout de suite'
                                 : 'Il t\'en faut ' + P.prix() + ', tu en as ' + P.total()) + '</span></button>'
            : '<button class="bf-opt" id="optReessayer"><b>Réessayer la bombe</b><span>Le blocage est terminé</span></button>')
        + '<a class="bf-opt" href="parcours.html" style="display:block;text-decoration:none">'
        + '<b>Revenir au parcours</b><span>Tu peux rejouer des niveaux en attendant</span></a>'
        + '</div>';

      const p = $("optPayer");
      if (p) p.onclick = async () => {
        p.disabled = true;
        const ok = await P.payerDeblocage();
        majCompteur();
        if (ok) { $("bombeFin").classList.remove("on"); lancer(); }
        else { p.disabled = false; }
      };
      const r = $("optReessayer");
      if (r) r.onclick = () => { $("bombeFin").classList.remove("on"); lancer(); };
    }

    rendre();
    $("bombeFin").classList.add("on");

    // Compte à rebours du blocage
    const t = setInterval(() => {
      if (!$("bombeFin").classList.contains("on")) { clearInterval(t); return; }
      const ms = P.resteBlocageMs();
      const el = $("bfAttente");
      if (ms <= 0) { clearInterval(t); rendre(); }
      else if (el) el.textContent = fmt(Math.ceil(ms/1000));
    }, 1000);
  }

  lancer();
})();

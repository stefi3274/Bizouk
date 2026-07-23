/* BiZouk — La Bombe : 30 mots cachés, 2 à trouver, 2 minutes */
(function () {
  const $ = id => document.getElementById(id);
  async function db() { return window.DB || (window.attendreDB ? await window.attendreDB(6000) : null); }
  const esc = s => (s || "").replace(/[&<>"']/g, c => (
    { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));

  const DUREE = 120;          // 2 minutes
  const NB_MOTS_GRILLE = 20;  // mots cachés (rebrassage des mots du chapitre)
  const NB_CIBLES = 2;        // mots à trouver

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
    // Rebrassage : on mélange tous les mots du chapitre et on en prend 20
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

    // Générer la grille une seule fois, puis choisir 2 cibles parmi les mots réellement placés
    const puzzle = jeu.charger(res.mots, 15);
    const places = puzzle.placements.map(p => p.mot);
    cibles = [];
    const copie = places.slice();
    for (let i = 0; i < NB_CIBLES && copie.length; i++) {
      const idx = Math.floor(Math.random() * copie.length);
      cibles.push(copie.splice(idx, 1)[0]);
    }
    // Appliquer les cibles sans régénérer la grille
    jeu.definirCibles(cibles);

    chapitreCourant = res.chapitre;
    themeNomCourant = res.themeNom || "";
    $("bombeSous").textContent = res.chapitre.nom + (res.themeNom ? " · " + res.themeNom : "")
      + " · 20 mots cachés, 2 à trouver";
    majCibles();
    termine = false;
    demarrer();
  }

  // ---------- Fin ----------
  async function neutralisee() {
    if (termine) return;
    termine = true;
    clearInterval(minuteur);
    const rb = await window.Progression.bombeReussie(chapitreId);
    majCompteur();

    const et = window.Progression.etat();
    const nom = window.Progression.connecte() ? await nomJoueur() : null;

    $("bfCarte").className = "bf-carte reussi";
    $("bfEmoji").textContent = "🎉";
    $("bfTitre").innerHTML = "Bombe <b style='color:var(--vert)'>neutralisée</b>";
    $("bfSous").innerHTML = nom
      ? "Bravo <b>" + esc(nom) + "</b>, tu assures ! Il te restait " + fmt(Math.max(0,reste)) + "."
      : "Tu assures ! Il te restait " + fmt(Math.max(0,reste)) + ".";
    $("bfContenu").innerHTML =
      (rb && rb.gain ? '<div class="gain-bizouk"><span class="pierre-gain">' + (window.BiZoukPierre ? window.BiZoukPierre.pierre("rose",42) : "") + '</span>'
        + '<span class="gb-nb" style="color:var(--rose)">+' + rb.gain + '</span>'
        + '<span class="gb-txt">pierres BiZouk gagnées<br><b style="color:var(--rose)">chapitre terminé</b></span></div>' : '')
      + '<div class="bf-options">'
      + '<button class="btn btn-v" id="btnPartager">Partager ma victoire</button>'
      + '<a class="btn btn-g" href="parcours.html">Continuer le parcours</a>'
      + (nom ? '' : '<a class="btn btn-g" href="inscription.html">Créer un compte pour garder ta progression</a>')
      + '</div>'
      + '<div class="partage-liens" id="partageLiens"></div>';

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
    $("bombeFin").classList.add("on");
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
    await window.Progression.bombeRatee();
    majCompteur();
    afficherBlocage(true);
  }

  function afficherBlocage(vientDExploser) {
    const P = window.Progression;
    $("bfCarte").className = "bf-carte rate";
    $("bfEmoji").textContent = "💥";
    $("bfTitre").innerHTML = vientDExploser ? "La bombe a <b style='color:var(--rouge)'>explosé</b>" : "Bombe explosée";
    $("bfSous").textContent = vientDExploser
      ? "Tu n'as pas trouvé les 2 mots à temps."
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

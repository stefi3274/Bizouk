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
  let nomCourant = null;

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
        nomCourant = nom;
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

    // Boutons de l'écran de victoire
    const act = document.querySelector(".vic-actions");
    if (act) {
      // Partager ce niveau
      if (!document.getElementById("vicPartager")) {
        const bp = document.createElement("button");
        bp.id = "vicPartager"; bp.className = "btn btn-v btn-sm";
        bp.textContent = "Partager";
        act.insertBefore(bp, act.firstChild);
        bp.onclick = async () => {
          const info = {
            chapitre: chapitreCourant ? chapitreCourant.nom : (themeCourant ? themeCourant.nom : ""),
            theme: themeCourant ? themeCourant.nom : "",
            niveau: conf.nom,
            temps: fmt(t),
            mots: et.total,
            pierres: (gain && gain.gain) ? gain.gain : 0,
            joueur: nomCourant || null
          };
          const avant = bp.textContent;
          bp.textContent = "Préparation…"; bp.disabled = true;
          let r = "telecharge";
          try { r = await window.BiZoukPartage.partagerNiveau(info); } catch (e) { r = "telecharge"; }
          bp.textContent = (r === "telecharge") ? "Image téléchargée" : avant;
          if (r === "telecharge") afficherLiensPartage(info);
          setTimeout(() => { bp.textContent = avant; bp.disabled = false; }, 2200);
        };
      }
      // Défier un ami
      if (!document.getElementById("vicDuel") && chapitreCourant) {
        const bd = document.createElement("button");
        bd.id = "vicDuel"; bd.className = "btn btn-g btn-sm";
        bd.textContent = "Défier un ami";
        act.insertBefore(bd, act.children[1] || null);
        bd.onclick = () => lancerDuel(t, et.total);
      }
      // Retour au parcours
      if (chapitreId && !document.getElementById("vicParcours")) {
        const a = document.createElement("a");
        a.id = "vicParcours"; a.className = "btn btn-g btn-sm";
        a.href = "parcours.html"; a.textContent = "Retour au parcours";
        act.appendChild(a);
      }
    }

    let zoneL = document.getElementById("vicLiens");
    if (!zoneL) {
      zoneL = document.createElement("div");
      zoneL.id = "vicLiens"; zoneL.className = "partage-liens";
      document.querySelector(".vic-carte").appendChild(zoneL);
    }
    $("victoire").classList.add("on");
  }

  function afficherLiensPartage(info) {
    const zone = document.getElementById("vicLiens");
    if (!zone || zone.innerHTML) return;
    const l = window.BiZoukPartage.liensNiveau(info);
    zone.innerHTML =
      '<p style="font-size:.8rem;color:var(--texte-faible);margin:12px 0 8px;font-style:italic">'
      + 'L\'image a été téléchargée : joins-la à ton message.</p>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center">'
      + '<a class="share-btn share-wa" href="' + l.whatsapp + '" target="_blank" rel="noopener">WhatsApp</a>'
      + '<a class="share-btn share-fb" href="' + l.facebook + '" target="_blank" rel="noopener">Facebook</a>'
      + '<a class="share-btn share-x" href="' + l.x + '" target="_blank" rel="noopener">X</a>'
      + '<a class="share-btn share-tg" href="' + l.telegram + '" target="_blank" rel="noopener">Telegram</a>'
      + '</div>';
  }


  // ---------- Lancer un duel ----------
  async function lancerDuel(temps, nbMots) {
    const zone = document.getElementById("vicLiens");
    if (zone) zone.innerHTML = '<p style="color:var(--texte-doux);font-size:.88rem;margin-top:14px">Création du duel…</p>';

    const pz = jeu.puzzle();
    const motsDuel = pz ? pz.placements.map(p => p.mot) : [];

    const duel = await window.BiZoukDuel.creer({
      chapitreId: chapitreCourant ? chapitreCourant.id : null,
      chapitreNom: chapitreCourant ? chapitreCourant.nom : (themeCourant ? themeCourant.nom : "Grille"),
      niveau: niveau,
      mots: motsDuel,
      joueur: nomCourant || "Un joueur",
      temps: temps
    });

    if (!duel) {
      if (zone) zone.innerHTML = '<p style="color:#fca5a5;font-size:.88rem;margin-top:14px">'
        + 'Impossible de créer le duel. Vérifie ta connexion.</p>';
      return;
    }

    const lien = window.BiZoukDuel.lien(duel.code);
    const txt = encodeURIComponent("Je te défie sur BiZouk ! J'ai fait "
      + fmt(temps) + " sur « " + (chapitreCourant ? chapitreCourant.nom : "cette grille") + " ». À toi de jouer : ");
    const u = encodeURIComponent(lien);

    if (zone) zone.innerHTML =
      '<div style="background:var(--gris-3);border-radius:12px;padding:16px;margin-top:16px">'
      + '<div style="font-size:.78rem;color:var(--texte-faible);text-transform:uppercase;letter-spacing:.06em;font-weight:700;margin-bottom:6px">Ton code de duel</div>'
      + '<div style="font-family:var(--serif);font-size:1.9rem;font-weight:700;color:var(--violet-c);letter-spacing:.14em;margin-bottom:12px">'
      + duel.code + '</div>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center">'
      + '<a class="share-btn share-wa" href="https://wa.me/?text=' + txt + '%20' + u + '" target="_blank" rel="noopener">WhatsApp</a>'
      + '<a class="share-btn share-tg" href="https://t.me/share/url?url=' + u + '&text=' + txt + '" target="_blank" rel="noopener">Telegram</a>'
      + '<button class="share-btn" id="copierDuel" style="background:var(--violet)">Copier le lien</button>'
      + '</div>'
      + '<p style="font-size:.8rem;color:var(--texte-faible);margin-top:10px">'
      + 'Ton ami jouera exactement la même grille.</p>'
      + '</div>';

    const cp = document.getElementById("copierDuel");
    if (cp) cp.onclick = async () => {
      try {
        await navigator.clipboard.writeText(lien);
        cp.textContent = "Copié ✓";
        setTimeout(() => { cp.textContent = "Copier le lien"; }, 2000);
      } catch {
        cp.textContent = "Copie impossible";
      }
    };
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

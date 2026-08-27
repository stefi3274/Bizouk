/* BiZouk — page du défi du jour */
(function () {
  const $ = id => document.getElementById(id);
  async function db() { return window.DB || (window.attendreDB ? await window.attendreDB(8000) : null); }
  const esc = s => (s || "").replace(/[&<>"']/g, c => (
    { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
  const fmt = s => Math.floor(s/60) + ":" + String(Math.max(0,s)%60).padStart(2,"0");

  let defi = null, jeu = null, debut = null, minuteur = null, fini = false;
  let totalMots = 0, monId = null;

  function avatarDe(nom, taille) {
    if (!window.BiZoukAvatar) return "";
    const c = window.BiZoukAvatar.configDepuisNom(nom);
    c.initiales = window.BiZoukAvatar.initialesDe(nom);
    return window.BiZoukAvatar.avatar(c, taille || 32);
  }

  function dateLisible(j) {
    const d = new Date(j + "T12:00:00");
    return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  }

  // ---------- Chargement ----------
  async function init() {
    const base = await db();
    if (base) {
      const { data } = await base.auth.getSession();
      if (data.session) {
        monId = data.session.user.id;
        const nav = $("navAuth");
        if (nav) { nav.textContent = "Mon compte"; nav.href = "compte.html"; }
      }
    }

    defi = await window.BiZoukDefi.motsDuJour();
    if (!defi) {
      $("defiTitre").textContent = "Aucun défi disponible";
      $("defiCarte").style.display = "none";
      chargerClassement();
      return;
    }

    $("dcDate").textContent = dateLisible(defi.jour);
    $("dcTheme").textContent = defi.chapitre;
    $("dcMots").textContent = defi.mots.length + " mots à trouver"
      + (defi.theme ? " · " + defi.theme : "");

    // Déjà joué aujourd'hui ?
    const fait = await window.BiZoukDefi.dejaJoue();
    if (fait) {
      $("defiCarte").style.display = "none";
      $("dejaJoue").style.display = "block";
      $("djTemps").textContent = fmt(fait.temps_sec);
      const place = await window.BiZoukDefi.maPlace();
      $("djPlace").textContent = place
        ? place.place + "e sur " + place.total + " joueurs"
        : (fait.local ? "Résultat non classé (sans compte)" : "");
    } else {
      $("defiCarte").style.display = "block";
    }

    chargerClassement();
  }

  // ---------- Classement du jour ----------
  async function chargerClassement() {
    const zone = $("clsJour");
    const liste = await window.BiZoukDefi.classement();

    if (!liste.length) {
      zone.innerHTML = '<div class="cj-vide">Personne n\'a encore relevé le défi.<br>Sois le premier !</div>';
      return;
    }

    const MEDAILLES = ["🥇","🥈","🥉"];
    zone.innerHTML = liste.slice(0, 20).map((r, i) =>
      '<div class="cj-ligne' + (i < 3 ? ' podium' : '') + (r.user_id === monId ? ' moi' : '') + '">'
      + '<span class="cj-place">' + (i < 3 ? MEDAILLES[i] : (i+1)) + '</span>'
      + '<span class="cj-av">' + avatarDe(r.joueur, 32) + '</span>'
      + '<span class="cj-nom">' + esc(r.joueur) + (r.user_id === monId ? ' <span style="color:var(--vert);font-size:.8rem">(toi)</span>' : '') + '</span>'
      + '<span class="cj-temps">' + fmt(r.temps_sec) + '</span>'
      + '</div>'
    ).join("");
  }

  // ---------- Compte à rebours ----------
  function rebours(surFin) {
    const zone = $("rebours"), nb = $("reboursNb"), txt = $("reboursTxt");
    zone.classList.add("on");
    const etapes = ["3","2","1","GO !"];
    const textes = ["Prépare-toi…","Concentre-toi…","C'est parti dans…","Trouve les mots !"];
    let i = 0;
    function suivant() {
      if (i >= etapes.length) { zone.classList.remove("on"); surFin(); return; }
      nb.textContent = etapes[i];
      txt.textContent = textes[i];
      nb.style.animation = "none"; void nb.offsetWidth;
      nb.style.animation = "reboursPop .9s ease-out";
      if (etapes[i] === "GO !") nb.style.color = "var(--vert)";
      i++;
      setTimeout(suivant, 900);
    }
    suivant();
  }

  // ---------- Jouer ----------
  $("btnJouer").addEventListener("click", () => {
    $("ecranAccueil").style.display = "none";
    $("ecranJeu").style.display = "block";
    construireGrille();
  });

  function construireGrille() {
    $("jeuTitre").textContent = defi.chapitre;
    $("jeuMeta").textContent = "Défi du " + dateLisible(defi.jour);

    jeu = window.BiZouk.creerJeu({
      conteneur: $("grille"),
      listeMots: $("motsListe"),
      surTrouve: (m, tr, total) => {
        $("statTrouves").textContent = tr;
        $("statRestants").textContent = total - tr;
      },
      surVictoire: () => terminer()
    });

    const pz = jeu.charger(defi.mots, 10, null, 11);
    totalMots = pz ? pz.placements.length : defi.mots.length;
    $("statRestants").textContent = totalMots;

    afficherApercu(pz ? pz.placements.map(p => p.mot) : defi.mots);
  }

  function afficherApercu(mots) {
    const tries = mots.slice().sort((a, b) => a.localeCompare(b, "fr"));
    $("apercuSous").textContent = tries.length + " mot" + (tries.length > 1 ? "s" : "") + " à repérer dans la grille";
    $("apercuListe").innerHTML = tries.map(m => '<span class="mot">' + m + '</span>').join("");
    $("apercuMots").classList.add("on");

    $("btnCommencer").onclick = () => {
      $("apercuMots").classList.remove("on");
      rebours(() => lancer());
    };
  }

  function lancer() {
    debut = Date.now(); fini = false;
    clearInterval(minuteur);
    minuteur = setInterval(() => {
      if (fini) return;
      $("chrono").textContent = fmt(Math.floor((Date.now() - debut)/1000));
    }, 500);
  }

  // ---------- Fin ----------
  async function terminer() {
    if (fini) return;
    fini = true;
    clearInterval(minuteur);
    const t = Math.floor((Date.now() - debut)/1000);

    $("resTemps").textContent = fmt(t);
    $("resSous").textContent = totalMots + " mots trouvés";
    $("resInvite").innerHTML = '<p style="font-size:.85rem;color:var(--texte-faible)">Calcul du classement…</p>';

    let enr = null, place = null; // remplis plus bas, capturés par les boutons ci-dessous

    // Partage
    const bp = $("btnPartagerDefi");
    if (bp) bp.onclick = async () => {
      const info = {
        chapitre: "Défi du jour · " + defi.chapitre,
        theme: defi.theme, niveau: "Défi", temps: fmt(t),
        mots: totalMots, pierres: 0,
        joueur: place && place.resultat ? place.resultat.joueur : null
      };
      const avant = bp.textContent;
      bp.textContent = "Préparation…"; bp.disabled = true;
      let r = "telecharge";
      try { r = await window.BiZoukPartage.partagerNiveau(info); } catch (e) { r = "telecharge"; }
      bp.textContent = (r === "telecharge") ? "Téléchargé" : avant;
      if (r === "telecharge") {
        const l = window.BiZoukPartage.liensNiveau(info);
        const zl = $("resLiens");
        if (zl && !zl.innerHTML) {
          zl.innerHTML = '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:10px">'
            + '<a class="share-btn share-wa" href="' + l.whatsapp + '" target="_blank" rel="noopener">WhatsApp</a>'
            + '<a class="share-btn share-tg" href="' + l.telegram + '" target="_blank" rel="noopener">Telegram</a>'
            + '</div>';
        }
      }
      setTimeout(() => { bp.textContent = avant; bp.disabled = false; }, 2200);
    };

    // Défier un ami sur ce même défi du jour
    const bd = $("btnDefierDefi");
    if (bd) bd.onclick = () => lancerDuelDefi(t, enr && enr.joueur);

    // Le résultat apparaît ici, immédiatement — digne d'une victoire, sans latence.
    $("resultat").classList.add("on");
    if (window.BiZoukSon) window.BiZoukSon.jouer("victoire");
    if (window.BiZoukConfetti) window.BiZoukConfetti.lancer(1300, 0.45);
    if (window.BiZoukAnalytics) window.BiZoukAnalytics.evenement("partie_terminee", { mode: "defi" });

    // ---------- À partir d'ici : le travail réseau, en arrière-plan ----------
    enr = await window.BiZoukDefi.enregistrer(t, totalMots, 0);

    let serieD = null;
    if (window.Progression) {
      await window.Progression.init();
      serieD = await window.Progression.marquerJour();
    }

    place = await window.BiZoukDefi.maPlace();
    let blocSerie = "";
    if (serieD && !serieD.deja && serieD.bonus) {
      blocSerie = '<div class="gain-bizouk" style="margin-bottom:8px">'
        + '<span class="pierre-gain">' + (window.BiZoukPierre ? window.BiZoukPierre.pierre("vert", 36) : "") + '</span>'
        + '<span class="gb-nb" style="color:var(--vert)">+' + serieD.bonus + '</span>'
        + '<span class="gb-txt">bonus série<br><b style="color:var(--vert)">' + serieD.palier + ' jours</b></span></div>';
      if (window.BiZoukConfetti) window.BiZoukConfetti.lancer();
    }
    $("resInvite").innerHTML = blocSerie + (place
      ? 'Tu es <b style="color:var(--violet-c)">' + place.place + 'e</b> sur '
        + place.total + ' joueur' + (place.total > 1 ? 's' : '') + ' aujourd\'hui.'
      : 'Tu joues sans compte : ton temps n\'apparaît pas au classement.<br>'
        + '<a href="inscription.html" style="color:var(--violet-c);font-weight:600">Créer un compte →</a>');

    // Grand moment (palier de série) : les liens de partage apparaissent tout
    // de suite, sans avoir à cliquer "Partager" d'abord.
    if (serieD && !serieD.deja && serieD.bonus) {
      const infoSerie = {
        chapitre: "Défi du jour · " + defi.chapitre, theme: defi.theme, niveau: "Défi",
        temps: fmt(t), mots: totalMots, pierres: serieD.bonus,
        joueur: place && place.resultat ? place.resultat.joueur : null
      };
      const l = window.BiZoukPartage.liensNiveau(infoSerie);
      const zl = $("resLiens");
      if (zl && !zl.innerHTML) {
        zl.innerHTML = '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:10px">'
          + '<a class="share-btn share-wa" href="' + l.whatsapp + '" target="_blank" rel="noopener">WhatsApp</a>'
          + '<a class="share-btn share-tg" href="' + l.telegram + '" target="_blank" rel="noopener">Telegram</a>'
          + '</div>';
      }
    }
  }

  async function lancerDuelDefi(temps, nomJoueur) {
    const zone = $("defiLiens");
    if (zone) zone.innerHTML = '<p style="color:var(--texte-doux);font-size:.88rem;margin-top:14px">Création du duel…</p>';

    const duel = await window.BiZoukDuel.creer({
      chapitreId: defi.chapitreId || null,
      chapitreNom: "Défi du jour · " + defi.chapitre,
      niveau: 5,
      mots: defi.mots,
      joueur: nomJoueur || "Un joueur",
      temps: temps
    });

    if (!duel) {
      if (zone) zone.innerHTML = '<p style="color:#fca5a5;font-size:.88rem;margin-top:14px">'
        + 'Impossible de créer le duel. Vérifie ta connexion.</p>';
      return;
    }

    const lien = window.BiZoukDuel.lien(duel.code);
    const txt = encodeURIComponent("Je te défie sur le défi du jour BiZouk ! J'ai fait "
      + fmt(temps) + " sur « " + defi.chapitre + " ». À toi de jouer : ");
    const u = encodeURIComponent(lien);

    if (zone) zone.innerHTML =
      '<div style="background:var(--gris-3);border-radius:12px;padding:16px;margin-top:16px">'
      + '<div style="font-size:.78rem;color:var(--texte-faible);text-transform:uppercase;letter-spacing:.06em;font-weight:700;margin-bottom:6px">Ton code de duel</div>'
      + '<div style="font-family:var(--serif);font-size:1.9rem;font-weight:700;color:var(--violet-c);letter-spacing:.14em;margin-bottom:12px">'
      + duel.code + '</div>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center">'
      + '<a class="share-btn share-wa" href="https://wa.me/?text=' + txt + '%20' + u + '" target="_blank" rel="noopener">WhatsApp</a>'
      + '<a class="share-btn share-tg" href="https://t.me/share/url?url=' + u + '&text=' + txt + '" target="_blank" rel="noopener">Telegram</a>'
      + '<button class="share-btn" id="copierDuelDefi" style="background:var(--violet)">Copier le lien</button>'
      + '</div>'
      + '<p style="font-size:.8rem;color:var(--texte-faible);margin-top:10px">'
      + 'Ton ami jouera exactement la même grille.</p>'
      + '</div>';

    const cp = $("copierDuelDefi");
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

  init();
})();

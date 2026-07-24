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
    rebours(() => lancer());
  });

  function lancer() {
    $("ecranJeu").style.display = "block";
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

    const pz = jeu.charger(defi.mots, 12);
    totalMots = pz ? pz.placements.length : defi.mots.length;
    $("statRestants").textContent = totalMots;

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

    await window.BiZoukDefi.enregistrer(t, totalMots, 0);

    // La série compte aussi
    if (window.Progression) {
      await window.Progression.init();
      await window.Progression.marquerJour();
    }

    $("resTemps").textContent = fmt(t);
    $("resSous").textContent = totalMots + " mots trouvés";

    const place = await window.BiZoukDefi.maPlace();
    $("resInvite").innerHTML = place
      ? 'Tu es <b style="color:var(--violet-c)">' + place.place + 'e</b> sur '
        + place.total + ' joueur' + (place.total > 1 ? 's' : '') + ' aujourd\'hui.'
      : 'Tu joues sans compte : ton temps n\'apparaît pas au classement.<br>'
        + '<a href="inscription.html" style="color:var(--violet-c);font-weight:600">Créer un compte →</a>';

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

    $("resultat").classList.add("on");
  }

  init();
})();

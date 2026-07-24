/* BiZouk — page duel : arène, course en direct contre le temps de l'adversaire */
(function () {
  const $ = id => document.getElementById(id);
  async function db() { return window.DB || (window.attendreDB ? await window.attendreDB(8000) : null); }
  const esc = s => (s || "").replace(/[&<>"']/g, c => (
    { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
  const fmt = s => Math.floor(s/60) + ":" + String(Math.max(0,s)%60).padStart(2,"0");
  const initiale = n => (n || "?").trim().charAt(0).toUpperCase();

  const code = (new URLSearchParams(location.search).get("code") || "").toUpperCase().trim();
  const TAILLES = { 15: 10, 20: 12 };

  let duel = null, jeu = null, debut = null, minuteur = null, fini = false;
  let monNom = "", totalMots = 0, trouves = 0;

  function poserAvatar(el, nom, taille) {
    if (!el) return;
    if (window.BiZoukAvatar) {
      const c = window.BiZoukAvatar.configDepuisNom(nom);
      c.initiales = window.BiZoukAvatar.initialesDe(nom);
      el.innerHTML = window.BiZoukAvatar.avatar(c, taille || 64);
      el.style.background = "none";
      el.style.border = "0";
    } else {
      el.textContent = initiale(nom);
    }
  }

  // ---------- Chargement ----------
  async function charger() {
    if (!code) { erreur("Aucun code de duel", "Le lien semble incomplet."); return; }

    duel = await window.BiZoukDuel.lire(code);
    if (!duel) { erreur("Duel introuvable", "Ce code ne correspond à aucun défi."); return; }
    if (duel.statut === "termine") { afficherDejaJoue(); return; }

    $("duelSous").textContent = "Bats son temps pour remporter le duel.";
    $("nomLui").textContent = duel.lanceur_nom;
    poserAvatar($("avLui"), duel.lanceur_nom, 68);
    $("tempsLui").textContent = fmt(duel.lanceur_temps);
    $("infoGrille").textContent = duel.chapitre_nom || "Grille";
    $("infoNiveau").textContent = (duel.niveau === 20 ? "Confirmé" : "Découverte") + " · 15 mots";
    $("infoTemps").textContent = fmt(duel.lanceur_temps);
    $("duelCarte").style.display = "block";

    const base = await db();
    if (base) {
      const { data } = await base.auth.getSession();
      if (data.session) {
        const u = data.session.user;
        const nom = (u.user_metadata && u.user_metadata.nom) ? u.user_metadata.nom : (u.email||"").split("@")[0];
        $("duelNom").value = nom;
        $("nomMoi").textContent = nom;
        poserAvatar($("avMoi"), nom, 68);
        const nav = $("navAuth");
        if (nav) { nav.textContent = "Mon compte"; nav.href = "compte.html"; }
      }
    }

    $("duelNom").addEventListener("input", () => {
      const v = $("duelNom").value.trim();
      $("nomMoi").textContent = v || "Toi";
      poserAvatar($("avMoi"), v || "Toi", 68);
    });
  }

  function erreur(titre, texte) {
    $("duelTitre").textContent = "Duel";
    $("duelSous").textContent = "";
    $("errTitre").textContent = titre;
    $("errTexte").textContent = texte;
    $("duelErreur").style.display = "block";
  }

  function afficherDejaJoue() {
    $("duelTitre").textContent = "Duel terminé";
    $("duelSous").textContent = "Ce défi a déjà été relevé.";
    const gagneLanceur = duel.lanceur_temps < duel.adversaire_temps;
    $("errTitre").textContent = "Résultat";
    $("errTexte").innerHTML = arene(
      { nom: duel.lanceur_nom, temps: duel.lanceur_temps, moi: false },
      { nom: duel.adversaire_nom || "Adversaire", temps: duel.adversaire_temps, moi: false },
      gagneLanceur ? 0 : 1
    );
    $("duelErreur").style.display = "block";
  }

  // ---------- Compte à rebours ----------
  function rebours(surFin) {
    const zone = $("rebours"), nb = $("reboursNb"), txt = $("reboursTxt");
    zone.classList.add("on");
    const etapes = ["3", "2", "1", "GO !"];
    const textes = ["Prépare-toi…", "Concentre-toi…", "C'est parti dans…", "Trouve les mots !"];
    let i = 0;
    function suivant() {
      if (i >= etapes.length) { zone.classList.remove("on"); surFin(); return; }
      nb.textContent = etapes[i];
      txt.textContent = textes[i];
      nb.style.animation = "none";
      void nb.offsetWidth;
      nb.style.animation = "reboursPop .9s ease-out";
      if (etapes[i] === "GO !") nb.style.color = "var(--vert)";
      i++;
      setTimeout(suivant, 900);
    }
    suivant();
  }

  // ---------- Jouer ----------
  $("btnRelever").addEventListener("click", () => {
    const nom = ($("duelNom").value || "").trim();
    if (nom.length < 2) { alert("Indique ton nom pour relever le défi."); return; }
    monNom = nom;
    $("ecranDefi").style.display = "none";
    rebours(() => lancerPartie());
  });

  function lancerPartie() {
    $("ecranJeu").style.display = "block";
    $("chronoCible").textContent = "à battre : " + fmt(duel.lanceur_temps);
    $("legMoi").textContent = monNom;
    $("legLui").textContent = duel.lanceur_nom;

    jeu = window.BiZouk.creerJeu({
      conteneur: $("grille"),
      listeMots: $("motsListe"),
      surTrouve: (m, tr, total) => { trouves = tr; totalMots = total; majCourse(); },
      surVictoire: () => terminer()
    });

    const pz = jeu.charger(duel.mots, TAILLES[duel.niveau] || 10);
    totalMots = pz ? pz.placements.length : duel.mots.length;
    majCourse();

    debut = Date.now(); fini = false;
    clearInterval(minuteur);
    minuteur = setInterval(() => {
      if (fini) return;
      const s = Math.floor((Date.now() - debut)/1000);
      const c = $("chrono");
      c.textContent = fmt(s);
      c.className = "dc-temps " + (s < duel.lanceur_temps ? "devant" : "derriere");
      majCourse();
    }, 250);
  }

  /* La course : ma progression réelle contre le rythme moyen de l'adversaire */
  function majCourse() {
    if (!debut) return;
    const s = (Date.now() - debut) / 1000;
    const pctMoi = totalMots ? Math.min(100, 100 * trouves / totalMots) : 0;
    // L'adversaire a mis lanceur_temps pour trouver tous les mots : rythme régulier
    const pctLui = Math.min(100, 100 * s / Math.max(1, duel.lanceur_temps));

    $("barreMoi").style.width = pctMoi + "%";
    $("barreLui").style.width = pctLui + "%";
    $("legMoiNb").textContent = trouves + "/" + totalMots;

    const etat = $("courseEtat");
    if (pctMoi >= pctLui + 3) { etat.textContent = "Tu es devant !"; etat.className = "course-etat devant"; }
    else if (pctLui >= pctMoi + 3) { etat.textContent = "Il te devance"; etat.className = "course-etat derriere"; }
    else { etat.textContent = "Au coude à coude"; etat.className = "course-etat"; }
  }

  // ---------- Fin ----------
  async function terminer() {
    if (fini) return;
    fini = true;
    clearInterval(minuteur);
    const t = Math.floor((Date.now() - debut)/1000);

    await window.BiZoukDuel.repondre(code, monNom, t);

    const jeGagne = t < duel.lanceur_temps;
    const ecart = Math.abs(t - duel.lanceur_temps);

    $("resEmoji").textContent = jeGagne ? "🏆" : "💪";
    $("resTitre").innerHTML = jeGagne
      ? 'Tu <b style="color:var(--vert)">remportes</b> le duel !'
      : 'Presque !';

    $("resContenu").innerHTML =
      arene(
        { nom: monNom, temps: t, moi: true },
        { nom: duel.lanceur_nom, temps: duel.lanceur_temps, moi: false },
        jeGagne ? 0 : 1
      )
      + '<div class="res-ecart">'
      + (jeGagne
          ? 'Plus rapide de <b>' + fmt(ecart) + '</b>. Beau travail.'
          : 'Il te manquait <b>' + fmt(ecart) + '</b>. Lance ta revanche !')
      + '</div>';

    // Bouton de partage du résultat
    const bp = $("btnPartagerRes");
    if (bp) bp.onclick = async () => {
      const info = {
        chapitre: duel.chapitre_nom || "Duel",
        theme: "",
        niveau: duel.niveau === 20 ? "Confirmé" : "Découverte",
        temps: fmt(t),
        mots: totalMots,
        pierres: 0,
        joueur: monNom,
        duel: { adversaire: duel.lanceur_nom, sonTemps: fmt(duel.lanceur_temps), gagne: jeGagne }
      };
      const avant = bp.textContent;
      bp.textContent = "Préparation…"; bp.disabled = true;
      let r = "telecharge";
      try { r = await window.BiZoukPartage.partagerDuel(info); } catch (e) { r = "telecharge"; }
      bp.textContent = (r === "telecharge") ? "Image téléchargée" : avant;
      if (r === "telecharge") liensPartage(info);
      setTimeout(() => { bp.textContent = avant; bp.disabled = false; }, 2200);
    };

    $("resultat").classList.add("on");
  }

  /* Les deux combattants côte à côte, gagnant en premier */
  function arene(a, b, indexGagnant) {
    const liste = indexGagnant === 0 ? [a, b] : [b, a];
    return '<div class="res-arene">' + liste.map((j, i) => {
      const gagne = i === 0;
      return '<div class="res-ligne ' + (gagne ? 'gagnant' : 'perdant') + '">'
        + '<span class="res-av ' + (j.moi ? 'moi' : 'lui') + '" style="background:none">'
        + (window.BiZoukAvatar
            ? window.BiZoukAvatar.avatar(Object.assign(window.BiZoukAvatar.configDepuisNom(j.nom),
                {initiales: window.BiZoukAvatar.initialesDe(j.nom)}), 46)
            : esc(initiale(j.nom)))
        + '</span>'
        + '<span class="res-info"><span class="res-nom">' + esc(j.nom) + '</span>'
        + '<span class="res-mention">' + (j.moi ? 'toi' : 'adversaire') + '</span></span>'
        + '<span class="res-temps">' + fmt(j.temps) + '</span>'
        + '<span class="res-medaille">' + (gagne ? '🏆' : '') + '</span>'
        + '</div>';
    }).join("") + '</div>';
  }

  function liensPartage(info) {
    const zone = $("resLiens");
    if (!zone || zone.innerHTML) return;
    const l = window.BiZoukPartage.liensDuel(info);
    zone.innerHTML =
      '<p style="font-size:.8rem;color:var(--texte-faible);margin:12px 0 8px;font-style:italic">'
      + 'L\'image a été téléchargée : joins-la à ton message.</p>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center">'
      + '<a class="share-btn share-wa" href="' + l.whatsapp + '" target="_blank" rel="noopener">WhatsApp</a>'
      + '<a class="share-btn share-tg" href="' + l.telegram + '" target="_blank" rel="noopener">Telegram</a>'
      + '<a class="share-btn share-x" href="' + l.x + '" target="_blank" rel="noopener">X</a>'
      + '</div>';
  }

  charger();
})();

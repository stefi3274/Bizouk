/* BiZouk — Mode classique : zéro lettre au hasard, message mystère garanti */
(function () {
  const $ = id => document.getElementById(id);
  async function db() { return window.DB || (window.attendreDB ? await window.attendreDB(8000) : null); }
  const esc = s => (s || "").replace(/[&<>"']/g, c => (
    { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));

  const MAX_MOTS = 22; // assez pour une grille riche, sans devenir trop grande

  let jeu = null, mysterePlat = null, chapitreCourant = null, motsCourant = null, debut = null, minuteur = null;

  function fmt(s) {
    const m = Math.floor(s / 60), r = s % 60;
    return m + ":" + String(r).padStart(2, "0");
  }

  async function chargerListe() {
    const box = $("listeChapitres");
    const base = await db();
    const ent = await window.entrepriseId();
    if (!base || !ent) { box.innerHTML = "<p class='empty'>Connexion impossible.</p>"; return; }

    const { data: chaps } = await base.from("chapitres")
      .select("id, nom, theme_id, mots").eq("entreprise_id", ent).eq("publie", true)
      .order("nom");
    const { data: themes } = await base.from("themes").select("id, nom").eq("entreprise_id", ent);
    const nomTheme = {};
    (themes || []).forEach(t => nomTheme[t.id] = t.nom);

    const valides = (chaps || []).filter(c => Array.isArray(c.mots) && c.mots.length >= 15);
    if (!valides.length) {
      box.innerHTML = "<p style='text-align:center;color:var(--texte-faible);font-style:italic'>Aucun chapitre assez riche pour ce mode pour l'instant.</p>";
      return;
    }

    box.innerHTML = '<div style="display:grid;gap:10px">' + valides.map(c =>
      '<button type="button" class="form-carte" style="text-align:left;cursor:pointer;width:100%;border:1px solid var(--gris-line)" data-chap="' + c.id + '">'
      + '<b style="display:block;color:var(--blanc);font-family:var(--serif);font-size:1.05rem">' + esc(c.nom) + '</b>'
      + '<span style="color:var(--texte-faible);font-size:.82rem">' + esc(nomTheme[c.theme_id] || "") + ' · ' + c.mots.length + ' mots disponibles</span>'
      + '</button>'
    ).join("") + '</div>';

    box.querySelectorAll("[data-chap]").forEach(b => {
      const chap = valides.find(c => c.id === b.getAttribute("data-chap"));
      b.onclick = () => lancer(chap);
    });
  }

  async function nomJoueur() {
    const base = await db(); if (!base) return null;
    const { data } = await base.auth.getSession();
    if (!data.session) return null;
    const u = data.session.user;
    return (u.user_metadata && u.user_metadata.nom) ? u.user_metadata.nom : (u.email||"").split("@")[0];
  }

  function melanger(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function lancer(chap) {
    chapitreCourant = chap;
    $("ecranChoix").style.display = "none";
    $("ecranJeu").style.display = "block";
    $("jeuTitre").textContent = chap.nom;

    const mots = melanger(chap.mots).slice(0, Math.min(MAX_MOTS, chap.mots.length));
    motsCourant = mots;
    $("jeuMeta").textContent = mots.length + " mots à trouver · message mystère à révéler à la fin";

    debut = Date.now();
    clearInterval(minuteur);
    minuteur = setInterval(() => {
      const c = $("chrono");
      if (c) c.textContent = fmt(Math.floor((Date.now() - debut) / 1000));
    }, 1000);

    jeu = window.BiZouk.creerJeu({
      conteneur: $("grille"),
      listeMots: $("motsListe"),
      surTrouve: (m, tr, total) => {
        $("motsProgres").textContent = tr + " / " + total + " mots trouvés";
      },
      surVictoire: () => terminer(),
      surMotsTermines: (mystere) => afficherBanniere(mystere),
      surLettreMystere: (idx) => remplirLettre(idx)
    });

    const puzzle = jeu.charger(mots, 9, null, null, true);
    $("motsProgres").textContent = "0 / " + (puzzle ? puzzle.placements.length : mots.length) + " mots trouvés";
  }

  function afficherBanniere(mystere) {
    mysterePlat = [];
    mystere.mots.forEach((mot, mi) => {
      mot.split("").forEach((l, li) => {
        mysterePlat.push({ lettre: l, revele: false, finMot: li === mot.length - 1 && mi < mystere.mots.length - 1 });
      });
    });
    $("mystereBanniere").style.display = "block";
    redessiner();
  }

  function remplirLettre(idx) {
    if (!mysterePlat || !mysterePlat[idx]) return;
    mysterePlat[idx].revele = true;
    redessiner();
  }

  function redessiner() {
    if (!mysterePlat) return;
    $("mystereTexte").textContent = mysterePlat.map(l =>
      (l.revele ? l.lettre : "_") + (l.finMot ? "\u00A0\u00A0" : " ")
    ).join("");
  }

  function terminer() {
    clearInterval(minuteur);
    const t = debut ? Math.floor((Date.now() - debut) / 1000) : null;
    $("vicSous").textContent = "Chapitre « " + chapitreCourant.nom + " » terminé"
      + (t != null ? " en " + fmt(t) : "") + ".";
    $("victoire").classList.add("on");
    if (window.BiZoukSon) window.BiZoukSon.jouer("victoire");
    if (window.BiZoukConfetti) window.BiZoukConfetti.lancer(1600, 0.8);
    if (window.BiZoukAnalytics) window.BiZoukAnalytics.evenement("partie_terminee", { mode: "classique" });

    const bd = $("btnDefierClassique");
    if (bd) bd.onclick = () => lancerDefiClassique(t);
  }

  async function lancerDefiClassique(temps) {
    const zone = $("defiClassiqueLiens");
    if (zone) zone.innerHTML = '<p style="color:var(--texte-doux);font-size:.88rem;margin-top:14px">Création du duel…</p>';

    const nom = await nomJoueur();
    const duel = await window.BiZoukDuelClassique.creer({
      chapitreId: chapitreCourant ? chapitreCourant.id : null,
      chapitreNom: chapitreCourant ? chapitreCourant.nom : "Mode classique",
      mots: motsCourant || [],
      joueur: nom || "Un joueur",
      temps: temps
    });

    if (!duel) {
      if (zone) zone.innerHTML = '<p style="color:#fca5a5;font-size:.88rem;margin-top:14px">Impossible de créer le duel.</p>';
      return;
    }

    const lien = window.BiZoukDuelClassique.lien(duel.code);
    const txt = encodeURIComponent("Je te défie sur BiZouk (Mode classique) ! Mêmes mots, message mystère à révéler. À toi de jouer : ");
    const u = encodeURIComponent(lien);

    if (zone) zone.innerHTML =
      '<div style="background:var(--gris-3);border-radius:12px;padding:16px;margin-top:16px">'
      + '<div style="font-size:.78rem;color:var(--texte-faible);text-transform:uppercase;letter-spacing:.06em;font-weight:700;margin-bottom:6px">Code du duel</div>'
      + '<div style="font-family:var(--serif);font-size:1.9rem;font-weight:700;color:var(--violet-c);letter-spacing:.14em;margin-bottom:12px">'
      + duel.code + '</div>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center">'
      + '<a class="share-btn share-wa" href="https://wa.me/?text=' + txt + '%20' + u + '" target="_blank" rel="noopener">WhatsApp</a>'
      + '<a class="share-btn share-tg" href="https://t.me/share/url?url=' + u + '&text=' + txt + '" target="_blank" rel="noopener">Telegram</a>'
      + '<button class="share-btn" id="copierDefiClassique" style="background:var(--violet)">Copier le lien</button>'
      + '</div></div>';

    const cp = $("copierDefiClassique");
    if (cp) cp.onclick = async () => {
      try { await navigator.clipboard.writeText(lien); cp.textContent = "Copié ✓"; }
      catch (e) { cp.textContent = "Copie impossible"; }
    };
  }

  $("vicRejouer").addEventListener("click", () => {
    $("victoire").classList.remove("on");
    $("ecranJeu").style.display = "none";
    $("mystereBanniere").style.display = "none";
    $("ecranChoix").style.display = "block";
    mysterePlat = null;
    clearInterval(minuteur);
    const zone = $("defiClassiqueLiens");
    if (zone) zone.innerHTML = "";
  });

  chargerListe();
})();

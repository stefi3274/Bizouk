/* BiZouk — Mode classique : zéro lettre au hasard, message mystère garanti */
(function () {
  const $ = id => document.getElementById(id);
  async function db() { return window.DB || (window.attendreDB ? await window.attendreDB(8000) : null); }
  const esc = s => (s || "").replace(/[&<>"']/g, c => (
    { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));

  const MAX_MOTS = 22; // assez pour une grille riche, sans devenir trop grande

  let jeu = null, mysterePlat = null, chapitreCourant = null;

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
    $("jeuMeta").textContent = mots.length + " mots à trouver · message mystère à révéler à la fin";

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
    $("vicSous").textContent = "Chapitre « " + chapitreCourant.nom + " » terminé.";
    $("victoire").classList.add("on");
    if (window.BiZoukSon) window.BiZoukSon.jouer("victoire");
    if (window.BiZoukConfetti) window.BiZoukConfetti.lancer(1600, 0.8);
    if (window.BiZoukAnalytics) window.BiZoukAnalytics.evenement("partie_terminee", { mode: "classique" });
  }

  $("vicRejouer").addEventListener("click", () => {
    $("victoire").classList.remove("on");
    $("ecranJeu").style.display = "none";
    $("mystereBanniere").style.display = "none";
    $("ecranChoix").style.display = "block";
    mysterePlat = null;
  });

  chargerListe();
})();

/* BiZouk — parcours : thèmes, chapitres, niveaux et bombes */
(function () {
  const $ = id => document.getElementById(id);
  async function db() { return window.DB || (window.attendreDB ? await window.attendreDB(8000) : null); }
  const esc = s => (s || "").replace(/[&<>"']/g, c => (
    { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));

  let themes = [];       // [{id, nom, description, chapitres:[...]}]
  let themeActif = null;
  let recherche = "";
  const themeDemande = new URLSearchParams(location.search).get("theme");

  function majSerie() {
    const P = window.Progression;
    const b = $("serieBadge"), n = $("serieNb");
    if (!b || !n) return;
    const s = P.serie();
    if (s > 0) {
      b.style.display = "inline-flex";
      n.textContent = s;
      b.classList.toggle("eteinte", !P.aJoueAujourdhui());
      b.title = P.aJoueAujourdhui()
        ? s + " jours de suite · déjà joué aujourd'hui"
        : s + " jours de suite · joue aujourd'hui pour continuer !";
    } else {
      b.style.display = "none";
    }
  }

  async function afficherReprise() {
    const P = window.Progression;
    const zone = $("zoneReprise");
    if (!zone) return;
    const pos = P.dernierePosition();
    if (!pos || !themes.length) { zone.innerHTML = ""; return; }

    // Retrouver le chapitre et son thème
    let chap = null, theme = null;
    for (const t of themes) {
      const c = t.chapitres.find(x => x.id === pos.chapitre);
      if (c) { chap = c; theme = t; break; }
    }
    if (!chap) { zone.innerHTML = ""; return; }

    // Déterminer l'étape suivante dans ce chapitre
    let libelle, lien;
    if (!P.reussi(chap.id, 15)) { libelle = "Découverte · 15 mots"; lien = "jeu.html?chapitre=" + chap.id + "&niveau=15"; }
    else if (!P.reussi(chap.id, 20)) { libelle = "Confirmé · 20 mots"; lien = "jeu.html?chapitre=" + chap.id + "&niveau=20"; }
    else if (!P.bombeFaite(chap.id)) { libelle = "La Bombe 💣"; lien = "bombe.html?chapitre=" + chap.id; }
    else {
      // Chapitre fini : proposer le suivant
      const idx = theme.chapitres.findIndex(x => x.id === chap.id);
      const suiv = theme.chapitres[idx + 1];
      if (!suiv) { zone.innerHTML = ""; return; }
      chap = suiv;
      libelle = "Découverte · 15 mots";
      lien = "jeu.html?chapitre=" + suiv.id + "&niveau=15";
    }

    zone.innerHTML = '<div class="reprise">'
      + '<div class="reprise-txt"><div class="rp-lab">Reprendre</div>'
      + '<h3>' + esc(chap.nom) + '</h3>'
      + '<p>' + esc(theme.nom) + ' · ' + libelle + '</p></div>'
      + '<a class="btn btn-v" href="' + lien + '">Continuer</a>'
      + '</div>';
  }

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

  // ---------- Chargement ----------
  async function chargerDonnees() {
    const base = await db();
    if (!base) return false;
    const ent = await entrepriseId();
    if (!ent) return false;

    const [rT, rC] = await Promise.all([
      base.from("themes").select("id, nom, description").eq("entreprise_id", ent).eq("publie", true).order("created_at"),
      base.from("chapitres").select("id, theme_id, nom, ordre, mots").eq("entreprise_id", ent).eq("publie", true).order("ordre")
    ]);
    if (rT.error || !rT.data) return false;

    const chapsParTheme = {};
    (rC.data || []).forEach(c => {
      (chapsParTheme[c.theme_id] = chapsParTheme[c.theme_id] || []).push(c);
    });
    themes = rT.data.map(t => ({
      ...t,
      chapitres: (chapsParTheme[t.id] || []).sort((a,b) => (a.ordre||0) - (b.ordre||0))
    })).filter(t => t.chapitres.length > 0);
    return true;
  }

  // ---------- Rendu ----------
  function dessinerThemes() {
    const zone = $("parcoursZone");
    const filtres = recherche.trim().toLowerCase();
    const liste = filtres
      ? themes.filter(t => (t.nom + " " + (t.description||"")).toLowerCase().includes(filtres))
      : themes;

    if (!themes.length) {
      zone.innerHTML = '<div class="cls-vide"><h3>Aucun thème disponible</h3>'
        + '<p>Les premiers chapitres arrivent bientôt. Reviens vite !</p>'
        + '<a href="contact.html" class="btn btn-v btn-sm">Proposer un thème</a></div>';
      return;
    }
    if (!liste.length) {
      zone.innerHTML = '<div class="cls-vide"><h3>Aucun résultat</h3>'
        + '<p>Aucun thème ne correspond à « ' + esc(recherche) + ' ».</p></div>';
      return;
    }

    zone.innerHTML = '<div class="theme-grille">' + liste.map(t => {
      const total = t.chapitres.length;
      const finis = t.chapitres.filter(c => window.Progression.chapitreFini(c.id)).length;
      const pct = total ? Math.round(100 * finis / total) : 0;
      return '<a class="theme-carte" href="#" data-theme="' + t.id + '">'
        + '<div class="tc-head"><h3>' + esc(t.nom) + '</h3>'
        + (finis === total && total ? '<span class="tc-fini">✓</span>' : '') + '</div>'
        + (t.description ? '<p class="tc-desc">' + esc(t.description) + '</p>' : '')
        + '<div class="tc-meta">' + total + (total > 1 ? ' chapitres' : ' chapitre')
        + ' · ' + t.chapitres.reduce((s,c) => s + (Array.isArray(c.mots) ? c.mots.length : 0), 0) + ' mots</div>'
        + '<div class="tc-barre"><span style="width:' + pct + '%"></span></div>'
        + '<div class="tc-progres">' + finis + ' / ' + total + ' terminé' + (finis > 1 ? 's' : '') + '</div>'
        + '</a>';
    }).join("") + '</div>';

    zone.querySelectorAll("[data-theme]").forEach(a => {
      a.addEventListener("click", e => {
        e.preventDefault();
        const id = a.getAttribute("data-theme");
        themeActif = themes.find(t => t.id === id);
        history.replaceState(null, "", "parcours.html?theme=" + id);
        dessinerChapitres();
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    });
  }

  function dessinerChapitres() {
    const P = window.Progression;
    const zone = $("parcoursZone");
    const t = themeActif;
    if (!t) return dessinerThemes();

    let html = '<button class="btn btn-g btn-sm" id="retourThemes" style="margin-bottom:20px">← Tous les thèmes</button>'
      + '<div style="margin-bottom:24px">'
      + '<h2 style="font-family:var(--serif);font-size:1.7rem;color:var(--blanc);margin-bottom:6px">' + esc(t.nom) + '</h2>'
      + (t.description ? '<p style="color:var(--texte-doux)">' + esc(t.description) + '</p>' : '')
      + '</div>';

    t.chapitres.forEach((chap, i) => {
      // Le chapitre est ouvert si c'est le premier, ou si le précédent est fini
      const ouvert = (i === 0) || P.chapitreFini(t.chapitres[i-1].id);
      const fini = P.chapitreFini(chap.id);
      const nbMots = Array.isArray(chap.mots) ? chap.mots.length : 0;

      html += '<section class="partie' + (ouvert ? '' : ' verrou') + '">'
        + '<div class="partie-head">'
        + '<span class="partie-num">' + (i+1) + '</span>'
        + '<div><h2>' + esc(chap.nom) + (fini ? ' ✓' : '') + '</h2>'
        + '<div class="ph-sous">' + (ouvert
            ? nbMots + ' mots · 2 niveaux + bombe'
            : 'Termine le chapitre précédent pour ouvrir') + '</div></div>'
        + '</div><div class="niv-liste">';

      // Niveau Découverte (15)
      const d15 = P.reussi(chap.id, 15);
      const o15 = P.niveauOuvert(chap.id, 15, ouvert);
      html += '<a class="niv-case niv-decouverte' + (d15 ? ' fait' : '') + (o15 ? '' : ' verrou') + '" '
        + 'href="' + (o15 ? 'jeu.html?chapitre=' + chap.id + '&niveau=15' : '#') + '">'
        + '<div class="nc-head"><span class="nc-nom">Découverte</span>'
        + '<span class="nc-etat">' + (d15 ? '✓' : (o15 ? '' : '🔒')) + '</span></div>'
        + '<div class="nc-mots">15 mots à trouver</div>'
        + '<div class="nc-gain">' + (d15 ? 'Réussi · 3 pierres' : '+3 pierres vertes') + '</div></a>';

      // Niveau Confirmé (20)
      const d20 = P.reussi(chap.id, 20);
      const o20 = P.niveauOuvert(chap.id, 20, ouvert);
      html += '<a class="niv-case niv-confirme' + (d20 ? ' fait' : '') + (o20 ? '' : ' verrou') + '" '
        + 'href="' + (o20 ? 'jeu.html?chapitre=' + chap.id + '&niveau=20' : '#') + '">'
        + '<div class="nc-head"><span class="nc-nom">Confirmé</span>'
        + '<span class="nc-etat">' + (d20 ? '✓' : (o20 ? '' : '🔒')) + '</span></div>'
        + '<div class="nc-mots">15 mots · les plus longs</div>'
        + '<div class="nc-gain">' + (d20 ? 'Réussi · 3 pierres' : '+3 pierres jaunes') + '</div></a>';

      html += '</div>';

      // La Bombe du chapitre
      const oB = P.bombeOuverte(chap.id, ouvert);
      const fB = P.bombeFaite(chap.id);
      const bloque = P.bloque();
      html += '<div class="bombe-sep' + (oB ? '' : ' verrou') + '">'
        + '<span class="bombe-icone">' + (fB ? '✅' : '💣') + '</span>'
        + '<div class="bombe-txt"><h3>La Bombe' + (fB ? ' · neutralisée' : '') + '</h3>'
        + '<p>' + (fB ? 'Chapitre terminé. Bravo !'
            : (oB ? (bloque ? 'Explosée. Attends ou dépense 5 pierres.' : '20 mots cachés, 2 à trouver en 2 minutes.')
                  : 'Réussis les deux niveaux pour l\'affronter.')) + '</p></div>'
        + (oB && !fB
            ? '<a class="btn btn-v btn-sm" href="bombe.html?chapitre=' + chap.id + '">'
              + (bloque ? 'Voir' : 'Affronter') + '</a>'
            : (fB ? '<span class="bz-badge bz-rose">' + (window.BiZoukPierre ? window.BiZoukPierre.pierre("rose",16) : "") + '<span class="bz-nb">+3</span></span>'
                  : '<button class="btn btn-g btn-sm" disabled>Verrouillé</button>'))
        + '</div></section>';
    });

    zone.innerHTML = html;
    const r = $("retourThemes");
    if (r) r.onclick = () => {
      themeActif = null;
      history.replaceState(null, "", "parcours.html");
      dessinerThemes();
    };
  }

  // ---------- Recherche ----------
  const champ = $("chercheTheme");
  if (champ) champ.addEventListener("input", () => {
    recherche = champ.value;
    if (themeActif) { themeActif = null; }
    dessinerThemes();
  });

  // ---------- Init ----------
  async function init() {
    const zone = $("parcoursZone");
    zone.innerHTML = '<p style="text-align:center;color:var(--texte-faible);font-style:italic;padding:40px">Chargement des thèmes…</p>';

    majCompteur();
    const ok = await chargerDonnees();
    await window.Progression.init();
    majCompteur();

    if (!ok) {
      zone.innerHTML = '<div class="cls-vide"><h3>Connexion impossible</h3>'
        + '<p>Vérifie ta connexion internet, puis recharge la page.</p></div>';
      return;
    }
    // Si un thème est demandé dans l'URL, on l'ouvre directement
    if (themeDemande) {
      const t = themes.find(x => x.id === themeDemande);
      if (t) { themeActif = t; dessinerChapitres(); }
      else dessinerThemes();
      majSerie();
      afficherReprise();
    } else {
      dessinerThemes();
    }

    if (!window.Progression.connecte()) $("inviteCompte").style.display = "block";
    else {
      $("inviteCompte").style.display = "none";
      const nav = $("navAuth");
      if (nav) { nav.textContent = "Mon compte"; nav.href = "compte.html"; }
    }
  }

  init();
})();

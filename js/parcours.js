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
    const MOTS_NIV = { 1: 6, 2: 7, 3: 8, 4: 9, 5: 10 };
    const prochainNiveau = [1,2,3,4,5].find(n => !P.reussi(chap.id, n));
    if (prochainNiveau) {
      libelle = "Niveau " + prochainNiveau + " · " + MOTS_NIV[prochainNiveau] + " mots";
      lien = "jeu.html?chapitre=" + chap.id + "&niveau=" + prochainNiveau;
    } else if (!P.bombeFaite(chap.id)) { libelle = "La Bombe 💣"; lien = "bombe.html?chapitre=" + chap.id; }
    else {
      // Chapitre fini : proposer le suivant
      const idx = theme.chapitres.findIndex(x => x.id === chap.id);
      const suiv = theme.chapitres[idx + 1];
      if (!suiv) { zone.innerHTML = ""; return; }
      chap = suiv;
      libelle = "Niveau 1 · 6 mots";
      lien = "jeu.html?chapitre=" + suiv.id + "&niveau=1";
    }

    zone.innerHTML = '<div class="reprise">'
      + '<div class="reprise-txt"><div class="rp-lab">Reprendre</div>'
      + '<h3>' + esc(chap.nom) + '</h3>'
      + '<p>' + esc(theme.nom) + ' · ' + libelle + '</p></div>'
      + '<a class="btn btn-v" href="' + lien + '">Continuer</a>'
      + '</div>';
  }

  function majCompteur() {
    const badge = $("badgeVert"), nb = $("bzVert");
    if (badge && window.BiZoukPierre && !badge.querySelector("svg")) {
      badge.insertAdjacentHTML("afterbegin", window.BiZoukPierre.pierre("vert", 17));
    }
    if (nb && window.Progression) nb.textContent = window.Progression.total();
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

    // "Thèmes Libres" reste toujours affiché en premier
    const estLibre = n => (n || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .trim().toLowerCase() === "themes libres";
    themes.sort((a, b) => (estLibre(b.nom) ? 1 : 0) - (estLibre(a.nom) ? 1 : 0));

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

  /* Construit la liste plate des nœuds du chemin (niveau 1, 2, 3, bombe, pour chaque chapitre) */
  function construireNoeuds(t) {
    const P = window.Progression;
    const noeuds = [];
    t.chapitres.forEach((chap, ci) => {
      const ouvertChap = (ci === 0) || P.chapitreFini(t.chapitres[ci - 1].id);
      const NIVS = [
        { n: 1, nom: "Niveau 1", icone: "1" },
        { n: 2, nom: "Niveau 2", icone: "2" },
        { n: 3, nom: "Niveau 3", icone: "3" },
        { n: 4, nom: "Niveau 4", icone: "4" },
        { n: 5, nom: "Niveau 5", icone: "5" }
      ];
      NIVS.forEach(niv => {
        noeuds.push({
          type: "niveau", chapitreId: chap.id, chapitreNom: chap.nom, chapitreIndex: ci,
          label: niv.nom, icone: niv.icone,
          fait: P.reussi(chap.id, niv.n),
          ouvert: P.niveauOuvert(chap.id, niv.n, ouvertChap),
          lien: "jeu.html?chapitre=" + chap.id + "&niveau=" + niv.n
        });
      });
      noeuds.push({
        type: "bombe", chapitreId: chap.id, chapitreNom: chap.nom, chapitreIndex: ci,
        label: "La Bombe", icone: "💣",
        fait: P.bombeFaite(chap.id),
        ouvert: P.bombeOuverte(chap.id, ouvertChap),
        lien: "bombe.html?chapitre=" + chap.id
      });
    });
    return noeuds;
  }

  /* Calcule les positions (zigzag) des nœuds et dessine le tracé SVG */
  function positionnerChemin(noeuds) {
    const cont = $("chemin");
    if (!cont) return;
    const larg = cont.clientWidth || 320;
    const pas = 108;          // espacement vertical entre deux nœuds
    const rayon = 32;         // demi-taille d'un nœud
    const marge = 50;
    const motif = [0.5, 0.76, 0.5, 0.24]; // positions horizontales en fraction de la largeur (sinueux)

    const pts = noeuds.map((n, i) => ({
      x: Math.min(larg - rayon - 6, Math.max(rayon + 6, motif[i % motif.length] * larg)),
      y: marge + i * pas
    }));

    const hauteur = marge + noeuds.length * pas + 30;
    cont.style.height = hauteur + "px";

    cont.querySelectorAll(".noeud").forEach(el => {
      const i = Number(el.dataset.idx);
      el.style.left = pts[i].x + "px";
      el.style.top = pts[i].y + "px";
    });
    cont.querySelectorAll(".chemin-etiquette").forEach(el => {
      const i = Number(el.dataset.idx);
      const surDroite = pts[i].x <= larg / 2;
      el.style.top = (pts[i].y - 40) + "px";
      el.style.left = surDroite ? "10px" : "auto";
      el.style.right = surDroite ? "auto" : "10px";
      el.style.textAlign = surDroite ? "left" : "right";
    });

    const svg = $("cheminSvg");
    if (svg && pts.length) {
      svg.setAttribute("width", larg);
      svg.setAttribute("height", hauteur);
      svg.setAttribute("viewBox", "0 0 " + larg + " " + hauteur);
      // Partie déjà parcourue (violet plein) jusqu'au premier niveau non réussi, puis à venir (pointillé gris)
      let idxFin = noeuds.findIndex(n => !n.fait);
      if (idxFin === -1) idxFin = pts.length - 1;
      const versD = (arr) => arr.map((p, i) => (i === 0 ? "M " : "L ") + p.x + " " + p.y).join(" ");
      const faits = pts.slice(0, idxFin + 1);
      const restants = pts.slice(idxFin);
      svg.innerHTML =
        '<path d="' + versD(restants) + '" fill="none" stroke="var(--gris-3)" stroke-width="6" stroke-linecap="round" stroke-dasharray="2 14"/>'
        + (faits.length > 1 ? '<path d="' + versD(faits) + '" fill="none" stroke="var(--violet)" stroke-width="6" stroke-linecap="round"/>' : "");
    }
  }

  function dessinerChemin(t) {
    const zone = $("parcoursZone");
    const noeuds = construireNoeuds(t);

    let html = '<button class="btn btn-g btn-sm" id="retourThemes" style="margin-bottom:20px">← Tous les thèmes</button>'
      + '<div style="margin-bottom:10px;text-align:center">'
      + '<h2 style="font-family:var(--serif);font-size:1.7rem;color:var(--blanc);margin-bottom:6px">' + esc(t.nom) + '</h2>'
      + (t.description ? '<p style="color:var(--texte-doux)">' + esc(t.description) + '</p>' : '')
      + '</div>';

    html += '<div class="chemin" id="chemin"><svg class="chemin-svg" id="cheminSvg"></svg>';
    let chapCourant = -1;
    noeuds.forEach((no, i) => {
      if (no.chapitreIndex !== chapCourant) {
        chapCourant = no.chapitreIndex;
        html += '<div class="chemin-etiquette" data-idx="' + i + '">' + esc(no.chapitreNom) + '</div>';
      }
      const classes = ["noeud"];
      if (no.type === "bombe") classes.push("noeud-bombe");
      if (no.fait) classes.push("fait");
      else if (!no.ouvert) classes.push("verrou");
      else classes.push("dispo");
      html += '<a class="' + classes.join(" ") + '" data-idx="' + i + '" '
        + 'href="' + (no.ouvert ? no.lien : "#") + '" title="' + esc(no.chapitreNom + " · " + no.label) + '">'
        + '<span class="noeud-ic">' + (no.fait ? "✓" : (no.ouvert ? no.icone : "🔒")) + '</span>'
        + '</a>';
    });
    html += '</div>';

    zone.innerHTML = html;
    positionnerChemin(noeuds);

    zone.querySelectorAll(".noeud.verrou").forEach(el => el.addEventListener("click", e => e.preventDefault()));

    const r = $("retourThemes");
    if (r) r.onclick = () => {
      themeActif = null;
      history.replaceState(null, "", "parcours.html");
      dessinerThemes();
    };

    const redessiner = () => { if (themeActif === t) positionnerChemin(noeuds); };
    window.addEventListener("resize", redessiner);

    // Défiler jusqu'au premier nœud disponible non terminé (reprendre là où on en était)
    const idxCible = noeuds.findIndex(n => n.ouvert && !n.fait);
    const elCible = zone.querySelector('.noeud[data-idx="' + (idxCible >= 0 ? idxCible : noeuds.length - 1) + '"]');
    if (elCible) setTimeout(() => elCible.scrollIntoView({ behavior: "smooth", block: "center" }), 200);
  }

  function dessinerChapitres() {
    if (!themeActif) return dessinerThemes();
    dessinerChemin(themeActif);
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

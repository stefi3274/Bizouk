/* BiZouk — moteur de mots mêlés (génération + interaction) */
(function () {
  const DIRS = [[0,1],[0,-1],[1,0],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]];
  const LETTRES = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const NB_COULEURS = 8;

  function normaliser(mot) {
    return (mot || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toUpperCase().replace(/[^A-Z]/g, "");
  }

  // Génère une grille contenant les mots donnés
  function generer(motsBruts, tailleMin) {
    const liste = [...new Set(motsBruts.map(normaliser).filter(m => m.length >= 2))];
    if (!liste.length) return null;

    const plusLong = Math.max(...liste.map(m => m.length));
    // Taille compacte : on vise ~55% de remplissage (mots serrés mais plaçables)
    const totalLettres = liste.reduce((s,m) => s + m.length, 0);
    const parVolume = Math.ceil(Math.sqrt(totalLettres / 0.62));
    const taille = Math.max(tailleMin || 12, plusLong + 1, parVolume);

    const grille = Array.from({ length: taille }, () => Array(taille).fill(null));
    const placements = [];
    const tries = [...liste].sort((a,b) => b.length - a.length);
    const nonPlaces = [];

    tries.forEach(mot => {
      let place = false;
      for (let essai = 0; essai < 600 && !place; essai++) {
        const dir = DIRS[Math.floor(Math.random() * DIRS.length)];
        const r0 = Math.floor(Math.random() * taille);
        const c0 = Math.floor(Math.random() * taille);
        const rF = r0 + dir[0] * (mot.length - 1);
        const cF = c0 + dir[1] * (mot.length - 1);
        if (rF < 0 || rF >= taille || cF < 0 || cF >= taille) continue;

        let ok = true;
        for (let i = 0; i < mot.length; i++) {
          const r = r0 + dir[0]*i, c = c0 + dir[1]*i;
          if (grille[r][c] && grille[r][c] !== mot[i]) { ok = false; break; }
        }
        if (!ok) continue;

        const cases = [];
        for (let i = 0; i < mot.length; i++) {
          const r = r0 + dir[0]*i, c = c0 + dir[1]*i;
          grille[r][c] = mot[i];
          cases.push({ r, c });
        }
        placements.push({ mot, cases });
        place = true;
      }
      if (!place) nonPlaces.push(mot);
    });

    // Remplir les cases vides
    for (let r = 0; r < taille; r++)
      for (let c = 0; c < taille; c++)
        if (!grille[r][c]) grille[r][c] = LETTRES[Math.floor(Math.random() * LETTRES.length)];

    return { grille, taille, placements, nonPlaces };
  }

  // ---------- Interaction ----------
  function creerJeu(options) {
    const conteneur = options.conteneur;
    const listeBox = options.listeMots;
    const surTrouve = options.surTrouve || function(){};
    const surVictoire = options.surVictoire || function(){};

    let puzzle = null;
    let trouves = [];
    let glisse = false, depart = null, courant = null;

    function couleurMot(i) { return "var(--f" + ((i % NB_COULEURS) + 1) + ")"; }

    function dessiner() {
      if (!puzzle) return;
      const t = puzzle.taille;
      // Largeur réellement disponible (le conteneur peut défiler si besoin)
      const boite = conteneur.parentElement;
      const dispo = Math.max(240, boite.clientWidth - 34);
      const estMobile = window.innerWidth < 700;
      // Sur mobile on accepte des cases plus petites pour éviter le défilement ;
      // en dessous de 15px on laisse défiler plutôt que de rendre illisible.
      const minPx = estMobile ? 15 : 18;
      const maxPx = estMobile ? 34 : 38;
      let taillePx = Math.floor((dispo - (t-1)*2) / t);
      taillePx = Math.max(minPx, Math.min(maxPx, taillePx));

      conteneur.style.gridTemplateColumns = "repeat(" + t + ", " + taillePx + "px)";
      conteneur.style.fontSize = Math.max(8, Math.round(taillePx * 0.5)) + "px";
      // Indiquer si la grille dépasse (défilement horizontal)
      const largeurTotale = t * taillePx + (t-1) * 2;
      boite.classList.toggle("defile", largeurTotale > dispo + 4);

      let html = "";
      for (let r = 0; r < t; r++) {
        for (let c = 0; c < t; c++) {
          html += '<div class="case" data-r="' + r + '" data-c="' + c + '">' + puzzle.grille[r][c] + '</div>';
        }
      }
      conteneur.innerHTML = html;
      appliquerTrouves();
    }

    function appliquerTrouves() {
      conteneur.querySelectorAll(".case").forEach(el => {
        el.classList.remove("trouve");
        el.style.background = "";
      });
      trouves.forEach(f => {
        const idx = puzzle.placements.findIndex(p => p.mot === f.mot);
        const coul = couleurMot(idx);
        f.cases.forEach(pos => {
          const el = conteneur.querySelector('[data-r="'+pos.r+'"][data-c="'+pos.c+'"]');
          if (el) { el.classList.add("trouve"); el.style.background = coul; }
        });
      });
    }

    function majListe() {
      if (!listeBox || !puzzle) return;
      const set = new Set(trouves.map(f => f.mot));
      listeBox.innerHTML = puzzle.placements.map((p, i) =>
        '<span class="mot' + (set.has(p.mot) ? ' trouve' : '') + '"'
        + (set.has(p.mot) ? ' style="--mc:' + couleurMot(i) + '"' : '')
        + '>' + p.mot + '</span>'
      ).join("");
      const pr = document.getElementById("motsProgres");
      if (pr) pr.textContent = trouves.length + " / " + puzzle.placements.length + " mots trouvés";
    }

    function cheminTemp() {
      if (!glisse || !depart || !courant) return [];
      const dr = courant.r - depart.r, dc = courant.c - depart.c;
      const droit = dr === 0 || dc === 0 || Math.abs(dr) === Math.abs(dc);
      if (!droit) return [];
      const pas = Math.max(Math.abs(dr), Math.abs(dc));
      const sr = pas ? Math.sign(dr) : 0, sc = pas ? Math.sign(dc) : 0;
      const chemin = [];
      for (let i = 0; i <= pas; i++) chemin.push({ r: depart.r + sr*i, c: depart.c + sc*i });
      return chemin;
    }

    function surligner() {
      conteneur.querySelectorAll(".case.select").forEach(e => e.classList.remove("select"));
      cheminTemp().forEach(pos => {
        const el = conteneur.querySelector('[data-r="'+pos.r+'"][data-c="'+pos.c+'"]');
        if (el) el.classList.add("select");
      });
    }

    function valider() {
      const chemin = cheminTemp();
      if (chemin.length >= 2 && puzzle) {
        const s = chemin.map(p => puzzle.grille[p.r][p.c]).join("");
        const inv = s.split("").reverse().join("");
        const dejaTrouves = new Set(trouves.map(f => f.mot));
        const match = puzzle.placements.find(p =>
          !dejaTrouves.has(p.mot) && (p.mot === s || p.mot === inv));
        if (match) {
          trouves.push(match);
          appliquerTrouves();
          majListe();
          surTrouve(match, trouves.length, puzzle.placements.length);
          if (trouves.length === puzzle.placements.length) surVictoire();
        }
      }
      glisse = false; depart = null; courant = null;
      conteneur.querySelectorAll(".case.select").forEach(e => e.classList.remove("select"));
    }

    function caseDepuisPoint(x, y) {
      const el = document.elementFromPoint(x, y);
      if (!el || el.dataset.r === undefined) return null;
      return { r: Number(el.dataset.r), c: Number(el.dataset.c) };
    }

    // Souris
    conteneur.addEventListener("mousedown", e => {
      const el = e.target.closest(".case"); if (!el) return;
      e.preventDefault();
      glisse = true;
      depart = { r: Number(el.dataset.r), c: Number(el.dataset.c) };
      courant = { ...depart };
      surligner();
    });
    conteneur.addEventListener("mouseover", e => {
      if (!glisse) return;
      const el = e.target.closest(".case"); if (!el) return;
      courant = { r: Number(el.dataset.r), c: Number(el.dataset.c) };
      surligner();
    });
    window.addEventListener("mouseup", () => { if (glisse) valider(); });

    // Tactile
    conteneur.addEventListener("touchstart", e => {
      const el = e.target.closest(".case"); if (!el) return;
      e.preventDefault();
      glisse = true;
      depart = { r: Number(el.dataset.r), c: Number(el.dataset.c) };
      courant = { ...depart };
      surligner();
    }, { passive: false });
    conteneur.addEventListener("touchmove", e => {
      if (!glisse) return;
      e.preventDefault();
      const t = e.touches[0];
      const pos = caseDepuisPoint(t.clientX, t.clientY);
      if (pos) { courant = pos; surligner(); }
    }, { passive: false });
    window.addEventListener("touchend", () => { if (glisse) valider(); });

    window.addEventListener("resize", () => { if (puzzle) dessiner(); });

    return {
      charger(mots, tailleMin) {
        puzzle = generer(mots, tailleMin);
        trouves = [];
        dessiner();
        majListe();
        return puzzle;
      },
      recommencer() {
        trouves = [];
        appliquerTrouves();
        majListe();
      },
      revelerTout() {
        if (!puzzle) return;
        trouves = puzzle.placements.slice();
        appliquerTrouves();
        majListe();
      },
      etat() {
        return puzzle ? { total: puzzle.placements.length, trouves: trouves.length } : null;
      },
      puzzle() { return puzzle; }
    };
  }

  window.BiZouk = { generer, normaliser, creerJeu };
})();

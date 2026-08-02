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
  function generer(motsBruts, tailleMin, tailleMax) {
    const liste = [...new Set(motsBruts.map(normaliser).filter(m => m.length >= 2))];
    if (!liste.length) return null;

    const plusLong = Math.max(...liste.map(m => m.length));
    // Taille compacte : on vise ~72% de remplissage (mots serrés, lettres plus grandes)
    const totalLettres = liste.reduce((s,m) => s + m.length, 0);
    const parVolume = Math.ceil(Math.sqrt(totalLettres / 0.72));
    let taille = Math.max(tailleMin || 12, plusLong + 1, parVolume);
    if (tailleMax) taille = Math.min(taille, Math.max(tailleMax, plusLong + 1));

    const grille = Array.from({ length: taille }, () => Array(taille).fill(null));
    const placements = [];
    const tries = [...liste].sort((a,b) => b.length - a.length);
    const nonPlaces = [];

    tries.forEach(mot => {
      let place = false;
      for (let essai = 0; essai < 900 && !place; essai++) {
        const dir = DIRS[Math.floor(Math.random() * DIRS.length)];
        let r0, c0;
        // Sans ça, l'algorithme remplit surtout le centre : les points de départ
        // proches des bords/coins sont plus souvent rejetés (le mot sortirait du
        // cadre), donc les coins récupèrent surtout des lettres de remplissage.
        // On force donc une majorité des tentatives à viser les coins/bords.
        const zone = Math.random();
        if (zone < 0.35) {
          const k = Math.max(3, Math.floor(taille * 0.3));
          r0 = Math.random() < 0.5 ? Math.floor(Math.random() * k) : taille - 1 - Math.floor(Math.random() * k);
          c0 = Math.random() < 0.5 ? Math.floor(Math.random() * k) : taille - 1 - Math.floor(Math.random() * k);
        } else if (zone < 0.75) {
          const bande = Math.max(2, Math.floor(taille * 0.25));
          if (Math.random() < 0.5) {
            r0 = Math.random() < 0.5 ? Math.floor(Math.random() * bande) : taille - 1 - Math.floor(Math.random() * bande);
            c0 = Math.floor(Math.random() * taille);
          } else {
            c0 = Math.random() < 0.5 ? Math.floor(Math.random() * bande) : taille - 1 - Math.floor(Math.random() * bande);
            r0 = Math.floor(Math.random() * taille);
          }
        } else {
          r0 = Math.floor(Math.random() * taille);
          c0 = Math.floor(Math.random() * taille);
        }
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
    let cibles = null;   // si défini, seuls ces mots comptent
    let glisse = false, depart = null, courant = null;
    let tailleCase = 32;
    let bulle = null;
    let dernierTrouveA = 0, combo = 0;
    let toastCombo = null;

    function assurerBulle() {
      if (!bulle) {
        bulle = document.createElement("div");
        bulle.className = "lettre-bulle";
        document.body.appendChild(bulle);
      }
      return bulle;
    }

    function afficherBulle(pos) {
      if (!pos) return;
      const el = conteneur.querySelector('[data-r="'+pos.r+'"][data-c="'+pos.c+'"]');
      if (!el) return;
      const b = assurerBulle();
      const taille = Math.round(tailleCase * 3);
      const rect = el.getBoundingClientRect();
      b.style.width = taille + "px";
      b.style.height = taille + "px";
      b.style.fontSize = Math.round(taille * 0.52) + "px";
      b.textContent = el.textContent;
      const cx = rect.left + rect.width / 2;
      let cy = rect.top - taille / 2 - 10;
      if (cy - taille / 2 < 4) cy = rect.bottom + taille / 2 + 10; // évite le débordement en haut d'écran
      b.style.left = Math.min(Math.max(taille/2 + 4, cx), window.innerWidth - taille/2 - 4) + "px";
      b.style.top = cy + "px";
      b.classList.add("on");
    }

    function cacherBulle() {
      if (bulle) bulle.classList.remove("on");
    }

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
      const minPx = estMobile ? 20 : 26;
      const maxPx = estMobile ? 46 : 56;
      let taillePx = Math.floor((dispo - (t-1)*2) / t);
      taillePx = Math.max(minPx, Math.min(maxPx, taillePx));
      tailleCase = taillePx;

      conteneur.style.gridTemplateColumns = "repeat(" + t + ", " + taillePx + "px)";
      conteneur.style.fontSize = Math.max(10, Math.round(taillePx * 0.6)) + "px";
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
      // Si des cibles sont définies, on n'affiche qu'elles
      const aAfficher = cibles
        ? puzzle.placements.filter(p => cibles.includes(p.mot))
        : puzzle.placements;
      listeBox.innerHTML = aAfficher.map(p => {
        const i = puzzle.placements.findIndex(x => x.mot === p.mot);
        return '<span class="mot' + (set.has(p.mot) ? ' trouve' : '') + '"'
          + (set.has(p.mot) ? ' style="--mc:' + couleurMot(i) + '"' : '')
          + '>' + p.mot + '</span>';
      }).join("");
      const pr = document.getElementById("motsProgres");
      if (pr) {
        const totalUtile = cibles ? cibles.length : puzzle.placements.length;
        const trouvesUtiles = cibles
          ? trouves.filter(f => cibles.includes(f.mot)).length
          : trouves.length;
        pr.textContent = cibles
          ? trouvesUtiles + " / " + totalUtile
          : trouvesUtiles + " / " + totalUtile + " mots trouvés";
      }
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

    function afficherToastCombo(n) {
      if (!toastCombo) {
        toastCombo = document.createElement("div");
        toastCombo.className = "combo-toast";
        document.body.appendChild(toastCombo);
      }
      toastCombo.textContent = "🔥 " + n + " mots coup sur coup !";
      toastCombo.classList.remove("on");
      void toastCombo.offsetWidth; // relance l'animation
      toastCombo.classList.add("on");
      clearTimeout(toastCombo._t);
      toastCombo._t = setTimeout(() => toastCombo.classList.remove("on"), 1600);
    }

    function valider() {
      const chemin = cheminTemp();
      if (chemin.length >= 2 && puzzle) {
        const s = chemin.map(p => puzzle.grille[p.r][p.c]).join("");
        const inv = s.split("").reverse().join("");
        const dejaTrouves = new Set(trouves.map(f => f.mot));
        // Le mot compte même si le tracé dépasse d'une ou plusieurs lettres :
        // on cherche le mot comme sous-chaîne du tracé, dans les deux sens.
        const match = puzzle.placements.find(p =>
          !dejaTrouves.has(p.mot) && (s.includes(p.mot) || inv.includes(p.mot)));
        if (match) {
          trouves.push(match);
          appliquerTrouves();
          majListe();

          // Combo : mots trouvés coup sur coup (moins de 4s d'écart)
          const maintenant = Date.now();
          combo = (maintenant - dernierTrouveA < 4000) ? combo + 1 : 1;
          dernierTrouveA = maintenant;
          if (window.BiZoukSon) window.BiZoukSon.jouer(combo >= 3 ? "combo" : "trouve");
          if (navigator.vibrate) navigator.vibrate(combo >= 3 ? [15,30,15] : 12);
          if (combo >= 3) afficherToastCombo(combo);

          if (cibles) {
            const utiles = trouves.filter(f => cibles.includes(f.mot)).length;
            surTrouve(match, utiles, cibles.length, combo);
            if (utiles === cibles.length) surVictoire();
          } else {
            surTrouve(match, trouves.length, puzzle.placements.length, combo);
            if (trouves.length === puzzle.placements.length) surVictoire();
          }
        }
      }
      glisse = false; depart = null; courant = null;
      conteneur.querySelectorAll(".case.select").forEach(e => e.classList.remove("select"));
    }

    function caseDepuisPoint(x, y) {
      if (!puzzle) return null;
      const rect = conteneur.getBoundingClientRect();
      const gap = 2; // doit correspondre au gap CSS de la grille (.grille{gap:2px})
      const pas = tailleCase + gap;
      if (pas <= 0) return null;
      let c = Math.floor((x - rect.left) / pas);
      let r = Math.floor((y - rect.top) / pas);
      const t = puzzle.taille;
      // On "colle" le doigt à la case la plus proche même s'il déborde du cadre,
      // au lieu de perdre le tracé quand le doigt glisse hors de la grille.
      if (r < 0) r = 0; else if (r > t - 1) r = t - 1;
      if (c < 0) c = 0; else if (c > t - 1) c = t - 1;
      return { r, c };
    }

    // Souris
    conteneur.addEventListener("mousedown", e => {
      const el = e.target.closest(".case"); if (!el) return;
      e.preventDefault();
      glisse = true;
      depart = { r: Number(el.dataset.r), c: Number(el.dataset.c) };
      courant = { ...depart };
      surligner();
      afficherBulle(courant);
    });
    conteneur.addEventListener("mouseover", e => {
      if (!glisse) return;
      const el = e.target.closest(".case"); if (!el) return;
      courant = { r: Number(el.dataset.r), c: Number(el.dataset.c) };
      surligner();
      afficherBulle(courant);
    });
    window.addEventListener("mouseup", () => { if (glisse) { valider(); cacherBulle(); } });

    // Tactile
    conteneur.addEventListener("touchstart", e => {
      const el = e.target.closest(".case"); if (!el) return;
      e.preventDefault();
      glisse = true;
      depart = { r: Number(el.dataset.r), c: Number(el.dataset.c) };
      courant = { ...depart };
      surligner();
      afficherBulle(courant);
    }, { passive: false });
    conteneur.addEventListener("touchmove", e => {
      if (!glisse) return;
      e.preventDefault();
      const t = e.touches[0];
      const pos = caseDepuisPoint(t.clientX, t.clientY);
      if (pos) { courant = pos; surligner(); afficherBulle(courant); }
    }, { passive: false });
    window.addEventListener("touchend", () => { if (glisse) { valider(); cacherBulle(); } });

    window.addEventListener("resize", () => { if (puzzle) dessiner(); });

    return {
      /* Vrai si le joueur a le doigt/la souris posé en train de tracer un mot */
      enCours() { return glisse; },
      charger(mots, tailleMin, motsClbles, tailleMax) {
        puzzle = generer(mots, tailleMin, tailleMax);
        trouves = [];
        cibles = motsClbles || null;
        dessiner();
        majListe();
        return puzzle;
      },
      /* Révèle la première lettre d'un mot non trouvé.
         Retourne le mot ciblé, ou null s'il n'y a plus rien à révéler. */
      indice() {
        if (!puzzle) return null;
        const dejaTrouves = new Set(trouves.map(f => f.mot));
        const candidats = puzzle.placements.filter(p => {
          if (dejaTrouves.has(p.mot)) return false;
          if (cibles && !cibles.includes(p.mot)) return false;
          return true;
        });
        if (!candidats.length) return null;

        // On prend le mot le plus court (le plus facile à finir)
        candidats.sort((a, b) => a.mot.length - b.mot.length);
        const choisi = candidats[0];
        const pos = choisi.cases[0];
        const el = conteneur.querySelector('[data-r="' + pos.r + '"][data-c="' + pos.c + '"]');
        if (el) {
          el.classList.add("indice");
          // L'éclat s'estompe mais la case reste marquée
          setTimeout(() => el.classList.add("indice-pose"), 1400);
        }
        return { mot: choisi.mot, lettre: puzzle.grille[pos.r][pos.c], position: pos };
      },

      /* Exporte l'état complet de la partie (pour la sauvegarde) */
      exporter() {
        if (!puzzle) return null;
        return {
          grille: puzzle.grille,
          taille: puzzle.taille,
          placements: puzzle.placements,
          trouves: trouves.map(f => f.mot),
          cibles: cibles
        };
      },

      /* Restaure une partie sauvegardée */
      restaurer(etat) {
        if (!etat || !etat.grille || !etat.placements) return false;
        puzzle = {
          grille: etat.grille,
          taille: etat.taille,
          placements: etat.placements,
          nonPlaces: []
        };
        cibles = etat.cibles || null;
        const set = new Set(etat.trouves || []);
        trouves = puzzle.placements.filter(p => set.has(p.mot));
        dessiner();
        majListe();
        return true;
      },

      definirCibles(liste) {
        cibles = liste && liste.length ? liste : null;
        majListe();
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

/* BiZouk — partage d'une victoire (image + texte + lien) */
(function () {
  const FOND = "#1c1b21";
  const FOND_2 = "#26252d";
  const BLANC = "#f5f3f8";
  const DOUX = "#a09aae";
  const VIOLET = "#a78bfa";
  const TEINTES = { vert:"#34d399", jaune:"#f0b429", rose:"#f472b6", violet:"#a78bfa" };

  function melangeCouleur(hex, ratio) {
    const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    const fr = 28, fg = 27, fb = 33;
    return "rgb(" + Math.round(r*ratio + fr*(1-ratio)) + "," +
                    Math.round(g*ratio + fg*(1-ratio)) + "," +
                    Math.round(b*ratio + fb*(1-ratio)) + ")";
  }

  function lignes(ctx, texte, maxW) {
    const mots = texte.split(/\s+/);
    const out = []; let ligne = "";
    for (const mot of mots) {
      const test = ligne ? ligne + " " + mot : mot;
      if (ctx.measureText(test).width > maxW && ligne) { out.push(ligne); ligne = mot; }
      else ligne = test;
    }
    if (ligne) out.push(ligne);
    return out;
  }

  /* Dessine une gemme sur le canvas */
  function dessinerGemme(ctx, x, y, taille, couleur) {
    const c = TEINTES[couleur] || VIOLET;
    const h = taille * 1.1;
    ctx.save();
    ctx.translate(x, y);
    // Corps
    const g = ctx.createLinearGradient(0, -h/2, taille/3, h/2);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.35, c);
    g.addColorStop(1, melangeCouleur(c, 0.45));
    ctx.beginPath();
    ctx.moveTo(0, -h/2);
    ctx.lineTo(taille/2, -h/2 + taille*0.33);
    ctx.lineTo(0, h/2);
    ctx.lineTo(-taille/2, -h/2 + taille*0.33);
    ctx.closePath();
    ctx.fillStyle = g; ctx.fill();
    // Table
    ctx.beginPath();
    ctx.moveTo(0, -h/2);
    ctx.lineTo(-taille*0.18, -h/2 + taille*0.33);
    ctx.lineTo(taille*0.18, -h/2 + taille*0.33);
    ctx.closePath();
    ctx.fillStyle = "rgba(255,255,255,.45)"; ctx.fill();
    // Éclat
    ctx.beginPath();
    ctx.moveTo(-taille*0.08, -h/2 + taille*0.1);
    ctx.lineTo(-taille*0.14, -h/2 + taille*0.3);
    ctx.lineTo(-taille*0.04, -h/2 + taille*0.3);
    ctx.closePath();
    ctx.fillStyle = "rgba(255,255,255,.75)"; ctx.fill();
    ctx.restore();
  }

  /* Génère l'image de victoire (carré 1080x1080) */
  function dessiner(info) {
    const W = 1080, H = 1080;
    const cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    const ctx = cv.getContext("2d");

    // Fond dégradé
    const g = ctx.createLinearGradient(0, 0, W*0.7, H);
    g.addColorStop(0, melangeCouleur("#7c3aed", 0.26));
    g.addColorStop(0.55, FOND_2);
    g.addColorStop(1, FOND);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    // Barre du haut
    const bg = ctx.createLinearGradient(0, 0, W, 0);
    bg.addColorStop(0, TEINTES.vert);
    bg.addColorStop(0.5, TEINTES.jaune);
    bg.addColorStop(1, TEINTES.rose);
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, 12);

    const marge = 90;

    // Logo BiZouk
    ctx.textAlign = "left";
    ctx.font = "700 40px Georgia, serif";
    ctx.fillStyle = BLANC;
    ctx.fillText("Bi", marge, 130);
    const wBi = ctx.measureText("Bi").width;
    ctx.fillStyle = VIOLET;
    ctx.fillText("Zouk", marge + wBi, 130);

    // Mention
    ctx.textAlign = "right";
    ctx.font = "600 24px Inter, system-ui, sans-serif";
    ctx.fillStyle = DOUX;
    ctx.letterSpacing = "3px";
    ctx.fillText("MOTS MÊLÉS", W - marge, 130);
    ctx.letterSpacing = "0px";

    // Titre principal
    ctx.textAlign = "center";
    ctx.font = "700 88px Georgia, serif";
    ctx.fillStyle = BLANC;
    ctx.fillText("Chapitre", W/2, 320);
    ctx.fillStyle = TEINTES.vert;
    ctx.fillText("terminé", W/2, 420);

    // Nom du chapitre
    ctx.font = "500 40px Georgia, serif";
    ctx.fillStyle = VIOLET;
    const ls = lignes(ctx, info.chapitre || "", W - marge*2);
    let y = 500;
    ls.slice(0,2).forEach(l => { ctx.fillText(l, W/2, y); y += 52; });

    // Thème
    if (info.theme) {
      ctx.font = "400 28px Inter, system-ui, sans-serif";
      ctx.fillStyle = DOUX;
      ctx.fillText(info.theme, W/2, y + 8);
    }

    // Les trois gemmes
    const yGem = 700;
    const espace = 150;
    ["vert","jaune","rose"].forEach((c, i) => {
      dessinerGemme(ctx, W/2 + (i-1)*espace, yGem, 92, c);
    });

    // Total de pierres
    ctx.font = "700 52px Georgia, serif";
    ctx.fillStyle = BLANC;
    ctx.fillText("+" + (info.pierres || 9) + " pierres BiZouk", W/2, yGem + 130);

    // Joueur
    if (info.joueur) {
      ctx.font = "500 34px Inter, system-ui, sans-serif";
      ctx.fillStyle = DOUX;
      ctx.fillText("par " + info.joueur, W/2, yGem + 182);
    }

    // Pied
    ctx.font = "400 26px Inter, system-ui, sans-serif";
    ctx.fillStyle = "#726c80";
    ctx.fillText("Joue toi aussi sur BiZouk", W/2, H - 60);

    return cv;
  }


  /* Image d'un niveau réussi (1080x1080) */
  function dessinerNiveau(info) {
    const W = 1080, H = 1080;
    const cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    const ctx = cv.getContext("2d");

    const teinte = info.niveau === "Confirmé" ? TEINTES.jaune : TEINTES.vert;

    const g = ctx.createLinearGradient(0, 0, W*0.7, H);
    g.addColorStop(0, melangeCouleur(teinte, 0.22));
    g.addColorStop(0.55, FOND_2);
    g.addColorStop(1, FOND);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = teinte; ctx.fillRect(0, 0, W, 12);

    const marge = 90;
    ctx.textAlign = "left";
    ctx.font = "700 40px Georgia, serif";
    ctx.fillStyle = BLANC;
    ctx.fillText("Bi", marge, 130);
    const wBi = ctx.measureText("Bi").width;
    ctx.fillStyle = VIOLET;
    ctx.fillText("Zouk", marge + wBi, 130);

    ctx.textAlign = "right";
    ctx.font = "600 24px Inter, system-ui, sans-serif";
    ctx.fillStyle = DOUX;
    ctx.letterSpacing = "3px";
    ctx.fillText("MOTS MÊLÉS", W - marge, 130);
    ctx.letterSpacing = "0px";

    ctx.textAlign = "center";
    ctx.font = "700 82px Georgia, serif";
    ctx.fillStyle = BLANC;
    ctx.fillText("Niveau", W/2, 300);
    ctx.fillStyle = teinte;
    ctx.fillText("réussi", W/2, 396);

    ctx.font = "500 38px Georgia, serif";
    ctx.fillStyle = VIOLET;
    const ls = lignes(ctx, info.chapitre || "", W - marge*2);
    let y = 480;
    ls.slice(0,2).forEach(l => { ctx.fillText(l, W/2, y); y += 50; });

    ctx.font = "400 28px Inter, system-ui, sans-serif";
    ctx.fillStyle = DOUX;
    ctx.fillText((info.niveau || "") + " · " + (info.mots || 0) + " mots", W/2, y + 6);

    // Le temps, en grand
    ctx.font = "700 128px Georgia, serif";
    ctx.fillStyle = TEINTES.jaune;
    ctx.fillText(info.temps || "0:00", W/2, 730);
    ctx.font = "400 30px Inter, system-ui, sans-serif";
    ctx.fillStyle = DOUX;
    ctx.fillText("temps réalisé", W/2, 778);

    // Pierres gagnées
    if (info.pierres) {
      const coul = info.niveau === "Confirmé" ? "jaune" : "vert";
      dessinerGemme(ctx, W/2 - 70, 880, 64, coul);
      ctx.textAlign = "left";
      ctx.font = "700 44px Georgia, serif";
      ctx.fillStyle = BLANC;
      ctx.fillText("+" + info.pierres + " pierres", W/2 - 20, 896);
      ctx.textAlign = "center";
    }

    if (info.joueur) {
      ctx.font = "500 30px Inter, system-ui, sans-serif";
      ctx.fillStyle = DOUX;
      ctx.fillText("par " + info.joueur, W/2, 960);
    }

    ctx.font = "400 26px Inter, system-ui, sans-serif";
    ctx.fillStyle = "#726c80";
    ctx.fillText("Bats mon temps sur BiZouk", W/2, H - 55);

    return cv;
  }


  /* Image de résultat de duel (1080x1080) */
  function dessinerDuel(info) {
    const W = 1080, H = 1080;
    const cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    const ctx = cv.getContext("2d");
    const d = info.duel || {};
    const gagne = !!d.gagne;
    const teinte = gagne ? TEINTES.vert : "#fb923c";

    const g = ctx.createLinearGradient(0, 0, W*0.7, H);
    g.addColorStop(0, melangeCouleur(teinte, 0.2));
    g.addColorStop(0.55, FOND_2);
    g.addColorStop(1, FOND);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    // Bandeau haut bicolore
    const bg = ctx.createLinearGradient(0, 0, W, 0);
    bg.addColorStop(0, "#a78bfa");
    bg.addColorStop(0.5, FOND_2);
    bg.addColorStop(1, "#fb923c");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, 12);

    const marge = 90;
    ctx.textAlign = "left";
    ctx.font = "700 40px Georgia, serif";
    ctx.fillStyle = BLANC;
    ctx.fillText("Bi", marge, 128);
    const wBi = ctx.measureText("Bi").width;
    ctx.fillStyle = VIOLET;
    ctx.fillText("Zouk", marge + wBi, 128);

    ctx.textAlign = "right";
    ctx.font = "600 24px Inter, system-ui, sans-serif";
    ctx.fillStyle = DOUX;
    ctx.letterSpacing = "3px";
    ctx.fillText("DUEL", W - marge, 128);
    ctx.letterSpacing = "0px";

    // Titre
    ctx.textAlign = "center";
    ctx.font = "700 76px Georgia, serif";
    ctx.fillStyle = BLANC;
    ctx.fillText(gagne ? "Duel" : "Belle", W/2, 268);
    ctx.fillStyle = teinte;
    ctx.fillText(gagne ? "remporté" : "bataille", W/2, 356);

    // Nom de la grille
    ctx.font = "500 34px Georgia, serif";
    ctx.fillStyle = VIOLET;
    const ls = lignes(ctx, info.chapitre || "", W - marge*2);
    ctx.fillText(ls[0] || "", W/2, 428);

    // Les deux combattants
    const yBloc = 520;
    const largeur = 380;
    const gauche = W/2 - largeur - 20;
    const droite = W/2 + 20;

    function combattant(x, nom, temps, estMoi, estGagnant) {
      // Fond
      ctx.fillStyle = estGagnant ? "rgba(52,211,153,.14)" : "rgba(255,255,255,.04)";
      ctx.strokeStyle = estGagnant ? TEINTES.vert : "#3d3947";
      ctx.lineWidth = 2;
      const r = 18;
      ctx.beginPath();
      ctx.moveTo(x + r, yBloc);
      ctx.arcTo(x + largeur, yBloc, x + largeur, yBloc + 210, r);
      ctx.arcTo(x + largeur, yBloc + 210, x, yBloc + 210, r);
      ctx.arcTo(x, yBloc + 210, x, yBloc, r);
      ctx.arcTo(x, yBloc, x + largeur, yBloc, r);
      ctx.closePath();
      ctx.fill(); ctx.stroke();

      // Avatar
      const cx = x + largeur/2;
      const grad = ctx.createLinearGradient(cx-34, yBloc+30, cx+34, yBloc+98);
      if (estMoi) { grad.addColorStop(0,"#c4b5fd"); grad.addColorStop(1,"#5b21b6"); }
      else { grad.addColorStop(0,"#fb923c"); grad.addColorStop(1,"#c2410c"); }
      ctx.beginPath();
      ctx.arc(cx, yBloc + 64, 34, 0, Math.PI*2);
      ctx.fillStyle = grad; ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.font = "700 32px Georgia, serif";
      ctx.textAlign = "center";
      ctx.fillText((nom||"?").charAt(0).toUpperCase(), cx, yBloc + 76);

      // Nom
      ctx.font = "600 26px Inter, system-ui, sans-serif";
      ctx.fillStyle = BLANC;
      let n = nom || "";
      while (ctx.measureText(n).width > largeur - 40 && n.length > 3) n = n.slice(0, -1);
      if (n !== nom) n += "…";
      ctx.fillText(n, cx, yBloc + 132);

      // Temps
      ctx.font = "700 46px Georgia, serif";
      ctx.fillStyle = estGagnant ? TEINTES.vert : DOUX;
      ctx.fillText(temps, cx, yBloc + 186);

      if (estGagnant) {
        ctx.font = "400 30px Inter, system-ui, sans-serif";
        ctx.fillText("🏆", x + largeur - 34, yBloc + 44);
      }
    }

    combattant(gauche, info.joueur, info.temps, true, gagne);
    combattant(droite, d.adversaire, d.sonTemps, false, !gagne);

    // VS au centre
    ctx.textAlign = "center";
    ctx.font = "700 40px Georgia, serif";
    ctx.fillStyle = "#726c80";
    ctx.fillText("VS", W/2, yBloc + 118);

    // Pied
    ctx.font = "500 30px Inter, system-ui, sans-serif";
    ctx.fillStyle = DOUX;
    ctx.fillText(gagne ? "Qui veut tenter sa chance ?" : "Je prends ma revanche bientôt", W/2, 850);

    ctx.font = "400 26px Inter, system-ui, sans-serif";
    ctx.fillStyle = "#726c80";
    ctx.fillText("Lance ton duel sur BiZouk", W/2, H - 55);

    return cv;
  }

  function versFichier(cv, nom) {
    return new Promise(resolve => {
      cv.toBlob(blob => {
        if (!blob) return resolve(null);
        resolve(new File([blob], nom + ".png", { type: "image/png" }));
      }, "image/png");
    });
  }

  function telecharger(cv, nom) {
    cv.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = nom + ".png";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, "image/png");
  }

  window.BiZoukPartage = {
    apercu(info) { return dessiner(info); },

    async partager(info) {
      const cv = dessiner(info);
      const fichier = await versFichier(cv, "bizouk-chapitre");
      const lien = location.origin + location.pathname.replace(/[^/]*$/, "") + "index.html";
      const texte = "J'ai terminé le chapitre « " + (info.chapitre || "") + " » sur BiZouk"
        + (info.pierres ? " et gagné " + info.pierres + " pierres" : "")
        + " ! À toi de jouer.";

      if (fichier && navigator.canShare && navigator.canShare({ files: [fichier] })) {
        try {
          await navigator.share({ files: [fichier], text: texte, url: lien });
          return "image";
        } catch (e) { if (e && e.name === "AbortError") return "annule"; }
      }
      if (navigator.share) {
        try {
          await navigator.share({ text: texte, url: lien });
          return "texte";
        } catch (e) { if (e && e.name === "AbortError") return "annule"; }
      }
      telecharger(cv, "bizouk-chapitre");
      return "telecharge";
    },

    apercuNiveau(info) { return dessinerNiveau(info); },

    async partagerNiveau(info) {
      const cv = dessinerNiveau(info);
      const fichier = await versFichier(cv, "bizouk-niveau");
      const lien = location.origin + location.pathname.replace(/[^/]*$/, "") + "index.html";
      const texte = "J'ai réussi « " + (info.chapitre || "") + " » (" + (info.niveau||"") + ") en "
        + (info.temps || "") + " sur BiZouk. Tu fais mieux ?";
      if (fichier && navigator.canShare && navigator.canShare({ files: [fichier] })) {
        try { await navigator.share({ files: [fichier], text: texte, url: lien }); return "image"; }
        catch (e) { if (e && e.name === "AbortError") return "annule"; }
      }
      if (navigator.share) {
        try { await navigator.share({ text: texte, url: lien }); return "texte"; }
        catch (e) { if (e && e.name === "AbortError") return "annule"; }
      }
      telecharger(cv, "bizouk-niveau");
      return "telecharge";
    },

    apercuDuel(info) { return dessinerDuel(info); },

    async partagerDuel(info) {
      const cv = dessinerDuel(info);
      const fichier = await versFichier(cv, "bizouk-duel");
      const lien = location.origin + location.pathname.replace(/[^/]*$/, "") + "index.html";
      const d = info.duel || {};
      const texte = d.gagne
        ? "J'ai battu " + (d.adversaire||"mon adversaire") + " en duel sur BiZouk (" + (info.temps||"") + " contre " + (d.sonTemps||"") + ") ! Qui veut essayer ?"
        : "Duel serré contre " + (d.adversaire||"mon adversaire") + " sur BiZouk. Je prends ma revanche !";
      if (fichier && navigator.canShare && navigator.canShare({ files: [fichier] })) {
        try { await navigator.share({ files: [fichier], text: texte, url: lien }); return "image"; }
        catch (e) { if (e && e.name === "AbortError") return "annule"; }
      }
      if (navigator.share) {
        try { await navigator.share({ text: texte, url: lien }); return "texte"; }
        catch (e) { if (e && e.name === "AbortError") return "annule"; }
      }
      telecharger(cv, "bizouk-duel");
      return "telecharge";
    },

    liensDuel(info) {
      const lien = location.origin + location.pathname.replace(/[^/]*$/, "") + "index.html";
      const d = info.duel || {};
      const t = encodeURIComponent(d.gagne
        ? "J'ai battu " + (d.adversaire||"") + " en duel sur BiZouk ! Qui veut essayer ?"
        : "Duel serré sur BiZouk. Je prends ma revanche !");
      const u = encodeURIComponent(lien);
      return {
        whatsapp: "https://wa.me/?text=" + t + "%20" + u,
        facebook: "https://www.facebook.com/sharer/sharer.php?u=" + u,
        x: "https://twitter.com/intent/tweet?text=" + t + "&url=" + u,
        telegram: "https://t.me/share/url?url=" + u + "&text=" + t
      };
    },

    liensNiveau(info) {
      const lien = location.origin + location.pathname.replace(/[^/]*$/, "") + "index.html";
      const t = encodeURIComponent("J'ai réussi « " + (info.chapitre||"") + " » en " + (info.temps||"") + " sur BiZouk. Tu fais mieux ?");
      const u = encodeURIComponent(lien);
      return {
        whatsapp: "https://wa.me/?text=" + t + "%20" + u,
        facebook: "https://www.facebook.com/sharer/sharer.php?u=" + u,
        x: "https://twitter.com/intent/tweet?text=" + t + "&url=" + u,
        telegram: "https://t.me/share/url?url=" + u + "&text=" + t
      };
    },

    liens(info) {
      const lien = location.origin + location.pathname.replace(/[^/]*$/, "") + "index.html";
      const t = encodeURIComponent("J'ai terminé le chapitre « " + (info.chapitre||"") + " » sur BiZouk ! À toi de jouer.");
      const u = encodeURIComponent(lien);
      return {
        whatsapp: "https://wa.me/?text=" + t + "%20" + u,
        facebook: "https://www.facebook.com/sharer/sharer.php?u=" + u,
        x: "https://twitter.com/intent/tweet?text=" + t + "&url=" + u,
        telegram: "https://t.me/share/url?url=" + u + "&text=" + t
      };
    }
  };
})();

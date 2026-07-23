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

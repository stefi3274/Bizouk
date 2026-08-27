/* BiZouk — accueil : thèmes avec décompte réel des mots (via leurs chapitres) */
(function () {
  const $ = id => document.getElementById(id);
  async function db() { return window.DB || (window.attendreDB ? await window.attendreDB(8000) : null); }
  const esc = s => (s || "").replace(/[&<>"']/g, c => (
    { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));

  const COULEURS = ["var(--violet-c)","var(--vert)","var(--or)","var(--rose)","#60a5fa","#fb923c","#2dd4bf","#e879f9"];

  async function chargerThemes() {
    const box = $("themesGrille");
    if (!box) return;

    const base = await db();
    if (!base) {
      box.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--texte-faible);padding:30px;font-style:italic">'
        + 'Impossible de charger les thèmes. Vérifie ta connexion.</p>';
      return;
    }
    const ent = await entrepriseId();
    if (!ent) {
      box.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--texte-faible);padding:30px;font-style:italic">'
        + 'Configuration en cours.</p>';
      return;
    }

    // On charge les thèmes ET leurs chapitres pour compter les mots réellement disponibles
    const [rT, rC] = await Promise.all([
      base.from("themes").select("id, nom, description")
        .eq("entreprise_id", ent).eq("publie", true).order("created_at", { ascending: false }),
      base.from("chapitres").select("id, theme_id, mots, ordre")
        .eq("entreprise_id", ent).eq("publie", true).order("ordre")
    ]);

    if (rT.error || !rT.data || !rT.data.length) {
      box.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--texte-faible);padding:30px;font-style:italic">'
        + 'Les premiers thèmes arrivent bientôt.</p>';
      return;
    }

    // Additionner les mots de tous les chapitres, par thème
    const parTheme = {};
    (rC.data || []).forEach(c => {
      const n = Array.isArray(c.mots) ? c.mots.length : 0;
      if (!parTheme[c.theme_id]) parTheme[c.theme_id] = { mots: 0, chapitres: 0, premierChapitre: null, ordreMin: 1e9 };
      parTheme[c.theme_id].mots += n;
      parTheme[c.theme_id].chapitres += 1;
      const o = (c.ordre === null || c.ordre === undefined) ? 1e9 : c.ordre;
      if (o < parTheme[c.theme_id].ordreMin) {
        parTheme[c.theme_id].ordreMin = o;
        parTheme[c.theme_id].premierChapitre = c.id;
      }
    });

    // N'afficher que les thèmes qui ont au moins un chapitre
    const themes = rT.data.filter(t => parTheme[t.id] && parTheme[t.id].chapitres > 0);
    if (!themes.length) {
      box.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--texte-faible);padding:30px;font-style:italic">'
        + 'Les premiers chapitres arrivent bientôt.</p>';
      return;
    }

    // Les cartes mènent directement au premier chapitre jouable du thème
    box.innerHTML = themes.map((t, i) => {
      const info = parTheme[t.id];
      const coul = COULEURS[i % COULEURS.length];
      const nbChap = info.chapitres;
      const premier = info.premierChapitre;
      const lien = 'parcours.html?theme=' + t.id;
      return '<a class="niv-carte" href="' + lien + '" style="--nc:' + coul + '">'
        + '<h3 style="margin-top:6px">' + esc(t.nom) + '</h3>'
        + (t.description ? '<p>' + esc(t.description) + '</p>' : '')
        + '<div class="niv-taille">'
        + nbChap + (nbChap > 1 ? ' chapitres' : ' chapitre')
        + ' · ' + info.mots + (info.mots > 1 ? ' mots' : ' mot')
        + '</div>'
        + '<div style="margin-top:12px;font-size:.85rem;font-weight:600;color:var(--nc)">Voir les chapitres →</div>'
        + '</a>';
    }).join("");
  }

  async function majAuth() {
    const base = await db();
    if (!base) return;
    const { data } = await base.auth.getSession();
    if (data.session) {
      const nav = $("navAuth");
      if (nav) { nav.textContent = "Mon compte"; nav.href = "compte.html"; }
      const inv = $("inviteCompte");
      if (inv) inv.style.display = "none";
    }
  }

  async function majSerie() {
    if (!window.Progression) return;
    await window.Progression.init();
    const P = window.Progression;
    const b = $("serieBadge"), n = $("serieNb");
    if (!b || !n) return;
    const s = P.serie();
    if (s > 0) {
      b.style.display = "inline-flex";
      n.textContent = s;
      const dejaJoue = P.aJoueAujourdhui();
      const danger = !dejaJoue && P.serieEnDanger && P.serieEnDanger();
      b.classList.toggle("eteinte", !dejaJoue);
      b.classList.toggle("danger", !!danger);
      b.title = dejaJoue
        ? s + " jours de suite · déjà joué aujourd'hui"
        : (danger
            ? "Ta série de " + s + " jours est en danger ! Joue aujourd'hui pour la sauver."
            : s + " jours de suite · joue aujourd'hui pour continuer !");
    } else {
      b.style.display = "none";
    }
  }

  function afficherOnboarding() {
    try {
      if (localStorage.getItem("bizouk_onboarding_vu") === "1") return;
    } catch (e) { return; }

    const etapes = [
      { icone: "👆", titre: "Trace un mot", texte: "Fais glisser ton doigt sur les lettres, dans n'importe quelle direction, pour tracer un mot caché dans la grille." },
      { icone: "💎", titre: "Gagne des pierres", texte: "Chaque niveau réussi te rapporte des pierres BiZouk, à dépenser pour débloquer des indices." },
      { icone: "🔥", titre: "Reviens chaque jour", texte: "Le défi du jour et ta série de jours consécutifs t'attendent — un peu chaque jour suffit." }
    ];
    let i = 0;

    const fenetre = document.createElement("div");
    fenetre.className = "info-app-fenetre on";
    document.body.appendChild(fenetre);

    function rendre() {
      const e = etapes[i];
      const dernier = i === etapes.length - 1;
      fenetre.innerHTML =
        '<div class="onb-carte">'
        + '<button type="button" class="onb-passer" id="onbPasser">Passer</button>'
        + '<div class="onb-icone">' + e.icone + '</div>'
        + '<h3 class="onb-titre">' + e.titre + '</h3>'
        + '<p class="onb-texte">' + e.texte + '</p>'
        + '<div class="onb-points">'
        + etapes.map((_, k) => '<span class="onb-point' + (k === i ? ' on' : '') + '"></span>').join("")
        + '</div>'
        + '<button type="button" class="btn btn-v" id="onbSuivant" style="width:100%">'
        + (dernier ? "Commencer !" : "Suivant") + '</button>'
        + '</div>';

      document.getElementById("onbPasser").onclick = fermer;
      document.getElementById("onbSuivant").onclick = () => {
        if (dernier) { fermer(); return; }
        i++; rendre();
      };
    }

    const fermer = () => {
      try { localStorage.setItem("bizouk_onboarding_vu", "1"); } catch (e) {}
      fenetre.remove();
    };
    fenetre.addEventListener("click", (e) => { if (e.target === fenetre) fermer(); });

    rendre();
  }

  chargerThemes();
  majAuth();
  majSerie();
  afficherOnboarding();

  // Parrainage : mémoriser ?parrain=... et l'attacher aux liens d'inscription
  (function () {
    const p = new URLSearchParams(location.search).get("parrain");
    if (p) { try { sessionStorage.setItem("bizouk_parrain", p); } catch (e) {} }
    const code = p || (() => { try { return sessionStorage.getItem("bizouk_parrain"); } catch (e) { return null; } })();
    if (code) {
      document.querySelectorAll('a[href="inscription.html"]').forEach(a => {
        a.href = "inscription.html?parrain=" + encodeURIComponent(code);
      });
    }
  })();
})();

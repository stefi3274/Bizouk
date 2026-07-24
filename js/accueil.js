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

  chargerThemes();
  majAuth();
})();

/* BiZouk — accueil : chargement des thèmes */
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

    const { data, error } = await base.from("themes")
      .select("id, nom, description, mots")
      .eq("entreprise_id", ent).eq("publie", true)
      .order("created_at", { ascending: false });

    if (error || !data || !data.length) {
      box.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--texte-faible);padding:30px;font-style:italic">'
        + 'Les premiers thèmes arrivent bientôt.</p>';
      return;
    }

    box.innerHTML = data.map((t, i) => {
      const nb = Array.isArray(t.mots) ? t.mots.length : 0;
      const coul = COULEURS[i % COULEURS.length];
      return '<a class="niv-carte" href="jeu.html?theme=' + t.id + '&niveau=15" style="--nc:' + coul + '">'
        + '<h3 style="margin-top:6px">' + esc(t.nom) + '</h3>'
        + (t.description ? '<p>' + esc(t.description) + '</p>' : '')
        + '<div class="niv-taille">' + nb + ' mots disponibles</div>'
        + '</a>';
    }).join("");
  }

  // Masquer l'invitation si déjà connecté
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

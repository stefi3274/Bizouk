/* BiZouk — classement */
(function () {
  const $ = id => document.getElementById(id);
  async function db() { return window.DB || (window.attendreDB ? await window.attendreDB(8000) : null); }
  const esc = s => (s || "").replace(/[&<>"']/g, c => (
    { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
  const fmt = s => Math.floor(s/60) + ":" + String(s%60).padStart(2,"0");
  const MEDAILLES = ["🥇","🥈","🥉"];

  let niveauActif = "tous";

  async function charger() {
    const zone = $("clsZone");
    zone.innerHTML = '<p style="text-align:center;color:var(--texte-faible);font-style:italic">Chargement…</p>';

    const base = await db();
    if (!base) { zone.innerHTML = '<div class="cls-vide"><h3>Connexion impossible</h3><p>Vérifie ta connexion internet et recharge la page.</p></div>'; return; }
    const ent = await entrepriseId();
    if (!ent) { zone.innerHTML = '<div class="cls-vide"><h3>Configuration en cours</h3><p>Le classement sera bientôt disponible.</p></div>'; return; }

    let req = base.from("parties").select("*").eq("entreprise_id", ent);
    if (niveauActif !== "tous") req = req.eq("niveau", parseInt(niveauActif,10));
    const { data, error } = await req.order("temps_sec", { ascending: true }).limit(300);

    if (error || !data || !data.length) {
      zone.innerHTML = '<div class="cls-vide">'
        + '<h3>Aucun temps enregistré</h3>'
        + '<p>Personne n\'a encore terminé de grille à ce niveau. Sois le premier à inscrire ton nom !</p>'
        + '<a href="index.html" class="btn btn-v btn-sm">Jouer maintenant</a></div>';
      return;
    }

    // Meilleur temps par joueur (le classement récompense la performance)
    const meilleurs = {};
    data.forEach(p => {
      const cle = p.user_id || p.joueur;
      if (!meilleurs[cle] || p.temps_sec < meilleurs[cle].temps_sec) meilleurs[cle] = p;
    });
    const liste = Object.values(meilleurs).sort((a,b) => a.temps_sec - b.temps_sec).slice(0, 50);

    // Nombre de grilles terminées par joueur
    const compte = {};
    data.forEach(p => { const c = p.user_id || p.joueur; compte[c] = (compte[c]||0) + 1; });

    zone.innerHTML =
      '<p style="text-align:center;color:var(--texte-doux);font-size:.92rem;margin-bottom:16px">'
      + liste.length + (liste.length > 1 ? ' joueurs classés' : ' joueur classé') + '</p>'
      + '<div class="cls-table">'
      + '<div class="cls-row cls-th"><span>Place</span><span>Joueur</span><span>Temps</span><span>Grilles</span></div>'
      + liste.map((p, i) => {
          const cle = p.user_id || p.joueur;
          return '<div class="cls-row' + (i < 3 ? ' cls-podium' : '') + '">'
            + '<span class="cls-place">' + (i < 3 ? MEDAILLES[i] : (i+1)) + '</span>'
            + '<span class="cls-nom">' + esc(p.joueur)
            + '<span class="cls-theme">' + esc(p.theme_nom || "—") + ' · ' + p.niveau + ' mots</span></span>'
            + '<span class="cls-temps">' + fmt(p.temps_sec) + '</span>'
            + '<span class="cls-niv">' + (compte[cle]||1) + '</span>'
            + '</div>';
        }).join("")
      + '</div>';
  }

  document.querySelectorAll(".cls-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".cls-chip").forEach(c => c.classList.toggle("on", c === chip));
      niveauActif = chip.getAttribute("data-niv");
      charger();
    });
  });

  (async () => {
    const base = await db(); if (!base) return;
    const { data } = await base.auth.getSession();
    if (data.session) { const n = $("navAuth"); if (n) { n.textContent = "Mon compte"; n.href = "compte.html"; } }
  })();

  charger();
})();

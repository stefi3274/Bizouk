/* BiZouk — statistiques personnelles (à partir de la table "parties") */
(function () {
  const $ = id => document.getElementById(id);
  async function db() { return window.DB || (window.attendreDB ? await window.attendreDB(8000) : null); }
  const esc = s => (s || "").replace(/[&<>"']/g, c => (
    { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
  const fmt = s => Math.floor(s/60) + ":" + String(Math.round(s)%60).padStart(2,"0");

  async function init() {
    const base = await db();
    if (!base) return;
    const { data: sess } = await base.auth.getSession();
    if (!sess.session) { $("nonConnecte").style.display = "block"; return; }
    $("connecte").style.display = "block";

    const monId = sess.session.user.id;
    const { data: parties } = await base.from("parties")
      .select("theme_nom, niveau, temps_sec, created_at")
      .eq("user_id", monId).order("created_at", { ascending: false });

    const liste = parties || [];
    if (!liste.length) {
      $("parTheme").innerHTML = '<p style="color:var(--texte-faible);font-style:italic;text-align:center">'
        + 'Aucune partie enregistrée pour l\'instant. Joue ta première grille !</p>';
      return;
    }

    // Stats globales
    const temps = liste.map(p => p.temps_sec).filter(t => t != null);
    const moyenne = temps.reduce((s,t) => s+t, 0) / temps.length;
    const meilleur = Math.min(...temps);
    const il7 = new Date(); il7.setDate(il7.getDate() - 7);
    const cetteSemaine = liste.filter(p => new Date(p.created_at) >= il7).length;

    $("statTotal").textContent = liste.length;
    $("statMoyen").textContent = fmt(moyenne);
    $("statMeilleur").textContent = fmt(meilleur);
    $("statSemaine").textContent = cetteSemaine;

    // 10 dernières parties (barres, la plus récente à droite)
    const recentes = liste.slice(0, 10).reverse();
    const maxTemps = Math.max(...recentes.map(p => p.temps_sec || 0), 1);
    $("barresRecentes").innerHTML = recentes.map(p => {
      const h = Math.max(6, Math.round((p.temps_sec / maxTemps) * 100));
      const rapide = p.temps_sec <= moyenne;
      return '<div class="barre-c">'
        + '<div class="barre" style="height:' + h + '%;background:' + (rapide ? 'var(--vert)' : 'var(--violet-c)') + '"></div>'
        + '<div class="barre-lab">' + fmt(p.temps_sec) + '</div>'
        + '</div>';
    }).join("");

    // Meilleur temps par thème
    const parTheme = {};
    liste.forEach(p => {
      const nom = p.theme_nom || "Sans thème";
      if (!parTheme[nom]) parTheme[nom] = { meilleur: Infinity, nb: 0 };
      parTheme[nom].nb++;
      if (p.temps_sec < parTheme[nom].meilleur) parTheme[nom].meilleur = p.temps_sec;
    });
    const themesTries = Object.entries(parTheme).sort((a,b) => a[1].meilleur - b[1].meilleur);
    $("parTheme").innerHTML = themesTries.map(([nom, info]) =>
      '<div class="theme-ligne">'
      + '<span><span class="theme-nom">' + esc(nom) + '</span><br>'
      + '<span class="theme-detail">' + info.nb + ' partie' + (info.nb>1?'s':'') + '</span></span>'
      + '<span class="theme-temps">' + fmt(info.meilleur) + '</span>'
      + '</div>'
    ).join("");
  }

  init();
})();

/* BiZouk — duels Bombe : même grille de leurres, même mot cible, on compare qui désamorce */
(function () {
  async function db() { return window.DB || (window.attendreDB ? await window.attendreDB(8000) : null); }

  function genererCode() {
    const lettres = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let c = "";
    for (let i = 0; i < 6; i++) c += lettres[Math.floor(Math.random() * lettres.length)];
    return c;
  }

  const API = {
    async creer(info) {
      const base = await db();
      if (!base) return null;
      const ent = await entrepriseId();
      if (!ent) return null;

      let user = null;
      const { data: sess } = await base.auth.getSession();
      if (sess.session) user = sess.session.user;

      let code, essais = 0, cree = null;
      while (essais < 6 && !cree) {
        code = genererCode();
        const { data, error } = await base.from("duels_bombe").insert({
          entreprise_id: ent,
          code: code,
          chapitre_id: info.chapitreId || null,
          chapitre_nom: info.chapitreNom || null,
          mots: info.mots || [],
          cible: info.cible,
          lanceur_nom: info.joueur || "Un joueur",
          lanceur_id: user ? user.id : null,
          lanceur_temps: info.temps != null ? info.temps : null,
          lanceur_reussi: !!info.reussi,
          statut: "ouvert"
        }).select("*").single();
        if (!error) cree = data;
        essais++;
      }
      return cree;
    },

    async lire(code) {
      const base = await db();
      if (!base) return null;
      const { data } = await base.from("duels_bombe").select("*")
        .eq("code", (code || "").toUpperCase()).maybeSingle();
      return data;
    },

    async repondre(code, info) {
      const base = await db();
      if (!base) return null;
      const { data, error } = await base.from("duels_bombe").update({
        joueur_id: info.userId || null,
        joueur_nom: info.joueur,
        joueur_temps: info.temps != null ? info.temps : null,
        joueur_reussi: !!info.reussi,
        statut: "termine"
      }).eq("code", (code || "").toUpperCase()).select("*").single();
      return error ? null : data;
    },

    lien(code) { return location.origin + "/duel-bombe.html?code=" + code; }
  };

  window.BiZoukDuelBombe = API;
})();

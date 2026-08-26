/* BiZouk — duels en différé : je joue, j'envoie le défi, l'ami joue, on compare */
(function () {
  async function db() { return window.DB || (window.attendreDB ? await window.attendreDB(8000) : null); }

  /* Code court et lisible pour partager un duel */
  function genererCode() {
    const lettres = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";  // sans I, O, 0, 1 (confusion)
    let c = "";
    for (let i = 0; i < 6; i++) c += lettres[Math.floor(Math.random() * lettres.length)];
    return c;
  }

  const API = {
    /* Créer un duel après avoir terminé une grille */
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
        const { data, error } = await base.from("duels").insert({
          entreprise_id: ent,
          code: code,
          chapitre_id: info.chapitreId || null,
          chapitre_nom: info.chapitreNom || null,
          niveau: info.niveau,
          mots: info.mots || [],
          lanceur_nom: info.joueur || "Un joueur",
          lanceur_id: user ? user.id : null,
          lanceur_temps: info.temps,
          destinataire_id: info.destinataireId || null,
          destinataire_nom: info.destinataireNom || null,
          statut: "ouvert"
        }).select("*").single();
        if (!error) cree = data;
        essais++;
      }
      return cree;
    },

    /* Récupérer un duel par son code */
    async lire(code) {
      const base = await db();
      if (!base || !code) return null;
      const { data } = await base.from("duels").select("*")
        .eq("code", code.toUpperCase().trim()).maybeSingle();
      return data || null;
    },

    /* Enregistrer le résultat de l'adversaire */
    async repondre(code, nom, temps) {
      const base = await db();
      if (!base) return null;
      let user = null;
      const { data: sess } = await base.auth.getSession();
      if (sess.session) user = sess.session.user;

      const { data, error } = await base.from("duels").update({
        adversaire_nom: nom || "Un joueur",
        adversaire_id: user ? user.id : null,
        adversaire_temps: temps,
        statut: "termine"
      }).eq("code", code.toUpperCase().trim()).eq("statut", "ouvert").select("*").maybeSingle();

      if (error) return null;
      return data;
    },

    /* Lien à partager */
    lien(code) {
      return location.origin + location.pathname.replace(/[^/]*$/, "") + "duel.html?code=" + code;
    },

    /* Mes duels (si connecté), y compris ceux qui me sont adressés directement */
    async mesDuels() {
      const base = await db();
      if (!base) return [];
      const { data: sess } = await base.auth.getSession();
      if (!sess.session) return [];
      const uid = sess.session.user.id;
      const { data } = await base.from("duels").select("*")
        .or("lanceur_id.eq." + uid + ",adversaire_id.eq." + uid + ",destinataire_id.eq." + uid)
        .order("created_at", { ascending: false }).limit(30);
      return data || [];
    },

    /* Rechercher un joueur par pseudo, parmi ceux qui ont déjà joué au moins une grille */
    async chercherJoueur(pseudo) {
      const base = await db();
      if (!base || !pseudo || pseudo.trim().length < 2) return [];
      const ent = await entrepriseId();
      if (!ent) return [];
      const { data: sess } = await base.auth.getSession();
      const monId = sess.session ? sess.session.user.id : null;

      const { data } = await base.from("parties").select("user_id, joueur")
        .eq("entreprise_id", ent).ilike("joueur", "%" + pseudo.trim() + "%").limit(50);

      const vus = new Set(); const resultats = [];
      (data || []).forEach(p => {
        if (!p.user_id || vus.has(p.user_id) || p.user_id === monId) return;
        vus.add(p.user_id);
        resultats.push({ userId: p.user_id, joueur: p.joueur });
      });
      return resultats.slice(0, 10);
    }
  };

  window.BiZoukDuel = API;
})();

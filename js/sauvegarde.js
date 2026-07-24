/* BiZouk — sauvegarde automatique d'une partie en cours
   Permet de reprendre exactement où on s'est arrêté après une fermeture. */
(function () {
  const PREFIXE = "bizouk_partie_";
  const DUREE_VIE = 24 * 60 * 60 * 1000;   // une sauvegarde expire après 24 h

  /* Identifiant unique d'une partie selon son contexte */
  function cle(contexte) {
    const c = contexte || {};
    if (c.type === "defi") return PREFIXE + "defi_" + (c.jour || "");
    if (c.type === "duel") return PREFIXE + "duel_" + (c.code || "");
    return PREFIXE + "jeu_" + (c.chapitre || "libre") + "_" + (c.niveau || "");
  }

  const API = {
    /* Enregistre l'état de la partie */
    sauver(contexte, etatJeu, tempsEcoule) {
      if (!etatJeu) return;
      try {
        const paquet = {
          date: Date.now(),
          contexte: contexte,
          etat: etatJeu,
          temps: tempsEcoule || 0
        };
        localStorage.setItem(cle(contexte), JSON.stringify(paquet));
      } catch (e) { /* espace insuffisant : on ignore */ }
    },

    /* Récupère une sauvegarde si elle existe et n'a pas expiré */
    lire(contexte) {
      try {
        const brut = localStorage.getItem(cle(contexte));
        if (!brut) return null;
        const p = JSON.parse(brut);
        if (!p || !p.etat) return null;
        if (Date.now() - (p.date || 0) > DUREE_VIE) { this.effacer(contexte); return null; }
        // Une partie terminée n'a pas à être restaurée
        const tot = (p.etat.placements || []).length;
        const tr = (p.etat.trouves || []).length;
        if (tot && tr >= tot) { this.effacer(contexte); return null; }
        return p;
      } catch { return null; }
    },

    effacer(contexte) {
      try { localStorage.removeItem(cle(contexte)); } catch {}
    },

    /* Nettoie toutes les sauvegardes expirées */
    nettoyer() {
      try {
        const aSupprimer = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (!k || k.indexOf(PREFIXE) !== 0) continue;
          try {
            const p = JSON.parse(localStorage.getItem(k));
            if (!p || Date.now() - (p.date || 0) > DUREE_VIE) aSupprimer.push(k);
          } catch { aSupprimer.push(k); }
        }
        aSupprimer.forEach(k => localStorage.removeItem(k));
      } catch {}
    },

    /* Y a-t-il une partie en cours, quelle qu'elle soit ? */
    partieEnCours() {
      try {
        let meilleure = null;
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (!k || k.indexOf(PREFIXE) !== 0) continue;
          const p = JSON.parse(localStorage.getItem(k));
          if (!p || !p.etat) continue;
          if (Date.now() - (p.date || 0) > DUREE_VIE) continue;
          const tot = (p.etat.placements || []).length;
          const tr = (p.etat.trouves || []).length;
          if (!tot || tr >= tot) continue;
          if (!meilleure || p.date > meilleure.date) meilleure = p;
        }
        return meilleure;
      } catch { return null; }
    }
  };

  API.nettoyer();
  window.BiZoukSauvegarde = API;
})();

/* BiZouk — progression : chapitres, niveaux, pierres BiZouk, bombes
   Un chapitre = 2 niveaux (15 et 20 mots) + 1 bombe.
   Fonctionne sans compte (navigateur) et avec compte (synchronisé). */
(function () {
  const CLE = "bizouk_progression";
  const COULEURS = { 15: "vert", 20: "jaune" };
  const PRIX_DEBLOCAGE = 5;
  const PRIX_INDICE = 1;
  const GAIN_PAR_NIVEAU = 3;
  const GAIN_BOMBE = 3;
  const BLOCAGE_MS = 2 * 60 * 1000;

  async function db() { return window.DB || (window.attendreDB ? await window.attendreDB(6000) : null); }

  function vide() {
    return {
      niveaux_reussis: [],   // ex. "chapId-15", "chapId-20"
      bombes_reussies_ids: [],  // ids de chapitres dont la bombe est passée
      bizouk_vert: 0, bizouk_jaune: 0, bizouk_rose: 0,
      bombes_reussies: 0, bombes_ratees: 0,
      bloque_jusqua: null
    };
  }

  function lireLocal() {
    try {
      const s = localStorage.getItem(CLE);
      if (!s) return vide();
      return Object.assign(vide(), JSON.parse(s));
    } catch { return vide(); }
  }
  function ecrireLocal(p) { try { localStorage.setItem(CLE, JSON.stringify(p)); } catch {} }

  let etat = lireLocal();
  let utilisateur = null;
  let charge = false;

  async function chargerDepuisCompte() {
    const base = await db();
    if (!base) return null;
    const { data: sess } = await base.auth.getSession();
    if (!sess.session) { utilisateur = null; return null; }
    utilisateur = sess.session.user;

    const { data, error } = await base.from("progression")
      .select("*").eq("user_id", utilisateur.id).maybeSingle();
    if (error) return null;

    if (!data) {
      const nom = (utilisateur.user_metadata && utilisateur.user_metadata.nom)
        ? utilisateur.user_metadata.nom : (utilisateur.email||"").split("@")[0];
      const ent = await entrepriseId();
      const local = lireLocal();
      const nouveau = {
        user_id: utilisateur.id, entreprise_id: ent, joueur: nom,
        niveaux_reussis: local.niveaux_reussis || [],
        bombes_reussies_ids: local.bombes_reussies_ids || [],
        bizouk_vert: local.bizouk_vert||0, bizouk_jaune: local.bizouk_jaune||0, bizouk_rose: local.bizouk_rose||0,
        bombes_reussies: local.bombes_reussies||0, bombes_ratees: local.bombes_ratees||0,
        bloque_jusqua: local.bloque_jusqua || null
      };
      await base.from("progression").insert(nouveau);
      return nouveau;
    }
    return data;
  }

  async function charger() {
    if (charge) return etat;
    const distant = await chargerDepuisCompte();
    if (distant) {
      const local = lireLocal();
      etat = {
        niveaux_reussis: [...new Set([...(distant.niveaux_reussis||[]), ...(local.niveaux_reussis||[])])],
        bombes_reussies_ids: [...new Set([...(distant.bombes_reussies_ids||[]), ...(local.bombes_reussies_ids||[])])],
        bizouk_vert: Math.max(distant.bizouk_vert||0, local.bizouk_vert||0),
        bizouk_jaune: Math.max(distant.bizouk_jaune||0, local.bizouk_jaune||0),
        bizouk_rose: Math.max(distant.bizouk_rose||0, local.bizouk_rose||0),
        bombes_reussies: Math.max(distant.bombes_reussies||0, local.bombes_reussies||0),
        bombes_ratees: Math.max(distant.bombes_ratees||0, local.bombes_ratees||0),
        bloque_jusqua: distant.bloque_jusqua || local.bloque_jusqua || null
      };
      ecrireLocal(etat);
      await sauver();
    } else {
      etat = lireLocal();
    }
    charge = true;
    return etat;
  }

  async function sauver() {
    ecrireLocal(etat);
    if (!utilisateur) return;
    const base = await db();
    if (!base) return;
    await base.from("progression").update({
      niveaux_reussis: etat.niveaux_reussis,
      bombes_reussies_ids: etat.bombes_reussies_ids,
      bizouk_vert: etat.bizouk_vert, bizouk_jaune: etat.bizouk_jaune, bizouk_rose: etat.bizouk_rose,
      bombes_reussies: etat.bombes_reussies, bombes_ratees: etat.bombes_ratees,
      bloque_jusqua: etat.bloque_jusqua, maj: new Date().toISOString()
    }).eq("user_id", utilisateur.id);
  }

  const API = {
    async init() { return await charger(); },
    etat() { return etat; },
    connecte() { return !!utilisateur; },
    total() { return etat.bizouk_vert + etat.bizouk_jaune + etat.bizouk_rose; },
    detail() { return { vert: etat.bizouk_vert, jaune: etat.bizouk_jaune, rose: etat.bizouk_rose }; },

    // ---------- Niveaux d'un chapitre ----------
    reussi(chapId, niveau) { return etat.niveaux_reussis.includes(chapId + "-" + niveau); },
    bombeFaite(chapId) { return etat.bombes_reussies_ids.includes(chapId); },

    // Le niveau 15 est ouvert si le chapitre l'est ; le 20 si le 15 est réussi
    niveauOuvert(chapId, niveau, chapitreOuvert) {
      if (!chapitreOuvert) return false;
      if (niveau === 15) return true;
      return this.reussi(chapId, 15);
    },
    bombeOuverte(chapId, chapitreOuvert) {
      return !!chapitreOuvert && this.reussi(chapId, 15) && this.reussi(chapId, 20);
    },
    // Un chapitre est terminé quand ses 2 niveaux ET sa bombe sont passés
    chapitreFini(chapId) {
      return this.reussi(chapId, 15) && this.reussi(chapId, 20) && this.bombeFaite(chapId);
    },

    async gagnerNiveau(chapId, niveau) {
      const cle = chapId + "-" + niveau;
      const nouveau = !etat.niveaux_reussis.includes(cle);
      if (nouveau) {
        etat.niveaux_reussis.push(cle);
        const coul = COULEURS[niveau] || "vert";
        etat["bizouk_" + coul] += GAIN_PAR_NIVEAU;
        await sauver();
      }
      return { nouveau, gain: nouveau ? GAIN_PAR_NIVEAU : 0, couleur: COULEURS[niveau] || "vert" };
    },

    // ---------- Bombe ----------
    bloque() { return !!etat.bloque_jusqua && new Date(etat.bloque_jusqua).getTime() > Date.now(); },
    resteBlocageMs() {
      if (!etat.bloque_jusqua) return 0;
      return Math.max(0, new Date(etat.bloque_jusqua).getTime() - Date.now());
    },
    async bombeReussie(chapId) {
      etat.bombes_reussies++;
      etat.bloque_jusqua = null;
      let gain = 0;
      if (chapId && !etat.bombes_reussies_ids.includes(chapId)) {
        etat.bombes_reussies_ids.push(chapId);
        etat.bizouk_rose += GAIN_BOMBE;
        gain = GAIN_BOMBE;
      }
      await sauver();
      return { gain };
    },
    async bombeRatee() {
      etat.bombes_ratees++;
      etat.bloque_jusqua = new Date(Date.now() + BLOCAGE_MS).toISOString();
      await sauver();
    },
    peutPayer() { return this.total() >= PRIX_DEBLOCAGE; },
    prix() { return PRIX_DEBLOCAGE; },
    async payerDeblocage() {
      if (!this.peutPayer()) return false;
      let reste = PRIX_DEBLOCAGE;
      const ordre = ["vert","jaune","rose"].sort((a,b) => etat["bizouk_"+b] - etat["bizouk_"+a]);
      for (const c of ordre) {
        const pris = Math.min(etat["bizouk_"+c], reste);
        etat["bizouk_"+c] -= pris; reste -= pris;
        if (reste <= 0) break;
      }
      etat.bloque_jusqua = null;
      await sauver();
      return true;
    },
    // Récompense de contribution (créditée par l'admin)
    async recompenser(nb, couleur) {
      const c = couleur || "violet";
      const cible = (c === "violet") ? "rose" : c;   // pas de pierre violette en stock
      etat["bizouk_" + cible] += (nb || 0);
      await sauver();
      return { gain: nb, couleur: cible };
    },

    // ---------- Indices ----------
    prixIndice() { return PRIX_INDICE; },
    peutIndice() { return this.total() >= PRIX_INDICE; },

    async payerIndice() {
      if (!this.peutIndice()) return false;
      let reste = PRIX_INDICE;
      const ordre = ["vert","jaune","rose"].sort((a,b) => etat["bizouk_"+b] - etat["bizouk_"+a]);
      for (const c of ordre) {
        const pris = Math.min(etat["bizouk_"+c], reste);
        etat["bizouk_"+c] -= pris; reste -= pris;
        if (reste <= 0) break;
      }
      await sauver();
      return true;
    },

    async reinitialiser() { etat = vide(); await sauver(); }
  };

  window.Progression = API;
})();

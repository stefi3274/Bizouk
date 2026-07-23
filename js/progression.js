/* BiZouk — progression du joueur : niveaux réussis, pierres BiZouk, blocage bombe
   Fonctionne sans compte (navigateur) et avec compte (Supabase, synchronisé). */
(function () {
  const CLE = "bizouk_progression";
  const COULEURS = { 15: "vert", 20: "jaune", 25: "rose" };
  const PRIX_DEBLOCAGE = 5;
  const GAIN_PAR_NIVEAU = 3;
  const BLOCAGE_MS = 2 * 60 * 1000;   // 2 minutes

  async function db() { return window.DB || (window.attendreDB ? await window.attendreDB(6000) : null); }

  function vide() {
    return {
      niveaux_reussis: [],
      bizouk_vert: 0, bizouk_jaune: 0, bizouk_rose: 0,
      bombes_reussies: 0, bombes_ratees: 0,
      bloque_jusqua: null
    };
  }

  // ---------- Stockage local ----------
  function lireLocal() {
    try {
      const s = localStorage.getItem(CLE);
      if (!s) return vide();
      const p = JSON.parse(s);
      return Object.assign(vide(), p);
    } catch { return vide(); }
  }
  function ecrireLocal(p) {
    try { localStorage.setItem(CLE, JSON.stringify(p)); } catch {}
  }

  // ---------- État courant ----------
  let etat = lireLocal();
  let utilisateur = null;
  let charge = false;

  async function chargerDepuisCompte() {
    const base = await db();
    if (!base) return null;
    const { data: session } = await base.auth.getSession();
    if (!session.session) { utilisateur = null; return null; }
    utilisateur = session.session.user;

    const { data, error } = await base.from("progression")
      .select("*").eq("user_id", utilisateur.id).maybeSingle();
    if (error) return null;

    if (!data) {
      // Première connexion : on remonte la progression locale sur le compte
      const nom = (utilisateur.user_metadata && utilisateur.user_metadata.nom)
        ? utilisateur.user_metadata.nom : (utilisateur.email||"").split("@")[0];
      const ent = await entrepriseId();
      const local = lireLocal();
      const nouveau = {
        user_id: utilisateur.id, entreprise_id: ent, joueur: nom,
        niveaux_reussis: local.niveaux_reussis || [],
        bizouk_vert: local.bizouk_vert || 0,
        bizouk_jaune: local.bizouk_jaune || 0,
        bizouk_rose: local.bizouk_rose || 0,
        bombes_reussies: local.bombes_reussies || 0,
        bombes_ratees: local.bombes_ratees || 0,
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
      // Le compte fait foi, mais on garde le meilleur des deux (jamais de perte)
      const local = lireLocal();
      etat = {
        niveaux_reussis: [...new Set([...(distant.niveaux_reussis||[]), ...(local.niveaux_reussis||[])])],
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
      bizouk_vert: etat.bizouk_vert,
      bizouk_jaune: etat.bizouk_jaune,
      bizouk_rose: etat.bizouk_rose,
      bombes_reussies: etat.bombes_reussies,
      bombes_ratees: etat.bombes_ratees,
      bloque_jusqua: etat.bloque_jusqua,
      maj: new Date().toISOString()
    }).eq("user_id", utilisateur.id);
  }

  // ---------- API ----------
  const API = {
    async init() { return await charger(); },
    etat() { return etat; },
    connecte() { return !!utilisateur; },

    total() { return etat.bizouk_vert + etat.bizouk_jaune + etat.bizouk_rose; },
    detail() {
      return { vert: etat.bizouk_vert, jaune: etat.bizouk_jaune, rose: etat.bizouk_rose };
    },

    cle(partie, niveau) { return partie + "-" + niveau; },

    reussi(partie, niveau) {
      return etat.niveaux_reussis.includes(partie + "-" + niveau);
    },

    // Un niveau est ouvert si c'est le tout premier, ou si le précédent est réussi
    ouvert(partie, niveau) {
      const NIVS = [15, 20, 25];
      const i = NIVS.indexOf(niveau);
      if (partie === 1 && i === 0) return true;
      if (i > 0) return this.reussi(partie, NIVS[i-1]);
      // premier niveau d'une partie : il faut avoir fini la partie précédente
      return this.reussi(partie - 1, 25);
    },

    async gagnerNiveau(partie, niveau) {
      const cle = partie + "-" + niveau;
      const nouveau = !etat.niveaux_reussis.includes(cle);
      if (nouveau) {
        etat.niveaux_reussis.push(cle);
        const coul = COULEURS[niveau] || "vert";
        etat["bizouk_" + coul] += GAIN_PAR_NIVEAU;
        await sauver();
      }
      return { nouveau, gain: nouveau ? GAIN_PAR_NIVEAU : 0, couleur: COULEURS[niveau] };
    },

    // ---------- Bombe ----------
    bloque() {
      if (!etat.bloque_jusqua) return false;
      return new Date(etat.bloque_jusqua).getTime() > Date.now();
    },
    resteBlocageMs() {
      if (!etat.bloque_jusqua) return 0;
      return Math.max(0, new Date(etat.bloque_jusqua).getTime() - Date.now());
    },
    async bombeReussie() {
      etat.bombes_reussies++;
      etat.bloque_jusqua = null;
      await sauver();
    },
    async bombeRatee() {
      etat.bombes_ratees++;
      etat.bloque_jusqua = new Date(Date.now() + BLOCAGE_MS).toISOString();
      await sauver();
    },
    peutPayer() { return this.total() >= PRIX_DEBLOCAGE; },
    prix() { return PRIX_DEBLOCAGE; },

    // Dépense 5 BiZouk, en prenant d'abord dans la couleur la plus fournie
    async payerDeblocage() {
      if (!this.peutPayer()) return false;
      let reste = PRIX_DEBLOCAGE;
      const ordre = ["vert","jaune","rose"].sort((a,b) => etat["bizouk_"+b] - etat["bizouk_"+a]);
      for (const c of ordre) {
        const dispo = etat["bizouk_" + c];
        const pris = Math.min(dispo, reste);
        etat["bizouk_" + c] -= pris;
        reste -= pris;
        if (reste <= 0) break;
      }
      etat.bloque_jusqua = null;
      await sauver();
      return true;
    },

    async reinitialiser() {
      etat = vide();
      await sauver();
    }
  };

  window.Progression = API;
})();

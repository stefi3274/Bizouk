/* BiZouk — progression : chapitres, niveaux, pierres BiZouk, bombes
   Un chapitre = 2 niveaux (15 et 20 mots) + 1 bombe.
   Fonctionne sans compte (navigateur) et avec compte (synchronisé). */
(function () {
  const CLE = "bizouk_progression";
  const COULEURS = { 15: "vert", 20: "jaune" };
  const PRIX_DEBLOCAGE = 5;
  const PRIX_INDICE = 1;
  const PRIX_SAUVETAGE = 1;                  // pierres pour sauver une série
  const PALIERS = [3, 7, 14, 30, 60, 100];   // jours qui donnent un bonus
  const BONUS = { 3: 3, 7: 7, 14: 10, 30: 20, 60: 35, 100: 60 };
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
      bloque_jusqua: null,
      serie_jours: 0, serie_record: 0, dernier_jour: null,
      paliers_recus: [],
      dernier_chapitre: null, dernier_niveau: null
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
        bloque_jusqua: local.bloque_jusqua || null,
        serie_jours: local.serie_jours||0, serie_record: local.serie_record||0,
        dernier_jour: local.dernier_jour || null, paliers_recus: local.paliers_recus||[],
        dernier_chapitre: local.dernier_chapitre || null, dernier_niveau: local.dernier_niveau || null
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
        bloque_jusqua: distant.bloque_jusqua || local.bloque_jusqua || null,
        serie_jours: Math.max(distant.serie_jours||0, local.serie_jours||0),
        serie_record: Math.max(distant.serie_record||0, local.serie_record||0),
        dernier_jour: (distant.dernier_jour && local.dernier_jour)
          ? (distant.dernier_jour > local.dernier_jour ? distant.dernier_jour : local.dernier_jour)
          : (distant.dernier_jour || local.dernier_jour || null),
        paliers_recus: [...new Set([...(distant.paliers_recus||[]), ...(local.paliers_recus||[])])],
        dernier_chapitre: distant.dernier_chapitre || local.dernier_chapitre || null,
        dernier_niveau: distant.dernier_niveau || local.dernier_niveau || null
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
      bloque_jusqua: etat.bloque_jusqua,
      serie_jours: etat.serie_jours, serie_record: etat.serie_record,
      dernier_jour: etat.dernier_jour, paliers_recus: etat.paliers_recus,
      dernier_chapitre: etat.dernier_chapitre, dernier_niveau: etat.dernier_niveau,
      maj: new Date().toISOString()
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

    // ---------- Série quotidienne ----------
    /* Date du jour au format AAAA-MM-JJ (heure locale du joueur) */
    jourAujourdhui() {
      const d = new Date();
      return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0")
        + "-" + String(d.getDate()).padStart(2,"0");
    },

    /* Nombre de jours entre deux dates AAAA-MM-JJ */
    ecartJours(a, b) {
      if (!a || !b) return null;
      const da = new Date(a + "T12:00:00"), dbb = new Date(b + "T12:00:00");
      return Math.round((dbb - da) / 86400000);
    },

    serie() { return etat.serie_jours || 0; },
    record() { return etat.serie_record || 0; },
    aJoueAujourdhui() { return etat.dernier_jour === this.jourAujourdhui(); },

    /* La série est-elle en danger (un seul jour manqué, rattrapable) ? */
    serieEnDanger() {
      if (!etat.dernier_jour || !etat.serie_jours) return false;
      const ecart = this.ecartJours(etat.dernier_jour, this.jourAujourdhui());
      return ecart === 2;   // hier manqué, aujourd'hui on peut encore sauver
    },

    /* Appelé quand le joueur termine une grille */
    async marquerJour() {
      const auj = this.jourAujourdhui();
      if (etat.dernier_jour === auj) {
        return { deja: true, serie: etat.serie_jours, bonus: 0, palier: null };
      }

      const ecart = this.ecartJours(etat.dernier_jour, auj);
      if (ecart === 1) etat.serie_jours = (etat.serie_jours || 0) + 1;   // jour suivant
      else etat.serie_jours = 1;                                          // reprise à zéro

      etat.dernier_jour = auj;
      if (etat.serie_jours > (etat.serie_record || 0)) etat.serie_record = etat.serie_jours;

      // Bonus de palier
      let bonus = 0, palier = null;
      const recus = etat.paliers_recus || [];
      for (const p of PALIERS) {
        if (etat.serie_jours >= p && !recus.includes(p)) {
          bonus = BONUS[p] || 0;
          palier = p;
          recus.push(p);
          etat.paliers_recus = recus;
          etat.bizouk_rose += bonus;
          break;
        }
      }

      await sauver();
      return { deja: false, serie: etat.serie_jours, bonus, palier,
               record: etat.serie_record, nouveauRecord: etat.serie_jours === etat.serie_record && etat.serie_jours > 1 };
    },

    /* Sauver une série en danger contre une pierre */
    peutSauverSerie() { return this.serieEnDanger() && this.total() >= PRIX_SAUVETAGE; },
    prixSauvetage() { return PRIX_SAUVETAGE; },

    async sauverSerie() {
      if (!this.peutSauverSerie()) return false;
      let reste = PRIX_SAUVETAGE;
      const ordre = ["vert","jaune","rose"].sort((a,b) => etat["bizouk_"+b] - etat["bizouk_"+a]);
      for (const c of ordre) {
        const pris = Math.min(etat["bizouk_"+c], reste);
        etat["bizouk_"+c] -= pris; reste -= pris;
        if (reste <= 0) break;
      }
      // On fait comme si le joueur avait joué hier
      const hier = new Date(); hier.setDate(hier.getDate() - 1);
      etat.dernier_jour = hier.getFullYear() + "-" + String(hier.getMonth()+1).padStart(2,"0")
        + "-" + String(hier.getDate()).padStart(2,"0");
      await sauver();
      return true;
    },

    /* Prochain palier à atteindre */
    prochainPalier() {
      const s = etat.serie_jours || 0;
      for (const p of PALIERS) if (s < p) return { jours: p, bonus: BONUS[p], reste: p - s };
      return null;
    },

    // ---------- Reprendre où on s'est arrêté ----------
    async memoriserPosition(chapitreId, niveau) {
      if (!chapitreId) return;
      etat.dernier_chapitre = chapitreId;
      etat.dernier_niveau = niveau || null;
      await sauver();
    },
    dernierePosition() {
      if (!etat.dernier_chapitre) return null;
      return { chapitre: etat.dernier_chapitre, niveau: etat.dernier_niveau };
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

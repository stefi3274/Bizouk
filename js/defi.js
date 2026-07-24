/* BiZouk — le défi du jour : une grille identique pour tous, chaque jour */
(function () {
  async function db() { return window.DB || (window.attendreDB ? await window.attendreDB(8000) : null); }

  const NB_MOTS = 18;   // taille du défi quotidien

  /* Date du jour au format AAAA-MM-JJ */
  function jour() {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0")
      + "-" + String(d.getDate()).padStart(2,"0");
  }

  /* Générateur pseudo-aléatoire déterministe : même graine = même suite */
  function graineDepuis(txt) {
    let h = 2166136261;
    for (let i = 0; i < txt.length; i++) {
      h ^= txt.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function alea(graine) {
    let e = graine;
    return function () {
      e |= 0; e = (e + 0x6D2B79F5) | 0;
      let t = Math.imul(e ^ (e >>> 15), 1 | e);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* Mélange déterministe d'une liste */
  function melangerAvec(liste, rnd) {
    const a = liste.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  const API = {
    jour,

    /* Récupère les mots du défi du jour : identiques pour tous les joueurs */
    async motsDuJour() {
      const base = await db();
      if (!base) return null;
      const ent = await entrepriseId();
      if (!ent) return null;

      const { data: chaps } = await base.from("chapitres")
        .select("id, theme_id, nom, mots")
        .eq("entreprise_id", ent).eq("publie", true).order("id");
      if (!chaps || !chaps.length) return null;

      // La graine vient de la date : tout le monde a la même grille le même jour
      const rnd = alea(graineDepuis("bizouk-" + jour()));

      // Choisir un chapitre du jour
      const chap = chaps[Math.floor(rnd() * chaps.length)];
      const { data: th } = await base.from("themes").select("nom").eq("id", chap.theme_id).maybeSingle();

      const tous = Array.isArray(chap.mots) ? chap.mots : [];
      if (tous.length < 8) return null;
      const mots = melangerAvec(tous, rnd).slice(0, Math.min(NB_MOTS, tous.length));

      return {
        jour: jour(),
        chapitre: chap.nom,
        theme: (th && th.nom) || "",
        mots: mots
      };
    },

    /* A-t-on déjà joué le défi d'aujourd'hui ? */
    async dejaJoue() {
      const base = await db();
      if (!base) return null;
      const { data: sess } = await base.auth.getSession();
      if (!sess.session) {
        // Sans compte : on garde la trace localement
        try {
          const v = localStorage.getItem("bizouk_defi_" + jour());
          return v ? JSON.parse(v) : null;
        } catch { return null; }
      }
      const { data } = await base.from("defis_jour").select("*")
        .eq("jour", jour()).eq("user_id", sess.session.user.id).maybeSingle();
      return data || null;
    },

    /* Enregistre le résultat */
    async enregistrer(temps, motsTotal, indices) {
      const base = await db();
      if (!base) return null;
      const ent = await entrepriseId();
      const { data: sess } = await base.auth.getSession();

      if (!sess.session) {
        // Sans compte : mémoire locale seulement
        const res = { jour: jour(), temps_sec: temps, mots_total: motsTotal, local: true };
        try { localStorage.setItem("bizouk_defi_" + jour(), JSON.stringify(res)); } catch {}
        return res;
      }

      const u = sess.session.user;
      const nom = (u.user_metadata && u.user_metadata.nom) ? u.user_metadata.nom : (u.email||"").split("@")[0];
      const { data, error } = await base.from("defis_jour").insert({
        entreprise_id: ent, jour: jour(), user_id: u.id, joueur: nom,
        temps_sec: temps, mots_total: motsTotal, indices: indices || 0
      }).select("*").maybeSingle();

      if (error) return null;
      return data;
    },

    /* Classement du jour */
    async classement(dateVoulue) {
      const base = await db();
      if (!base) return [];
      const ent = await entrepriseId();
      if (!ent) return [];
      const { data } = await base.from("defis_jour").select("*")
        .eq("entreprise_id", ent).eq("jour", dateVoulue || jour())
        .order("temps_sec", { ascending: true }).limit(100);
      return data || [];
    },

    /* Ma place dans le classement du jour */
    async maPlace() {
      const base = await db();
      if (!base) return null;
      const { data: sess } = await base.auth.getSession();
      if (!sess.session) return null;
      const liste = await this.classement();
      const i = liste.findIndex(x => x.user_id === sess.session.user.id);
      return i < 0 ? null : { place: i + 1, total: liste.length, resultat: liste[i] };
    }
  };

  window.BiZoukDefi = API;
})();

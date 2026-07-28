/* BiZouk — analytics maison (aucune dépendance externe)
   Un identifiant de session anonyme (aucune donnée personnelle) est généré et
   gardé en localStorage. Chaque page vue et chaque événement clé (partie
   terminée, inscription...) est écrit dans la table Supabase "evenements". */
(function () {
  async function db() { return window.DB || (window.attendreDB ? await window.attendreDB(8000) : null); }

  function idSession() {
    try {
      let id = localStorage.getItem("bizouk_session");
      if (!id) {
        id = "s_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10);
        localStorage.setItem("bizouk_session", id);
      }
      return id;
    } catch (e) {
      return "s_" + Math.random().toString(36).slice(2, 10);
    }
  }

  async function evenement(type, details) {
    try {
      const base = await db();
      if (!base) return;
      const ent = window.entrepriseId ? await window.entrepriseId() : null;
      if (!ent) return;
      let userId = null;
      try {
        const { data } = await base.auth.getSession();
        userId = data && data.session ? data.session.user.id : null;
      } catch (e) {}
      await base.from("evenements").insert({
        entreprise_id: ent,
        session_id: idSession(),
        user_id: userId,
        type: type,
        page: location.pathname.split("/").pop() || "index.html",
        details: details || null
      });
    } catch (e) { /* silencieux : l'analytics ne doit jamais gêner le jeu */ }
  }

  window.BiZoukAnalytics = { evenement };

  // Page vue automatique
  document.addEventListener("DOMContentLoaded", () => evenement("page_vue"));
})();

/* BiZouk — récompense de duel : +3 pierres au VAINQUEUR seulement, une fois, jamais à l'acceptation.
   Réutilisé partout où un résultat de duel peut s'afficher (duel-page, duel-aléatoire, mes duels). */
(function () {
  async function db() { return window.DB || (window.attendreDB ? await window.attendreDB(8000) : null); }

  /* duel : ligne de la table "duels" (avec lanceur_temps/adversaire_temps déjà connus)
     monId : mon user_id, pour savoir si je suis lanceur ou adversaire */
  async function verifierEtCrediter(duel, monId) {
    if (!duel || !monId) return;
    if (duel.lanceur_temps == null || duel.adversaire_temps == null) return; // pas encore résolu

    const jeSuisLanceur = duel.lanceur_id === monId;
    const jeSuisAdversaire = duel.adversaire_id === monId;
    if (!jeSuisLanceur && !jeSuisAdversaire) return;

    const jaiGagne = jeSuisLanceur
      ? duel.lanceur_temps < duel.adversaire_temps
      : duel.adversaire_temps < duel.lanceur_temps;
    if (!jaiGagne) return;

    const dejaRecompense = jeSuisLanceur ? duel.lanceur_recompense : duel.adversaire_recompense;
    if (dejaRecompense) return;

    if (window.Progression) {
      await window.Progression.init();
      await window.Progression.ajouterPierres(3);
    }

    const base = await db();
    if (!base) return;
    const champ = jeSuisLanceur ? "lanceur_recompense" : "adversaire_recompense";
    await base.from("duels").update({ [champ]: true }).eq("id", duel.id);
  }

  window.BiZoukDuelRecompense = { verifierEtCrediter };
})();

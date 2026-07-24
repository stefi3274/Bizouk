/* BiZouk — définir un nouveau mot de passe après récupération */
(function () {
  const $ = id => document.getElementById(id);
  async function db() { return window.DB || (window.attendreDB ? await window.attendreDB(8000) : null); }
  const msg = (t, k) => { const e = $("msg"); if(!e) return; e.textContent = t; e.className = "msg on " + (k||""); };

  let pret = false;

  async function verifier() {
    const base = await db();
    if (!base) { msg("Connexion impossible. Recharge la page.", "err"); return; }

    // Supabase place un jeton de récupération dans l'URL
    const { data } = await base.auth.getSession();
    if (data.session) { pret = true; return; }

    // Attendre l'événement de récupération (le jeton peut mettre un instant)
    base.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) { pret = true; msg(""); $("msg").className = "msg"; }
    });

    setTimeout(async () => {
      const { data: d2 } = await base.auth.getSession();
      if (!d2.session && !pret) {
        $("formZone").style.display = "none";
        $("lienInvalide").style.display = "block";
        $("sousTitre").textContent = "Lien expiré ou invalide";
      }
    }, 2500);
  }

  $("btnValider").addEventListener("click", async () => {
    const m1 = $("mdp1").value;
    const m2 = $("mdp2").value;

    if (m1.length < 6) { msg("Le mot de passe doit faire au moins 6 caractères.", "err"); return; }
    if (m1 !== m2) { msg("Les deux mots de passe ne correspondent pas.", "err"); return; }

    const base = await db();
    if (!base) { msg("Connexion impossible.", "err"); return; }

    msg("Enregistrement…");
    $("btnValider").disabled = true;

    const { error } = await base.auth.updateUser({ password: m1 });
    $("btnValider").disabled = false;

    if (error) {
      msg(error.message.includes("session") || error.message.includes("Auth")
        ? "Ce lien n'est plus valide. Demande un nouveau lien."
        : "Erreur : " + error.message, "err");
      return;
    }

    msg("Mot de passe enregistré ! Redirection…", "ok");
    setTimeout(() => { location.href = "index.html"; }, 1400);
  });

  verifier();
})();

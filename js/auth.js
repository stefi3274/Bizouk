/* BiZouk — connexion / inscription des lecteurs */
(function () {
  // Récupère la connexion, en attendant si nécessaire
  async function db() {
    return window.DB || (window.attendreDB ? await window.attendreDB(8000) : null);
  }

  const $ = id => document.getElementById(id);
  const msg = (t, k) => { const e = $("msg"); if(!e) return; e.textContent = t; e.className = "msg on " + (k||""); };
  const retour = new URLSearchParams(location.search).get("retour") || "index.html";

  if (typeof DB === "undefined" || !DB) { msg("Connexion indisponible pour le moment.", "err"); return; }

  // Connexion
  const lf = $("loginForm");
  if (lf) lf.addEventListener("submit", async e => {
    e.preventDefault();
    msg("Connexion…");
    const { error } = await (await db()).auth.signInWithPassword({
      email: $("email").value.trim(), password: $("pass").value
    });
    if (error) { msg("Email ou mot de passe incorrect.", "err"); return; }
    msg("Connecté ! Redirection…", "ok");
    setTimeout(() => location.href = retour, 700);
  });

  // Inscription
  const sf = $("signupForm");
  if (sf) sf.addEventListener("submit", async e => {
    e.preventDefault();
    const nom = $("nom").value.trim();
    if (nom.length < 2) { msg("Indique ton nom.", "err"); return; }
    if ($("pass").value.length < 6) { msg("Le mot de passe doit faire au moins 6 caractères.", "err"); return; }
    msg("Création du compte…");
    const { error } = await (await db()).auth.signUp({
      email: $("email").value.trim(),
      password: $("pass").value,
      options: { data: { nom: nom } }
    });
    if (error) {
      msg(error.message.includes("already") ? "Cet email a déjà un compte." : "Erreur : " + error.message, "err");
      return;
    }
    msg("Compte créé ! Redirection…", "ok");
    setTimeout(() => location.href = retour, 900);
  });
})();

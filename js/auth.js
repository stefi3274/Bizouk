/* BiZouk — connexion / inscription des lecteurs */
(function () {
  // Récupère la connexion, en attendant si nécessaire
  async function db() {
    return window.DB || (window.attendreDB ? await window.attendreDB(8000) : null);
  }

  const $ = id => document.getElementById(id);
  const msg = (t, k) => { const e = $("msg"); if(!e) return; e.textContent = t; e.className = "msg on " + (k||""); };
  const retour = new URLSearchParams(location.search).get("retour") || "index.html";



  // ---------- Sélecteur d'avatar (page inscription) ----------
  let avConfig = { palette: 0, motif: 0, initiales: "?" };

  function rendreAvatar() {
    const box = $("avApercu");
    if (!box || !window.BiZoukAvatar) return;
    const nom = ($("nom") ? $("nom").value : "") || "";
    avConfig.initiales = window.BiZoukAvatar.initialesDe(nom);
    box.innerHTML = window.BiZoukAvatar.avatar(avConfig, 84);
    const pn = $("palNom"), mn = $("motNom");
    if (pn) pn.textContent = window.BiZoukAvatar.PALETTES[avConfig.palette].nom;
    if (mn) {
      const m = window.BiZoukAvatar.MOTIFS[avConfig.motif];
      mn.textContent = m.charAt(0).toUpperCase() + m.slice(1);
    }
  }

  if ($("avApercu")) {
    const nb = window.BiZoukAvatar ? window.BiZoukAvatar.nbPalettes : 12;
    const nm = window.BiZoukAvatar ? window.BiZoukAvatar.nbMotifs : 8;
    avConfig.palette = Math.floor(Math.random() * nb);
    avConfig.motif = Math.floor(Math.random() * nm);

    const maj = (k, d, max) => { avConfig[k] = (avConfig[k] + d + max) % max; rendreAvatar(); };
    if ($("palMoins")) $("palMoins").onclick = () => maj("palette", -1, nb);
    if ($("palPlus"))  $("palPlus").onclick  = () => maj("palette", 1, nb);
    if ($("motMoins")) $("motMoins").onclick = () => maj("motif", -1, nm);
    if ($("motPlus"))  $("motPlus").onclick  = () => maj("motif", 1, nm);
    if ($("avHasard")) $("avHasard").onclick = () => {
      avConfig.palette = Math.floor(Math.random() * nb);
      avConfig.motif = Math.floor(Math.random() * nm);
      rendreAvatar();
    };
    if ($("nom")) $("nom").addEventListener("input", rendreAvatar);
    rendreAvatar();
  }


  // ---------- Mot de passe oublié ----------
  if ($("lienOubli")) {
    $("lienOubli").addEventListener("click", e => {
      e.preventDefault();
      $("loginForm").style.display = "none";
      const lb = document.querySelector(".lien-bas");
      if (lb) lb.style.display = "none";
      $("blocOubli").style.display = "block";
      const mo = $("mailOubli"), em = $("email");
      if (mo && em && em.value) mo.value = em.value;
      if (mo) mo.focus();
    });
  }

  if ($("annulerOubli")) {
    $("annulerOubli").addEventListener("click", e => {
      e.preventDefault();
      $("blocOubli").style.display = "none";
      $("loginForm").style.display = "block";
      const lb = document.querySelector(".lien-bas");
      if (lb) lb.style.display = "block";
    });
  }

  if ($("btnOubli")) {
    $("btnOubli").addEventListener("click", async () => {
      const mail = ($("mailOubli").value || "").trim();
      const mo = $("msgOubli");
      const dire = (t, k) => { if (mo) { mo.textContent = t; mo.className = "msg on " + (k||""); } };

      if (!mail || mail.indexOf("@") < 0) { dire("Entre une adresse email valide.", "err"); return; }

      const base = await db();
      if (!base) { dire("Service indisponible. Réessaie dans un instant.", "err"); return; }

      dire("Envoi en cours…");
      $("btnOubli").disabled = true;

      const retourVers = location.origin + location.pathname.replace(/[^/]*$/, "") + "nouveau-mot-de-passe.html";
      const { error } = await base.auth.resetPasswordForEmail(mail, { redirectTo: retourVers });

      $("btnOubli").disabled = false;
      if (error) { dire("Erreur : " + error.message, "err"); return; }

      dire("Email envoyé ! Regarde ta boîte de réception (et les spams).", "ok");
      $("mailOubli").value = "";
    });
  }

  // Connexion
  const lf = $("loginForm");
  if (lf) lf.addEventListener("submit", async e => {
    e.preventDefault();
    msg("Connexion…");
    const base = await db();
    if (!base) { msg("Service indisponible. Réessaie dans un instant.", "err"); return; }
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
    const base2 = await db();
    if (!base2) { msg("Service indisponible. Réessaie dans un instant.", "err"); return; }
    const { error } = await (await db()).auth.signUp({
      email: $("email").value.trim(),
      password: $("pass").value,
      options: { data: { nom: nom, avatar: window.BiZoukAvatar ? window.BiZoukAvatar.encoder(avConfig) : "0-0" } }
    });
    if (error) {
      msg(error.message.includes("already") ? "Cet email a déjà un compte." : "Erreur : " + error.message, "err");
      return;
    }
    msg("Compte créé ! Redirection…", "ok");
    setTimeout(() => location.href = retour, 900);
  });
})();

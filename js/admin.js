/* BiZouk — admin : gestion des thèmes */
(function () {
  const $ = id => document.getElementById(id);
  async function db() { return window.DB || (window.attendreDB ? await window.attendreDB(8000) : null); }
  const esc = s => (s || "").replace(/[&<>"']/g, c => (
    { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
  const status = (m, t) => { const e = $("admMsg"); if(e){ e.textContent = m; e.className = "msg on " + (t||"ok"); } };
  const dateFr = iso => new Date(iso).toLocaleDateString("fr-FR",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});

  let editId = null;

  function normaliser(m) {
    return (m||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/[^A-Z]/g,"");
  }
  function motsDepuisTexte(txt) {
    return [...new Set((txt||"").split(/[\n,;]+/).map(normaliser).filter(m => m.length >= 2))];
  }

  // Onglets (indépendants de la connexion)
  document.querySelectorAll(".adm-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      const t = tab.getAttribute("data-tab");
      document.querySelectorAll(".adm-tab").forEach(x => x.classList.toggle("on", x === tab));
      ["creer","themes","parties"].forEach(k => {
        const el = $("tab-" + k); if (el) el.style.display = (t === k) ? "block" : "none";
      });
      if (t === "themes") lancerAvecDB("themesList", chargerThemes);
      if (t === "parties") lancerAvecDB("partiesList", chargerParties);
    });
  });

  // Compteur de mots (indépendant de la connexion)
  const ta = $("thMots");
  if (ta) ta.addEventListener("input", () => {
    const n = motsDepuisTexte(ta.value).length;
    const c = $("compteMots");
    if (c) {
      c.textContent = n + (n > 1 ? " mots" : " mot");
      c.style.background = n >= 25 ? "rgba(52,211,153,.2)" : "var(--violet-glow)";
      c.style.color = n >= 25 ? "#6ee7b7" : "var(--violet-c)";
    }
  });

  async function lancerAvecDB(zoneId, fn) {
    const box = $(zoneId);
    if (box) box.innerHTML = "<p class='empty'>Chargement…</p>";
    const base = await db();
    if (!base) {
      if (box) box.innerHTML = "<p class='empty' style='color:#fca5a5'>Connexion au serveur impossible."
        + "<br><br>Vérifie ta connexion internet, puis recharge la page.</p>";
      return;
    }
    fn();
  }

  // ---------- Authentification ----------
  async function refreshAuth() {
    const base = await db();
    if (!base) { const s = $("setupNote"); if (s) s.style.display = "block"; return; }
    const { data } = await base.auth.getSession();
    if (data.session) { $("loginCard").style.display="none"; $("panel").style.display="block"; }
    else { $("loginCard").style.display="block"; $("panel").style.display="none"; }
  }

  $("loginForm").addEventListener("submit", async e => {
    e.preventDefault();
    const st = $("loginMsg"); st.textContent = "Connexion…"; st.className = "msg on";
    const base = await db();
    if (!base) { st.textContent = "Serveur indisponible."; st.className = "msg on err"; return; }
    const { error } = await base.auth.signInWithPassword({
      email: $("admEmail").value.trim(), password: $("admPass").value });
    if (error) { st.textContent = "Email ou mot de passe incorrect."; st.className = "msg on err"; return; }
    st.className = "msg"; refreshAuth();
  });

  $("logoutBtn").addEventListener("click", async () => {
    const base = await db(); if (base) await base.auth.signOut(); refreshAuth();
  });

  // ---------- Créer / modifier un thème ----------
  $("btnSauver").addEventListener("click", async () => {
    const nom = $("thNom").value.trim();
    const desc = $("thDesc").value.trim();
    const mots = motsDepuisTexte($("thMots").value);

    if (nom.length < 2) { status("Donne un nom au thème.", "err"); return; }
    if (mots.length < 10) { status("Il faut au moins 10 mots (tu en as " + mots.length + ").", "err"); return; }

    status("Enregistrement…", "");
    const base = await db();
    const ent = await entrepriseId();
    if (!base || !ent) { status("Connexion impossible.", "err"); return; }

    const donnees = { entreprise_id: ent, nom, description: desc || null, mots, publie: true };
    let error;
    if (editId) ({ error } = await base.from("themes").update(donnees).eq("id", editId));
    else ({ error } = await base.from("themes").insert(donnees));

    if (error) { status("Erreur : " + error.message, "err"); return; }
    status(editId ? "Thème modifié !" : "Thème publié !", "ok");
    reset();
  });

  $("btnAnnuler").addEventListener("click", reset);

  function reset() {
    editId = null;
    $("thNom").value = ""; $("thDesc").value = ""; $("thMots").value = "";
    $("compteMots").textContent = "0 mot";
    $("compteMots").style.background = "var(--violet-glow)";
    $("compteMots").style.color = "var(--violet-c)";
    $("formTitre").textContent = "Nouveau thème";
    $("btnSauver").textContent = "Publier le thème";
    $("btnAnnuler").style.display = "none";
  }

  // ---------- Liste des thèmes ----------
  async function chargerThemes() {
    const box = $("themesList");
    try {
      const base = await db();
      const ent = await entrepriseId();
      if (!ent) { box.innerHTML = "<p class='empty'>Entreprise BiZouk introuvable. Vérifie que le SQL est exécuté.</p>"; return; }
      const { data, error } = await base.from("themes").select("*")
        .eq("entreprise_id", ent).order("created_at", { ascending: false });
      if (error) {
        box.innerHTML = "<p class='empty' style='color:#fca5a5'>Erreur : " + esc(error.message)
          + "<br><br>Si le message parle de permissions, ton compte n'est peut-être pas relié à BiZouk.</p>";
        return;
      }
      if (!data.length) { box.innerHTML = "<p class='empty'>Aucun thème. Crée le premier dans l'onglet « Créer un thème ».</p>"; return; }

      box.innerHTML = data.map(t => {
        const nb = Array.isArray(t.mots) ? t.mots.length : 0;
        const apercu = Array.isArray(t.mots) ? t.mots.slice(0,8).join(" · ") : "";
        const niveaux = [];
        if (nb >= 15) niveaux.push("15"); if (nb >= 20) niveaux.push("20"); if (nb >= 25) niveaux.push("25");
        return '<div class="theme-item">'
          + '<div class="ti-nom">' + esc(t.nom) + '</div>'
          + '<div class="ti-meta"><span class="compte-mots">' + nb + ' mots</span> · '
          + (niveaux.length ? 'niveaux ' + niveaux.join("/") : '<span style="color:#fca5a5">trop peu de mots</span>')
          + ' · ' + dateFr(t.created_at) + '</div>'
          + (apercu ? '<div class="ti-apercu">' + esc(apercu) + (nb > 8 ? ' …' : '') + '</div>' : '')
          + '<div class="ti-act">'
          + '<button class="mod" data-mod="' + t.id + '">Modifier</button>'
          + '<button class="sup" data-sup="' + t.id + '">Supprimer</button>'
          + '</div></div>';
      }).join("");

      box.querySelectorAll("[data-mod]").forEach(b =>
        b.onclick = () => modifier(data.find(x => x.id === b.getAttribute("data-mod"))));
      box.querySelectorAll("[data-sup]").forEach(b =>
        b.onclick = () => supprimer(b.getAttribute("data-sup")));
    } catch (e) {
      box.innerHTML = "<p class='empty' style='color:#fca5a5'>Erreur : " + esc(String(e && e.message || e)) + "</p>";
    }
  }

  function modifier(t) {
    if (!t) return;
    editId = t.id;
    $("thNom").value = t.nom || "";
    $("thDesc").value = t.description || "";
    $("thMots").value = Array.isArray(t.mots) ? t.mots.join("\n") : "";
    $("thMots").dispatchEvent(new Event("input"));
    $("formTitre").textContent = "Modifier le thème";
    $("btnSauver").textContent = "Enregistrer les modifications";
    $("btnAnnuler").style.display = "inline-flex";
    document.querySelector('.adm-tab[data-tab="creer"]').click();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function supprimer(id) {
    if (!confirm("Supprimer ce thème définitivement ?")) return;
    const base = await db();
    const { error } = await base.from("themes").delete().eq("id", id);
    if (error) { status("Suppression impossible : " + error.message, "err"); return; }
    status("Thème supprimé.", "ok");
    chargerThemes();
  }

  // ---------- Parties jouées ----------
  async function chargerParties() {
    const box = $("partiesList");
    try {
      const base = await db();
      const ent = await entrepriseId();
      const { data, error } = await base.from("parties").select("*")
        .eq("entreprise_id", ent).order("created_at", { ascending: false }).limit(60);
      if (error) { box.innerHTML = "<p class='empty' style='color:#fca5a5'>Erreur : " + esc(error.message) + "</p>"; return; }
      if (!data.length) { box.innerHTML = "<p class='empty'>Aucune partie enregistrée pour l'instant.</p>"; return; }

      const fmt = s => Math.floor(s/60) + ":" + String(s%60).padStart(2,"0");
      box.innerHTML =
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px">'
        + '<span style="color:var(--texte-doux);font-size:.9rem">' + data.length + ' partie(s) enregistrée(s)</span>'
        + '<button class="btn btn-g btn-sm" id="viderParties" style="border-color:var(--rouge);color:#fca5a5">Tout effacer</button>'
        + '</div>'
        + data.map(p =>
          '<div class="theme-item" style="border-left-color:var(--or)">'
          + '<div class="ti-nom">' + esc(p.joueur || "Joueur") + ' · <span style="color:var(--or)">' + fmt(p.temps_sec) + '</span></div>'
          + '<div class="ti-meta">' + esc(p.theme_nom || "—") + ' · niveau ' + p.niveau
          + ' · ' + p.mots_total + ' mots · ' + dateFr(p.created_at) + '</div>'
          + '<div class="ti-act"><button class="sup" data-delp="' + p.id + '">Supprimer</button></div>'
          + '</div>'
        ).join("");

      box.querySelectorAll("[data-delp]").forEach(b =>
        b.onclick = () => supprimerPartie(b.getAttribute("data-delp")));
      const vider = $("viderParties");
      if (vider) vider.onclick = () => viderToutesParties();
    } catch (e) {
      box.innerHTML = "<p class='empty' style='color:#fca5a5'>Erreur : " + esc(String(e && e.message || e)) + "</p>";
    }
  }

  async function supprimerPartie(id) {
    if (!confirm("Supprimer ce score du classement ?")) return;
    const base = await db();
    const { error } = await base.from("parties").delete().eq("id", id);
    if (error) { status("Suppression impossible : " + error.message, "err"); return; }
    status("Score supprimé.", "ok");
    chargerParties();
  }

  async function viderToutesParties() {
    if (!confirm("Effacer TOUS les scores enregistrés ?\n\nCette action est définitive et videra le classement.")) return;
    if (!confirm("Vraiment sûr ? Tous les temps de tous les joueurs seront perdus.")) return;
    const base = await db();
    const ent = await entrepriseId();
    const { error } = await base.from("parties").delete().eq("entreprise_id", ent);
    if (error) { status("Suppression impossible : " + error.message, "err"); return; }
    status("Tous les scores ont été effacés.", "ok");
    chargerParties();
  }

  refreshAuth();
})();

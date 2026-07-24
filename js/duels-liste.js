/* BiZouk — page Duels : rejoindre par code, lancer un duel, voir ses duels */
(function () {
  const $ = id => document.getElementById(id);
  async function db() { return window.DB || (window.attendreDB ? await window.attendreDB(8000) : null); }
  const esc = s => (s || "").replace(/[&<>"']/g, c => (
    { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
  const fmt = s => Math.floor(s/60) + ":" + String(Math.max(0,s)%60).padStart(2,"0");
  const msg = (t, k) => { const e = $("msgCode"); if(!e) return; e.textContent = t; e.className = "msg on " + (k||""); };

  function avatarDe(nom, taille) {
    if (!window.BiZoukAvatar) return "";
    const c = window.BiZoukAvatar.configDepuisNom(nom);
    c.initiales = window.BiZoukAvatar.initialesDe(nom);
    return window.BiZoukAvatar.avatar(c, taille || 40);
  }

  // ---------- Rejoindre par code ----------
  $("btnRejoindre").addEventListener("click", async () => {
    const code = ($("codeSaisi").value || "").trim().toUpperCase();
    if (code.length < 4) { msg("Entre le code complet (6 caractères).", "err"); return; }
    msg("Recherche du duel…");
    const duel = await window.BiZoukDuel.lire(code);
    if (!duel) { msg("Aucun duel ne correspond à ce code.", "err"); return; }
    if (duel.statut === "termine") {
      msg("Ce duel a déjà été relevé. Ouverture du résultat…", "ok");
    } else {
      msg("Duel trouvé ! Ouverture…", "ok");
    }
    setTimeout(() => { location.href = "duel.html?code=" + code; }, 700);
  });

  $("codeSaisi").addEventListener("keydown", e => {
    if (e.key === "Enter") $("btnRejoindre").click();
  });

  // ---------- Sélecteur de niveau ----------
  document.querySelectorAll('input[name="niv"]').forEach(r => {
    r.addEventListener("change", () => {});
  });

  // ---------- Charger les grilles disponibles ----------
  async function chargerChapitres() {
    const sel = $("selChapitre");
    const base = await db();
    if (!base) { sel.innerHTML = '<option value="">Connexion impossible</option>'; return; }
    const ent = await entrepriseId();
    if (!ent) { sel.innerHTML = '<option value="">Configuration en cours</option>'; return; }

    const [rC, rT] = await Promise.all([
      base.from("chapitres").select("id, theme_id, nom, ordre, mots")
        .eq("entreprise_id", ent).eq("publie", true).order("ordre"),
      base.from("themes").select("id, nom").eq("entreprise_id", ent).eq("publie", true)
    ]);

    const chaps = rC.data || [];
    const themes = {};
    (rT.data || []).forEach(t => themes[t.id] = t.nom);

    if (!chaps.length) {
      sel.innerHTML = '<option value="">Aucune grille disponible</option>';
      $("btnLancer").disabled = true;
      return;
    }

    // Grouper par thème
    const parTheme = {};
    chaps.forEach(c => {
      const nomT = themes[c.theme_id] || "Autres";
      (parTheme[nomT] = parTheme[nomT] || []).push(c);
    });

    sel.innerHTML = Object.keys(parTheme).map(nomT =>
      '<optgroup label="' + esc(nomT) + '">'
      + parTheme[nomT].map(c => {
          const nb = Array.isArray(c.mots) ? c.mots.length : 0;
          return '<option value="' + c.id + '">' + esc(c.nom) + ' (' + nb + ' mots)</option>';
        }).join("")
      + '</optgroup>'
    ).join("");
  }

  // ---------- Lancer un duel ----------
  $("btnLancer").addEventListener("click", () => {
    const chapId = $("selChapitre").value;
    if (!chapId) { alert("Choisis une grille."); return; }
    const niv = (document.querySelector('input[name="niv"]:checked') || {}).value || "15";
    // On va jouer la grille, avec le mode duel activé
    location.href = "jeu.html?chapitre=" + chapId + "&niveau=" + niv + "&duel=1";
  });

  // ---------- Mes duels ----------
  async function chargerMesDuels() {
    const box = $("mesDuels");
    const base = await db();
    if (!base) {
      box.innerHTML = '<p style="text-align:center;color:var(--texte-faible);font-style:italic;padding:24px">'
        + 'Connexion impossible.</p>';
      return;
    }

    const { data: sess } = await base.auth.getSession();
    if (!sess.session) {
      box.innerHTML = '<div class="cls-vide" style="padding:32px 24px">'
        + '<h3 style="font-size:1.1rem">Connecte-toi pour suivre tes duels</h3>'
        + '<p>Avec un compte, tu retrouves l\'historique de tous tes duels.</p>'
        + '<a href="connexion.html" class="btn btn-v btn-sm">Se connecter</a></div>';
      return;
    }

    const uid = sess.session.user.id;
    const u = sess.session.user;
    const monNom = (u.user_metadata && u.user_metadata.nom) ? u.user_metadata.nom : (u.email||"").split("@")[0];
    const nav = $("navAuth");
    if (nav) { nav.textContent = "Mon compte"; nav.href = "compte.html"; }

    const duels = await window.BiZoukDuel.mesDuels();
    if (!duels.length) {
      box.innerHTML = '<p style="text-align:center;color:var(--texte-faible);font-style:italic;padding:24px">'
        + 'Aucun duel pour l\'instant. Lance ton premier défi !</p>';
      return;
    }

    box.innerHTML = duels.map(d => {
      const jeSuisLanceur = d.lanceur_id === uid;
      const adversaire = jeSuisLanceur ? (d.adversaire_nom || "En attente") : d.lanceur_nom;
      const monTemps = jeSuisLanceur ? d.lanceur_temps : d.adversaire_temps;
      const sonTemps = jeSuisLanceur ? d.adversaire_temps : d.lanceur_temps;

      if (d.statut === "ouvert") {
        // Duel lancé mais pas encore relevé
        return '<div class="duel-item attente">'
          + '<span class="di-av">' + avatarDe("?", 40) + '</span>'
          + '<span class="di-info"><span class="di-nom">En attente d\'un adversaire</span>'
          + '<span class="di-detail">' + esc(d.chapitre_nom || "Grille") + ' · ton temps : ' + fmt(d.lanceur_temps) + '</span></span>'
          + '<span class="di-temps"><b class="di-code">' + d.code + '</b><span>code</span></span>'
          + '<span class="di-action"><button data-copier="' + d.code + '">Copier</button></span>'
          + '</div>';
      }

      const jeGagne = monTemps < sonTemps;
      return '<div class="duel-item ' + (jeGagne ? 'gagne' : 'perdu') + '">'
        + '<span class="di-av">' + avatarDe(adversaire, 40) + '</span>'
        + '<span class="di-info"><span class="di-nom">' + (jeGagne ? '🏆 ' : '') + 'contre ' + esc(adversaire) + '</span>'
        + '<span class="di-detail">' + esc(d.chapitre_nom || "Grille") + ' · '
        + (d.niveau === 20 ? "Confirmé" : "Découverte") + '</span></span>'
        + '<span class="di-temps ' + (jeGagne ? 'gagne' : 'perdu') + '">'
        + '<b>' + fmt(monTemps) + '</b><span>contre ' + fmt(sonTemps) + '</span></span>'
        + '</div>';
    }).join("");

    box.querySelectorAll("[data-copier]").forEach(b => {
      b.onclick = async () => {
        const lien = window.BiZoukDuel.lien(b.getAttribute("data-copier"));
        try {
          await navigator.clipboard.writeText(lien);
          b.textContent = "Copié ✓";
          setTimeout(() => { b.textContent = "Copier"; }, 2000);
        } catch { b.textContent = "Échec"; }
      };
    });
  }

  chargerChapitres();
  chargerMesDuels();
})();

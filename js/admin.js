/* BiZouk — admin : thèmes, chapitres, contributions, parties */
(function () {
  const $ = id => document.getElementById(id);
  async function db() { return window.DB || (window.attendreDB ? await window.attendreDB(8000) : null); }
  const esc = s => (s || "").replace(/[&<>"']/g, c => (
    { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
  const status = (m, t) => { const e = $("admMsg"); if(e){ e.textContent = m; e.className = "msg on " + (t||"ok"); } };
  const dateFr = iso => new Date(iso).toLocaleDateString("fr-FR",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});

  let editId = null;
  let themesCache = [];

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
      ["bord","creer","themes","contrib","parties"].forEach(k => {
        const el = $("tab-" + k); if (el) el.style.display = (t === k) ? "block" : "none";
      });
      if (t === "bord") lancerAvecDB("bordContenu", chargerBord);
      if (t === "themes") lancerAvecDB("themesList", chargerThemes);
      if (t === "contrib") lancerAvecDB("contribList", chargerContributions);
      if (t === "parties") lancerAvecDB("partiesList", chargerParties);
      if (t === "creer") remplirSelectThemes();
    });
  });

  // Compteur de mots
  const ta = $("chMots");
  if (ta) ta.addEventListener("input", () => {
    const n = motsDepuisTexte(ta.value).length;
    const c = $("compteMots");
    if (c) {
      c.textContent = n + (n > 1 ? " mots" : " mot");
      const bon = n >= 35;
      const ok = n >= 20;
      c.style.background = bon ? "rgba(52,211,153,.2)" : (ok ? "rgba(240,180,41,.2)" : "var(--violet-glow)");
      c.style.color = bon ? "#6ee7b7" : (ok ? "#fbbf24" : "var(--violet-c)");
    }
  });



  // ---------- Tableau de bord ----------
  async function chargerBord() {
    const box = $("bordContenu");
    try {
      const base = await db();
      const ent = await entrepriseId();
      if (!ent) { box.innerHTML = "<p class='empty'>Entreprise introuvable.</p>"; return; }

      const [rTh, rCh, rPa, rPr, rDu, rDf, rCo] = await Promise.all([
        base.from("themes").select("id, nom").eq("entreprise_id", ent),
        base.from("chapitres").select("id, theme_id, nom, mots").eq("entreprise_id", ent),
        base.from("parties").select("chapitre_nom, theme_nom, niveau, temps_sec, joueur, created_at").eq("entreprise_id", ent),
        base.from("progression").select("joueur, serie_jours, serie_record, niveaux_reussis, bombes_reussies_ids").eq("entreprise_id", ent),
        base.from("duels").select("statut, created_at").eq("entreprise_id", ent),
        base.from("defis_jour").select("jour, joueur, temps_sec").eq("entreprise_id", ent),
        base.from("bizouk_contributions").select("statut").eq("entreprise_id", ent)
      ]);

      const themes = rTh.data || [], chaps = rCh.data || [], parties = rPa.data || [];
      const joueurs = rPr.data || [], duels = rDu.data || [], defis = rDf.data || [];
      const contribs = rCo.data || [];

      const totalMots = chaps.reduce((s,c) => s + (Array.isArray(c.mots) ? c.mots.length : 0), 0);
      const duelsFinis = duels.filter(d => d.statut === "termine").length;
      const contribsAttente = contribs.filter(c => c.statut === "a_verifier").length;

      // Parties des 7 derniers jours
      const il7 = new Date(); il7.setDate(il7.getDate() - 7);
      const recentes = parties.filter(p => new Date(p.created_at) >= il7).length;

      // Chapitres les plus joués
      const parChapitre = {};
      parties.forEach(p => {
        const n = p.chapitre_nom || p.theme_nom || "—";
        parChapitre[n] = (parChapitre[n] || 0) + 1;
      });
      const topChapitres = Object.entries(parChapitre).sort((a,b) => b[1]-a[1]).slice(0, 8);
      const maxJoue = topChapitres.length ? topChapitres[0][1] : 1;

      // Chapitres jamais joués
      const jamais = chaps.filter(c => !parChapitre[c.nom]);

      // Joueurs les plus assidus
      const topSeries = joueurs.slice()
        .sort((a,b) => (b.serie_record||0) - (a.serie_record||0)).slice(0, 5)
        .filter(j => (j.serie_record||0) > 0);

      // Défi du jour
      const defiAuj = defis.filter(d => d.jour === new Date().toISOString().slice(0,10)).length;

      box.innerHTML =
        '<div class="bord-grille">'
        + '<div class="bord-c"><b>' + joueurs.length + '</b><span>joueurs inscrits</span></div>'
        + '<div class="bord-c or"><b>' + parties.length + '</b><span>parties jouées</span></div>'
        + '<div class="bord-c vert"><b>' + recentes + '</b><span>ces 7 jours</span></div>'
        + '<div class="bord-c"><b>' + themes.length + '</b><span>thèmes</span></div>'
        + '<div class="bord-c"><b>' + chaps.length + '</b><span>chapitres</span></div>'
        + '<div class="bord-c"><b>' + totalMots + '</b><span>mots au total</span></div>'
        + '<div class="bord-c or"><b>' + duelsFinis + '</b><span>duels joués</span></div>'
        + '<div class="bord-c vert"><b>' + defiAuj + '</b><span>défis aujourd\'hui</span></div>'
        + '</div>'

        + (contribsAttente
            ? '<div class="bord-section" style="border-color:var(--or)">'
              + '<h3 style="color:var(--or)">' + contribsAttente + ' contribution'
              + (contribsAttente > 1 ? 's' : '') + ' en attente</h3>'
              + '<p style="font-size:.88rem;color:var(--texte-doux)">Va dans l\'onglet Contributions pour les examiner.</p>'
              + '</div>'
            : '')

        + '<div class="bord-section"><h3>Chapitres les plus joués</h3>'
        + (topChapitres.length
            ? topChapitres.map(([nom, nb]) =>
                '<div style="padding:8px 0">'
                + '<div class="bord-ligne" style="border:0;padding:0">'
                + '<span class="bord-nom">' + esc(nom) + '</span>'
                + '<span class="bord-val">' + nb + '</span></div>'
                + '<div class="bord-barre"><span style="width:' + Math.round(100*nb/maxJoue) + '%"></span></div>'
                + '</div>').join("")
            : '<p style="color:var(--texte-faible);font-style:italic;font-size:.88rem">Aucune partie enregistrée.</p>')
        + '</div>'

        + (jamais.length
            ? '<div class="bord-section"><h3>Chapitres jamais joués (' + jamais.length + ')</h3>'
              + '<p style="font-size:.85rem;color:var(--texte-doux);line-height:1.7">'
              + jamais.slice(0, 12).map(c => esc(c.nom)).join(" · ")
              + (jamais.length > 12 ? " …" : "") + '</p></div>'
            : '')

        + '<div class="bord-section"><h3>Joueurs les plus assidus</h3>'
        + (topSeries.length
            ? topSeries.map(j =>
                '<div class="bord-ligne"><span class="bord-nom">' + esc(j.joueur || "—") + '</span>'
                + '<span class="bord-val">' + (j.serie_record||0) + ' jours 🔥</span></div>').join("")
            : '<p style="color:var(--texte-faible);font-style:italic;font-size:.88rem">Aucune série en cours.</p>')
        + '</div>';

    } catch (e) {
      box.innerHTML = "<p class='empty' style='color:#fca5a5'>Erreur : " + esc(String(e && e.message || e)) + "</p>";
    }
  }

  // ---------- Extraction de mots depuis un texte ----------
  /* Mots trop courants pour faire de bons mots mêlés */
  const MOTS_COURANTS = new Set([
    "AVEC","POUR","DANS","SOUS","SANS","MAIS","DONC","AINSI","ALORS","APRES","AVANT",
    "CETTE","CETTE","CELUI","CELLE","LEURS","NOTRE","VOTRE","MEME","AUSSI","ENCORE",
    "TOUT","TOUS","TOUTE","TOUTES","PLUS","MOINS","TRES","BIEN","ETRE","AVOIR","FAIRE",
    "DIRE","POUVOIR","VOULOIR","DEVOIR","QUAND","COMME","PARCE","QUE","QUI","QUOI",
    "DONT","LEQUEL","AUCUN","CHAQUE","PLUSIEURS","QUELQUE","AUTRE","AUTRES","ENTRE",
    "PENDANT","DEPUIS","VERS","CHEZ","CONTRE","SELON","MALGRE","PARMI","AUPRES",
    "CELA","CECI","VOILA","VOICI","AUJOURD","HUI","DEJA","JAMAIS","TOUJOURS","SOUVENT",
    "PEUT","FAIT","DEUX","TROIS","QUATRE","CINQ","LEUR","ELLE","ELLES","NOUS","VOUS",
    "SONT","ETAIT","ETAIENT","SERA","SERONT","AVAIT","AVAIENT","AURA","AURONT"
  ]);

  function extraireMots(texte, lgMin, lgMax, ignorerCourants) {
    const brut = (texte || "")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .split(/[^A-Z]+/)
      .filter(Boolean);

    const vus = new Set();
    const sortie = [];
    for (const m of brut) {
      if (m.length < lgMin || m.length > lgMax) continue;
      if (ignorerCourants && MOTS_COURANTS.has(m)) continue;
      if (vus.has(m)) continue;
      vus.add(m);
      sortie.push(m);
    }
    return sortie;
  }

  if ($("btnImport")) {
    $("btnImport").onclick = () => {
      const b = $("blocImport");
      b.style.display = (b.style.display === "none") ? "block" : "none";
      if (b.style.display === "block") $("texteSource").focus();
    };
  }
  if ($("btnFermerImport")) {
    $("btnFermerImport").onclick = () => { $("blocImport").style.display = "none"; };
  }

  if ($("btnExtraire")) {
    $("btnExtraire").onclick = () => {
      const texte = $("texteSource").value || "";
      const lgMin = parseInt($("lgMin").value, 10) || 4;
      const lgMax = parseInt($("lgMax").value, 10) || 12;
      const ignorer = $("sansCourants").checked;

      const mots = extraireMots(texte, lgMin, lgMax, ignorer);
      const zone = $("apercuImport");

      if (!mots.length) {
        zone.innerHTML = '<p style="color:#fca5a5;font-size:.88rem">'
          + 'Aucun mot trouvé. Essaie de réduire la longueur minimale.</p>';
        return;
      }

      zone.innerHTML =
        '<div style="background:var(--gris-2);border-radius:10px;padding:14px">'
        + '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px">'
        + '<span class="compte-mots">' + mots.length + ' mots extraits</span>'
        + '<div style="display:flex;gap:6px;flex-wrap:wrap">'
        + '<button type="button" class="btn btn-v btn-sm" id="btnRemplacer">Remplacer</button>'
        + '<button type="button" class="btn btn-g btn-sm" id="btnAjouter">Ajouter</button>'
        + '</div></div>'
        + '<div style="max-height:150px;overflow:auto;font-size:.84rem;color:var(--texte-doux);line-height:1.7">'
        + mots.map(m => esc(m)).join(" · ")
        + '</div></div>';

      $("btnRemplacer").onclick = () => {
        $("chMots").value = mots.join("\n");
        $("chMots").dispatchEvent(new Event("input"));
        $("blocImport").style.display = "none";
        status(mots.length + " mots importés.", "ok");
      };
      $("btnAjouter").onclick = () => {
        const actuels = motsDepuisTexte($("chMots").value);
        const fusion = [...new Set([...actuels, ...mots])];
        $("chMots").value = fusion.join("\n");
        $("chMots").dispatchEvent(new Event("input"));
        $("blocImport").style.display = "none";
        status((fusion.length - actuels.length) + " nouveaux mots ajoutés.", "ok");
      };
    };
  }

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
    if (data.session) {
      $("loginCard").style.display="none"; $("panel").style.display="block";
      remplirSelectThemes();
      lancerAvecDB("bordContenu", chargerBord);
    } else { $("loginCard").style.display="block"; $("panel").style.display="none"; }
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

  // ---------- Liste déroulante des thèmes ----------
  async function remplirSelectThemes() {
    const sel = $("chTheme");
    if (!sel) return;
    const base = await db();
    if (!base) return;
    const ent = await entrepriseId();
    if (!ent) return;
    const { data } = await base.from("themes").select("id, nom").eq("entreprise_id", ent).order("nom");
    themesCache = data || [];
    const courant = sel.value;
    sel.innerHTML = '<option value="">— Choisir un thème existant —</option>'
      + themesCache.map(t => '<option value="' + t.id + '">' + esc(t.nom) + '</option>').join("");
    if (courant) sel.value = courant;
    // Masquer le bloc "nouveau thème" si un thème est choisi
    sel.onchange = () => {
      const bloc = $("blocNouveauTheme");
      if (bloc) bloc.style.display = sel.value ? "none" : "block";
    };
  }

  // ---------- Créer / modifier un chapitre ----------
  $("btnSauver").addEventListener("click", async () => {
    const themeId = $("chTheme").value;
    const themeNom = $("chThemeNom").value.trim();
    const themeDesc = $("chThemeDesc").value.trim();
    const nom = $("chNom").value.trim();
    const ordre = parseInt($("chOrdre").value, 10) || 1;
    const mots = motsDepuisTexte($("chMots").value);

    if (!themeId && themeNom.length < 2) { status("Choisis un thème ou donne un nom au nouveau thème.", "err"); return; }
    if (nom.length < 2) { status("Donne un nom au chapitre.", "err"); return; }
    if (mots.length < 20) { status("Il faut au moins 20 mots (tu en as " + mots.length + ").", "err"); return; }

    status("Enregistrement…", "");
    const base = await db();
    const ent = await entrepriseId();
    if (!base || !ent) { status("Connexion impossible.", "err"); return; }

    // Créer le thème si nécessaire
    let idTheme = themeId;
    if (!idTheme) {
      const { data, error } = await base.from("themes")
        .insert({ entreprise_id: ent, nom: themeNom, description: themeDesc || null, mots: [], publie: true })
        .select("id").single();
      if (error) { status("Erreur thème : " + error.message, "err"); return; }
      idTheme = data.id;
    }

    const donnees = { entreprise_id: ent, theme_id: idTheme, nom, ordre, mots, publie: true };
    let error;
    if (editId) ({ error } = await base.from("chapitres").update(donnees).eq("id", editId));
    else ({ error } = await base.from("chapitres").insert(donnees));

    if (error) { status("Erreur : " + error.message, "err"); return; }
    status(editId ? "Chapitre modifié !" : "Chapitre publié !", "ok");
    reset();
    remplirSelectThemes();
  });

  $("btnAnnuler").addEventListener("click", reset);

  function reset() {
    editId = null;
    $("chTheme").value = ""; $("chThemeNom").value = ""; $("chThemeDesc").value = "";
    $("chNom").value = ""; $("chOrdre").value = "1"; $("chMots").value = "";
    $("compteMots").textContent = "0 mot";
    $("compteMots").style.background = "var(--violet-glow)";
    $("compteMots").style.color = "var(--violet-c)";
    $("formTitre").textContent = "Nouveau chapitre";
    $("btnSauver").textContent = "Publier le chapitre";
    $("btnAnnuler").style.display = "none";
    const bloc = $("blocNouveauTheme"); if (bloc) bloc.style.display = "block";
  }

  // ---------- Thèmes et chapitres ----------
  async function chargerThemes() {
    const box = $("themesList");
    try {
      const base = await db();
      const ent = await entrepriseId();
      if (!ent) { box.innerHTML = "<p class='empty'>Entreprise BiZouk introuvable. Vérifie le SQL.</p>"; return; }

      const [rT, rC] = await Promise.all([
        base.from("themes").select("*").eq("entreprise_id", ent).order("nom"),
        base.from("chapitres").select("*").eq("entreprise_id", ent).order("ordre")
      ]);
      if (rT.error) {
        box.innerHTML = "<p class='empty' style='color:#fca5a5'>Erreur : " + esc(rT.error.message)
          + "<br><br>Si le message parle de permissions, ton compte n'est pas relié à BiZouk.</p>";
        return;
      }
      const themes = rT.data || [];
      const chaps = rC.data || [];
      if (!themes.length) { box.innerHTML = "<p class='empty'>Aucun thème. Crée le premier chapitre dans l'onglet « Créer un chapitre ».</p>"; return; }

      box.innerHTML = themes.map(t => {
        const mesChaps = chaps.filter(c => c.theme_id === t.id).sort((a,b)=>(a.ordre||0)-(b.ordre||0));
        return '<div style="margin-bottom:26px">'
          + '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px;flex-wrap:wrap">'
          + '<h3 style="font-family:var(--serif);font-size:1.2rem;color:var(--blanc)">' + esc(t.nom)
          + ' <span style="font-size:.8rem;color:var(--texte-faible);font-weight:400">' + mesChaps.length + ' chapitre(s)</span></h3>'
          + '<button class="ti-act sup" data-supth="' + t.id + '" style="font-family:inherit;font-weight:600;font-size:.78rem;padding:6px 12px;border-radius:8px;cursor:pointer;border:1px solid var(--rouge);background:none;color:#fca5a5">Supprimer le thème</button>'
          + '</div>'
          + (mesChaps.length
              ? mesChaps.map(c => {
                  const nb = Array.isArray(c.mots) ? c.mots.length : 0;
                  const apercu = Array.isArray(c.mots) ? c.mots.slice(0,6).join(" · ") : "";
                  const ok = nb >= 20;
                  return '<div class="theme-item">'
                    + '<div class="ti-nom">' + c.ordre + '. ' + esc(c.nom) + '</div>'
                    + '<div class="ti-meta"><span class="compte-mots">' + nb + ' mots</span> · '
                    + (ok ? 'Découverte + Confirmé + Bombe' : '<span style="color:#fca5a5">trop peu de mots</span>')
                    + ' · ' + dateFr(c.created_at) + '</div>'
                    + (apercu ? '<div class="ti-apercu">' + esc(apercu) + (nb > 6 ? ' …' : '') + '</div>' : '')
                    + '<div class="ti-act">'
                    + '<button class="mod" data-mod="' + c.id + '">Modifier</button>'
                    + '<button class="sup" data-sup="' + c.id + '">Supprimer</button>'
                    + '</div></div>';
                }).join("")
              : '<p style="color:var(--texte-faible);font-style:italic;font-size:.88rem;padding:10px 0">Aucun chapitre dans ce thème.</p>')
          + '</div>';
      }).join("");

      box.querySelectorAll("[data-mod]").forEach(b =>
        b.onclick = () => modifier(chaps.find(x => x.id === b.getAttribute("data-mod"))));
      box.querySelectorAll("[data-sup]").forEach(b =>
        b.onclick = () => supprimerChapitre(b.getAttribute("data-sup")));
      box.querySelectorAll("[data-supth]").forEach(b =>
        b.onclick = () => supprimerTheme(b.getAttribute("data-supth")));
    } catch (e) {
      box.innerHTML = "<p class='empty' style='color:#fca5a5'>Erreur : " + esc(String(e && e.message || e)) + "</p>";
    }
  }

  function modifier(c) {
    if (!c) return;
    editId = c.id;
    $("chTheme").value = c.theme_id || "";
    const bloc = $("blocNouveauTheme"); if (bloc) bloc.style.display = "none";
    $("chNom").value = c.nom || "";
    $("chOrdre").value = c.ordre || 1;
    $("chMots").value = Array.isArray(c.mots) ? c.mots.join("\n") : "";
    $("chMots").dispatchEvent(new Event("input"));
    $("formTitre").textContent = "Modifier le chapitre";
    $("btnSauver").textContent = "Enregistrer les modifications";
    $("btnAnnuler").style.display = "inline-flex";
    document.querySelector('.adm-tab[data-tab="creer"]').click();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function supprimerChapitre(id) {
    if (!confirm("Supprimer ce chapitre définitivement ?")) return;
    const base = await db();
    const { error } = await base.from("chapitres").delete().eq("id", id);
    if (error) { status("Suppression impossible : " + error.message, "err"); return; }
    status("Chapitre supprimé.", "ok");
    chargerThemes();
  }

  async function supprimerTheme(id) {
    if (!confirm("Supprimer ce thème ET tous ses chapitres ?\n\nCette action est définitive.")) return;
    const base = await db();
    const { error } = await base.from("themes").delete().eq("id", id);
    if (error) { status("Suppression impossible : " + error.message, "err"); return; }
    status("Thème supprimé.", "ok");
    chargerThemes();
    remplirSelectThemes();
  }

  // ---------- Contributions ----------
  async function chargerContributions() {
    const box = $("contribList");
    try {
      const base = await db();
      const ent = await entrepriseId();
      const { data, error } = await base.from("bizouk_contributions").select("*")
        .eq("entreprise_id", ent).eq("statut","a_verifier").order("created_at",{ascending:false});
      if (error) { box.innerHTML = "<p class='empty' style='color:#fca5a5'>Erreur : " + esc(error.message) + "</p>"; return; }
      if (!data.length) { box.innerHTML = "<p class='empty'>Aucune proposition à examiner.</p>"; return; }

      box.innerHTML = data.map(c => {
        const nb = motsDepuisTexte(c.mots).length;
        return '<div class="theme-item">'
          + '<div class="ti-nom">' + esc(c.theme) + (c.chapitre ? ' · ' + esc(c.chapitre) : '') + '</div>'
          + '<div class="ti-meta">Par ' + esc(c.auteur) + (c.contact ? ' · ' + esc(c.contact) : '')
          + ' · <span class="compte-mots">' + nb + ' mots</span> · ' + dateFr(c.created_at) + '</div>'
          + '<div class="ti-apercu">' + esc(motsDepuisTexte(c.mots).slice(0,10).join(" · ")) + (nb > 10 ? ' …' : '') + '</div>'
          + '<div class="ti-act">'
          + '<button class="mod" data-reprendre="' + c.id + '">Reprendre dans le formulaire</button>'
          + '<button class="ok" data-recompenser="' + c.id + '" style="border-color:var(--vert);color:#6ee7b7">Accepter · +50 pierres</button>'
          + '<button class="sup" data-rejeter="' + c.id + '">Rejeter</button>'
          + '</div></div>';
      }).join("");

      box.querySelectorAll("[data-reprendre]").forEach(b =>
        b.onclick = () => reprendre(data.find(x => x.id === b.getAttribute("data-reprendre"))));
      box.querySelectorAll("[data-rejeter]").forEach(b =>
        b.onclick = () => rejeter(b.getAttribute("data-rejeter")));
      box.querySelectorAll("[data-recompenser]").forEach(b =>
        b.onclick = () => recompenser(data.find(x => x.id === b.getAttribute("data-recompenser"))));
    } catch (e) {
      box.innerHTML = "<p class='empty' style='color:#fca5a5'>Erreur : " + esc(String(e && e.message || e)) + "</p>";
    }
  }

  function reprendre(c) {
    if (!c) return;
    editId = null;
    $("chTheme").value = "";
    const bloc = $("blocNouveauTheme"); if (bloc) bloc.style.display = "block";
    $("chThemeNom").value = c.theme || "";
    $("chNom").value = c.chapitre || "Chapitre 1";
    $("chMots").value = motsDepuisTexte(c.mots).join("\n");
    $("chMots").dispatchEvent(new Event("input"));
    $("formTitre").textContent = "Chapitre proposé par " + (c.auteur || "un joueur");
    document.querySelector('.adm-tab[data-tab="creer"]').click();
    window.scrollTo({ top: 0, behavior: "smooth" });
    status("Proposition chargée. Vérifie et publie.", "ok");
  }

  async function recompenser(c) {
    if (!c) return;
    const email = (c.contact || "").trim();
    if (!email || email.indexOf("@") < 0) {
      alert("Ce contributeur n'a pas indiqué d'email de compte.\n\nImpossible de le créditer automatiquement.");
      return;
    }
    if (!confirm("Accepter cette proposition et créditer 50 pierres BiZouk à " + (c.auteur||"ce contributeur") + " ?\n\nCompte : " + email)) return;

    const base = await db();
    const { data, error } = await base.rpc("crediter_contributeur", { email_cible: email, nb_pierres: 50 });

    if (error) {
      status("Crédit impossible : " + error.message, "err");
      return;
    }
    if (data === "compte_introuvable") {
      const suite = confirm(
        "Aucun compte BiZouk n'existe pour « " + email + " ».\n\n"
        + "Le contributeur doit d'abord créer son compte.\n\n"
        + "Marquer quand même la proposition comme acceptée ?");
      if (!suite) return;
      await base.from("bizouk_contributions").update({ statut: "accepte_sans_credit" }).eq("id", c.id);
      status("Proposition acceptée. Contributeur à créditer plus tard (pas de compte).", "err");
      chargerContributions();
      return;
    }

    await base.from("bizouk_contributions").update({ statut: "accepte" }).eq("id", c.id);
    status("Proposition acceptée · 50 pierres créditées à " + esc(c.auteur) + " !", "ok");
    chargerContributions();
  }

  async function rejeter(id) {
    if (!confirm("Rejeter cette proposition ?")) return;
    const base = await db();
    await base.from("bizouk_contributions").update({ statut:"rejete" }).eq("id", id);
    status("Proposition rejetée.", "ok");
    chargerContributions();
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
      if (!data.length) { box.innerHTML = "<p class='empty'>Aucune partie enregistrée.</p>"; return; }

      const fmt = s => Math.floor(s/60) + ":" + String(s%60).padStart(2,"0");
      box.innerHTML =
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px">'
        + '<span style="color:var(--texte-doux);font-size:.9rem">' + data.length + ' partie(s)</span>'
        + '<button class="btn btn-g btn-sm" id="viderParties" style="border-color:var(--rouge);color:#fca5a5">Tout effacer</button>'
        + '</div>'
        + data.map(p =>
          '<div class="theme-item" style="border-left-color:var(--or)">'
          + '<div class="ti-nom">' + esc(p.joueur || "Joueur") + ' · <span style="color:var(--or)">' + fmt(p.temps_sec) + '</span></div>'
          + '<div class="ti-meta">' + esc(p.chapitre_nom || p.theme_nom || "—") + ' · niveau ' + p.niveau
          + ' · ' + p.mots_total + ' mots · ' + dateFr(p.created_at) + '</div>'
          + '<div class="ti-act"><button class="sup" data-delp="' + p.id + '">Supprimer</button></div>'
          + '</div>'
        ).join("");

      box.querySelectorAll("[data-delp]").forEach(b =>
        b.onclick = () => supprimerPartie(b.getAttribute("data-delp")));
      const v = $("viderParties");
      if (v) v.onclick = () => viderToutesParties();
    } catch (e) {
      box.innerHTML = "<p class='empty' style='color:#fca5a5'>Erreur : " + esc(String(e && e.message || e)) + "</p>";
    }
  }

  async function supprimerPartie(id) {
    if (!confirm("Supprimer ce score ?")) return;
    const base = await db();
    const { error } = await base.from("parties").delete().eq("id", id);
    if (error) { status("Suppression impossible : " + error.message, "err"); return; }
    status("Score supprimé.", "ok");
    chargerParties();
  }

  async function viderToutesParties() {
    if (!confirm("Effacer TOUS les scores ?\n\nCette action est définitive.")) return;
    if (!confirm("Vraiment sûr ? Le classement sera vidé.")) return;
    const base = await db();
    const ent = await entrepriseId();
    const { error } = await base.from("parties").delete().eq("entreprise_id", ent);
    if (error) { status("Suppression impossible : " + error.message, "err"); return; }
    status("Tous les scores effacés.", "ok");
    chargerParties();
  }

  refreshAuth();
})();

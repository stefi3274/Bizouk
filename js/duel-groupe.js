/* BiZouk — duel de groupe : un lien partagé en chaîne, classement final au bout d'un délai */
(function () {
  const $ = id => document.getElementById(id);
  async function db() { return window.DB || (window.attendreDB ? await window.attendreDB(8000) : null); }
  const esc = s => (s || "").replace(/[&<>"']/g, c => (
    { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
  const fmt = s => Math.floor(s/60) + ":" + String(Math.max(0,s)%60).padStart(2,"0");
  const MEDAILLES = ["🥇","🥈","🥉"];
  const RECOMPENSES = [5, 3, 1];

  const code = new URLSearchParams(location.search).get("code");
  let monId = null, monNom = "";

  async function moi() {
    const base = await db();
    if (!base) return;
    const { data } = await base.auth.getSession();
    if (data.session) {
      monId = data.session.user.id;
      monNom = (data.session.user.user_metadata && data.session.user.user_metadata.nom) || "";
      const nav = $("navAuth");
      if (nav) { nav.textContent = "Mon compte"; nav.href = "compte.html"; }
    }
  }

  function lienDuel(c) { return location.origin + "/duel-groupe.html?code=" + c; }

  async function init() {
    await moi();
    if (!code) { initCreation(); return; }
    await ouvrirDuel();
  }

  // ---------- Création ----------
  async function initCreation() {
    $("ecranCreation").style.display = "block";
    const base = await db();
    const ent = await window.entrepriseId();
    const sel = $("selChapitre");
    if (!base || !ent) { sel.innerHTML = '<option value="">Connexion impossible</option>'; return; }

    const [rC, rT] = await Promise.all([
      base.from("chapitres").select("id, theme_id, nom, mots").eq("entreprise_id", ent).eq("publie", true).order("nom"),
      base.from("themes").select("id, nom").eq("entreprise_id", ent)
    ]);
    const chaps = (rC.data || []).filter(c => Array.isArray(c.mots) && c.mots.length >= 10);
    const nomTheme = {};
    (rT.data || []).forEach(t => nomTheme[t.id] = t.nom);

    if (!chaps.length) { sel.innerHTML = '<option value="">Aucune grille disponible</option>'; return; }
    sel.innerHTML = chaps.map(c =>
      '<option value="' + c.id + '">' + esc(c.nom) + (nomTheme[c.theme_id] ? " · " + esc(nomTheme[c.theme_id]) : "") + '</option>'
    ).join("");

    $("btnCreer").onclick = async () => {
      if (!monId) { location.href = "connexion.html?retour=duel-groupe.html"; return; }
      const chapId = sel.value;
      const chap = chaps.find(c => c.id === chapId);
      if (!chap) { alert("Choisis une grille."); return; }
      const niveau = parseInt($("selNiveau").value, 10);
      const heures = parseInt($("selDuree").value, 10);
      const MOTS_NIV = { 1:6, 2:7, 3:8, 4:9, 5:10 };
      const n = MOTS_NIV[niveau] || 10;

      const mots = melanger(chap.mots).slice(0, n);
      const expireA = new Date(Date.now() + heures * 3600 * 1000).toISOString();

      $("btnCreer").disabled = true; $("btnCreer").textContent = "Création…";
      const dCode = await creerCode(base, ent, {
        chapitre_id: chap.id, chapitre_nom: chap.nom, niveau, mots,
        createur_id: monId, createur_nom: monNom || "Un joueur", expire_a: expireA
      });
      if (!dCode) { alert("Impossible de créer le duel."); $("btnCreer").disabled = false; $("btnCreer").textContent = "Créer le duel de groupe"; return; }
      location.href = "duel-groupe.html?code=" + dCode;
    };
  }

  function melanger(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
    return a;
  }

  async function creerCode(base, ent, champs) {
    const lettres = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    for (let essai = 0; essai < 6; essai++) {
      let c = ""; for (let i=0;i<6;i++) c += lettres[Math.floor(Math.random()*lettres.length)];
      const { error } = await base.from("duels_groupe").insert(Object.assign({ entreprise_id: ent, code: c }, champs));
      if (!error) return c;
    }
    return null;
  }

  // ---------- Ouverture d'un duel existant ----------
  async function ouvrirDuel() {
    const base = await db();
    const { data: duel } = await base.from("duels_groupe").select("*").eq("code", code).maybeSingle();
    if (!duel) {
      $("ecranJoindre").style.display = "block";
      $("joinTitre").textContent = "Duel introuvable";
      $("joinCarte").innerHTML = '<a href="duel-groupe.html" class="btn btn-v btn-sm">Créer un nouveau duel</a>';
      return;
    }

    const { data: participants } = await base.from("duels_groupe_participants")
      .select("*").eq("duel_groupe_id", duel.id).order("temps_sec", { ascending: true, nullsFirst: false });

    const expire = new Date(duel.expire_a);
    const termine = Date.now() > expire.getTime();

    if (termine) { afficherClassement(duel, participants || []); return; }

    const monParticipation = monId ? (participants || []).find(p => p.user_id === monId) : null;

    $("ecranJoindre").style.display = "block";
    $("joinTitre").textContent = esc(duel.createur_nom) + " te défie !";
    $("joinSous").textContent = (duel.chapitre_nom || "Grille") + " · " + (participants||[]).length + " participant"
      + ((participants||[]).length > 1 ? "s" : "") + " · se termine " + relatif(expire);

    if (!monId) {
      $("joinCarte").innerHTML = '<p style="color:var(--texte-doux);margin-bottom:14px">Connecte-toi pour participer.</p>'
        + '<a href="connexion.html?retour=' + encodeURIComponent(location.href) + '" class="btn btn-v btn-sm">Se connecter</a>';
      return;
    }

    if (monParticipation && monParticipation.temps_sec != null) {
      $("joinCarte").innerHTML = '<p style="color:var(--vert);font-weight:600;margin-bottom:6px">Tu as déjà joué</p>'
        + '<p style="font-family:var(--serif);font-size:1.6rem;color:var(--blanc);margin-bottom:14px">' + fmt(monParticipation.temps_sec) + '</p>'
        + '<p style="color:var(--texte-faible);font-size:.88rem;margin-bottom:14px">Le classement final sera visible ' + relatif(expire) + '.</p>'
        + '<button class="btn btn-g btn-sm" id="btnPartagerAvant">Partager à d\'autres</button>'
        + '<div class="partage-liens" id="partageAvantLiens"></div>';
      brancherPartage($("btnPartagerAvant"), $("partageAvantLiens"), duel);
      return;
    }

    $("joinCarte").innerHTML = '<p style="color:var(--texte-doux);margin-bottom:16px">Une seule tentative compte. Prêt ?</p>'
      + '<button class="btn btn-v" id="btnJouerGroupe" style="width:100%;margin-bottom:10px">Jouer la grille</button>'
      + '<button class="btn btn-g btn-sm" id="btnPartagerAvant" style="width:100%">Partager à d\'autres avant de jouer</button>'
      + '<div class="partage-liens" id="partageAvantLiens"></div>';

    $("btnJouerGroupe").onclick = () => jouer(duel);
    brancherPartage($("btnPartagerAvant"), $("partageAvantLiens"), duel);
  }

  function relatif(date) {
    const ms = date.getTime() - Date.now();
    const h = Math.round(ms / 3600000);
    if (h < 1) return "dans moins d'une heure";
    if (h < 24) return "dans " + h + "h";
    return "dans " + Math.round(h/24) + " jour" + (Math.round(h/24) > 1 ? "s" : "");
  }

  function brancherPartage(bouton, zone, duel) {
    if (!bouton) return;
    bouton.onclick = () => {
      const lien = lienDuel(duel.code);
      const txt = encodeURIComponent(esc(duel.createur_nom) + " te défie sur BiZouk (et toi, tu peux défier d'autres) ! ");
      const u = encodeURIComponent(lien);
      zone.innerHTML = '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:12px">'
        + '<a class="share-btn share-wa" href="https://wa.me/?text=' + txt + '%20' + u + '" target="_blank" rel="noopener">WhatsApp</a>'
        + '<a class="share-btn share-tg" href="https://t.me/share/url?url=' + u + '&text=' + txt + '" target="_blank" rel="noopener">Telegram</a>'
        + '<button class="share-btn" id="copierGroupe" style="background:var(--violet)">Copier le lien</button></div>';
      const cp = $("copierGroupe");
      if (cp) cp.onclick = async () => {
        try { await navigator.clipboard.writeText(lien); cp.textContent = "Copié ✓"; } catch (e) {}
      };
    };
  }

  // ---------- Jouer la grille ----------
  let debut = null, minuteur = null, fini = false, totalMots = 0, duelActif = null;

  function jouer(duel) {
    duelActif = duel;
    $("ecranJoindre").style.display = "none";
    $("ecranJeu").style.display = "block";
    $("jeuTitre").textContent = duel.chapitre_nom || "Duel de groupe";
    $("jeuMeta").textContent = "Contre " + esc(duel.createur_nom) + " et le groupe";

    const jeu = window.BiZouk.creerJeu({
      conteneur: $("grille"),
      listeMots: $("motsListe"),
      surTrouve: (m, tr, total) => { $("statTrouves").textContent = tr; $("statRestants").textContent = total - tr; },
      surVictoire: () => terminerPartie()
    });

    const pz = jeu.charger(duel.mots, 9, null, 12);
    totalMots = pz ? pz.placements.length : duel.mots.length;
    $("statRestants").textContent = totalMots;

    debut = Date.now(); fini = false;
    minuteur = setInterval(() => {
      if (fini) return;
      $("chrono").textContent = fmt(Math.floor((Date.now()-debut)/1000));
    }, 1000);
  }

  async function terminerPartie() {
    if (fini) return;
    fini = true;
    clearInterval(minuteur);
    const t = Math.floor((Date.now() - debut) / 1000);
    const base = await db();

    await base.from("duels_groupe_participants").upsert({
      duel_groupe_id: duelActif.id, user_id: monId, joueur: monNom || "Un joueur", temps_sec: t
    }, { onConflict: "duel_groupe_id,user_id" });

    if (window.BiZoukAnalytics) window.BiZoukAnalytics.evenement("partie_terminee", { mode: "duel_groupe" });

    $("ecranJeu").style.display = "none";
    $("resEmoji").textContent = "⏱️";
    $("resTitre").textContent = "Temps enregistré";
    $("resSous").textContent = fmt(t) + " — le classement sera visible " + relatif(new Date(duelActif.expire_a));
    $("resContenu").innerHTML = "";
    $("resultat").classList.add("on");
    brancherPartage($("btnPartagerGroupe"), $("partageGroupeLiens"), duelActif);
  }

  // ---------- Classement final ----------
  function afficherClassement(duel, participants) {
    $("resEmoji").textContent = "🏆";
    $("resTitre").textContent = "Classement final";
    $("resSous").textContent = (duel.chapitre_nom || "Grille") + " · " + participants.length + " participant" + (participants.length>1?"s":"");

    const tries = participants.filter(p => p.temps_sec != null);
    $("resContenu").innerHTML = tries.length
      ? tries.map((p, i) =>
          '<div class="theme-ligne" style="border-bottom:1px solid var(--gris-3);padding:10px 0">'
          + '<span>' + (i < 3 ? MEDAILLES[i] + ' ' : (i+1) + '. ') + esc(p.joueur) + (p.user_id === monId ? ' (toi)' : '') + '</span>'
          + '<span style="font-family:var(--serif);font-weight:700;color:var(--violet-c)">' + fmt(p.temps_sec) + '</span>'
          + '</div>'
        ).join("")
      : '<p style="color:var(--texte-faible);font-style:italic;text-align:center">Personne n\'a encore joué.</p>';

    // Réclamation de récompense pour le top 3
    const monRang = tries.findIndex(p => p.user_id === monId);
    if (monId && monRang >= 0 && monRang < 3) {
      const moi_ = tries[monRang];
      const zone = document.createElement("div");
      zone.style.marginTop = "14px"; zone.style.textAlign = "center";
      if (moi_.recompense_reclamee) {
        zone.innerHTML = '<p style="color:var(--vert);font-weight:600;font-size:.9rem">✓ Récompense réclamée</p>';
      } else {
        zone.innerHTML = '<button class="btn btn-v btn-sm" id="btnReclamerGroupe">Réclamer tes ' + RECOMPENSES[monRang] + ' pierres BiZouk</button>';
      }
      $("resContenu").appendChild(zone);
      const br = $("btnReclamerGroupe");
      if (br) br.onclick = async () => {
        br.disabled = true; br.textContent = "…";
        const base = await db();
        if (window.Progression) {
          await window.Progression.init();
          await window.Progression.ajouterBadge(MEDAILLES[monRang] + " Duel de groupe", RECOMPENSES[monRang]);
        }
        await base.from("duels_groupe_participants").update({ recompense_reclamee: true }).eq("id", moi_.id);
        afficherClassement(duel, tries.map(p => p.id === moi_.id ? Object.assign({}, p, { recompense_reclamee: true }) : p));
      };
    }

    if (window.BiZoukConfetti && monRang === 0) window.BiZoukConfetti.lancer(2000, 1.2);
    brancherPartage($("btnPartagerGroupe"), $("partageGroupeLiens"), duel);
    $("resultat").classList.add("on");
  }

  init();
})();
